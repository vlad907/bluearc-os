import { Prisma } from "@prisma/client";

import { providerErrorMetadata, runProviderPartnerSearch } from "@/lib/ai/provider-agents";
import { prisma } from "@/lib/prisma";

export class PartnerSearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerSearchUnavailableError";
  }
}

export class PartnerSearchProviderError extends Error {
  metadata: ReturnType<typeof providerErrorMetadata>;

  constructor(error: unknown) {
    super("Partner search failed");
    this.name = "PartnerSearchProviderError";
    this.metadata = providerErrorMetadata(error);
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

export async function buildPartnerSearchQuery(organizationId: string, explicitQuery?: unknown) {
  const explicit = typeof explicitQuery === "string" ? explicitQuery.trim() : "";

  if (explicit) {
    return explicit;
  }

  const [profile, strategy] = await Promise.all([
    prisma.workspaceProfile.findUnique({ where: { organizationId } }),
    prisma.workspaceAiStrategy.findUnique({ where: { organizationId } }),
  ]);

  if (!profile && !strategy) {
    throw new PartnerSearchUnavailableError("Add a workspace profile or provide a search query before running partner search");
  }

  return buildQueryFromProfile(profile, strategy);
}

export async function searchAndPersistPartnerCandidates(params: {
  organizationId: string;
  query?: unknown;
}) {
  const query = await buildPartnerSearchQuery(params.organizationId, params.query);

  let result;
  try {
    result = await runProviderPartnerSearch(params.organizationId, query);
  } catch (error) {
    throw new PartnerSearchProviderError(error);
  }

  if (!result) {
    throw new PartnerSearchUnavailableError(
      "Live partner search requires a configured Anthropic provider with web search, and available AI budget",
    );
  }

  const existing = await prisma.partnerCandidate.findMany({
    where: { organizationId: params.organizationId },
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
        organizationId: params.organizationId,
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

  return {
    query,
    created,
    createdCount: created.length,
    skipped,
    skippedCount: skipped.length,
    provider: result.provider,
    model: result.model,
  };
}
