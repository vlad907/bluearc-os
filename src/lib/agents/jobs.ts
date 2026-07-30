import { AgentJob, AgentJobStatus, Prisma } from "@prisma/client";

import { generateLeadEmailDraft } from "@/lib/agents/lead-draft";
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
  if (job.type !== "lead_generate_draft") {
    throw new Error(`Unsupported agent job type: ${job.type}`);
  }

  const payload = asJsonObject(job.payload);
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
