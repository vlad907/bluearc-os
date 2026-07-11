import { createHmac, randomBytes } from "node:crypto";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "openid",
  "email",
  "profile",
] as const;

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const STATE_MAX_AGE_SECONDS = 15 * 60;

type OAuthStatePayload = {
  organizationId: string;
  userId: string;
  nonce: string;
  iat: number;
};

export type GoogleTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export type GoogleUserInfo = {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

export class GmailOAuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GmailOAuthError";
    this.status = status;
  }
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function stateSecret() {
  return process.env.OAUTH_STATE_SECRET
    ?? process.env.TOKEN_ENCRYPTION_KEY
    ?? (process.env.NODE_ENV === "production" ? "" : "bluearc-dev-oauth-state-secret");
}

function sign(payloadSegment: string) {
  const secret = stateSecret();

  if (!secret) {
    throw new GmailOAuthError("OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY is required for Gmail OAuth state signing", 503);
  }

  return createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

export function encodeOAuthState(params: { organizationId: string; userId: string }) {
  const payload: OAuthStatePayload = {
    organizationId: params.organizationId,
    userId: params.userId,
    nonce: randomBytes(16).toString("base64url"),
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadSegment = base64url(JSON.stringify(payload));
  return `${payloadSegment}.${sign(payloadSegment)}`;
}

export function decodeOAuthState(rawState: string) {
  const [payloadSegment, signature] = rawState.split(".");

  if (!payloadSegment || !signature || signature !== sign(payloadSegment)) {
    throw new GmailOAuthError("Invalid Gmail OAuth state", 400);
  }

  const payload = JSON.parse(fromBase64url(payloadSegment)) as Partial<OAuthStatePayload>;
  const issuedAt = Number(payload.iat);

  if (!payload.organizationId || !payload.userId || !issuedAt) {
    throw new GmailOAuthError("Invalid Gmail OAuth state payload", 400);
  }

  if (Math.floor(Date.now() / 1000) - issuedAt > STATE_MAX_AGE_SECONDS) {
    throw new GmailOAuthError("Gmail OAuth state expired. Start the connect flow again.", 400);
  }

  return {
    organizationId: payload.organizationId,
    userId: payload.userId,
  };
}

export function getGoogleOAuthConfig(request?: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()
    ?? (request ? `${new URL(request.url).origin}/api/integrations/google/callback` : "");

  if (!clientId || !clientSecret || !redirectUri) {
    throw new GmailOAuthError("Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.", 503);
  }

  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleConnectUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state: params.state,
  });

  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${query.toString()}`;
}

export async function exchangeGoogleCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json() as GoogleTokenPayload;

  if (!response.ok || !payload.access_token) {
    throw new GmailOAuthError(payload.error_description || payload.error || "Google OAuth token exchange failed", 502);
  }

  return payload;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json() as GoogleUserInfo;

  if (!response.ok || !payload.email) {
    throw new GmailOAuthError("Failed to fetch Gmail account profile", 502);
  }

  return payload;
}
