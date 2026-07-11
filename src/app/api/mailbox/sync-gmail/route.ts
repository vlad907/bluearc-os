import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import {
  accessTokenForConnection,
  getGmailMessage,
  listGmailMessageIds,
  normalizeGmailMessage,
} from "@/lib/gmail/client";
import { GmailOAuthError } from "@/lib/gmail/oauth";
import { classifyInboundEmail } from "@/lib/mailbox/classification";
import { resolveMailboxLinks } from "@/lib/mailbox/linking";
import { prisma } from "@/lib/prisma";
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

function clampMaxResults(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(numeric), 1), 50);
}

function syncQuery(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "newer_than:30d -in:spam -in:trash";
}

function handleError(error: unknown) {
  if (error instanceof GmailOAuthError) {
    return jsonError(error.message, error.status);
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
    const connection = await prisma.gmailConnection.findFirst({
      where: {
        organizationId,
        userId,
        status: "connected",
        ...(connectionId ? { id: connectionId } : {}),
      },
      orderBy: { connectedAt: "desc" },
    });

    if (!connection) {
      return jsonError("No connected Gmail account found for this user/workspace", 400);
    }

    const accessToken = await accessTokenForConnection(connection);
    const messageRefs = await listGmailMessageIds({
      accessToken,
      query: syncQuery(body.query),
      maxResults: clampMaxResults(body.maxResults),
    });

    let importedMessages = 0;
    let importedThreads = 0;
    let skippedMessages = 0;

    for (const messageRef of messageRefs) {
      const message = await getGmailMessage(accessToken, messageRef.id);
      const normalized = normalizeGmailMessage(message, connection.email);
      const classification = normalized.direction === "inbound" ? classifyInboundEmail(normalized.body) : null;
      const mailboxLinks = await resolveMailboxLinks({
        organizationId,
        direction: normalized.direction,
        fromEmail: normalized.fromEmail,
        toEmail: normalized.toEmail,
      });

      const existingMessage = await prisma.emailMessage.findUnique({
        where: {
          organizationId_providerMessageId: {
            organizationId,
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
            organizationId,
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
              organizationId,
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
          organizationId,
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

    return Response.json({
      synced: true,
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
    });
  } catch (error) {
    if (connectionId) {
      await prisma.gmailConnection.updateMany({
        where: { id: connectionId, organizationId },
        data: { lastError: error instanceof Error ? error.message.slice(0, 500) : "Gmail sync failed" },
      });
    }

    return handleError(error);
  }
}
