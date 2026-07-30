import { NextRequest } from "next/server";

import { claimNextAgentJob, completeAgentJob, failAgentJob, processAgentJob } from "@/lib/agents/jobs";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const workspace = await resolveWorkspace(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const job = await claimNextAgentJob(workspace.organizationId);

  if (!job) {
    return Response.json({ processed: false, job: null });
  }

  try {
    const result = await processAgentJob(job);
    const completedJob = await completeAgentJob(job.id, result);

    return Response.json({ processed: true, job: completedJob });
  } catch (error) {
    const failedJob = await failAgentJob(job, error);

    if (failedJob.status === "queued") {
      return Response.json({ processed: false, retryQueued: true, job: failedJob });
    }

    return jsonError(failedJob.error ?? "Agent job failed", 500);
  }
}
