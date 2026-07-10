import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const allowedStatuses = ["open", "needs_reply", "drafted", "done", "archived"] as const;

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

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Mailbox thread not found", 404);
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
    const thread = await prisma.emailThread.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        lead: { select: { id: true, title: true } },
        outreach: { select: { id: true, subject: true, status: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: [{ receivedAt: "asc" }, { sentAt: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!thread) {
      return jsonError("Mailbox thread not found", 404);
    }

    return Response.json({ thread });
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
  const status = typeof body.status === "string" ? body.status.trim() : "";

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    return jsonError("status is invalid", 400);
  }

  try {
    const result = await prisma.emailThread.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { status },
    });

    if (result.count === 0) {
      return jsonError("Mailbox thread not found", 404);
    }

    const thread = await prisma.emailThread.findUnique({
      where: { id },
      include: { messages: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
    });

    return Response.json({ thread });
  } catch (error) {
    return handlePrismaError(error);
  }
}
