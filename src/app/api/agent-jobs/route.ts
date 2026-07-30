import { AgentJobType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { requireWorkspaceRole, resolveWorkspace } from "@/lib/auth/workspace";
import { parseWebsiteUrl } from "@/lib/agents/lead-research";
import { clampGmailSyncMaxResults, gmailSyncQuery } from "@/lib/gmail/sync";
import { prisma } from "@/lib/prisma";
import { DraftMode } from "@/lib/outreach/draft-agents";

export const dynamic = "force-dynamic";

type AgentJobsBody = {
  organizationId?: unknown;
  type?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  mode?: unknown;
  url?: unknown;
  connectionId?: unknown;
  query?: unknown;
  maxResults?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as AgentJobsBody;
  } catch {
    return {};
  }
}

function parseJobType(value: unknown): AgentJobType | null {
  return value === "lead_generate_draft" ||
    value === "lead_research_website" ||
    value === "mailbox_suggest_reply" ||
    value === "gmail_sync_mailbox" ||
    value === "partner_search" ||
    value === "gmail_send_draft"
    ? value
    : null;
}

function parseMode(value: unknown): DraftMode {
  return value === "fallback" || value === "soft" || value === "partnership" ? value : "signal";
}

function handlePrismaError(error: unknown) {
  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const workspace = await resolveWorkspace(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  try {
    const jobs = await prisma.agentJob.findMany({
      where: { organizationId: workspace.organizationId },
      orderBy: { queuedAt: "desc" },
      take: 25,
    });

    return Response.json({ jobs });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const type = parseJobType(body.type);

  if (!type) {
    return jsonError("Unsupported agent job type", 400);
  }

  const workspace = type === "gmail_sync_mailbox" || type === "gmail_send_draft"
    ? await requireWorkspaceRole(request, body, ["owner", "admin", "manager", "member"])
    : await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const entityType = typeof body.entityType === "string" ? body.entityType.trim() : "";
  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";

  if ((type === "lead_generate_draft" || type === "lead_research_website") && entityType !== "lead") {
    return jsonError(`${type} jobs require entityType=lead`, 400);
  }

  if (type === "mailbox_suggest_reply" && entityType !== "email_thread") {
    return jsonError("mailbox_suggest_reply jobs require entityType=email_thread", 400);
  }

  if (type === "gmail_sync_mailbox" && entityType && entityType !== "gmail_connection") {
    return jsonError("gmail_sync_mailbox jobs require entityType=gmail_connection when entityType is provided", 400);
  }

  if (type === "partner_search" && entityType && entityType !== "workspace") {
    return jsonError("partner_search jobs require entityType=workspace when entityType is provided", 400);
  }

  if (type === "gmail_send_draft" && entityType !== "email_thread") {
    return jsonError("gmail_send_draft jobs require entityType=email_thread", 400);
  }

  if (type !== "gmail_sync_mailbox" && type !== "partner_search" && !entityId) {
    return jsonError("entityId is required", 400);
  }

  try {
    let jobEntityType = entityType;
    let jobEntityId = entityId;
    let payload: Prisma.JsonObject = {
      mode: parseMode(body.mode),
    };

    if (type === "gmail_sync_mailbox") {
      if (!("userId" in workspace) || !workspace.userId) {
        return jsonError("Sign in is required to queue Gmail sync", 401);
      }

      const connectionId = typeof body.connectionId === "string" && body.connectionId.trim()
        ? body.connectionId.trim()
        : entityId || null;
      const connection = await prisma.gmailConnection.findFirst({
        where: {
          organizationId: workspace.organizationId,
          userId: workspace.userId,
          status: "connected",
          ...(connectionId ? { id: connectionId } : {}),
        },
        orderBy: { connectedAt: "desc" },
        select: { id: true },
      });

      if (!connection) {
        return jsonError("No connected Gmail account found for this user/workspace", 400);
      }

      jobEntityType = "gmail_connection";
      jobEntityId = connection.id;
      payload = {
        userId: workspace.userId,
        connectionId: connection.id,
        query: gmailSyncQuery(body.query),
        maxResults: clampGmailSyncMaxResults(body.maxResults),
      } satisfies Prisma.JsonObject;
    } else if (type === "partner_search") {
      jobEntityType = "workspace";
      jobEntityId = workspace.organizationId;
      payload = {
        query: typeof body.query === "string" ? body.query.trim() : "",
      } satisfies Prisma.JsonObject;
    } else if (type === "gmail_send_draft") {
      if (!("userId" in workspace) || !workspace.userId) {
        return jsonError("Sign in is required to queue Gmail send", 401);
      }

      const thread = await prisma.emailThread.findFirst({
        where: { id: entityId, organizationId: workspace.organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!thread) {
        return jsonError("Mailbox thread not found", 404);
      }

      payload = {
        userId: workspace.userId,
      } satisfies Prisma.JsonObject;
    } else if (type === "mailbox_suggest_reply") {
      const thread = await prisma.emailThread.findFirst({
        where: { id: entityId, organizationId: workspace.organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!thread) {
        return jsonError("Mailbox thread not found", 404);
      }
    } else {
      const lead = await prisma.lead.findFirst({
        where: { id: entityId, organizationId: workspace.organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!lead) {
        return jsonError("Lead not found", 404);
      }
    }

    const url = type === "lead_research_website" ? parseWebsiteUrl(body.url) : null;

    if (type === "lead_research_website" && !url) {
      return jsonError("lead_research_website jobs require a valid http(s) url", 400);
    }

    if (type !== "gmail_sync_mailbox" && type !== "partner_search" && type !== "gmail_send_draft") {
      payload = {
        mode: parseMode(body.mode),
        ...(url ? { url } : {}),
      } satisfies Prisma.JsonObject;
    }

    const job = await prisma.agentJob.create({
      data: {
        organizationId: workspace.organizationId,
        type,
        entityType: jobEntityType,
        entityId: jobEntityId,
        payload,
      },
    });

    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
