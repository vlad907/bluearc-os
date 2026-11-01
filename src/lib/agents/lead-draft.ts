import { Prisma } from "@prisma/client";

import { providerErrorMetadata, runProviderAgent2, runProviderAgent3 } from "@/lib/ai/provider-agents";
import { prisma } from "@/lib/prisma";
import { DraftMode, runDeterministicAgent2, runDeterministicAgent3 } from "@/lib/outreach/draft-agents";

function asJsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function contactName(contact: { firstName: string; lastName: string | null } | null) {
  if (!contact) {
    return null;
  }

  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

export async function generateLeadEmailDraft(params: {
  organizationId: string;
  leadId: string;
  mode: DraftMode;
}) {
  const { organizationId, leadId, mode } = params;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId, deletedAt: null },
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
    throw new Error("Lead not found");
  }

  const [workspaceProfile, workspaceAiStrategy] = await Promise.all([
    prisma.workspaceProfile.findUnique({ where: { organizationId } }),
    prisma.workspaceAiStrategy.findUnique({ where: { organizationId } }),
  ]);
  const leadMetadata = asJsonObject(lead.metadata);
  const agent1Output = asJsonObject(lead.agentResearchRuns[0]?.output);
  const agentInput = {
    mode,
    leadTitle: lead.title,
    companyName: lead.company?.name,
    contactName: contactName(lead.contact),
    websiteUrl: typeof leadMetadata.websiteUrl === "string" ? leadMetadata.websiteUrl : null,
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
        ...leadMetadata,
        latestEmailDraftId: emailDraft.id,
        latestDraftVerifierDecision: verification.decision,
      },
    },
  });

  return { emailDraft, outreach };
}
