import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

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

async function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown>) {
  return resolveWorkspace(request, body);
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
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

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

  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;
  const status = typeof body.status === "string" ? body.status.trim() : "";


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
