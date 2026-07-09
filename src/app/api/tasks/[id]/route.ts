import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const taskStatuses = ["todo", "in_progress", "done", "cancelled"] as const;
const taskPriorities = ["low", "medium", "high", "urgent"] as const;

const writableTaskFields = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "completedAt",
  "assignedToId",
  "entityType",
  "entityId",
  "metadata",
] as const;

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateTaskBody = {
  organizationId?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  completedAt?: unknown;
  assignedToId?: unknown;
  entityType?: unknown;
  entityId?: unknown;
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

function buildTaskData(body: UpdateTaskBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableTaskFields) {
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

    if (field === "status" && !isOneOf(value, taskStatuses)) {
      errors.push("status is invalid");
      continue;
    }

    if (field === "priority" && !isOneOf(value, taskPriorities)) {
      errors.push("priority is invalid");
      continue;
    }

    if (["description", "assignedToId", "entityType", "entityId"].includes(field)) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    if (field === "dueDate" || field === "completedAt") {
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
    if (error.code === "P2025") {
      return jsonError("Task not found", 404);
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
    const task = await prisma.task.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!task) {
      return jsonError("Task not found", 404);
    }

    return Response.json({ task });
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

  const { data, errors } = buildTaskData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No supported fields provided", 400);
  }

  try {
    const result = await prisma.task.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });

    if (result.count === 0) {
      return jsonError("Task not found", 404);
    }

    const task = await prisma.task.findUnique({ where: { id } });

    return Response.json({ task });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const organizationId = resolveOrganizationId(request, body ?? undefined);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const result = await prisma.task.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return jsonError("Task not found", 404);
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
