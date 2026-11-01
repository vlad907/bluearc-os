import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { GmailOAuthError } from "@/lib/gmail/oauth";
import { GmailSendError, sendMailboxGmailDraft } from "@/lib/gmail/send";
import { requireWorkspaceRole } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function handleError(error: unknown) {
  if (error instanceof GmailOAuthError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof GmailSendError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Mailbox thread not found", 404);
  }

  console.error(error);
  return jsonError("Failed to send Gmail draft", 500);
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const workspace = await requireWorkspaceRole(request, body, ["owner", "admin", "manager", "member"]);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId, userId } = workspace;

  try {
    const result = await sendMailboxGmailDraft({
      organizationId,
      userId,
      threadId: id,
    });

    return Response.json({
      sent: true,
      draftId: result.draftId,
      sentMessageId: result.sentMessageId,
      message: result.message,
    });
  } catch (error) {
    return handleError(error);
  }
}
