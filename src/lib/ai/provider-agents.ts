import { Prisma } from "@prisma/client";

import { getCrmAgentPrompt } from "@/lib/ai/crm-agent-prompts";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { prisma } from "@/lib/prisma";
import { Agent2DraftInput, Agent2DraftOutput, Agent3VerifierOutput, DraftMode } from "@/lib/outreach/draft-agents";

type JsonObject = Record<string, unknown>;

type AiProvider = {
  provider: "openai" | "anthropic" | "local_openai";
  apiKey: string;
  model: string;
  baseUrl?: string;
};

type ProviderJsonResult = {
  output: JsonObject;
  outputChars: number;
  usage?: {
    requestTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
  };
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

function extractOpenAiUsage(payload: unknown) {
  const objectPayload = asJsonObject(payload);
  const usage = asJsonObject(objectPayload?.usage);

  return {
    requestTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined,
    responseTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined,
    totalTokens: typeof usage?.total_tokens === "number" ? usage.total_tokens : undefined,
  };
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

function extractAnthropicUsage(payload: unknown) {
  const objectPayload = asJsonObject(payload);
  const usage = asJsonObject(objectPayload?.usage);

  return {
    requestTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined,
    responseTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined,
    totalTokens:
      typeof usage?.input_tokens === "number" && typeof usage?.output_tokens === "number"
        ? usage.input_tokens + usage.output_tokens
        : undefined,
  };
}

function extractChatCompletionText(payload: unknown) {
  const objectPayload = asJsonObject(payload);
  const choices = Array.isArray(objectPayload?.choices) ? objectPayload.choices : [];
  const firstChoice = asJsonObject(choices[0]);
  const message = asJsonObject(firstChoice?.message);

  return readString(message?.content);
}

function extractChatCompletionUsage(payload: unknown) {
  const objectPayload = asJsonObject(payload);
  const usage = asJsonObject(objectPayload?.usage);

  return {
    requestTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
    responseTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : undefined,
    totalTokens: typeof usage?.total_tokens === "number" ? usage.total_tokens : undefined,
  };
}

async function logProviderCall(params: {
  organizationId: string;
  provider?: AiProvider["provider"];
  model?: string;
  agent: string;
  promptKey?: string;
  status: "success" | "failed" | "skipped";
  durationMs?: number;
  inputChars?: number;
  outputChars?: number;
  usage?: ProviderJsonResult["usage"];
  error?: string;
  metadata?: Prisma.JsonObject;
}) {
  try {
    const estimatedCostUsd = estimateCostUsd({
      provider: params.provider,
      model: params.model,
      usage: params.usage,
    });

    await prisma.aiProviderCall.create({
      data: {
        organizationId: params.organizationId,
        provider: params.provider,
        model: params.model,
        agent: params.agent,
        promptKey: params.promptKey,
        status: params.status,
        durationMs: params.durationMs,
        inputChars: params.inputChars,
        outputChars: params.outputChars,
        requestTokens: params.usage?.requestTokens,
        responseTokens: params.usage?.responseTokens,
        totalTokens: params.usage?.totalTokens,
        estimatedCostUsd,
        error: params.error?.slice(0, 500),
        metadata: params.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to log provider call", error);
  }
}

async function getConfiguredAiProvider(organizationId: string): Promise<AiProvider | null> {
  const credentials = await prisma.integrationCredential.findMany({
    where: {
      organizationId,
      kind: "ai_provider",
      status: { in: ["configured", "connected"] },
      provider: { in: ["local_openai", "openai", "anthropic"] },
    },
    orderBy: { provider: "desc" },
  });

  const sortedCredentials = credentials.sort((left, right) => {
    const priority = { local_openai: 0, openai: 1, anthropic: 2, google_gmail: 3, google_oauth: 4 };
    return priority[left.provider] - priority[right.provider];
  });

  for (const credential of sortedCredentials) {
    const envValue = credential.envKeyName ? process.env[credential.envKeyName] : undefined;
    if (!envValue) {
      continue;
    }

    if (credential.provider === "local_openai") {
      return {
        provider: "local_openai",
        apiKey: credential.envSecretName ? process.env[credential.envSecretName] ?? "local" : "local",
        baseUrl: envValue.replace(/\/$/, ""),
        model: process.env.LOCAL_LLM_MODEL ?? "local-model",
      };
    }

    if (credential.provider === "openai") {
      return {
        provider: "openai",
        apiKey: envValue,
        model: process.env.OPENAI_MODEL ?? "gpt-5.2",
      };
    }

    if (credential.provider === "anthropic") {
      return {
        provider: "anthropic",
        apiKey: envValue,
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      };
    }
  }

  return null;
}

function monthStart() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function getBudgetBlockReason(organizationId: string) {
  const budget = await prisma.aiUsageBudget.findUnique({ where: { organizationId } });

  if (!budget?.enforce) {
    return null;
  }

  const since = monthStart();
  const perMinuteSince = new Date(Date.now() - 60_000);
  const [callCount, tokenAggregate, recentCallCount] = await Promise.all([
    prisma.aiProviderCall.count({
      where: {
        organizationId,
        createdAt: { gte: since },
        status: { in: ["success", "failed"] },
      },
    }),
    prisma.aiProviderCall.aggregate({
      where: {
        organizationId,
        createdAt: { gte: since },
      },
      _sum: { totalTokens: true, estimatedCostUsd: true },
    }),
    prisma.aiProviderCall.count({
      where: {
        organizationId,
        createdAt: { gte: perMinuteSince },
        status: { in: ["success", "failed"] },
      },
    }),
  ]);

  // Rate limit first: it is the tightest, most protective guardrail.
  if (budget.perMinuteCallLimit !== null && recentCallCount >= budget.perMinuteCallLimit) {
    return `AI rate limit reached (${recentCallCount}/${budget.perMinuteCallLimit} calls in the last minute).`;
  }

  if (budget.monthlyCallLimit !== null && callCount >= budget.monthlyCallLimit) {
    return `Monthly AI call budget reached (${callCount}/${budget.monthlyCallLimit}).`;
  }

  const totalTokens = tokenAggregate._sum.totalTokens ?? 0;
  if (budget.monthlyTokenLimit !== null && totalTokens >= budget.monthlyTokenLimit) {
    return `Monthly AI token budget reached (${totalTokens}/${budget.monthlyTokenLimit}).`;
  }

  const totalCostUsd = tokenAggregate._sum.estimatedCostUsd ?? 0;
  if (budget.monthlyCostLimitUsd !== null && totalCostUsd >= budget.monthlyCostLimitUsd) {
    return `Monthly AI cost budget reached ($${totalCostUsd.toFixed(2)}/$${budget.monthlyCostLimitUsd.toFixed(2)}).`;
  }

  return null;
}

async function callOpenAiJson(provider: AiProvider, systemPrompt: string, userPrompt: string): Promise<ProviderJsonResult> {
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

  return {
    output: object,
    outputChars: text.length,
    usage: extractOpenAiUsage(payload),
  };
}

async function callLocalOpenAiJson(provider: AiProvider, systemPrompt: string, userPrompt: string): Promise<ProviderJsonResult> {
  if (!provider.baseUrl) {
    throw new Error("Local provider is missing base URL");
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Local OpenAI-compatible endpoint returned ${response.status}`);
  }

  const payload = await response.json() as unknown;
  const text = extractChatCompletionText(payload);
  const object = parseJsonObject(text);

  if (!object) {
    throw new Error("Local OpenAI-compatible endpoint returned non-JSON output");
  }

  return {
    output: object,
    outputChars: text.length,
    usage: extractChatCompletionUsage(payload),
  };
}

async function callAnthropicJson(provider: AiProvider, systemPrompt: string, userPrompt: string): Promise<ProviderJsonResult> {
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

  return {
    output: object,
    outputChars: text.length,
    usage: extractAnthropicUsage(payload),
  };
}

async function callProviderJson(provider: AiProvider, systemPrompt: string, userPrompt: string) {
  return provider.provider === "local_openai"
    ? callLocalOpenAiJson(provider, systemPrompt, userPrompt)
    : provider.provider === "openai"
      ? callOpenAiJson(provider, systemPrompt, userPrompt)
      : callAnthropicJson(provider, systemPrompt, userPrompt);
}

async function callConfiguredJsonAgent(
  organizationId: string,
  agent: string,
  promptKey: string,
  systemPrompt: string,
  userPrompt: string,
) {
  const provider = await getConfiguredAiProvider(organizationId);

  if (!provider) {
    await logProviderCall({
      organizationId,
      agent,
      promptKey,
      status: "skipped",
      inputChars: systemPrompt.length + userPrompt.length,
      metadata: { reason: "No configured AI provider" },
    });
    return null;
  }

  const budgetBlockReason = await getBudgetBlockReason(organizationId);

  if (budgetBlockReason) {
    await logProviderCall({
      organizationId,
      provider: provider.provider,
      model: provider.model,
      agent,
      promptKey,
      status: "skipped",
      inputChars: systemPrompt.length + userPrompt.length,
      error: budgetBlockReason,
      metadata: { reason: "AI usage budget blocked provider call" },
    });
    return null;
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      const result = await callProviderJson(provider, systemPrompt, userPrompt);
      await logProviderCall({
        organizationId,
        provider: provider.provider,
        model: provider.model,
        agent,
        promptKey,
        status: "success",
        durationMs: Date.now() - startedAt,
        inputChars: systemPrompt.length + userPrompt.length,
        outputChars: result.outputChars,
        usage: result.usage,
        metadata: { attempt },
      });

      return {
        provider: provider.provider,
        model: provider.model,
        output: result.output,
      };
    } catch (error) {
      lastError = error;
      await logProviderCall({
        organizationId,
        provider: provider.provider,
        model: provider.model,
        agent,
        promptKey,
        status: "failed",
        durationMs: Date.now() - startedAt,
        inputChars: systemPrompt.length + userPrompt.length,
        error: error instanceof Error ? error.message : "Provider call failed",
        metadata: { attempt },
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Provider call failed");
}

function normalizedGenerationMode(provider: string) {
  return `provider_${provider}_v1`;
}

export async function runProviderAgent1(organizationId: string, websiteText: string) {
  const prompt = getCrmAgentPrompt("agent1Research");
  const result = await callConfiguredJsonAgent(
    organizationId,
    "agent1",
    prompt.key,
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
    "agent2",
    prompt.key,
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
    "agent3",
    prompt.key,
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

export type PartnerSearchCompany = {
  name: string;
  website: string | null;
  description: string | null;
  relevanceReason: string | null;
};

export type PartnerSearchResult = {
  provider: AiProvider["provider"];
  model: string;
  companies: PartnerSearchCompany[];
};

// Web search is a provider-native server tool. Anthropic's shape is verified;
// pick the dynamic-filtering variant on models that support it, otherwise the
// basic tool. Models older than the 4.6 family only accept the basic variant.
function anthropicWebSearchToolType(model: string) {
  const normalized = model.trim().toLowerCase();
  const supportsDynamic =
    normalized.startsWith("claude-opus-4-6") ||
    normalized.startsWith("claude-opus-4-7") ||
    normalized.startsWith("claude-opus-4-8") ||
    normalized.startsWith("claude-sonnet-5") ||
    normalized.startsWith("claude-sonnet-4-6");
  return supportsDynamic ? "web_search_20260209" : "web_search_20250305";
}

function extractAnthropicAllText(payload: unknown) {
  const objectPayload = asJsonObject(payload);
  const content = Array.isArray(objectPayload?.content) ? objectPayload.content : [];
  const parts: string[] = [];

  for (const contentItem of content) {
    const contentObject = asJsonObject(contentItem);
    if (contentObject?.type === "text") {
      const text = readString(contentObject.text);
      if (text) {
        parts.push(text);
      }
    }
  }

  return parts.join("\n");
}

async function callAnthropicWebSearchJson(
  provider: AiProvider,
  systemPrompt: string,
  userPrompt: string,
): Promise<ProviderJsonResult> {
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: userPrompt },
  ];
  const usage = { requestTokens: 0, responseTokens: 0, totalTokens: 0 };

  // The server-side tool loop can pause after ~10 internal iterations
  // (stop_reason "pause_turn"); re-send the accumulated turns to resume.
  for (let turn = 0; turn < 4; turn += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 3000,
        system: systemPrompt,
        messages,
        tools: [{ type: anthropicWebSearchToolType(provider.model), name: "web_search", max_uses: 5 }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic returned ${response.status}`);
    }

    const payload = await response.json() as unknown;
    const turnUsage = extractAnthropicUsage(payload);
    usage.requestTokens += turnUsage.requestTokens ?? 0;
    usage.responseTokens += turnUsage.responseTokens ?? 0;
    usage.totalTokens += turnUsage.totalTokens ?? (turnUsage.requestTokens ?? 0) + (turnUsage.responseTokens ?? 0);

    const objectPayload = asJsonObject(payload);
    if (objectPayload?.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: objectPayload.content });
      continue;
    }

    const text = extractAnthropicAllText(payload);
    const object = parseJsonObject(text);

    if (!object) {
      throw new Error("Anthropic web search returned non-JSON output");
    }

    return { output: object, outputChars: text.length, usage };
  }

  throw new Error("Anthropic web search did not finish within the turn limit");
}

function normalizePartnerCompany(value: unknown): PartnerSearchCompany | null {
  const object = asJsonObject(value);
  const name = readString(object?.company_name) || readString(object?.name);
  if (!name) {
    return null;
  }

  const website = readString(object?.website);
  return {
    name,
    website: /^https?:\/\//i.test(website) ? website : null,
    description: readString(object?.description) || null,
    relevanceReason: readString(object?.relevance_reason) || readString(object?.relevanceReason) || null,
  };
}

export async function runProviderPartnerSearch(
  organizationId: string,
  query: string,
): Promise<PartnerSearchResult | null> {
  const prompt = getCrmAgentPrompt("partnerSearch");
  const provider = await getConfiguredAiProvider(organizationId);

  if (!provider) {
    await logProviderCall({
      organizationId,
      agent: "partner_search",
      promptKey: prompt.key,
      status: "skipped",
      inputChars: prompt.prompt.length + query.length,
      metadata: { reason: "No configured AI provider" },
    });
    return null;
  }

  // Live partner search needs a web-search-capable provider; only Anthropic's
  // server tool is wired up. Skip honestly rather than inventing companies.
  if (provider.provider !== "anthropic") {
    await logProviderCall({
      organizationId,
      provider: provider.provider,
      model: provider.model,
      agent: "partner_search",
      promptKey: prompt.key,
      status: "skipped",
      inputChars: prompt.prompt.length + query.length,
      metadata: { reason: "Live partner web search requires a configured Anthropic provider" },
    });
    return null;
  }

  const budgetBlockReason = await getBudgetBlockReason(organizationId);
  if (budgetBlockReason) {
    await logProviderCall({
      organizationId,
      provider: provider.provider,
      model: provider.model,
      agent: "partner_search",
      promptKey: prompt.key,
      status: "skipped",
      inputChars: prompt.prompt.length + query.length,
      error: budgetBlockReason,
      metadata: { reason: "AI usage budget blocked provider call" },
    });
    return null;
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      const result = await callAnthropicWebSearchJson(provider, prompt.prompt, query);
      await logProviderCall({
        organizationId,
        provider: provider.provider,
        model: provider.model,
        agent: "partner_search",
        promptKey: prompt.key,
        status: "success",
        durationMs: Date.now() - startedAt,
        inputChars: prompt.prompt.length + query.length,
        outputChars: result.outputChars,
        usage: result.usage,
        metadata: { attempt },
      });

      const rawCompanies = Array.isArray(result.output.companies) ? result.output.companies : [];
      const companies = rawCompanies
        .map(normalizePartnerCompany)
        .filter((company): company is PartnerSearchCompany => company !== null);

      return { provider: provider.provider, model: provider.model, companies };
    } catch (error) {
      lastError = error;
      await logProviderCall({
        organizationId,
        provider: provider.provider,
        model: provider.model,
        agent: "partner_search",
        promptKey: prompt.key,
        status: "failed",
        durationMs: Date.now() - startedAt,
        inputChars: prompt.prompt.length + query.length,
        error: error instanceof Error ? error.message : "Provider call failed",
        metadata: { attempt },
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Partner search failed");
}
