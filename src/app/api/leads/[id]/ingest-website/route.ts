import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/auth/workspace";
import { extractEmails, extractPhones, fetchWebsiteText, inferPageType } from "@/lib/research/website";

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

async function resolveOrganizationId(request: NextRequest, body?: IngestWebsiteBody) {
  return resolveWorkspaceId(request, body);
}

function parseWebsiteUrl(value: unknown) {
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

function asJsonObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return jsonError("Lead not found", 404);
    }
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

  const organizationId = await resolveOrganizationId(request, body);
  const url = parseWebsiteUrl(body.url);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  if (!url) {
    return jsonError("url must be a valid http(s) URL", 400);
  }

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        contactId: true,
        metadata: true,
      },
    });

    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    const rawText = await fetchWebsiteText(url);
    const extractedEmails = extractEmails(rawText);
    const extractedPhones = extractPhones(rawText);

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
        },
        pages: {
          create: {
            organizationId,
            leadId: lead.id,
            companyId: lead.companyId,
            contactId: lead.contactId,
            url,
            pageType: inferPageType(url),
            rawText,
            extractedEmails,
            extractedPhones,
          },
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

    return Response.json({ snapshot, lead: updatedLead }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Website returned")) {
      return jsonError(error.message, 502);
    }

    return handlePrismaError(error);
  }
}
