import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const candidateStatuses = ["discovered", "researching", "qualified", "contacted", "converted", "rejected", "archived"] as const;
const partnershipTypes = ["subcontractor", "vendor_network", "referral_partner", "field_service_partner", "unknown"] as const;

type CreatePartnerCandidateBody = {
  organizationId?: unknown;
  name?: unknown;
  website?: unknown;
  description?: unknown;
  industry?: unknown;
  relevanceReason?: unknown;
  partnershipType?: unknown;
  status?: unknown;
  source?: unknown;
  metadata?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as CreatePartnerCandidateBody;
  } catch {
    return null;
  }
}

function resolveOrganizationId(request: NextRequest, body?: CreatePartnerCandidateBody | null) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId") ??
    (typeof body?.organizationId === "string" ? body.organizationId : null);

  return organizationId?.trim() || null;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return jsonError("Related record was not found", 400);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const organizationId = resolveOrganizationId(request);
  const status = request.nextUrl.searchParams.get("status");

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  if (status && !candidateStatuses.includes(status as (typeof candidateStatuses)[number])) {
    return jsonError("status is invalid", 400);
  }

  try {
    const partnerCandidates = await prisma.partnerCandidate.findMany({
      where: {
        organizationId,
        status: status ? status as (typeof candidateStatuses)[number] : undefined,
      },
      include: {
        company: { select: { id: true, name: true } },
        lead: { select: { id: true, title: true } },
      },
      orderBy: [{ fitScore: "desc" }, { createdAt: "desc" }],
    });

    return Response.json({ partnerCandidates });
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
  const name = optionalString(body.name);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  if (!name) {
    return jsonError("name is required", 400);
  }

  if (name === undefined) {
    return jsonError("name must be a string", 400);
  }

  const website = optionalString(body.website);
  const description = optionalString(body.description);
  const industry = optionalString(body.industry);
  const relevanceReason = optionalString(body.relevanceReason);
  const source = optionalString(body.source);

  if ([website, description, industry, relevanceReason, source].includes(undefined)) {
    return jsonError("Optional text fields must be strings or null", 400);
  }

  if (body.status !== undefined && !isOneOf(body.status, candidateStatuses)) {
    return jsonError("status is invalid", 400);
  }

  if (body.partnershipType !== undefined && !isOneOf(body.partnershipType, partnershipTypes)) {
    return jsonError("partnershipType is invalid", 400);
  }

  try {
    const partnerCandidate = await prisma.partnerCandidate.create({
      data: {
        organizationId,
        name,
        website,
        description,
        industry,
        relevanceReason,
        source: source ?? "manual_partnership_discovery",
        status: body.status ?? "discovered",
        partnershipType: body.partnershipType ?? "unknown",
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
      },
    });

    return Response.json({ partnerCandidate }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
