import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type ConvertBody = {
  organizationId?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as ConvertBody;
  } catch {
    return {};
  }
}

async function resolveOrganizationId(request: NextRequest, body?: ConvertBody) {
  return resolveWorkspaceId(request, body);
}

function domainFromWebsite(website: string | null) {
  if (!website) {
    return null;
  }

  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return jsonError("Partner candidate not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const organizationId = await resolveOrganizationId(request, body);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const candidate = await prisma.partnerCandidate.findFirst({
      where: { id, organizationId },
    });

    if (!candidate) {
      return jsonError("Partner candidate not found", 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = candidate.companyId
        ? await tx.company.update({
          where: { id: candidate.companyId },
          data: {
            relationshipType: "partner",
            website: candidate.website,
            industry: candidate.industry,
            metadata: {
              partnerCandidateId: candidate.id,
              fitScore: candidate.fitScore,
              partnershipType: candidate.partnershipType,
              recommendedOutreachAngle: candidate.recommendedOutreachAngle,
            },
          },
        })
        : await tx.company.create({
          data: {
            organizationId,
            name: candidate.name,
            relationshipType: "partner",
            domain: domainFromWebsite(candidate.website),
            website: candidate.website,
            industry: candidate.industry,
            status: "prospect",
            metadata: {
              source: "partner_candidate_conversion",
              partnerCandidateId: candidate.id,
              fitScore: candidate.fitScore,
              partnershipType: candidate.partnershipType,
              recommendedOutreachAngle: candidate.recommendedOutreachAngle,
            },
          },
        });

      const lead = candidate.leadId
        ? await tx.lead.update({
          where: { id: candidate.leadId },
          data: { companyId: company.id, stage: "evaluating" },
        })
        : await tx.lead.create({
          data: {
            organizationId,
            companyId: company.id,
            title: `${candidate.name} partnership lead`,
            stage: "evaluating",
            probability: candidate.fitScore ? Math.round(candidate.fitScore * 100) : 35,
            source: "partner_candidate",
            metadata: {
              partnerCandidateId: candidate.id,
              partnershipType: candidate.partnershipType,
              recommendedOutreachAngle: candidate.recommendedOutreachAngle,
              contactEmails: candidate.contactEmails,
              contactFormUrl: candidate.contactFormUrl,
            },
          },
        });

      const task = await tx.task.create({
        data: {
          organizationId,
          title: `Prepare partnership outreach for ${candidate.name}`,
          description: candidate.recommendedOutreachAngle ?? "Review candidate fit and prepare a partnership outreach draft.",
          status: "todo",
          priority: candidate.fitScore && candidate.fitScore >= 0.7 ? "high" : "medium",
          entityType: "lead",
          entityId: lead.id,
          metadata: {
            source: "partner_candidate_conversion",
            partnerCandidateId: candidate.id,
          },
        },
      });

      const partnerCandidate = await tx.partnerCandidate.update({
        where: { id: candidate.id },
        data: {
          status: "converted",
          companyId: company.id,
          leadId: lead.id,
          convertedAt: new Date(),
        },
      });

      return { company, lead, task, partnerCandidate };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
