import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const companyRelationshipTypes = [
  "customer",
  "vendor",
  "msp",
  "property_manager",
  "contractor",
  "partner",
] as const;
const companySizes = ["startup", "smb", "mid", "enterprise"] as const;
const companyStatuses = ["prospect", "active", "inactive", "churned"] as const;

const writableCompanyFields = [
  "name",
  "relationshipType",
  "domain",
  "industry",
  "size",
  "status",
  "website",
  "phone",
  "address",
  "metadata",
] as const;

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateCompanyBody = {
  name?: unknown;
  relationshipType?: unknown;
  domain?: unknown;
  industry?: unknown;
  size?: unknown;
  status?: unknown;
  website?: unknown;
  phone?: unknown;
  address?: unknown;
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

function buildCompanyData(body: UpdateCompanyBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableCompanyFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "name") {
      if (typeof value !== "string" || !value.trim()) {
        errors.push("name must be a non-empty string");
        continue;
      }

      data.name = value.trim();
      continue;
    }

    if (
      field === "relationshipType" &&
      !isOneOf(value, companyRelationshipTypes)
    ) {
      errors.push("relationshipType is invalid");
      continue;
    }

    if (field === "size" && value !== null && !isOneOf(value, companySizes)) {
      errors.push("size is invalid");
      continue;
    }

    if (field === "status" && !isOneOf(value, companyStatuses)) {
      errors.push("status is invalid");
      continue;
    }

    if (["domain", "industry", "website", "phone"].includes(field)) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    data[field] = value;
  }

  return { data, errors };
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return jsonError("Company not found", 404);
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
    const company = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!company) {
      return jsonError("Company not found", 404);
    }

    return Response.json({ company });
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

  const { data, errors } = buildCompanyData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No supported fields provided", 400);
  }

  try {
    const result = await prisma.company.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });

    if (result.count === 0) {
      return jsonError("Company not found", 404);
    }

    const company = await prisma.company.findUnique({ where: { id } });

    return Response.json({ company });
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
    const result = await prisma.company.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return jsonError("Company not found", 404);
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
