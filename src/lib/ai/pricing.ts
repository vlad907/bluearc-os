// Estimated model pricing for provider-backed agent calls.
//
// Rates are published list prices in USD per 1,000,000 tokens and are used only
// to produce a rough cost estimate for observability and budget guardrails. They
// are not billing-grade and should be updated as provider pricing changes.
// Local OpenAI-compatible endpoints (LM Studio/Ollama/vLLM/llama.cpp) are treated
// as free because they run on self-hosted hardware.

export type AiProviderName = "openai" | "anthropic" | "local_openai";

export type TokenUsage = {
  requestTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
};

type ModelRate = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
};

// Ordered from most specific prefix to least specific so the first match wins.
const MODEL_RATES: Array<{ prefix: string; rate: ModelRate }> = [
  // OpenAI
  { prefix: "gpt-5", rate: { inputPerMillionUsd: 1.25, outputPerMillionUsd: 10 } },
  { prefix: "gpt-4o-mini", rate: { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 } },
  { prefix: "gpt-4o", rate: { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10 } },
  { prefix: "gpt-4-turbo", rate: { inputPerMillionUsd: 10, outputPerMillionUsd: 30 } },
  { prefix: "gpt-4", rate: { inputPerMillionUsd: 30, outputPerMillionUsd: 60 } },
  { prefix: "gpt-3.5", rate: { inputPerMillionUsd: 0.5, outputPerMillionUsd: 1.5 } },
  // Anthropic
  { prefix: "claude-opus", rate: { inputPerMillionUsd: 15, outputPerMillionUsd: 75 } },
  { prefix: "claude-3-opus", rate: { inputPerMillionUsd: 15, outputPerMillionUsd: 75 } },
  { prefix: "claude-sonnet", rate: { inputPerMillionUsd: 3, outputPerMillionUsd: 15 } },
  { prefix: "claude-3-5-sonnet", rate: { inputPerMillionUsd: 3, outputPerMillionUsd: 15 } },
  { prefix: "claude-3-sonnet", rate: { inputPerMillionUsd: 3, outputPerMillionUsd: 15 } },
  { prefix: "claude-haiku", rate: { inputPerMillionUsd: 0.8, outputPerMillionUsd: 4 } },
  { prefix: "claude-3-5-haiku", rate: { inputPerMillionUsd: 0.8, outputPerMillionUsd: 4 } },
  { prefix: "claude-3-haiku", rate: { inputPerMillionUsd: 0.25, outputPerMillionUsd: 1.25 } },
];

function resolveRate(model?: string | null): ModelRate | null {
  if (!model) {
    return null;
  }

  const normalized = model.trim().toLowerCase();

  // Longest matching prefix wins so "gpt-4o-mini" beats "gpt-4o" beats "gpt-4".
  let best: { prefix: string; rate: ModelRate } | null = null;
  for (const entry of MODEL_RATES) {
    if (normalized.startsWith(entry.prefix) && (!best || entry.prefix.length > best.prefix.length)) {
      best = entry;
    }
  }

  return best?.rate ?? null;
}

/**
 * Estimate the USD cost of a single provider call from its token usage.
 *
 * Returns 0 for local providers (self-hosted, no marginal token cost) and null
 * when the cost cannot be estimated (unknown model or no usage reported), so
 * callers can distinguish "free" from "unknown" instead of recording a fake 0.
 */
export function estimateCostUsd(params: {
  provider?: AiProviderName;
  model?: string | null;
  usage?: TokenUsage;
}): number | null {
  if (params.provider === "local_openai") {
    return 0;
  }

  const rate = resolveRate(params.model);
  if (!rate) {
    return null;
  }

  const usage = params.usage;
  const inputTokens = usage?.requestTokens;
  const outputTokens = usage?.responseTokens;

  let cost: number;
  if (inputTokens === undefined && outputTokens === undefined) {
    // Only a combined total is available: apply a blended input/output rate.
    if (usage?.totalTokens === undefined) {
      return null;
    }
    const blendedRate = (rate.inputPerMillionUsd + rate.outputPerMillionUsd) / 2;
    cost = (usage.totalTokens / 1_000_000) * blendedRate;
  } else {
    cost =
      ((inputTokens ?? 0) / 1_000_000) * rate.inputPerMillionUsd +
      ((outputTokens ?? 0) / 1_000_000) * rate.outputPerMillionUsd;
  }

  // Round to 6 decimals — sub-cent precision without float noise.
  return Math.round(cost * 1_000_000) / 1_000_000;
}
