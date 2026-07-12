import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { accessTokenForConnection, sendGmailDraft } from "@/lib/gmail/client";
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

function asJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function handleError(error: unknown) {
  if (error instanceof GmailOAuthError) {
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

    const sourceMessage = thread.messages.find((message) => readString(asJsonObject(message.metadata).gmailDraftId));

    if (!sourceMessage) {
      return jsonError("Create a Gmail draft before sending", 400);
    }

    const metadata = asJsonObject(sourceMessage.metadata);
    const draftId = readString(metadata.gmailDraftId);

    if (!draftId) {
      return jsonError("Create a Gmail draft before sending", 400);
    }

    if (readString(metadata.gmailDraftSentAt)) {
      return jsonError("This Gmail draft has already been marked sent", 409);
    }

    const accessToken = await accessTokenForConnection(connection);
    const sentDraft = await sendGmailDraft({ accessToken, draftId });
    const sentAt = new Date();

    const updatedSourceMessage = await prisma.emailMessage.update({
      where: { id: sourceMessage.id },
      data: {
        suggestionStatus: "sent",
        metadata: {
          ...metadata,
          gmailDraftSentAt: sentAt.toISOString(),
          gmailSentMessageId: sentDraft.message?.id ?? null,
          gmailSentThreadId: sentDraft.message?.threadId ?? null,
        },
      },
    });

    const sentMessageId = sentDraft.message?.id ?? null;
    if (sentMessageId) {
      await prisma.emailMessage.upsert({
        where: {
          organizationId_providerMessageId: {
            organizationId,
            providerMessageId: sentMessageId,
          },
        },
        create: {
          organizationId,
          threadId: thread.id,
          providerMessageId: sentMessageId,
          direction: "outbound",
          fromEmail: connection.email,
          toEmail: sourceMessage.fromEmail,
          subject: sourceMessage.suggestedSubject ?? thread.subject,
          body: sourceMessage.suggestedBody ?? "",
          sentAt,
          metadata: {
            sourceInboundMessageId: sourceMessage.id,
            gmailDraftId: draftId,
            gmailThreadId: sentDraft.message?.threadId,
            labelIds: sentDraft.message?.labelIds ?? [],
          },
        },
        update: {
          sentAt,
          metadata: {
            sourceInboundMessageId: sourceMessage.id,
            gmailDraftId: draftId,
            gmailThreadId: sentDraft.message?.threadId,
            labelIds: sentDraft.message?.labelIds ?? [],
          },
        },
      });
    }

    await prisma.emailThread.update({
      where: { id: thread.id },
      data: {
        status: "done",
        lastMessageAt: sentAt,
      },
    });

    return Response.json({
      sent: true,
      draftId,
      sentMessageId,
      message: updatedSourceMessage,
    });
  } catch (error) {
    return handleError(error);
  }
}
