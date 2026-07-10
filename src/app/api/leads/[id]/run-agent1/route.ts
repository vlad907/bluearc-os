import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { providerErrorMetadata, runProviderAgent1 } from "@/lib/ai/provider-agents";
import { runDeterministicAgent1 } from "@/lib/research/agent1";

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

function resolveOrganizationId(request: NextRequest, body?: RunAgentBody) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId") ??
    (typeof body?.organizationId === "string" ? body.organizationId : null);

  return organizationId?.trim() || null;
}

function asJsonObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return jsonError("Lead not found", 404);
    }
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const organizationId = resolveOrganizationId(request, body);
  const snapshotId = typeof body.snapshotId === "string" ? body.snapshotId.trim() : "";

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        contactId: true,
        stage: true,
        metadata: true,
      },
    });

    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    const snapshot = await prisma.websiteSnapshot.findFirst({
      where: {
        id: snapshotId || undefined,
        leadId: lead.id,
        organizationId,
      },
      orderBy: { fetchedAt: "desc" },
    });

    if (!snapshot) {
      return jsonError("Run website ingestion before Agent 1 research", 400);
    }

    let output = runDeterministicAgent1(snapshot.rawText);
    let providerFallback: Prisma.JsonObject | null = null;

    try {
      const providerOutput = await runProviderAgent1(organizationId, snapshot.rawText);
      if (providerOutput) {
        output = {
          ...output,
          ...providerOutput,
        };
      }
    } catch (providerError) {
      providerFallback = providerErrorMetadata(providerError);
    }

    const researchRun = await prisma.agentResearchRun.create({
      data: {
        organizationId,
        leadId: lead.id,
        snapshotId: snapshot.id,
        companyId: lead.companyId,
        contactId: lead.contactId,
        agent: "agent1",
        status: "completed",
        output: providerFallback ? { ...output, ...providerFallback } : output,
        promptKey: output.promptKey,
        promptSource: output.promptSource,
      },
    });

    const metadata = asJsonObject(lead.metadata);
    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        stage: lead.stage === "new" ? "evaluating" : lead.stage,
        metadata: {
          ...metadata,
          latestAgent1RunId: researchRun.id,
          latestAgent1Output: providerFallback ? { ...output, ...providerFallback } : output,
          latestSnapshotId: snapshot.id,
          researchConfidence: output.confidence_score,
          researchCompletedAt: researchRun.createdAt.toISOString(),
        },
      },
    });

    return Response.json({ researchRun, output, lead: updatedLead });
  } catch (error) {
    return handlePrismaError(error);
  }
}
