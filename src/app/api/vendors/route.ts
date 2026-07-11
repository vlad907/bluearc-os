import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const vendorStatuses = ["active", "inactive", "blacklisted"] as const;

const writableVendorFields = [
  "companyId",
  "category",
  "contactName",
  "email",
  "phone",
  "website",
  "status",
  "rating",
  "notes",
  "metadata",
] as const;

type CreateVendorBody = {
  organizationId?: unknown;
  name?: unknown;
  companyId?: unknown;
  category?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  status?: unknown;
  rating?: unknown;
  notes?: unknown;
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

function assertOptionalInteger(value: unknown, field: string) {
  if (value !== undefined && value !== null && !Number.isInteger(value)) {
    return `${field} must be an integer or null`;
  }

  return null;
}

function buildVendorData(body: CreateVendorBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableVendorFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "status" && !isOneOf(value, vendorStatuses)) {
      errors.push("status is invalid");
      continue;
    }

    if (
      [
        "companyId",
        "category",
        "contactName",
        "email",
        "phone",
        "website",
        "notes",
      ].includes(field)
    ) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    if (field === "rating") {
      const error = assertOptionalInteger(value, field);
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
    const vendors = await prisma.vendor.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ vendors });
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

  const { data, errors } = buildVendorData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        name,
        ...data,
      },
    });

    return Response.json({ vendor }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
