import { Prisma } from "@prisma/client";

import { providerErrorMetadata, runProviderAgent1 } from "@/lib/ai/provider-agents";
import { prisma } from "@/lib/prisma";
import { runDeterministicAgent1 } from "@/lib/research/agent1";
import { crawlWebsite } from "@/lib/research/website";

function asJsonObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function parseWebsiteUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export async function ingestLeadWebsite(params: {
  organizationId: string;
  leadId: string;
  url: string;
}) {
  const { organizationId, leadId, url } = params;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId, deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      companyId: true,
      contactId: true,
      metadata: true,
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  const crawledPages = await crawlWebsite(url, 5);
  const extractedEmails = Array.from(new Set(crawledPages.flatMap((page) => page.extractedEmails)));
  const extractedPhones = Array.from(new Set(crawledPages.flatMap((page) => page.extractedPhones)));
  const rawText = crawledPages
    .map((page) => `# ${page.pageType.toUpperCase()} — ${page.url}\n${page.rawText}`)
    .join("\n\n")
    .slice(0, 60000);

  const snapshot = await prisma.websiteSnapshot.create({
    data: {
      organizationId,
      leadId: lead.id,
      companyId: lead.companyId,
      contactId: lead.contactId,
      url,
      rawText,
      textLength: rawText.length,
      metadata: {
        extractedEmails,
        extractedPhones,
        source: "manual_lead_research",
        crawledPageCount: crawledPages.length,
        crawledPageUrls: crawledPages.map((page) => page.url),
      },
      pages: {
        create: crawledPages.map((page) => ({
          organizationId,
          leadId: lead.id,
          companyId: lead.companyId,
          contactId: lead.contactId,
          url: page.url,
          pageType: page.pageType,
          rawText: page.rawText,
          extractedEmails: page.extractedEmails,
          extractedPhones: page.extractedPhones,
        })),
      },
    },
    include: { pages: true },
  });

  const leadMetadata = asJsonObject(lead.metadata);
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      metadata: {
        ...leadMetadata,
        websiteUrl: url,
        latestSnapshotId: snapshot.id,
        latestWebsiteIngestedAt: snapshot.fetchedAt.toISOString(),
        extractedEmails,
        extractedPhones,
      },
    },
  });

  return { snapshot, lead: updatedLead };
}

export async function runLeadAgent1Research(params: {
  organizationId: string;
  leadId: string;
  snapshotId?: string;
}) {
  const { organizationId, leadId, snapshotId } = params;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId, deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      companyId: true,
      contactId: true,
      stage: true,
      metadata: true,
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  const snapshot = await prisma.websiteSnapshot.findFirst({
    where: {
      id: snapshotId || undefined,
      leadId: lead.id,
      organizationId,
    },
    orderBy: { fetchedAt: "desc" },
  });

  if (!snapshot) {
    throw new Error("Run website ingestion before Agent 1 research");
  }

  let output = runDeterministicAgent1(snapshot.rawText);
  let providerFallback: Prisma.JsonObject | null = null;

  try {
    const providerOutput = await runProviderAgent1(organizationId, snapshot.rawText);
    if (providerOutput) {
      output = {
        ...output,
        ...providerOutput,
      };
    }
  } catch (providerError) {
    providerFallback = providerErrorMetadata(providerError);
  }

  const finalOutput = providerFallback ? { ...output, ...providerFallback } : output;
  const researchRun = await prisma.agentResearchRun.create({
    data: {
      organizationId,
      leadId: lead.id,
      snapshotId: snapshot.id,
      companyId: lead.companyId,
      contactId: lead.contactId,
      agent: "agent1",
      status: "completed",
      output: finalOutput,
      promptKey: output.promptKey,
      promptSource: output.promptSource,
    },
  });

  const metadata = asJsonObject(lead.metadata);
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: lead.stage === "new" ? "evaluating" : lead.stage,
      metadata: {
        ...metadata,
        latestAgent1RunId: researchRun.id,
        latestAgent1Output: finalOutput,
        latestSnapshotId: snapshot.id,
        researchConfidence: output.confidence_score,
        researchCompletedAt: researchRun.createdAt.toISOString(),
      },
    },
  });

  return { researchRun, output: finalOutput, lead: updatedLead };
}

export async function ingestAndResearchLeadWebsite(params: {
  organizationId: string;
  leadId: string;
  url: string;
}) {
  const ingestion = await ingestLeadWebsite(params);
  const research = await runLeadAgent1Research({
    organizationId: params.organizationId,
    leadId: params.leadId,
    snapshotId: ingestion.snapshot.id,
  });

  return { ...ingestion, ...research };
}
