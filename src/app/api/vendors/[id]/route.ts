import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const vendorStatuses = ["active", "inactive", "blacklisted"] as const;

const writableVendorFields = [
  "name",
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

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateVendorBody = {
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

function assertOptionalInteger(value: unknown, field: string) {
  if (value !== undefined && value !== null && !Number.isInteger(value)) {
    return `${field} must be an integer or null`;
  }

  return null;
}

function buildVendorData(body: UpdateVendorBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableVendorFields) {
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
    if (error.code === "P2025") {
      return jsonError("Vendor not found", 404);
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
    const vendor = await prisma.vendor.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!vendor) {
      return jsonError("Vendor not found", 404);
    }

    return Response.json({ vendor });
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

  const { data, errors } = buildVendorData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No supported fields provided", 400);
  }

  try {
    const result = await prisma.vendor.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });

    if (result.count === 0) {
      return jsonError("Vendor not found", 404);
    }

    const vendor = await prisma.vendor.findUnique({ where: { id } });

    return Response.json({ vendor });
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
    const result = await prisma.vendor.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return jsonError("Vendor not found", 404);
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
