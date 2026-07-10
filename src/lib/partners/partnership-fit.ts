import { getCrmAgentPrompt } from "@/lib/ai/crm-agent-prompts";
import { extractEmails } from "@/lib/research/website";

type JsonObject = Record<string, unknown>;

type PartnershipType = "subcontractor" | "vendor_network" | "referral_partner" | "field_service_partner" | "unknown";

export type PartnershipFitInput = {
  companyName: string;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  websiteText: string;
  workspaceProfile?: JsonObject | null;
};

export type PartnershipFitOutput = {
  company_summary: string;
  partnership_type: PartnershipType;
  fit_score: number;
  fit_reasons: string[];
  recommended_outreach_angle: string;
  contact_emails: string[];
  contact_form_url: string | null;
  industry: string | null;
  promptKey: string;
  promptSource: string;
  generationMode: "deterministic_v1";
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function sentenceContaining(text: string, terms: string[]) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const sentence = sentences.find((item) => {
    const lower = item.toLowerCase();
    return terms.some((term) => lower.includes(term));
  });

  return sentence?.trim().slice(0, 240) ?? "";
}

function inferContactFormUrl(website: string | null | undefined, text: string) {
  if (!website || !includesAny(text.toLowerCase(), ["contact", "partner", "vendor", "subcontractor"])) {
    return null;
  }

  try {
    const url = new URL(website);
    return `${url.origin}/contact`;
  } catch {
    return null;
  }
}

function inferPartnershipType(text: string): PartnershipType {
  if (includesAny(text, ["subcontractor", "sub-contractor", "contractor network"])) {
    return "subcontractor";
  }

  if (includesAny(text, ["vendor network", "vendor portal", "approved vendor", "vendors"])) {
    return "vendor_network";
  }

  if (includesAny(text, ["field service", "dispatch", "on-site", "onsite", "technician"])) {
    return "field_service_partner";
  }

  if (includesAny(text, ["partner", "referral", "channel"])) {
    return "referral_partner";
  }

  return "unknown";
}

export function runDeterministicPartnershipFit(input: PartnershipFitInput): PartnershipFitOutput {
  const prompt = getCrmAgentPrompt("partnershipFit");
  const lower = `${input.description ?? ""} ${input.industry ?? ""} ${input.websiteText}`.toLowerCase();
  const serviceArea = readString(input.workspaceProfile?.serviceArea);
  const specialties = readStringArray(input.workspaceProfile?.serviceSpecialties);
  const partnershipType = inferPartnershipType(lower);
  const reasons: string[] = [];

  const vendorEvidence = sentenceContaining(input.websiteText, ["vendor", "subcontractor", "partner", "dispatch", "field service", "on-site", "onsite"]);
  if (vendorEvidence) {
    reasons.push(vendorEvidence);
  }

  if (specialties.length && includesAny(lower, specialties.map((item) => item.toLowerCase()))) {
    reasons.push(`Overlaps with workspace specialties: ${specialties.slice(0, 3).join(", ")}.`);
  }

  if (serviceArea && lower.includes(serviceArea.toLowerCase())) {
    reasons.push(`Mentions the workspace service area: ${serviceArea}.`);
  }

  if (!reasons.length && input.description) {
    reasons.push(input.description.slice(0, 220));
  }

  const strongTerms = ["subcontractor", "vendor portal", "approved vendor", "dispatch", "field service", "on-site", "onsite"];
  const moderateTerms = ["partner", "network", "nationwide", "regional", "installation", "maintenance", "support"];
  const strongMatches = strongTerms.filter((term) => lower.includes(term)).length;
  const moderateMatches = moderateTerms.filter((term) => lower.includes(term)).length;
  const fitScore = Math.min(1, 0.18 + strongMatches * 0.18 + moderateMatches * 0.08 + Math.min(reasons.length, 3) * 0.08);
  const roundedScore = Number(fitScore.toFixed(2));
  const companySummary = input.description || sentenceContaining(input.websiteText, ["service", "provide", "specialize", "team"]) || `${input.companyName} is a potential partnership target.`;
  const servicePhrase = specialties.length ? specialties.slice(0, 2).join(" / ") : "local field-service support";

  return {
    company_summary: companySummary.slice(0, 300),
    partnership_type: partnershipType,
    fit_score: roundedScore,
    fit_reasons: reasons.slice(0, 5),
    recommended_outreach_angle:
      roundedScore >= 0.55
        ? `Ask to be considered for ${servicePhrase} work as a local vendor or field partner${serviceArea ? ` in ${serviceArea}` : ""}.`
        : `Use a soft partnership ask and confirm whether they maintain a vendor or subcontractor network for ${servicePhrase}.`,
    contact_emails: extractEmails(input.websiteText),
    contact_form_url: inferContactFormUrl(input.website, lower),
    industry: input.industry || null,
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: "deterministic_v1",
  };
}
