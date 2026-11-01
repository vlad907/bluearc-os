import { Prisma } from "@prisma/client";

import {
  accessTokenForConnection,
  getGmailMessage,
  listGmailMessageIds,
  normalizeGmailMessage,
} from "@/lib/gmail/client";
import { classifyInboundEmail } from "@/lib/mailbox/classification";
import { resolveMailboxLinks } from "@/lib/mailbox/linking";
import { prisma } from "@/lib/prisma";

export function clampGmailSyncMaxResults(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(numeric), 1), 50);
}

export function gmailSyncQuery(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "newer_than:30d -in:spam -in:trash";
}

export async function syncGmailMailbox(params: {
  organizationId: string;
  userId: string;
  connectionId?: string | null;
  query?: unknown;
  maxResults?: unknown;
}) {
  const connection = await prisma.gmailConnection.findFirst({
    where: {
      organizationId: params.organizationId,
      userId: params.userId,
      status: "connected",
      ...(params.connectionId ? { id: params.connectionId } : {}),
    },
    orderBy: { connectedAt: "desc" },
  });

  if (!connection) {
    throw new Error("No connected Gmail account found for this user/workspace");
  }

  try {
    const accessToken = await accessTokenForConnection(connection);
    const messageRefs = await listGmailMessageIds({
      accessToken,
      query: gmailSyncQuery(params.query),
      maxResults: clampGmailSyncMaxResults(params.maxResults),
    });

    let importedMessages = 0;
    let importedThreads = 0;
    let skippedMessages = 0;

    for (const messageRef of messageRefs) {
      const message = await getGmailMessage(accessToken, messageRef.id);
      const normalized = normalizeGmailMessage(message, connection.email);
      const classification = normalized.direction === "inbound" ? classifyInboundEmail(normalized.body) : null;
      const mailboxLinks = await resolveMailboxLinks({
        organizationId: params.organizationId,
        direction: normalized.direction,
        fromEmail: normalized.fromEmail,
        toEmail: normalized.toEmail,
      });

      const existingMessage = await prisma.emailMessage.findUnique({
        where: {
          organizationId_providerMessageId: {
            organizationId: params.organizationId,
            providerMessageId: normalized.providerMessageId,
          },
        },
        select: { id: true },
      });

      if (existingMessage) {
        skippedMessages += 1;
        continue;
      }

      const existingThread = await prisma.emailThread.findUnique({
        where: {
          organizationId_provider_providerThreadId: {
            organizationId: params.organizationId,
            provider: "gmail",
            providerThreadId: normalized.providerThreadId,
          },
        },
        select: { id: true, companyId: true, contactId: true, metadata: true },
      });

      const thread = existingThread
        ? await prisma.emailThread.update({
            where: { id: existingThread.id },
            data: {
              companyId: existingThread.companyId ?? mailboxLinks.companyId,
              contactId: existingThread.contactId ?? mailboxLinks.contactId,
              subject: normalized.subject,
              classification: classification ?? undefined,
              lastMessageAt: normalized.receivedAt,
              status: classification && classification !== "unknown" ? "needs_reply" : undefined,
              metadata: {
                ...((existingThread.metadata as Prisma.JsonObject | null) ?? {}),
                ...mailboxLinks.metadata,
              },
            },
            select: { id: true },
          })
        : await prisma.emailThread.create({
            data: {
              organizationId: params.organizationId,
              provider: "gmail",
              providerThreadId: normalized.providerThreadId,
              subject: normalized.subject,
              status: classification && classification !== "unknown" ? "needs_reply" : "open",
              classification,
              lastMessageAt: normalized.receivedAt,
              companyId: mailboxLinks.companyId,
              contactId: mailboxLinks.contactId,
              metadata: mailboxLinks.metadata,
            },
            select: { id: true },
          });

      if (!existingThread) {
        importedThreads += 1;
      }

      await prisma.emailMessage.create({
        data: {
          organizationId: params.organizationId,
          threadId: thread.id,
          providerMessageId: normalized.providerMessageId,
          direction: normalized.direction,
          fromEmail: normalized.fromEmail,
          toEmail: normalized.toEmail,
          subject: normalized.subject,
          body: normalized.body,
          classification,
          receivedAt: normalized.direction === "inbound" ? normalized.receivedAt : null,
          sentAt: normalized.direction === "outbound" ? normalized.receivedAt : null,
          metadata: {
            ...normalized.metadata,
            ...mailboxLinks.metadata,
          },
        },
      });
      importedMessages += 1;
    }

    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });

    return {
      connection: {
        id: connection.id,
        email: connection.email,
      },
      counts: {
        scanned: messageRefs.length,
        importedThreads,
        importedMessages,
        skippedMessages,
      },
    };
  } catch (error) {
    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: { lastError: error instanceof Error ? error.message.slice(0, 500) : "Gmail sync failed" },
    });

    throw error;
  }
}
