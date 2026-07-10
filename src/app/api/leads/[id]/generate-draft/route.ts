import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { providerErrorMetadata, runProviderAgent2, runProviderAgent3 } from "@/lib/ai/provider-agents";
import { DraftMode, runDeterministicAgent2, runDeterministicAgent3 } from "@/lib/outreach/draft-agents";

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

function resolveOrganizationId(request: NextRequest, body?: GenerateDraftBody) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId") ??
    (typeof body?.organizationId === "string" ? body.organizationId : null);

  return organizationId?.trim() || null;
}

function parseMode(value: unknown): DraftMode {
  return value === "fallback" || value === "soft" || value === "partnership" ? value : "signal";
}

function asJsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function contactName(contact: { firstName: string; lastName: string | null } | null) {
  if (!contact) {
    return null;
  }

  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Lead not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const organizationId = resolveOrganizationId(request, body);
  const mode = parseMode(body.mode);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        company: true,
        contact: true,
        agentResearchRuns: {
          where: { agent: "agent1" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    const [workspaceProfile, workspaceAiStrategy] = await Promise.all([
      prisma.workspaceProfile.findUnique({ where: { organizationId } }),
      prisma.workspaceAiStrategy.findUnique({ where: { organizationId } }),
    ]);
    const agent1Output = asJsonObject(lead.agentResearchRuns[0]?.output);
    const agentInput = {
      mode,
      leadTitle: lead.title,
      companyName: lead.company?.name,
      contactName: contactName(lead.contact),
      websiteUrl: typeof asJsonObject(lead.metadata).websiteUrl === "string" ? asJsonObject(lead.metadata).websiteUrl as string : null,
      agent1Output,
      workspaceProfile: asJsonObject(workspaceProfile as unknown as Prisma.JsonValue),
      workspaceStrategy: workspaceAiStrategy
        ? {
          generatedStrategy: workspaceAiStrategy.generatedStrategy,
          selectedTargetCategories: workspaceAiStrategy.selectedTargetCategories,
          selectedPriorityPainPoints: workspaceAiStrategy.selectedPriorityPainPoints,
          selectedCtaStyle: workspaceAiStrategy.selectedCtaStyle,
          guardrails: workspaceAiStrategy.guardrails,
        }
        : null,
    };
    let providerFallback: Prisma.JsonObject | null = null;
    let draft = runDeterministicAgent2(agentInput);

    try {
      const providerDraft = await runProviderAgent2(organizationId, agentInput);
      if (providerDraft) {
        draft = providerDraft;
      }
    } catch (providerError) {
      providerFallback = providerErrorMetadata(providerError);
    }

    let verification = runDeterministicAgent3({
      draft,
      agent1Output,
      mode,
      workspaceProfile: asJsonObject(workspaceProfile as unknown as Prisma.JsonValue),
    });

    try {
      const providerVerification = await runProviderAgent3({
        organizationId,
        draft,
        agent1Output,
        mode,
        workspaceProfile: asJsonObject(workspaceProfile as unknown as Prisma.JsonValue),
      });
      if (providerVerification) {
        verification = providerVerification;
      }
    } catch (providerError) {
      providerFallback = {
        ...(providerFallback ?? {}),
        verifierProviderFallbackReason: providerError instanceof Error ? providerError.message : "Provider verifier call failed",
      };
    }

    const outreach = await prisma.outreach.create({
      data: {
        organizationId,
        companyId: lead.companyId,
        contactId: lead.contactId,
        leadId: lead.id,
        channel: "email",
        direction: "outbound",
        status: "draft",
        subject: verification.final_subject,
        body: verification.final_email,
        metadata: {
          source: "agent2_agent3_draft",
          verifierDecision: verification.decision,
          generationMode: draft.generationMode,
          verifierGenerationMode: verification.generationMode,
          ...providerFallback,
        },
      },
    });

    const emailDraft = await prisma.emailDraft.create({
      data: {
        organizationId,
        outreachId: outreach.id,
        companyId: lead.companyId,
        contactId: lead.contactId,
        leadId: lead.id,
        mode,
        status: "needs_review",
        subject: verification.final_subject,
        body: verification.final_email,
        usedSignal: draft.used_signal,
        verifierDecision: verification.decision,
        verifierReason: verification.reason,
        verifierEditedBody: verification.final_email,
        agent2Output: draft,
        agent3Output: verification,
        promptKey: draft.promptKey,
        promptSource: draft.promptSource,
        verifierPromptKey: verification.promptKey,
        verifierPromptSource: verification.promptSource,
        metadata: {
          generationMode: draft.generationMode,
          verifierGenerationMode: verification.generationMode,
          leadTitle: lead.title,
          ...providerFallback,
        },
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        lead: { select: { id: true, title: true } },
        outreach: { select: { id: true, status: true, subject: true } },
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        metadata: {
          ...asJsonObject(lead.metadata),
          latestEmailDraftId: emailDraft.id,
          latestDraftVerifierDecision: verification.decision,
        },
      },
    });

    return Response.json({ emailDraft, outreach }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
