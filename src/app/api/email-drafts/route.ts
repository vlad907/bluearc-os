import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statuses = ["draft", "needs_review", "approved", "rejected", "sent"] as const;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function resolveOrganizationId(request: NextRequest) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId");

  return organizationId?.trim() || null;
}

function handlePrismaError(error: unknown) {
  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const organizationId = resolveOrganizationId(request);
  const status = request.nextUrl.searchParams.get("status");

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  if (status && !statuses.includes(status as (typeof statuses)[number])) {
    return jsonError("status is invalid", 400);
  }

  try {
    const emailDrafts = await prisma.emailDraft.findMany({
      where: {
        organizationId,
        status: status ? status as (typeof statuses)[number] : undefined,
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        lead: { select: { id: true, title: true } },
        outreach: { select: { id: true, status: true, subject: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ emailDrafts });
  } catch (error) {
    return handlePrismaError(error);
  }
}
