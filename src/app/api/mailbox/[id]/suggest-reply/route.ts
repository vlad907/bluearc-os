import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { getCrmAgentPrompt } from "@/lib/ai/crm-agent-prompts";

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

async function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown>) {
  return resolveWorkspace(request, body);
}

function buildSuggestedReply(params: {
  subject: string;
  senderName: string;
  classification: string | null;
}) {
  const classification = params.classification ?? "unknown";
  const greeting = params.senderName ? `Hi ${params.senderName},` : "Hi,";

  if (classification === "pricing_request") {
    return {
      subject: `Re: ${params.subject}`,
      body: `${greeting}\n\nThanks for asking. Pricing depends on the site scope, number of locations, and the exact support requirements. The best next step is a quick call so we can understand the environment and give you a realistic range instead of a generic number.\n\nDo you have 15 minutes this week to walk through what you need?\n\nBest regards`,
    };
  }

  if (classification === "meeting_request" || classification === "interested") {
    return {
      subject: `Re: ${params.subject}`,
      body: `${greeting}\n\nThanks for the reply. Happy to connect and talk through it. A short call should be enough to understand the current setup, what you are trying to improve, and whether we can help.\n\nWhat does your availability look like over the next couple of days?\n\nBest regards`,
    };
  }

  if (classification === "question") {
    return {
      subject: `Re: ${params.subject}`,
      body: `${greeting}\n\nThanks for the question. The short answer is that we can tailor the approach based on your current environment and what matters most operationally.\n\nIf you can send a little more detail about the setup or the main issue you are trying to solve, I can give you a more specific answer.\n\nBest regards`,
    };
  }

  if (classification === "not_interested" || classification === "unsubscribe") {
    return {
      subject: `Re: ${params.subject}`,
      body: `${greeting}\n\nUnderstood — thanks for letting me know. I will close the loop on my side and will not continue following up.\n\nBest regards`,
    };
  }

  return {
    subject: `Re: ${params.subject}`,
    body: `${greeting}\n\nThanks for getting back to me. I wanted to follow up with a concise next step rather than overload your inbox.\n\nIf it makes sense, I can send over a short summary of how we typically help teams in this situation, or we can set up a brief call.\n\nBest regards`,
  };
}

function senderNameFromEmail(email: string | null) {
  if (!email) {
    return "";
  }

  const localPart = email.split("@")[0] ?? "";
  const firstToken = localPart.split(/[._-]/)[0] ?? "";
  return firstToken ? firstToken.charAt(0).toUpperCase() + firstToken.slice(1) : "";
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
  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const thread = await prisma.emailThread.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!thread) {
      return jsonError("Mailbox thread not found", 404);
    }

    const latestInbound = thread.messages.find((message) => message.direction === "inbound");

    if (!latestInbound) {
      return jsonError("Thread has no inbound message to reply to", 400);
    }

    const suggestion = buildSuggestedReply({
      subject: thread.subject,
      senderName: senderNameFromEmail(latestInbound.fromEmail),
      classification: latestInbound.classification ?? thread.classification,
    });

    const updatedMessage = await prisma.emailMessage.update({
      where: { id: latestInbound.id },
      data: {
        suggestedSubject: suggestion.subject,
        suggestedBody: suggestion.body,
        suggestedAt: new Date(),
        metadata: {
          promptKey: "responseDraft",
          promptSource: getCrmAgentPrompt("responseDraft").sourceFile,
          generationMode: "deterministic_v1",
        },
      },
    });

    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { status: "drafted" },
    });

    return Response.json({
      suggestion: {
        subject: updatedMessage.suggestedSubject,
        body: updatedMessage.suggestedBody,
        messageId: updatedMessage.id,
        prompt: getCrmAgentPrompt("responseDraft"),
      },
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}
