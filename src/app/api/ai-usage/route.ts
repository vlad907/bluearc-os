import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function resolveOrganizationId(request: NextRequest) {
  return resolveWorkspace(request);
}

function parseDays(value: string | null) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
    return 30;
  }

  return parsed;
}

function sumNullable(values: Array<number | null>) {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export async function GET(request: NextRequest) {
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;
  const days = parseDays(request.nextUrl.searchParams.get("days"));


  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const calls = await prisma.aiProviderCall.findMany({
      where: {
        organizationId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const byStatus = calls.reduce<Record<string, number>>((accumulator, call) => {
      accumulator[call.status] = (accumulator[call.status] ?? 0) + 1;
      return accumulator;
    }, {});
    const byProvider = calls.reduce<Record<string, number>>((accumulator, call) => {
      const provider = call.provider ?? "none";
      accumulator[provider] = (accumulator[provider] ?? 0) + 1;
      return accumulator;
    }, {});
    const byAgent = calls.reduce<Record<string, number>>((accumulator, call) => {
      accumulator[call.agent] = (accumulator[call.agent] ?? 0) + 1;
      return accumulator;
    }, {});
    const failures = calls
      .filter((call) => call.status === "failed")
      .slice(0, 10)
      .map((call) => ({
        id: call.id,
        provider: call.provider,
        model: call.model,
        agent: call.agent,
        promptKey: call.promptKey,
        error: call.error,
        createdAt: call.createdAt,
      }));
    const successfulDurations = calls
      .filter((call) => call.status === "success" && call.durationMs !== null)
      .map((call) => call.durationMs as number);
    const averageDurationMs = successfulDurations.length
      ? Math.round(successfulDurations.reduce((sum, value) => sum + value, 0) / successfulDurations.length)
      : null;

    return Response.json({
      days,
      totals: {
        calls: calls.length,
        success: byStatus.success ?? 0,
        failed: byStatus.failed ?? 0,
        skipped: byStatus.skipped ?? 0,
        totalTokens: sumNullable(calls.map((call) => call.totalTokens)),
        requestTokens: sumNullable(calls.map((call) => call.requestTokens)),
        responseTokens: sumNullable(calls.map((call) => call.responseTokens)),
        averageDurationMs,
      },
      byStatus,
      byProvider,
      byAgent,
      failures,
      recentCalls: calls.slice(0, 20).map((call) => ({
        id: call.id,
        provider: call.provider,
        model: call.model,
        agent: call.agent,
        promptKey: call.promptKey,
        status: call.status,
        durationMs: call.durationMs,
        totalTokens: call.totalTokens,
        error: call.error,
        createdAt: call.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
