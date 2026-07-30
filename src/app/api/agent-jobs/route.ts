import { AgentJobType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { resolveWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";
import { DraftMode } from "@/lib/outreach/draft-agents";

export const dynamic = "force-dynamic";

type AgentJobsBody = {
  organizationId?: unknown;
  type?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  mode?: unknown;
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
  return value === "lead_generate_draft" ? value : null;
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
  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const type = parseJobType(body.type);
  const entityType = typeof body.entityType === "string" ? body.entityType.trim() : "";
  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";

  if (!type) {
    return jsonError("Unsupported agent job type", 400);
  }

  if (type === "lead_generate_draft" && entityType !== "lead") {
    return jsonError("lead_generate_draft jobs require entityType=lead", 400);
  }

  if (!entityId) {
    return jsonError("entityId is required", 400);
  }

  try {
    if (type === "lead_generate_draft") {
      const lead = await prisma.lead.findFirst({
        where: { id: entityId, organizationId: workspace.organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!lead) {
        return jsonError("Lead not found", 404);
      }
    }

    const job = await prisma.agentJob.create({
      data: {
        organizationId: workspace.organizationId,
        type,
        entityType,
        entityId,
        payload: {
          mode: parseMode(body.mode),
        } satisfies Prisma.JsonObject,
      },
    });

    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
