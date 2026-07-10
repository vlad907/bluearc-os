import { getCrmAgentPrompt } from "@/lib/ai/crm-agent-prompts";

type Agent1Signal = {
  type: string;
  signal: string;
  evidence_quote: string;
};

type Agent1Pain = {
  pain: string;
  severity: "low" | "medium" | "high";
  evidence_quote: string;
};

function firstMatchingQuote(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      return match[0].slice(0, 220);
    }
  }

  return "";
}

function sentenceContaining(text: string, keyword: string) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const sentence = sentences.find((item) => item.toLowerCase().includes(keyword.toLowerCase()));
  return sentence?.trim().slice(0, 220) ?? "";
}

export function runDeterministicAgent1(websiteText: string) {
  const lower = websiteText.toLowerCase();
  const signals: Agent1Signal[] = [];
  const pains: Agent1Pain[] = [];

  const signalKeywords = [
    ["wifi", "technology"],
    ["wi-fi", "technology"],
    ["network", "technology"],
    ["camera", "security"],
    ["pos", "operations"],
    ["multiple locations", "operational"],
    ["24/7", "operational"],
    ["emergency", "operational"],
    ["installation", "service"],
    ["support", "service"],
  ] as const;

  for (const [keyword, type] of signalKeywords) {
    if (!lower.includes(keyword)) {
      continue;
    }

    const quote = sentenceContaining(websiteText, keyword) || keyword;
    signals.push({
      type,
      signal: `Website references ${keyword}.`,
      evidence_quote: quote,
    });
  }

  const reliabilityQuote = firstMatchingQuote(websiteText, [
    /[^.!?]*(?:downtime|reliable|reliability|outage|slow|issue|support|emergency)[^.!?]*[.!?]/i,
  ]);

  if (reliabilityQuote) {
    pains.push({
      pain: "Potential reliability or support-sensitive operations",
      severity: lower.includes("emergency") || lower.includes("24/7") ? "high" : "medium",
      evidence_quote: reliabilityQuote,
    });
  }

  const services = Array.from(
    new Set(
      ["network", "wifi", "wi-fi", "camera", "installation", "support", "security", "managed", "maintenance"]
        .filter((keyword) => lower.includes(keyword))
        .map((keyword) => keyword.replace("wi-fi", "Wi-Fi").replace("wifi", "Wi-Fi")),
    ),
  );

  const prompt = getCrmAgentPrompt("agent1Research");
  const confidence = Math.min(1, 0.18 + signals.length * 0.08 + pains.length * 0.22);

  return {
    website_summary: {
      one_liner: websiteText.slice(0, 180),
      services_offered: services.length ? services : ["General business services"],
    },
    pain_points_detected: pains,
    signals_found: signals.slice(0, 8),
    recommended_angle: {
      primary_offer: pains.length ? "Lead with the evidenced operational signal." : "Use a soft, factual observation and a low-friction CTA.",
      cta: "Ask for a short call to confirm whether there is a fit.",
    },
    confidence_score: Number(confidence.toFixed(2)),
    promptKey: prompt.key,
    promptSource: prompt.sourceFile,
    generationMode: "deterministic_v1",
  };
}
