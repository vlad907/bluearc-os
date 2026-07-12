import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

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

type CreateOutreachBody = {
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

function buildOutreachData(body: CreateOutreachBody) {
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

async function validateOutreachRelations(
  organizationId: string,
  data: Record<string, unknown>,
) {
  const relationChecks = [
    {
      field: "companyId",
      label: "Company",
      find: (id: string) => prisma.company.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      }),
    },
    {
      field: "contactId",
      label: "Contact",
      find: (id: string) => prisma.contact.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      }),
    },
    {
      field: "leadId",
      label: "Lead",
      find: (id: string) => prisma.lead.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      }),
    },
    {
      field: "jobId",
      label: "Job",
      find: (id: string) => prisma.job.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      }),
    },
  ];

  for (const check of relationChecks) {
    const value = data[check.field];
    if (value === null || value === undefined || value === "") {
      continue;
    }

    if (typeof value !== "string") {
      return `${check.field} must be a string or null`;
    }

    const record = await check.find(value.trim());
    if (!record) {
      return `${check.label} not found`;
    }
  }

  return null;
}

const outreachInclude = {
  company: {
    select: {
      id: true,
      name: true,
    },
  },
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      companyId: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      companyId: true,
    },
  },
  job: {
    select: {
      id: true,
      title: true,
      companyId: true,
    },
  },
};

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return jsonError("Related record was not found", 400);
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
    const outreach = await prisma.outreach.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: outreachInclude,
    });

    return Response.json({ outreach });
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

  const { data, errors } = buildOutreachData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const relationError = await validateOutreachRelations(organizationId, data);

  if (relationError) {
    return jsonError(relationError, 400);
  }

  try {
    const outreach = await prisma.outreach.create({
      data: {
        organizationId,
        ...data,
      },
      include: outreachInclude,
    });

    return Response.json({ outreach }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
