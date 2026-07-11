import { OutreachDirection, Prisma } from "@prisma/client";

import { getGoogleOAuthConfig, GoogleTokenPayload, GmailOAuthError } from "@/lib/gmail/oauth";
import { decryptToken, encryptToken } from "@/lib/gmail/tokens";
import { prisma } from "@/lib/prisma";

const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    data?: string;
    size?: number;
  };
  parts?: GmailPart[];
};

export type GmailMessage = GmailPart & {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type GmailConnectionForUse = {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
};

function base64urlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function headerValue(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ?? null;
}

function textFromPart(part?: GmailPart): string {
  if (!part) {
    return "";
  }

  if (part.mimeType === "text/plain" && part.body?.data) {
    return base64urlDecode(part.body.data);
  }

  const nested = part.parts?.map(textFromPart).find((text) => text.trim());
  if (nested) {
    return nested;
  }

  if (part.mimeType === "text/html" && part.body?.data) {
    return base64urlDecode(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
}

async function refreshAccessToken(connection: GmailConnectionForUse) {
  if (!connection.encryptedRefreshToken) {
    throw new GmailOAuthError("Gmail refresh token is missing. Disconnect and reconnect Gmail.", 401);
  }

  const config = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: decryptToken(connection.encryptedRefreshToken),
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json() as GoogleTokenPayload;

  if (!response.ok || !payload.access_token) {
    throw new GmailOAuthError(payload.error_description || payload.error || "Failed to refresh Gmail token", 502);
  }

  const tokenExpiresAt = payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null;
  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptToken(payload.access_token),
      tokenExpiresAt,
      lastError: null,
    },
  });

  return payload.access_token;
}

export async function accessTokenForConnection(connection: GmailConnectionForUse) {
  if (!connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptToken(connection.encryptedAccessToken);
  }

  return refreshAccessToken(connection);
}

async function gmailFetch<T>(accessToken: string, path: string) {
  const response = await fetch(`${GMAIL_API_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new GmailOAuthError(payload.error?.message ?? "Gmail API request failed", response.status);
  }

  return payload;
}

export async function listGmailMessageIds(params: {
  accessToken: string;
  query: string;
  maxResults: number;
}) {
  const query = new URLSearchParams({
    q: params.query,
    maxResults: String(params.maxResults),
  });
  const payload = await gmailFetch<{ messages?: Array<{ id: string; threadId: string }> }>(
    params.accessToken,
    `/messages?${query.toString()}`,
  );

  return payload.messages ?? [];
}

export async function getGmailMessage(accessToken: string, id: string) {
  const query = new URLSearchParams({ format: "full" });
  return gmailFetch<GmailMessage>(accessToken, `/messages/${encodeURIComponent(id)}?${query.toString()}`);
}

export function normalizeGmailMessage(message: GmailMessage, fallbackEmail: string) {
  const headers = message.payload?.headers ?? message.headers ?? [];
  const subject = headerValue(headers, "subject") ?? "(no subject)";
  const fromEmail = headerValue(headers, "from");
  const toEmail = headerValue(headers, "to");
  const dateHeader = headerValue(headers, "date");
  const receivedAt = message.internalDate
    ? new Date(Number(message.internalDate))
    : dateHeader
      ? new Date(dateHeader)
      : new Date();
  const body = textFromPart(message.payload ?? message) || message.snippet || "";
  const direction: OutreachDirection = fromEmail?.includes(fallbackEmail) ? "outbound" : "inbound";

  return {
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    subject,
    fromEmail,
    toEmail,
    body,
    direction,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    metadata: {
      labelIds: message.labelIds ?? [],
      snippet: message.snippet,
      gmailInternalDate: message.internalDate,
    } satisfies Prisma.JsonObject,
  };
}
