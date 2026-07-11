import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const statuses = ["draft", "needs_review", "approved", "rejected", "sent"] as const;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function resolveOrganizationId(request: NextRequest) {
  return resolveWorkspaceId(request);
}

function handlePrismaError(error: unknown) {
  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const organizationId = await resolveOrganizationId(request);
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
