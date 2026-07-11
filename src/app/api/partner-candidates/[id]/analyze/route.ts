import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { runDeterministicPartnershipFit } from "@/lib/partners/partnership-fit";
import { fetchWebsiteText } from "@/lib/research/website";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type AnalyzeBody = {
  organizationId?: unknown;
  websiteText?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as AnalyzeBody;
  } catch {
    return {};
  }
}

async function resolveOrganizationId(request: NextRequest, body?: AnalyzeBody) {
  return resolveWorkspace(request, body);
}

function asJsonObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const candidate = await prisma.partnerCandidate.findFirst({
      where: { id, organizationId },
    });

    if (!candidate) {
      return jsonError("Partner candidate not found", 404);
    }

    const workspaceProfile = await prisma.workspaceProfile.findUnique({
      where: { organizationId },
    });
    const manualText = typeof body.websiteText === "string" ? body.websiteText.trim() : "";
    const websiteText = manualText || (candidate.website ? await fetchWebsiteText(candidate.website) : "");

    if (!websiteText) {
      return jsonError("Candidate needs a website or pasted website text before analysis", 400);
    }

    const output = runDeterministicPartnershipFit({
      companyName: candidate.name,
      website: candidate.website,
      description: candidate.description,
      industry: candidate.industry,
      websiteText,
      workspaceProfile: workspaceProfile
        ? {
          businessName: workspaceProfile.businessName,
          businessDescription: workspaceProfile.businessDescription,
          serviceArea: workspaceProfile.serviceArea,
          industriesServed: workspaceProfile.industriesServed,
          serviceSpecialties: workspaceProfile.serviceSpecialties,
          preferredTone: workspaceProfile.preferredTone,
          preferredCta: workspaceProfile.preferredCta,
        }
        : null,
    });

    const partnerCandidate = await prisma.partnerCandidate.update({
      where: { id: candidate.id },
      data: {
        status: output.fit_score >= 0.55 ? "qualified" : "researching",
        partnershipType: output.partnership_type,
        fitScore: output.fit_score,
        fitReasons: output.fit_reasons,
        recommendedOutreachAngle: output.recommended_outreach_angle,
        contactEmails: output.contact_emails,
        contactFormUrl: output.contact_form_url,
        industry: output.industry ?? candidate.industry,
        promptKey: output.promptKey,
        promptSource: output.promptSource,
        analyzedAt: new Date(),
        metadata: {
          ...asJsonObject(candidate.metadata),
          partnershipFitOutput: output,
          analyzedTextLength: websiteText.length,
        },
      },
      include: {
        company: { select: { id: true, name: true } },
        lead: { select: { id: true, title: true } },
      },
    });

    return Response.json({ partnerCandidate, output });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Website returned")) {
      return jsonError(error.message, 502);
    }

    return handlePrismaError(error);
  }
}
