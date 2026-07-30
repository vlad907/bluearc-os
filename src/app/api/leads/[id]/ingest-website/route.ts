import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { resolveWorkspace } from "@/lib/auth/workspace";
import { ingestLeadWebsite, parseWebsiteUrl } from "@/lib/agents/lead-research";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type IngestWebsiteBody = {
  organizationId?: unknown;
  url?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as IngestWebsiteBody;
  } catch {
    return null;
  }
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Lead not found") {
      return jsonError("Lead not found", 404);
    }

    if (error.message.startsWith("Website returned")) {
      return jsonError(error.message, 502);
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Lead not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const url = parseWebsiteUrl(body.url);

  if (!url) {
    return jsonError("url must be a valid http(s) URL", 400);
  }

  try {
    const result = await ingestLeadWebsite({
      organizationId: workspace.organizationId,
      leadId: id,
      url,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
