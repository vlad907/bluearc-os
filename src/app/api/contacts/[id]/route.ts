import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

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
  "firstName",
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

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateContactBody = {
  organizationId?: unknown;
  firstName?: unknown;
  companyId?: unknown;
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

function buildContactData(body: UpdateContactBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableContactFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "firstName") {
      if (typeof value !== "string" || !value.trim()) {
        errors.push("firstName must be a non-empty string");
        continue;
      }

      data.firstName = value.trim();
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
    if (error.code === "P2025") {
      return jsonError("Contact not found", 404);
    }

    if (error.code === "P2003") {
      return jsonError("Related organization or company was not found", 400);
    }
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const contact = await prisma.contact.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!contact) {
      return jsonError("Contact not found", 404);
    }

    return Response.json({ contact });
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

  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  const { data, errors } = buildContactData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No supported fields provided", 400);
  }

  const companyError = await validateCompanyId(organizationId, data.companyId);

  if (companyError) {
    return jsonError(companyError, 400);
  }

  try {
    const result = await prisma.contact.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });

    if (result.count === 0) {
      return jsonError("Contact not found", 404);
    }

    const contact = await prisma.contact.findUnique({ where: { id } });

    return Response.json({ contact });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const result = await prisma.contact.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return jsonError("Contact not found", 404);
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
