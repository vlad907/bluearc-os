import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const jobStatuses = [
  "open",
  "bidding",
  "awarded",
  "in_progress",
  "completed",
  "cancelled",
] as const;
const jobPriorities = ["low", "medium", "high", "urgent"] as const;

const writableJobFields = [
  "title",
  "companyId",
  "contactId",
  "vendorId",
  "leadId",
  "description",
  "status",
  "priority",
  "type",
  "siteAddress",
  "postedDate",
  "dueDate",
  "bidDeadline",
  "estimatedValue",
  "assignedToId",
  "metadata",
] as const;

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateJobBody = {
  organizationId?: unknown;
  title?: unknown;
  companyId?: unknown;
  contactId?: unknown;
  vendorId?: unknown;
  leadId?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  type?: unknown;
  siteAddress?: unknown;
  postedDate?: unknown;
  dueDate?: unknown;
  bidDeadline?: unknown;
  estimatedValue?: unknown;
  assignedToId?: unknown;
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

function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown>) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId") ??
    (typeof body?.organizationId === "string" ? body.organizationId : null);

  return organizationId?.trim() || null;
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

function parseOptionalDate(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return { value, error: null };
  }

  if (typeof value !== "string") {
    return { value: null, error: `${field} must be an ISO date string or null` };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { value: null, error: `${field} must be a valid date` };
  }

  return { value: date, error: null };
}

function parseOptionalNumber(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return { value, error: null };
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { value: null, error: `${field} must be a finite number or null` };
  }

  return { value, error: null };
}

function buildJobData(body: UpdateJobBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableJobFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "title") {
      if (typeof value !== "string" || !value.trim()) {
        errors.push("title must be a non-empty string");
        continue;
      }

      data.title = value.trim();
      continue;
    }

    if (field === "status" && !isOneOf(value, jobStatuses)) {
      errors.push("status is invalid");
      continue;
    }

    if (field === "priority" && !isOneOf(value, jobPriorities)) {
      errors.push("priority is invalid");
      continue;
    }

    if (
      [
        "companyId",
        "contactId",
        "vendorId",
        "leadId",
        "description",
        "type",
        "assignedToId",
      ].includes(field)
    ) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    if (["postedDate", "dueDate", "bidDeadline"].includes(field)) {
      const parsed = parseOptionalDate(value, field);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }

      data[field] = parsed.value;
      continue;
    }

    if (field === "estimatedValue") {
      const parsed = parseOptionalNumber(value, field);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }

      data[field] = parsed.value;
      continue;
    }

    data[field] = value;
  }

  return { data, errors };
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return jsonError("Job not found", 404);
    }

    if (error.code === "P2003") {
      return jsonError("Related record was not found", 400);
    }
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const organizationId = resolveOrganizationId(request);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const job = await prisma.job.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!job) {
      return jsonError("Job not found", 404);
    }

    return Response.json({ job });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const organizationId = resolveOrganizationId(request, body);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  const { data, errors } = buildJobData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No supported fields provided", 400);
  }

  try {
    const result = await prisma.job.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });

    if (result.count === 0) {
      return jsonError("Job not found", 404);
    }

    const job = await prisma.job.findUnique({ where: { id } });

    return Response.json({ job });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const organizationId = resolveOrganizationId(request);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const result = await prisma.job.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return jsonError("Job not found", 404);
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
