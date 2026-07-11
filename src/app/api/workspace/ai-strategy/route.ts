import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const stringListFields = ["selectedTargetCategories", "selectedPriorityPainPoints"] as const;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown> | null) {
  return resolveWorkspaceId(request, body);
}

function parseStringList(value: unknown, field: string) {
  if (value === undefined) {
    return { value: undefined, error: null };
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return { value: undefined, error: `${field} must be an array of strings` };
  }

  return {
    value: value.map((item) => item.trim()).filter(Boolean),
    error: null,
  };
}

function buildStrategyData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of stringListFields) {
    const parsed = parseStringList(body[field], field);
    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }

    if (parsed.value !== undefined) {
      data[field] = parsed.value;
    }
  }

  if (body.selectedCtaStyle !== undefined) {
    if (body.selectedCtaStyle !== null && typeof body.selectedCtaStyle !== "string") {
      errors.push("selectedCtaStyle must be a string or null");
    } else {
      data.selectedCtaStyle = typeof body.selectedCtaStyle === "string" && body.selectedCtaStyle.trim()
        ? body.selectedCtaStyle.trim()
        : null;
    }
  }

  if (body.generatedStrategy !== undefined) {
    data.generatedStrategy = body.generatedStrategy;
  }

  if (body.guardrails !== undefined) {
    data.guardrails = body.guardrails;
  }

  return { data, errors };
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return jsonError("Workspace not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const organizationId = await resolveOrganizationId(request);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const strategy = await prisma.workspaceAiStrategy.findUnique({
      where: { organizationId },
    });

    return Response.json({ strategy });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const organizationId = await resolveOrganizationId(request, body);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  const { data, errors } = buildStrategyData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const strategy = await prisma.workspaceAiStrategy.upsert({
      where: { organizationId },
      update: data,
      create: {
        organizationId,
        ...data,
      },
    });

    return Response.json({ strategy });
  } catch (error) {
    return handlePrismaError(error);
  }
}
