import { NextRequest } from "next/server";
import { requireWorkspaceRole } from "@/lib/auth/workspace";
import { buildGoogleConnectUrl, encodeOAuthState, getGoogleOAuthConfig, GmailOAuthError } from "@/lib/gmail/oauth";
import { assertTokenEncryptionConfigured } from "@/lib/gmail/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspace = await requireWorkspaceRole(request, null, ["owner", "admin", "manager", "member"]);

  if ("error" in workspace) {
    return workspace.error;
  }

  try {
    assertTokenEncryptionConfigured();
    const config = getGoogleOAuthConfig(request);
    const state = encodeOAuthState({
      organizationId: workspace.organizationId,
      userId: workspace.userId,
    });
    const url = buildGoogleConnectUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
    });

    return Response.redirect(url, 302);
  } catch (error) {
    if (error instanceof GmailOAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message.includes("TOKEN_ENCRYPTION_KEY")) {
      return Response.json({ error: error.message }, { status: 503 });
    }

    console.error(error);
    return Response.json({ error: "Failed to start Gmail OAuth" }, { status: 500 });
  }
}
