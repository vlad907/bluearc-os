import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const contactRoles = [
  "decision_maker",
  "influencer",
  "user",
  "admin",
  "site_contact",
  "dispatcher",
] as const;
const contactStatuses = ["active", "inactive"] as const;

const writableContactFields = [
  "companyId",
  "lastName",
  "email",
  "phone",
  "title",
  "role",
  "source",
  "status",
  "metadata",
] as const;

type CreateContactBody = {
  organizationId?: unknown;
  companyId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  title?: unknown;
  role?: unknown;
  source?: unknown;
  status?: unknown;
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

function buildContactData(body: CreateContactBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableContactFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "role" && value !== null && !isOneOf(value, contactRoles)) {
      errors.push("role is invalid");
      continue;
    }

    if (field === "status" && !isOneOf(value, contactStatuses)) {
      errors.push("status is invalid");
      continue;
    }

    if (["companyId", "lastName", "email", "phone", "title", "source"].includes(field)) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    data[field] = typeof value === "string" ? value.trim() || null : value;
  }

  return { data, errors };
}

async function validateCompanyId(organizationId: string, companyId: unknown) {
  if (companyId === undefined || companyId === null) {
    return null;
  }

  if (typeof companyId !== "string" || !companyId.trim()) {
    return "companyId must be a string or null";
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId.trim(), organizationId, deletedAt: null },
    select: { id: true },
  });

  return company ? null : "Company not found";
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return jsonError("Related organization or company was not found", 400);
    }
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const organizationId = resolveOrganizationId(request);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const contacts = await prisma.contact.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ contacts });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const organizationId = resolveOrganizationId(request, body);
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  if (!firstName) {
    return jsonError("firstName is required", 400);
  }

  const { data, errors } = buildContactData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const companyError = await validateCompanyId(organizationId, data.companyId);

  if (companyError) {
    return jsonError(companyError, 400);
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        organizationId,
        firstName,
        ...data,
      },
    });

    return Response.json({ contact }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
