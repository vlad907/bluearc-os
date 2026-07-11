import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

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

type CreateCompanyBody = {
  organizationId?: unknown;
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

function buildCompanyData(body: CreateCompanyBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableCompanyFields) {
    const value = body[field];

    if (value === undefined) {
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
    if (error.code === "P2003") {
      return jsonError("Related organization was not found", 400);
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
    const companies = await prisma.company.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ companies });
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
  const name = typeof body.name === "string" ? body.name.trim() : "";


  if (!name) {
    return jsonError("name is required", 400);
  }

  const { data, errors } = buildCompanyData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const company = await prisma.company.create({
      data: {
        organizationId,
        name,
        ...data,
      },
    });

    return Response.json({ company }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
