import { getCrmAgentPrompt } from "@/lib/ai/crm-agent-prompts";

type JsonObject = Record<string, unknown>;

export type DraftMode = "signal" | "fallback" | "soft" | "partnership";

export type Agent2DraftInput = {
  mode: DraftMode;
  leadTitle: string;
  companyName?: string | null;
  contactName?: string | null;
  websiteUrl?: string | null;
  agent1Output?: JsonObject | null;
  workspaceProfile?: JsonObject | null;
  workspaceStrategy?: JsonObject | null;
};

export type Agent2DraftOutput = {
  subject: string;
  email_body: string;
  used_signal: string;
  promptKey: string;
  promptSource: string;
  generationMode: string;
  provider?: string;
  model?: string;
};

export type Agent3VerifierOutput = {
  decision: "send" | "hold";
  reason: string;
  final_subject: string;
  final_email: string;
  promptKey: string;
  promptSource: string;
  generationMode: string;
  provider?: string;
  model?: string;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNestedObject(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !(key in value)) {
    return null;
  }

  const objectValue = value as JsonObject;
  const nested = objectValue[key];
  return nested && typeof nested === "object" && !Array.isArray(nested) ? nested as JsonObject : null;
}

function firstSignal(agent1Output?: JsonObject | null) {
  const signals = Array.isArray(agent1Output?.signals_found) ? agent1Output.signals_found : [];
  const signal = signals.find((item) => item && typeof item === "object" && !Array.isArray(item)) as JsonObject | undefined;
  const signalText = readString(signal?.signal);
  const evidence = readString(signal?.evidence_quote);

  if (signalText) {
    return { signal: signalText, evidence };
  }

  const pains = Array.isArray(agent1Output?.pain_points_detected) ? agent1Output.pain_points_detected : [];
  const pain = pains.find((item) => item && typeof item === "object" && !Array.isArray(item)) as JsonObject | undefined;
  const painText = readString(pain?.pain);

  return painText ? { signal: painText, evidence: readString(pain?.evidence_quote) } : null;
}

function workspaceService(input: Agent2DraftInput) {
  const profile = input.workspaceProfile;
  const strategy = input.workspaceStrategy;
  const specialties = readStringArray(profile?.serviceSpecialties);
  const businessDescription = readString(profile?.businessDescription);
  const selectedCta = readString(strategy?.selectedCtaStyle) || readString(profile?.preferredCta);

  return {
    businessName: readString(profile?.businessName) || "Blue Arc",
    service: specialties[0] || businessDescription || "field-service and technology support",
    cta: selectedCta || "Would a short call next week make sense?",
    tone: readString(profile?.preferredTone) || "professional",
  };
}

function signature(profile?: JsonObject | null) {
  const senderName = readString(profile?.senderName);
  const senderTitle = readString(profile?.senderTitle);
  const senderPhone = readString(profile?.senderPhone);
  const senderEmail = readString(profile?.senderEmail);
  const lines = ["Best regards"];

  if (senderName) {
    lines.push(senderName);
  }

  if (senderTitle) {
    lines.push(senderTitle);
  }

  if (senderPhone) {
    lines.push(senderPhone);
  }

  if (senderEmail) {
    lines.push(senderEmail);
  }

  return lines.join("\n");
}

export function runDeterministicAgent2(input: Agent2DraftInput): Agent2DraftOutput {
  const prompt = getCrmAgentPrompt(input.mode === "partnership" ? "agent2PartnershipOutreach" : "agent2Outreach");
  const service = workspaceService(input);
  const companyName = input.companyName || input.leadTitle;
  const contactName = input.contactName ? ` ${input.contactName}` : "";
  const signal = firstSignal(input.agent1Output);
  const summary = readNestedObject(input.agent1Output, "website_summary");
  const summaryLine = readString(summary?.one_liner);
  const opener =
    input.mode === "signal" && signal
      ? `I noticed ${companyName} mentions ${signal.signal.toLowerCase().replace(/\.$/, "")}.`
      : input.mode === "partnership"
        ? `I came across ${companyName} and the work your team does.`
        : summaryLine
          ? `I took a quick look at ${companyName}: ${summaryLine.slice(0, 140)}.`
          : `I wanted to reach out after looking at ${companyName}.`;
  const body =
    input.mode === "partnership"
      ? `Hi${contactName},\n\n${opener}\n\n${service.businessName} handles ${service.service}, and I wanted to see if there is a fit to support your project pipeline as a local field partner when coverage is needed.\n\n${service.cta}\n\n${signature(input.workspaceProfile)}`
      : `Hi${contactName},\n\n${opener}\n\n${service.businessName} helps teams with ${service.service}. If this is relevant, I can keep it practical and focus on where we may be useful rather than sending a generic pitch.\n\n${service.cta}\n\n${signature(input.workspaceProfile)}`;

  return {
    subject: input.mode === "partnership" ? `Potential field partner for ${companyName}` : `Quick question for ${companyName}`,
    email_body: body,
    used_signal: signal?.evidence || signal?.signal || summaryLine || "No specific website signal; used soft/fallback outreach mode.",
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: "deterministic_v1",
  };
}

export function runDeterministicAgent3(params: {
  draft: Agent2DraftOutput;
  agent1Output?: JsonObject | null;
  mode: DraftMode;
  workspaceProfile?: JsonObject | null;
}): Agent3VerifierOutput {
  const prompt = getCrmAgentPrompt("agent3Verifier");
  const finalEmail = params.draft.email_body.replace(/\[[^\]]+\]/g, "").trim();
  const hasPlaceholder = /\[[^\]]+\]/.test(params.draft.email_body);
  const senderName = readString(params.workspaceProfile?.senderName);
  const hasSpecificSignal = Boolean(firstSignal(params.agent1Output));
  const sendable =
    !hasPlaceholder &&
    (params.mode !== "signal" || hasSpecificSignal) &&
    (!senderName || finalEmail.includes(senderName));

  return {
    decision: sendable ? "send" : "hold",
    reason: sendable
      ? "Draft passes placeholder, signal support, and signature checks."
      : "Draft needs human review because signal support or sender signature is incomplete.",
    final_subject: params.draft.subject,
    final_email: finalEmail,
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: "deterministic_v1",
  };
}
