import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const stringFields = [
  "businessName",
  "businessDescription",
  "serviceArea",
  "preferredTone",
  "outreachStyle",
  "preferredCta",
  "senderName",
  "senderTitle",
  "senderPhone",
  "senderEmail",
] as const;

const stringListFields = ["industriesServed", "serviceSpecialties", "doNotMention"] as const;

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
  return resolveWorkspace(request, body);
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

function buildProfileData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of stringFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value !== "string") {
      errors.push(`${field} must be a string or null`);
      continue;
    }

    data[field] = typeof value === "string" && value.trim() ? value.trim() : null;
  }

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
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const profile = await prisma.workspaceProfile.findUnique({
      where: { organizationId },
    });

    return Response.json({ profile });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  const { data, errors } = buildProfileData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const profile = await prisma.workspaceProfile.upsert({
      where: { organizationId },
      update: data,
      create: {
        organizationId,
        ...data,
      },
    });

    return Response.json({ profile });
  } catch (error) {
    return handlePrismaError(error);
  }
}
