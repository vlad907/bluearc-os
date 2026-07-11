import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, resolveWorkspaceAccess, workspaceAccessError } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const budgetManagerRoles = ["owner", "admin", "manager"] as const;

type BudgetBody = {
  organizationId?: unknown;
  enforce?: unknown;
  monthlyCallLimit?: unknown;
  monthlyTokenLimit?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as BudgetBody;
  } catch {
    return null;
  }
}

function parseOptionalPositiveInt(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    return { value: null };
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return { error: `${field} must be a positive integer or blank` };
  }

  return { value: parsed };
}

export async function GET(request: NextRequest) {
  const access = await resolveWorkspaceAccess(request);

  if (!access.authorized || !access.organizationId) {
    return workspaceAccessError(access);
  }

  const budget = await prisma.aiUsageBudget.findUnique({
    where: { organizationId: access.organizationId },
  });

  return Response.json({
    budget: budget ?? {
      organizationId: access.organizationId,
      enforce: false,
      monthlyCallLimit: null,
      monthlyTokenLimit: null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const auth = await requireWorkspaceRole(request, body, budgetManagerRoles);

  if ("error" in auth) {
    return auth.error;
  }

  const callLimit = parseOptionalPositiveInt(body.monthlyCallLimit, "monthlyCallLimit");
  const tokenLimit = parseOptionalPositiveInt(body.monthlyTokenLimit, "monthlyTokenLimit");

  if (callLimit.error) {
    return jsonError(callLimit.error, 400);
  }

  if (tokenLimit.error) {
    return jsonError(tokenLimit.error, 400);
  }

  const budget = await prisma.aiUsageBudget.upsert({
    where: { organizationId: auth.organizationId },
    update: {
      enforce: body.enforce === true,
      monthlyCallLimit: callLimit.value,
      monthlyTokenLimit: tokenLimit.value,
    },
    create: {
      organizationId: auth.organizationId,
      enforce: body.enforce === true,
      monthlyCallLimit: callLimit.value,
      monthlyTokenLimit: tokenLimit.value,
    },
  });

  return Response.json({ budget });
}
