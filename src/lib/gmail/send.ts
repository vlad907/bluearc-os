import { accessTokenForConnection, sendGmailDraft } from "@/lib/gmail/client";
import { prisma } from "@/lib/prisma";

export class GmailSendError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GmailSendError";
    this.status = status;
  }
}

function asJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function sendMailboxGmailDraft(params: {
  organizationId: string;
  userId: string;
  threadId: string;
}) {
  const [connection, thread] = await Promise.all([
    prisma.gmailConnection.findFirst({
      where: { organizationId: params.organizationId, userId: params.userId, status: "connected" },
      orderBy: { connectedAt: "desc" },
    }),
    prisma.emailThread.findFirst({
      where: { id: params.threadId, organizationId: params.organizationId, deletedAt: null },
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        },
      },
    }),
  ]);

  if (!connection) {
    throw new GmailSendError("No connected Gmail account found for this user/workspace");
  }

  if (!thread) {
    throw new GmailSendError("Mailbox thread not found", 404);
  }

  const sourceMessage = thread.messages.find((message) => readString(asJsonObject(message.metadata).gmailDraftId));

  if (!sourceMessage) {
    throw new GmailSendError("Create a Gmail draft before sending");
  }

  const metadata = asJsonObject(sourceMessage.metadata);
  const draftId = readString(metadata.gmailDraftId);

  if (!draftId) {
    throw new GmailSendError("Create a Gmail draft before sending");
  }

  if (readString(metadata.gmailDraftSentAt)) {
    throw new GmailSendError("This Gmail draft has already been marked sent", 409);
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
          organizationId: params.organizationId,
          providerMessageId: sentMessageId,
        },
      },
      create: {
        organizationId: params.organizationId,
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

  return {
    draftId,
    sentMessageId,
    message: updatedSourceMessage,
  };
}
