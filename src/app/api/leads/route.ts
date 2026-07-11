import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const leadStages = ["new", "evaluating", "bidding", "submitted", "won", "lost"] as const;

const writableLeadFields = [
  "contactId",
  "companyId",
  "stage",
  "value",
  "currency",
  "probability",
  "source",
  "assignedToId",
  "expectedClose",
  "metadata",
] as const;

type CreateLeadBody = {
  organizationId?: unknown;
  title?: unknown;
  contactId?: unknown;
  companyId?: unknown;
  stage?: unknown;
  value?: unknown;
  currency?: unknown;
  probability?: unknown;
  source?: unknown;
  assignedToId?: unknown;
  expectedClose?: unknown;
  metadata?: unknown;
};

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

async function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown>) {
  return resolveWorkspace(request, body);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function assertOptionalString(value: unknown, field: string) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    return `${field} must be a string or null`;
  }

  return null;
}

function parseOptionalDate(value: unknown, field: string, errors: string[]) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${field} must be an ISO date string or null`);
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${field} must be a valid ISO date string or null`);
    return undefined;
  }

  return date;
}

function buildLeadData(body: CreateLeadBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableLeadFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "stage" && !isOneOf(value, leadStages)) {
      errors.push("stage is invalid");
      continue;
    }

    if (["contactId", "companyId", "currency", "source", "assignedToId"].includes(field)) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    if (field === "value") {
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number"
      ) {
        errors.push("value must be a number, decimal string, or null");
        continue;
      }
    }

    if (field === "probability") {
      if (
        value !== null &&
        (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 100)
      ) {
        errors.push("probability must be an integer from 0 to 100 or null");
        continue;
      }
    }

    if (field === "expectedClose") {
      const date = parseOptionalDate(value, field, errors);
      if (date !== undefined) {
        data[field] = date;
      }
      continue;
    }

    data[field] = value;
  }

  return { data, errors };
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return jsonError("Related organization, company, or contact was not found", 400);
    }
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
    const leads = await prisma.lead.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ leads });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;
  const title = typeof body.title === "string" ? body.title.trim() : "";


  if (!title) {
    return jsonError("title is required", 400);
  }

  const { data, errors } = buildLeadData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        organizationId,
        title,
        ...data,
      },
    });

    return Response.json({ lead }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
