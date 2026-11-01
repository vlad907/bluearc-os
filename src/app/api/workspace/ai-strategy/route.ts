import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { getCrmAgentPrompt } from "@/lib/ai/crm-agent-prompts";
import { providerErrorMetadata, runProviderWorkspaceStrategy } from "@/lib/ai/provider-agents";

export const dynamic = "force-dynamic";

const stringListFields = ["selectedTargetCategories", "selectedPriorityPainPoints"] as const;
const defaultGuardrails = ["No placeholders", "No unsupported claims", "Match the workspace business type"];

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown> | null) {
  return resolveWorkspace(request, body);
}

function parseStringList(value: unknown, field: string) {
  if (value === undefined) {
    return { value: undefined, error: null };
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return { value: undefined, error: `${field} must be an array of strings` };
  }

  return {
    value: value.map((item) => item.trim()).filter(Boolean),
    error: null,
  };
}

function asJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Prisma.JsonObject : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readString(item)).filter(Boolean)
    : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compactProfile(profile: {
  businessName: string | null;
  businessDescription: string | null;
  serviceArea: string | null;
  industriesServed: string[];
  serviceSpecialties: string[];
  preferredTone: string | null;
  outreachStyle: string | null;
  preferredCta: string | null;
  doNotMention: string[];
  senderName: string | null;
  senderTitle: string | null;
  senderEmail: string | null;
}) {
  return {
    business_name: profile.businessName,
    business_description: profile.businessDescription,
    service_area: profile.serviceArea,
    industries_served: profile.industriesServed,
    service_specialties: profile.serviceSpecialties,
    preferred_tone: profile.preferredTone,
    outreach_style: profile.outreachStyle,
    preferred_cta: profile.preferredCta,
    do_not_mention: profile.doNotMention,
    sender: {
      name: profile.senderName,
      title: profile.senderTitle,
      email: profile.senderEmail,
    },
  } satisfies Prisma.JsonObject;
}

function inferBusinessType(profileText: string) {
  const text = profileText.toLowerCase();
  if (/(solar|photovoltaic|panel|renewable)/.test(text)) {
    return "solar";
  }

  if (/(hvac|plumbing|electrical|roofing|home service)/.test(text)) {
    return "home_services";
  }

  if (/(it|msp|network|wifi|wi-fi|pos|low voltage|low-voltage|security camera|cabling)/.test(text)) {
    return "it_field_services";
  }

  if (/(law|legal|attorney|compliance)/.test(text)) {
    return "legal";
  }

  return "general_b2b";
}

function defaultTargetsForType(type: string, industries: string[]) {
  if (industries.length) {
    return industries.slice(0, 6);
  }

  if (type === "solar") {
    return ["commercial property owners", "restaurants", "retail centers", "warehouses"];
  }

  if (type === "home_services") {
    return ["property managers", "facility managers", "multi-site operators", "homeowners"];
  }

  if (type === "it_field_services") {
    return ["restaurants", "retail operators", "property managers", "distributed offices"];
  }

  if (type === "legal") {
    return ["small businesses", "professional services firms", "property owners", "operators with compliance needs"];
  }

  return ["local businesses", "property managers", "operations teams", "multi-site operators"];
}

function defaultPainPointsForType(type: string, specialties: string[]) {
  if (specialties.length) {
    return specialties.map((specialty) => `Need reliable help with ${specialty}`).slice(0, 8);
  }

  if (type === "solar") {
    return ["High utility costs", "Unclear project ROI", "Roof/site suitability questions", "Need a practical installation plan"];
  }

  if (type === "home_services") {
    return ["Equipment downtime", "Slow vendor response", "Deferred maintenance", "Urgent repair coordination"];
  }

  if (type === "it_field_services") {
    return ["Network downtime", "Unreliable Wi-Fi", "POS rollout delays", "Need local hands for field work"];
  }

  if (type === "legal") {
    return ["Compliance uncertainty", "Contract risk", "Slow issue resolution", "Need clear next steps"];
  }

  return ["Operational friction", "Vendor coordination issues", "Slow response times", "Need dependable local execution"];
}

function defaultCtasForType(type: string, preferredCta: string | null) {
  if (preferredCta?.trim()) {
    return [preferredCta.trim()];
  }

  if (type === "solar") {
    return ["site assessment", "energy savings review", "project quote"];
  }

  if (type === "home_services") {
    return ["site visit", "repair estimate", "maintenance walkthrough"];
  }

  if (type === "it_field_services") {
    return ["short call", "site walkthrough", "field support discussion"];
  }

  if (type === "legal") {
    return ["intro call", "case review", "compliance discussion"];
  }

  return ["short call", "fit discussion", "intro meeting"];
}

