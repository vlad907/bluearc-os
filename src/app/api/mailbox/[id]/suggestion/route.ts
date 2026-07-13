import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const actions = ["approve", "reject"] as const;

type RouteParams = {
  params: Promise<{ id: string }>;
};

type SuggestionBody = {
  organizationId?: unknown;
  action?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as SuggestionBody;
  } catch {
    return {};
  }
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Mailbox thread not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;
  const action = typeof body.action === "string" ? body.action.trim() : "";

  if (!actions.includes(action as (typeof actions)[number])) {
    return jsonError("action must be 'approve' or 'reject'", 400);
  }

  try {
    const thread = await prisma.emailThread.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        messages: {
          where: { deletedAt: null, direction: "inbound" },
          orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!thread) {
      return jsonError("Mailbox thread not found", 404);
    }

    const target = thread.messages.find((message) => message.suggestedBody);

    if (!target) {
      return jsonError("Generate a suggested reply before approving or rejecting", 400);
    }

    if (action === "approve") {
      const message = await prisma.emailMessage.update({
        where: { id: target.id },
        data: { suggestionStatus: "approved" },
      });

      // Keep the thread in "drafted" so it stays in the send-ready queue.
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { status: "drafted" },
      });

      return Response.json({ action, message: { id: message.id, suggestionStatus: message.suggestionStatus } });
    }

    // Reject: clear the suggestion and return the thread to the reply queue.
    const message = await prisma.emailMessage.update({
      where: { id: target.id },
      data: {
        suggestionStatus: "rejected",
        suggestedSubject: null,
        suggestedBody: null,
        suggestedAt: null,
      },
    });

    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { status: "needs_reply" },
    });

    return Response.json({ action, message: { id: message.id, suggestionStatus: message.suggestionStatus } });
  } catch (error) {
    return handlePrismaError(error);
  }
}
