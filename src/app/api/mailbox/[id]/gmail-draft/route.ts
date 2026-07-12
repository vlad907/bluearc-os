import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { accessTokenForConnection, createGmailDraft } from "@/lib/gmail/client";
import { GmailOAuthError } from "@/lib/gmail/oauth";
import { prisma } from "@/lib/prisma";
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

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Mailbox thread not found", 404);
  }

  console.error(error);
  return jsonError("Failed to create Gmail draft", 500);
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
    const [connection, thread] = await Promise.all([
      prisma.gmailConnection.findFirst({
        where: { organizationId, userId, status: "connected" },
        orderBy: { connectedAt: "desc" },
      }),
      prisma.emailThread.findFirst({
        where: { id, organizationId, deletedAt: null },
        include: {
          messages: {
            where: { deletedAt: null },
            orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
          },
        },
      }),
    ]);

    if (!connection) {
      return jsonError("No connected Gmail account found for this user/workspace", 400);
    }

    if (!thread) {
      return jsonError("Mailbox thread not found", 404);
    }

    const latestInbound = thread.messages.find((message) => message.direction === "inbound");

    if (!latestInbound) {
      return jsonError("Thread has no inbound message to reply to", 400);
    }

    if (!latestInbound.fromEmail) {
      return jsonError("Inbound message has no sender email", 400);
    }

    if (!latestInbound.suggestedSubject || !latestInbound.suggestedBody) {
      return jsonError("Generate a suggested reply before creating a Gmail draft", 400);
    }

    const accessToken = await accessTokenForConnection(connection);
    const draft = await createGmailDraft({
      accessToken,
      from: connection.email,
      to: latestInbound.fromEmail,
      subject: latestInbound.suggestedSubject,
      body: latestInbound.suggestedBody,
      threadId: thread.provider === "gmail" ? thread.providerThreadId : null,
    });

    const updatedMessage = await prisma.emailMessage.update({
      where: { id: latestInbound.id },
      data: {
        suggestionStatus: "drafted",
        metadata: {
          ...(latestInbound.metadata && typeof latestInbound.metadata === "object" && !Array.isArray(latestInbound.metadata)
            ? latestInbound.metadata
            : {}),
          gmailDraftId: draft.id,
          gmailDraftMessageId: draft.message?.id,
          gmailDraftThreadId: draft.message?.threadId,
          gmailDraftCreatedAt: new Date().toISOString(),
        },
      },
    });

    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { status: "drafted" },
    });

    return Response.json({
      draft: {
        id: draft.id,
        messageId: draft.message?.id ?? null,
        threadId: draft.message?.threadId ?? null,
      },
      message: updatedMessage,
    });
  } catch (error) {
    return handleError(error);
  }
}
