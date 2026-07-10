import { Prisma } from "@prisma/client";

import { getCrmAgentPrompt } from "@/lib/ai/crm-agent-prompts";
import { prisma } from "@/lib/prisma";
import { Agent2DraftInput, Agent2DraftOutput, Agent3VerifierOutput, DraftMode } from "@/lib/outreach/draft-agents";

type JsonObject = Record<string, unknown>;

type AiProvider = {
  provider: "openai" | "anthropic";
  apiKey: string;
  model: string;
};

function asJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonObject(text: string) {
  try {
    return asJsonObject(JSON.parse(text));
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return asJsonObject(JSON.parse(match[0]));
    } catch {
      return null;
    }
  }
}

function extractOpenAiText(payload: unknown) {
  const objectPayload = asJsonObject(payload);
  const outputText = readString(objectPayload?.output_text);

  if (outputText) {
    return outputText;
  }

  const output = Array.isArray(objectPayload?.output) ? objectPayload.output : [];
  for (const outputItem of output) {
    const outputObject = asJsonObject(outputItem);
    const content = Array.isArray(outputObject?.content) ? outputObject.content : [];
    for (const contentItem of content) {
      const contentObject = asJsonObject(contentItem);
      const text = readString(contentObject?.text);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

function extractAnthropicText(payload: unknown) {
  const objectPayload = asJsonObject(payload);
  const content = Array.isArray(objectPayload?.content) ? objectPayload.content : [];

  for (const contentItem of content) {
    const contentObject = asJsonObject(contentItem);
    const text = readString(contentObject?.text);
    if (text) {
      return text;
    }
  }

  return "";
}

async function getConfiguredAiProvider(organizationId: string): Promise<AiProvider | null> {
  const credentials = await prisma.integrationCredential.findMany({
    where: {
      organizationId,
      kind: "ai_provider",
      status: { in: ["configured", "connected"] },
      provider: { in: ["openai", "anthropic"] },
    },
    orderBy: { provider: "desc" },
  });

  for (const credential of credentials) {
    const apiKey = credential.envKeyName ? process.env[credential.envKeyName] : undefined;
    if (!apiKey) {
      continue;
    }

    if (credential.provider === "openai") {
      return {
        provider: "openai",
        apiKey,
        model: process.env.OPENAI_MODEL ?? "gpt-5.2",
      };
    }

    if (credential.provider === "anthropic") {
      return {
        provider: "anthropic",
        apiKey,
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      };
    }
  }

  return null;
}

async function callOpenAiJson(provider: AiProvider, systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      store: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI returned ${response.status}`);
  }

  const payload = await response.json() as unknown;
  const text = extractOpenAiText(payload);
  const object = parseJsonObject(text);

  if (!object) {
    throw new Error("OpenAI returned non-JSON output");
  }

  return object;
}

async function callAnthropicJson(provider: AiProvider, systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 1600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic returned ${response.status}`);
  }

  const payload = await response.json() as unknown;
  const text = extractAnthropicText(payload);
  const object = parseJsonObject(text);

  if (!object) {
    throw new Error("Anthropic returned non-JSON output");
  }

  return object;
}

async function callConfiguredJsonAgent(organizationId: string, systemPrompt: string, userPrompt: string) {
  const provider = await getConfiguredAiProvider(organizationId);

  if (!provider) {
    return null;
  }

  const output = provider.provider === "openai"
    ? await callOpenAiJson(provider, systemPrompt, userPrompt)
    : await callAnthropicJson(provider, systemPrompt, userPrompt);

  return {
    provider: provider.provider,
    model: provider.model,
    output,
  };
}

function normalizedGenerationMode(provider: string) {
  return `provider_${provider}_v1`;
}

export async function runProviderAgent1(organizationId: string, websiteText: string) {
  const prompt = getCrmAgentPrompt("agent1Research");
  const result = await callConfiguredJsonAgent(
    organizationId,
    prompt.prompt,
    `Website text:\n${websiteText.slice(0, 30000)}`,
  );

  if (!result) {
    return null;
  }

  return {
    ...result.output,
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: normalizedGenerationMode(result.provider),
    provider: result.provider,
    model: result.model,
  };
}

export async function runProviderAgent2(organizationId: string, input: Agent2DraftInput): Promise<Agent2DraftOutput | null> {
  const prompt = getCrmAgentPrompt(input.mode === "partnership" ? "agent2PartnershipOutreach" : "agent2Outreach");
  const result = await callConfiguredJsonAgent(
    organizationId,
    prompt.prompt,
    JSON.stringify({
      mode: input.mode,
      leadTitle: input.leadTitle,
      companyName: input.companyName,
      contactName: input.contactName,
      websiteUrl: input.websiteUrl,
      agent1Output: input.agent1Output,
      workspaceProfile: input.workspaceProfile,
      workspaceStrategy: input.workspaceStrategy,
    }, null, 2),
  );

  if (!result) {
    return null;
  }

  const subject = readString(result.output.subject);
  const emailBody = readString(result.output.email_body);

  if (!subject || !emailBody) {
    throw new Error("Provider Agent 2 output is missing subject or email_body");
  }

  return {
    subject,
    email_body: emailBody,
    used_signal: readString(result.output.used_signal) || "Provider output did not report a used signal.",
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: normalizedGenerationMode(result.provider),
    provider: result.provider,
    model: result.model,
  };
}

export async function runProviderAgent3(params: {
  organizationId: string;
  draft: Agent2DraftOutput;
  agent1Output?: JsonObject | null;
  mode: DraftMode;
  workspaceProfile?: JsonObject | null;
}): Promise<Agent3VerifierOutput | null> {
  const prompt = getCrmAgentPrompt("agent3Verifier");
  const result = await callConfiguredJsonAgent(
    params.organizationId,
    prompt.prompt,
    JSON.stringify({
      mode: params.mode,
      draft: params.draft,
      agent1Output: params.agent1Output,
      workspaceProfile: params.workspaceProfile,
    }, null, 2),
  );

  if (!result) {
    return null;
  }

  const decision = result.output.decision === "hold" ? "hold" : "send";
  const finalSubject = readString(result.output.final_subject) || params.draft.subject;
  const finalEmail = readString(result.output.final_email) || params.draft.email_body;

  return {
    decision,
    reason: readString(result.output.reason) || "Provider verifier returned no reason.",
    final_subject: finalSubject,
    final_email: finalEmail,
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: normalizedGenerationMode(result.provider),
    provider: result.provider,
    model: result.model,
  };
}

export function providerErrorMetadata(error: unknown) {
  return {
    providerFallbackReason: error instanceof Error ? error.message : "Provider call failed",
  } satisfies Prisma.JsonObject;
}
