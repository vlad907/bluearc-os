import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateDraftBody = {
  organizationId?: unknown;
  action?: unknown;
  subject?: unknown;
  body?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as UpdateDraftBody;
  } catch {
    return null;
  }
}

async function resolveOrganizationId(request: NextRequest, body?: UpdateDraftBody | null) {
  return resolveWorkspace(request, body);
}

function parseAction(value: unknown) {
  if (value === "approve" || value === "reject" || value === "sent") {
    return value;
  }

  return null;
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Email draft not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
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
  const action = parseAction(body.action);
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : undefined;
  const draftBody = typeof body.body === "string" && body.body.trim() ? body.body.trim() : undefined;


  if (!action) {
    return jsonError("action must be approve, reject, or sent", 400);
  }

  try {
    const existingDraft = await prisma.emailDraft.findFirst({
      where: { id, organizationId },
    });

    if (!existingDraft) {
      return jsonError("Email draft not found", 404);
    }

    const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "sent";
    const now = new Date();
    const emailDraft = await prisma.emailDraft.update({
      where: { id },
      data: {
        status: nextStatus,
        subject: subject ?? existingDraft.subject,
        body: draftBody ?? existingDraft.body,
        approvedAt: action === "approve" ? now : existingDraft.approvedAt,
        rejectedAt: action === "reject" ? now : existingDraft.rejectedAt,
        sentAt: action === "sent" ? now : existingDraft.sentAt,
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        lead: { select: { id: true, title: true } },
        outreach: { select: { id: true, status: true, subject: true } },
      },
    });

    if (existingDraft.outreachId && action !== "reject") {
      await prisma.outreach.update({
        where: { id: existingDraft.outreachId },
        data: {
          subject: emailDraft.subject,
          body: emailDraft.body,
          status: action === "sent" ? "sent" : "draft",
          sentAt: action === "sent" ? now : undefined,
        },
      });
    }

    return Response.json({ emailDraft });
  } catch (error) {
    return handlePrismaError(error);
  }
}
