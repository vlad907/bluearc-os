import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { generateMailboxSuggestedReply } from "@/lib/agents/mailbox-reply";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Mailbox thread not found") {
      return jsonError("Mailbox thread not found", 404);
    }

    if (error.message === "Thread has no inbound message to reply to") {
      return jsonError(error.message, 400);
    }
  }

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

  try {
    const result = await generateMailboxSuggestedReply({
      organizationId: workspace.organizationId,
      threadId: id,
    });

    return Response.json({ suggestion: result.suggestion });
  } catch (error) {
    return handleError(error);
  }
}