function buildDeterministicStrategy(profile: ReturnType<typeof compactProfile>, metadata: Prisma.JsonObject = {}) {
  const industries = readStringArray(profile.industries_served);
  const specialties = readStringArray(profile.service_specialties);
  const businessName = readString(profile.business_name) || "This business";
  const serviceArea = readString(profile.service_area);
  const businessType = inferBusinessType(JSON.stringify(profile));
  const targetCategories = uniqueStrings(defaultTargetsForType(businessType, industries));
  const priorityPainPoints = uniqueStrings(defaultPainPointsForType(businessType, specialties));
  const ctaRecommendations = uniqueStrings(defaultCtasForType(businessType, readString(profile.preferred_cta)));
  const servicePhrase = specialties.length ? specialties.join(", ") : "reliable service";
  const areaPhrase = serviceArea ? ` in ${serviceArea}` : "";
  const rapportPoints = Object.fromEntries(
    targetCategories.map((category) => [
      category,
      [
        `Mention operational needs common to ${category}.`,
        `Connect ${servicePhrase} to one concrete business outcome.`,
        `Offer a specific next step: ${ctaRecommendations[0] ?? "short call"}.`,
        `Keep the message grounded in publicly visible signals.`,
      ],
    ]),
  );

  const prompt = getCrmAgentPrompt("workspaceStrategy");

  return {
    ideal_customers: targetCategories,
    priority_pain_points: priorityPainPoints,
    core_positioning: `${businessName} helps ${targetCategories.slice(0, 3).join(", ")}${areaPhrase} with ${servicePhrase}.`,
    rapport_points: rapportPoints,
    cta_recommendations: ctaRecommendations,
    guardrails: uniqueStrings([...readStringArray(profile.do_not_mention).map((item) => `Do not mention: ${item}`), ...defaultGuardrails]),
    business_type: businessType,
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: "deterministic_v1",
    generatedAt: new Date().toISOString(),
    ...metadata,
  } satisfies Prisma.JsonObject;
}

function normalizeGeneratedStrategy(value: unknown) {
  const object = asJsonObject(value);

  if (!object) {
    return null;
  }

  const prompt = getCrmAgentPrompt("workspaceStrategy");

  return {
    ...object,
    promptKey: readString(object.promptKey) || prompt.key,
    promptSource: readString(object.promptSource) || prompt.sourceFile,
    generatedAt: readString(object.generatedAt) || new Date().toISOString(),
  } satisfies Prisma.JsonObject;
}

function selectedValuesFromStrategy(strategy: Prisma.JsonObject) {
  const targets = uniqueStrings([
    ...readStringArray(strategy.ideal_customers),
    ...readStringArray(strategy.target_categories),
    ...readStringArray(strategy.selectedTargetCategories),
  ]);
  const painPoints = uniqueStrings([
    ...readStringArray(strategy.priority_pain_points),
    ...readStringArray(strategy.pain_points),
    ...readStringArray(strategy.selectedPriorityPainPoints),
  ]);
  const ctas = readStringArray(strategy.cta_recommendations);

  return {
    selectedTargetCategories: targets.slice(0, 8),
    selectedPriorityPainPoints: painPoints.slice(0, 8),
    selectedCtaStyle: readString(strategy.selectedCtaStyle) || readString(strategy.selected_cta_style) || ctas[0] || null,
    guardrails: {
      notes: uniqueStrings([
        ...readStringArray(strategy.guardrails),
        ...readStringArray(asJsonObject(strategy.guardrails)?.notes),
        ...defaultGuardrails,
      ]),
    } satisfies Prisma.JsonObject,
  };
}

function buildStrategyData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of stringListFields) {
    const parsed = parseStringList(body[field], field);
    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }

    if (parsed.value !== undefined) {
      data[field] = parsed.value;
    }
  }

  if (body.selectedCtaStyle !== undefined) {
    if (body.selectedCtaStyle !== null && typeof body.selectedCtaStyle !== "string") {
      errors.push("selectedCtaStyle must be a string or null");
    } else {
      data.selectedCtaStyle = typeof body.selectedCtaStyle === "string" && body.selectedCtaStyle.trim()
        ? body.selectedCtaStyle.trim()
        : null;
    }
  }

  if (body.generatedStrategy !== undefined) {
    data.generatedStrategy = body.generatedStrategy;
  }

  if (body.guardrails !== undefined) {
    data.guardrails = body.guardrails;
  }

  return { data, errors };
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return jsonError("Workspace not found", 404);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const strategy = await prisma.workspaceAiStrategy.findUnique({
      where: { organizationId },
    });

    return Response.json({ strategy });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  const { data, errors } = buildStrategyData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const strategy = await prisma.workspaceAiStrategy.upsert({
      where: { organizationId },
      update: data,
      create: {
        organizationId,
        ...data,
      },
    });

    return Response.json({ strategy });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const profile = await prisma.workspaceProfile.findUnique({
      where: { organizationId },
      select: {
        businessName: true,
        businessDescription: true,
        serviceArea: true,
        industriesServed: true,
        serviceSpecialties: true,
        preferredTone: true,
        outreachStyle: true,
        preferredCta: true,
        doNotMention: true,
        senderName: true,
        senderTitle: true,
        senderEmail: true,
      },
    });

    if (!profile) {
      return jsonError("Save a workspace profile before generating AI strategy", 400);
    }

    const compactedProfile = compactProfile(profile);
    let generatedStrategy: Prisma.JsonObject;
    let providerUsed = false;

    try {
      const providerStrategy = await runProviderWorkspaceStrategy(organizationId, compactedProfile);
      const normalizedProviderStrategy = normalizeGeneratedStrategy(providerStrategy);

      if (normalizedProviderStrategy) {
        generatedStrategy = normalizedProviderStrategy;
        providerUsed = true;
      } else {
        generatedStrategy = buildDeterministicStrategy(compactedProfile, { fallbackReason: "No configured AI provider" });
      }
    } catch (error) {
      generatedStrategy = buildDeterministicStrategy(compactedProfile, providerErrorMetadata(error));
    }

    const selectedValues = selectedValuesFromStrategy(generatedStrategy);
    const strategy = await prisma.workspaceAiStrategy.upsert({
      where: { organizationId },
      update: {
        generatedStrategy,
        ...selectedValues,
      },
      create: {
        organizationId,
        generatedStrategy,
        ...selectedValues,
      },
    });

    return Response.json({ strategy, providerUsed });
  } catch (error) {
    return handlePrismaError(error);
  }
}
