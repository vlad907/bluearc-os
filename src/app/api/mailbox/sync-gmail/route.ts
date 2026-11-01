import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { GmailOAuthError } from "@/lib/gmail/oauth";
import { syncGmailMailbox } from "@/lib/gmail/sync";
import { requireWorkspaceRole } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

type SyncBody = {
  organizationId?: unknown;
  connectionId?: unknown;
  query?: unknown;
  maxResults?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as SyncBody;
  } catch {
    return {};
  }
}

function handleError(error: unknown) {
  if (error instanceof GmailOAuthError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Error && error.message === "No connected Gmail account found for this user/workspace") {
    return jsonError(error.message, 400);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return jsonError("Gmail sync hit a duplicate provider record. Try again.", 409);
  }

  console.error(error);
  return jsonError("Failed to sync Gmail mailbox", 500);
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const workspace = await requireWorkspaceRole(request, body, ["owner", "admin", "manager", "member"]);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId, userId } = workspace;
  const connectionId = typeof body.connectionId === "string" ? body.connectionId : null;

  try {
    const result = await syncGmailMailbox({
      organizationId,
      userId,
      connectionId,
      query: body.query,
      maxResults: body.maxResults,
    });

    return Response.json({
      synced: true,
      connection: result.connection,
      counts: result.counts,
    });
  } catch (error) {
    return handleError(error);
  }
}
