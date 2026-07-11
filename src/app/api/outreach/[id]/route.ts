import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const outreachChannels = [
  "email",
  "phone",
  "sms",
  "linkedin",
  "meeting",
  "note",
  "other",
] as const;
const outreachDirections = ["inbound", "outbound"] as const;
const outreachStatuses = [
  "draft",
  "scheduled",
  "sent",
  "delivered",
  "opened",
  "replied",
  "bounced",
  "failed",
  "cancelled",
] as const;

const writableOutreachFields = [
  "companyId",
  "contactId",
  "leadId",
  "jobId",
  "channel",
  "direction",
  "status",
  "subject",
  "body",
  "scheduledAt",
  "sentAt",
  "deliveredAt",
  "openedAt",
  "repliedAt",
  "metadata",
] as const;

const nullableStringFields = [
  "companyId",
  "contactId",
  "leadId",
  "jobId",
  "subject",
  "body",
] as const;
const nullableDateFields = [
  "scheduledAt",
  "sentAt",
  "deliveredAt",
  "openedAt",
  "repliedAt",
] as const;

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateOutreachBody = {
  organizationId?: unknown;
  companyId?: unknown;
  contactId?: unknown;
  leadId?: unknown;
  jobId?: unknown;
  channel?: unknown;
  direction?: unknown;
  status?: unknown;
  subject?: unknown;
  body?: unknown;
  scheduledAt?: unknown;
  sentAt?: unknown;
  deliveredAt?: unknown;
  openedAt?: unknown;
  repliedAt?: unknown;
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

async function readOptionalJsonBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return readJsonBody(request);
}

async function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown> | null) {
  return resolveWorkspaceId(request, body);
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
  if (value === undefined) {
    return { value: undefined, error: null };
  }

  if (value === null) {
    return { value: null, error: null };
  }

  if (typeof value !== "string") {
    return { value: undefined, error: `${field} must be an ISO date string or null` };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { value: undefined, error: `${field} must be a valid ISO date string` };
  }

  return { value: date, error: null };
}

function buildOutreachData(body: UpdateOutreachBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableOutreachFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "channel" && !isOneOf(value, outreachChannels)) {
      errors.push("channel is invalid");
      continue;
    }

    if (field === "direction" && !isOneOf(value, outreachDirections)) {
      errors.push("direction is invalid");
      continue;
    }

    if (field === "status" && !isOneOf(value, outreachStatuses)) {
      errors.push("status is invalid");
      continue;
    }

    if (nullableStringFields.includes(field as (typeof nullableStringFields)[number])) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    if (nullableDateFields.includes(field as (typeof nullableDateFields)[number])) {
      const parsed = parseOptionalDate(value, field);
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
    if (error.code === "P2003") {
      return jsonError("Related record was not found", 400);
    }
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readOptionalJsonBody(request);

  if (body === null) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const organizationId = await resolveOrganizationId(request, body);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const outreach = await prisma.outreach.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!outreach) {
      return jsonError("Outreach not found", 404);
    }

    return Response.json({ outreach });
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

  const organizationId = await resolveOrganizationId(request, body);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  const { data, errors } = buildOutreachData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No supported fields provided", 400);
  }

  try {
    const result = await prisma.outreach.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });

    if (result.count === 0) {
      return jsonError("Outreach not found", 404);
    }

    const outreach = await prisma.outreach.findUnique({ where: { id } });

    return Response.json({ outreach });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readOptionalJsonBody(request);

  if (body === null) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const organizationId = await resolveOrganizationId(request, body);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const result = await prisma.outreach.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return jsonError("Outreach not found", 404);
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
