import { NextRequest } from "next/server";

import { claimNextAgentJob, completeAgentJob, failAgentJob, processAgentJob } from "@/lib/agents/jobs";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

type ProcessBody = {
  organizationId?: unknown;
  limit?: unknown;
};

type ProcessedJobSummary = {
  id: string;
  type: string;
  status: string;
  error: string | null;
  result: unknown;
};

type ProcessorWorkspace =
  | { organizationId: string; worker: boolean }
  | { error: Response };

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as ProcessBody;
  } catch {
    return {};
  }
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function workerSecretMatches(request: NextRequest) {
  const configuredSecret = process.env.AGENT_JOB_WORKER_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  const providedSecret = request.headers.get("x-agent-worker-secret")?.trim() || bearerToken(request);
  return providedSecret === configuredSecret;
}

function requestedOrganizationId(request: NextRequest, body: ProcessBody) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId") ??
    (typeof body.organizationId === "string" ? body.organizationId : null);

  return organizationId?.trim() || null;
}

async function resolveProcessorWorkspace(request: NextRequest, body: ProcessBody): Promise<ProcessorWorkspace> {
  if (workerSecretMatches(request)) {
    const organizationId = requestedOrganizationId(request, body);

    if (!organizationId) {
      return { error: jsonError("organizationId is required for worker processing", 400) };
    }

    return { organizationId, worker: true };
  }

  const workspace = await resolveWorkspace(request, body);

  if (workspace.error) {
    return { error: workspace.error };
  }

  return { organizationId: workspace.organizationId, worker: false };
}

function processLimit(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 10);
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const workspace = await resolveProcessorWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const limit = processLimit(body.limit);
  const jobs: ProcessedJobSummary[] = [];
  let retryQueued = false;

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextAgentJob(workspace.organizationId);

    if (!job) {
      break;
    }

    try {
      const result = await processAgentJob(job);
      const completedJob = await completeAgentJob(job.id, result);
      jobs.push({
        id: completedJob.id,
        type: completedJob.type,
        status: completedJob.status,
        error: completedJob.error,
        result: completedJob.result,
      });
    } catch (error) {
      const failedJob = await failAgentJob(job, error);
      retryQueued = retryQueued || failedJob.status === "queued";
      jobs.push({
        id: failedJob.id,
        type: failedJob.type,
        status: failedJob.status,
        error: failedJob.error,
        result: failedJob.result,
      });
    }
  }

  const failedJobs = jobs.filter((job) => job.status === "failed");

  if (failedJobs.length > 0) {
    return Response.json({
      processed: jobs.length > 0,
      processedCount: jobs.length,
      retryQueued,
      worker: workspace.worker,
      jobs,
      error: failedJobs[0]?.error ?? "Agent job failed",
    }, { status: 500 });
  }

  return Response.json({
    processed: jobs.length > 0,
    processedCount: jobs.length,
    retryQueued,
    worker: workspace.worker,
    jobs,
    job: jobs[0] ?? null,
  });
}
