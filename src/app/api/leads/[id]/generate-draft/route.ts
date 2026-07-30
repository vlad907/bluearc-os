import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { generateLeadEmailDraft } from "@/lib/agents/lead-draft";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { DraftMode } from "@/lib/outreach/draft-agents";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type GenerateDraftBody = {
  organizationId?: unknown;
  mode?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as GenerateDraftBody;
  } catch {
    return {};
  }
}

function parseMode(value: unknown): DraftMode {
  return value === "fallback" || value === "soft" || value === "partnership" ? value : "signal";
}

function handleError(error: unknown) {
  if (error instanceof Error && error.message === "Lead not found") {
    return jsonError("Lead not found", 404);
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
    const result = await generateLeadEmailDraft({
      organizationId: workspace.organizationId,
      leadId: id,
      mode: parseMode(body.mode),
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
