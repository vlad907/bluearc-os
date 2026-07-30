import { AgentJob, AgentJobStatus, Prisma } from "@prisma/client";

import { generateLeadEmailDraft } from "@/lib/agents/lead-draft";
import { ingestAndResearchLeadWebsite, parseWebsiteUrl } from "@/lib/agents/lead-research";
import { generateMailboxSuggestedReply } from "@/lib/agents/mailbox-reply";
import { prisma } from "@/lib/prisma";
import { DraftMode } from "@/lib/outreach/draft-agents";

function asJsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseDraftMode(value: unknown): DraftMode {
  return value === "fallback" || value === "soft" || value === "partnership" ? value : "signal";
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : "Agent job failed";
}

export async function processAgentJob(job: AgentJob) {
  const payload = asJsonObject(job.payload);

  if (job.type === "lead_research_website") {
    const url = parseWebsiteUrl(payload.url);

    if (!url) {
      throw new Error("lead_research_website job requires a valid url payload");
    }

    const result = await ingestAndResearchLeadWebsite({
      organizationId: job.organizationId,
      leadId: job.entityId,
      url,
    });

    return {
      leadId: job.entityId,
      snapshotId: result.snapshot.id,
      researchRunId: result.researchRun.id,
    } satisfies Prisma.JsonObject;
  }

  if (job.type === "mailbox_suggest_reply") {
    const result = await generateMailboxSuggestedReply({
      organizationId: job.organizationId,
      threadId: job.entityId,
    });

    return {
      threadId: result.threadId,
      messageId: result.messageId,
    } satisfies Prisma.JsonObject;
  }

  if (job.type === "lead_generate_draft") {
    const result = await generateLeadEmailDraft({
      organizationId: job.organizationId,
      leadId: job.entityId,
      mode: parseDraftMode(payload.mode),
    });

    return {
      emailDraftId: result.emailDraft.id,
      outreachId: result.outreach.id,
      leadId: job.entityId,
    } satisfies Prisma.JsonObject;
  }

  throw new Error(`Unsupported agent job type: ${job.type}`);
}

export async function claimNextAgentJob(organizationId: string) {
  const job = await prisma.agentJob.findFirst({
    where: {
      organizationId,
      status: "queued",
    },
    orderBy: { queuedAt: "asc" },
  });

  if (!job) {
    return null;
  }

  return prisma.agentJob.update({
    where: { id: job.id },
    data: {
      status: "running",
      attempts: { increment: 1 },
      startedAt: new Date(),
      error: null,
    },
  });
}

export async function completeAgentJob(jobId: string, result: Prisma.JsonObject) {
  return prisma.agentJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      result,
      completedAt: new Date(),
      error: null,
    },
  });
}

export async function failAgentJob(job: AgentJob, error: unknown) {
  const nextStatus: AgentJobStatus = job.attempts >= job.maxAttempts ? "failed" : "queued";

  return prisma.agentJob.update({
    where: { id: job.id },
    data: {
      status: nextStatus,
      error: serializeError(error).slice(0, 500),
      completedAt: nextStatus === "failed" ? new Date() : null,
    },
  });
}
