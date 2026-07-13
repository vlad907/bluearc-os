import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { providerErrorMetadata, runProviderPartnerSearch } from "@/lib/ai/provider-agents";

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

function normalizeWebsiteKey(website: string | null) {
  if (!website) {
    return null;
  }

  try {
    return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website.trim().toLowerCase() || null;
  }
}

function buildQueryFromProfile(
  profile: { businessDescription: string | null; serviceArea: string | null; industriesServed: string[]; serviceSpecialties: string[] } | null,
  strategy: { selectedTargetCategories: string[] } | null,
) {
  const parts: string[] = [];

  if (profile?.businessDescription) {
    parts.push(`Our business: ${profile.businessDescription}.`);
  }

  if (profile?.serviceSpecialties.length) {
    parts.push(`We provide: ${profile.serviceSpecialties.join(", ")}.`);
  }

  if (profile?.serviceArea) {
    parts.push(`Service area: ${profile.serviceArea}.`);
  }

  if (profile?.industriesServed.length) {
    parts.push(`Industries we serve: ${profile.industriesServed.join(", ")}.`);
  }

  if (strategy?.selectedTargetCategories.length) {
    parts.push(`Prioritize partner categories: ${strategy.selectedTargetCategories.join(", ")}.`);
  }

  parts.push(
    "Find national or regional vendors, MSPs, or contractors that subcontract field-service work to local providers and could add us to their vendor/subcontractor network. Return JSON: { \"companies\": [{ \"company_name\", \"website\", \"description\", \"relevance_reason\" }] }.",
  );

  return parts.join(" ");
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;
  const explicitQuery = typeof body.query === "string" ? body.query.trim() : "";

  try {
    let query = explicitQuery;

    if (!query) {
      const [profile, strategy] = await Promise.all([
        prisma.workspaceProfile.findUnique({ where: { organizationId } }),
        prisma.workspaceAiStrategy.findUnique({ where: { organizationId } }),
      ]);

      if (!profile && !strategy) {
        return jsonError("Add a workspace profile or provide a search query before running partner search", 400);
      }

      query = buildQueryFromProfile(profile, strategy);
    }

    let result;
    try {
      result = await runProviderPartnerSearch(organizationId, query);
    } catch (searchError) {
      return Response.json(
        { error: "Partner search failed", ...providerErrorMetadata(searchError) },
        { status: 502 },
      );
    }

    if (!result) {
      return jsonError(
        "Live partner search requires a configured Anthropic provider with web search, and available AI budget",
        409,
      );
    }

    const existing = await prisma.partnerCandidate.findMany({
      where: { organizationId },
      select: { name: true, website: true },
    });

    const existingNames = new Set(existing.map((candidate) => candidate.name.trim().toLowerCase()));
    const existingHosts = new Set(
      existing.map((candidate) => normalizeWebsiteKey(candidate.website)).filter((key): key is string => key !== null),
    );

    const created = [];
    const skipped: string[] = [];

    for (const company of result.companies) {
      const nameKey = company.name.trim().toLowerCase();
      const hostKey = normalizeWebsiteKey(company.website);

      if (existingNames.has(nameKey) || (hostKey && existingHosts.has(hostKey))) {
        skipped.push(company.name);
        continue;
      }

      existingNames.add(nameKey);
      if (hostKey) {
        existingHosts.add(hostKey);
      }

      const candidate = await prisma.partnerCandidate.create({
        data: {
          organizationId,
          name: company.name,
          website: company.website,
          description: company.description,
          relevanceReason: company.relevanceReason,
          source: "provider_web_search",
          status: "discovered",
          partnershipType: "unknown",
          metadata: { provider: result.provider, model: result.model } as Prisma.JsonObject,
        },
      });

      created.push(candidate);
    }

    return Response.json({
      created,
      createdCount: created.length,
      skipped,
      skippedCount: skipped.length,
      provider: result.provider,
      model: result.model,
    });
  } catch (error) {
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
