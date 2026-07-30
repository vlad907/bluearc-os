import { NextRequest } from "next/server";

import { resolveWorkspace } from "@/lib/auth/workspace";
import {
  PartnerSearchProviderError,
  PartnerSearchUnavailableError,
  searchAndPersistPartnerCandidates,
} from "@/lib/partners/search";

export const dynamic = "force-dynamic";

type SearchBody = {
  organizationId?: unknown;
  query?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as SearchBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  try {
    const result = await searchAndPersistPartnerCandidates({
      organizationId: workspace.organizationId,
      query: body.query,
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof PartnerSearchUnavailableError) {
      return jsonError(error.message, error.message.startsWith("Add a workspace profile") ? 400 : 409);
    }

    if (error instanceof PartnerSearchProviderError) {
      return Response.json({ error: error.message, ...error.metadata }, { status: 502 });
    }

    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
