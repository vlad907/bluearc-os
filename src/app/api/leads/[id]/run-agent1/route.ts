import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { resolveWorkspace } from "@/lib/auth/workspace";
import { runLeadAgent1Research } from "@/lib/agents/lead-research";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type RunAgentBody = {
  organizationId?: unknown;
  snapshotId?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as RunAgentBody;
  } catch {
    return {};
  }
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Lead not found") {
      return jsonError("Lead not found", 404);
    }

    if (error.message === "Run website ingestion before Agent 1 research") {
      return jsonError(error.message, 400);
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Lead not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  try {
    const result = await runLeadAgent1Research({
      organizationId: workspace.organizationId,
      leadId: id,
      snapshotId: typeof body.snapshotId === "string" ? body.snapshotId.trim() : "",
    });

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
