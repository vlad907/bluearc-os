import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  decodeOAuthState,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleOAuthConfig,
  GmailOAuthError,
} from "@/lib/gmail/oauth";
import { encryptToken } from "@/lib/gmail/tokens";

export const dynamic = "force-dynamic";

function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return Response.redirect(url, 302);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return redirectToSettings(request, { gmail: "error", message: oauthError });
  }

  if (!code || !state) {
    return redirectToSettings(request, { gmail: "error", message: "Missing Gmail OAuth code or state" });
  }

  try {
    const parsedState = decodeOAuthState(state);
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: parsedState.organizationId,
          userId: parsedState.userId,
        },
      },
    });

    if (!membership || membership.role === "viewer") {
      throw new GmailOAuthError("Workspace access denied for Gmail connection", 403);
    }

    const config = getGoogleOAuthConfig(request);
    const tokenPayload = await exchangeGoogleCode({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
    const userInfo = await fetchGoogleUserInfo(tokenPayload.access_token ?? "");
    const scopes = tokenPayload.scope?.split(" ").filter(Boolean) ?? [];
    const tokenExpiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + tokenPayload.expires_in * 1000)
      : null;

    await prisma.gmailConnection.upsert({
      where: {
        organizationId_userId_email: {
          organizationId: parsedState.organizationId,
          userId: parsedState.userId,
          email: userInfo.email ?? "",
        },
      },
      create: {
        organizationId: parsedState.organizationId,
        userId: parsedState.userId,
        email: userInfo.email ?? "",
        status: "connected",
        scopes,
        encryptedAccessToken: encryptToken(tokenPayload.access_token ?? ""),
        encryptedRefreshToken: tokenPayload.refresh_token ? encryptToken(tokenPayload.refresh_token) : null,
        tokenExpiresAt,
        metadata: {
          googleSubject: userInfo.sub,
          name: userInfo.name,
          picture: userInfo.picture,
        },
      },
      update: {
        status: "connected",
        scopes,
        encryptedAccessToken: encryptToken(tokenPayload.access_token ?? ""),
        encryptedRefreshToken: tokenPayload.refresh_token ? encryptToken(tokenPayload.refresh_token) : undefined,
        tokenExpiresAt,
        lastError: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        metadata: {
          googleSubject: userInfo.sub,
          name: userInfo.name,
          picture: userInfo.picture,
        },
      },
    });

    await prisma.integrationCredential.upsert({
      where: {
        organizationId_provider_kind: {
          organizationId: parsedState.organizationId,
          provider: "google_gmail",
          kind: "oauth_connection",
        },
      },
      create: {
        organizationId: parsedState.organizationId,
        provider: "google_gmail",
        kind: "oauth_connection",
        status: "connected",
        label: `Gmail: ${userInfo.email}`,
        scopes,
        connectedAt: new Date(),
        lastCheckedAt: new Date(),
      },
      update: {
        status: "connected",
        label: `Gmail: ${userInfo.email}`,
        scopes,
        connectedAt: new Date(),
        disabledAt: null,
        lastCheckedAt: new Date(),
      },
    });

    return redirectToSettings(request, { gmail: "connected", email: userInfo.email ?? "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail OAuth failed";
    const status = error instanceof GmailOAuthError ? error.status : 500;

    if (status >= 500) {
      console.error(error);
    }

    return redirectToSettings(request, { gmail: "error", message });
  }
}
