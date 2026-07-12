import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

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

type CreateJobBody = {
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

function buildJobData(body: CreateJobBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableJobFields) {
    const value = body[field];

    if (value === undefined) {
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

async function validateJobRelations(
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
      field: "vendorId",
      label: "Vendor",
      find: (id: string) => prisma.vendor.findFirst({
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
  ];

  for (const check of relationChecks) {
    const value = data[check.field];
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const record = await check.find(value.trim());
    if (!record) {
      return `${check.label} not found`;
    }
  }

  return null;
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

export async function GET(request: NextRequest) {
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const jobs = await prisma.job.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
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
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        lead: {
          select: {
            id: true,
            title: true,
            companyId: true,
          },
        },
      },
    });

    return Response.json({ jobs });
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

  const { data, errors } = buildJobData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const relationError = await validateJobRelations(organizationId, data);

  if (relationError) {
    return jsonError(relationError, 400);
  }

  try {
    const job = await prisma.job.create({
      data: {
        organizationId,
        title,
        ...data,
      },
      include: {
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
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        lead: {
          select: {
            id: true,
            title: true,
            companyId: true,
          },
        },
      },
    });

    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
