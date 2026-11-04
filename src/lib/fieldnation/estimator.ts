// Rules-based labor-time estimator — a faithful TypeScript port of
// FN-automation's app/pricing/estimator.py.
//
// We do NOT blindly trust a listing's stated duration. We estimate from the
// scope text using per-unit rules, then keep the larger of (buyer duration, our
// estimate). Anything open-ended or multi-tech is flagged for manual review
// rather than guessed. Every estimate carries the rules that produced it so the
// UI can show *why*.

export type EstimatorConfig = {
  minimumHours: number;
  hoursPerCableDrop: number;
  hoursPerCamera: number;
  hoursPerAccessPoint: number;
  hoursPerPosTerminal: number;
  manualReviewPhrases: string[];
};

export const DEFAULT_ESTIMATOR_CONFIG: EstimatorConfig = {
  minimumHours: 2.0,
  hoursPerCableDrop: 0.5,
  hoursPerCamera: 1.0,
  hoursPerAccessPoint: 0.75,
  hoursPerPosTerminal: 1.0,
  manualReviewPhrases: [
    "rack cleanup",
    "clean up the rack",
    "two technicians",
    "2 technicians",
    "two techs",
    "second technician",
    "as needed",
    "open-ended",
    "open ended",
    "ongoing until",
    "troubleshoot until resolved",
  ],
};

export type LaborEstimate = {
  buyerHours: number | null;
  estimatedHours: number;
  finalHours: number; // what pricing should use (max of the two, min floor)
  requiresManualReview: boolean;
  reason: string;
  matchedRules: string[];
};

const NUM = "(\\d+(?:\\.\\d+)?)";

// Sum quantities like "6 drops", "3 cameras" (digits only) across patterns.
function findQty(text: string, unitPatterns: string[]): number {
  let total = 0;
  for (const pat of unitPatterns) {
    const re = new RegExp(`${NUM}\\s*(?:${pat})`, "gi");
    for (const match of text.matchAll(re)) {
      total += Math.trunc(parseFloat(match[1]));
    }
  }
  return total;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateLaborHours(
  scopeText: string,
  buyerHours: number | null = null,
  config: EstimatorConfig = DEFAULT_ESTIMATOR_CONFIG,
): LaborEstimate {
  const text = (scopeText || "").trim();
  const low = text.toLowerCase();
  const rules: string[] = [];

  // 1) Hard manual-review triggers.
  for (const phrase of config.manualReviewPhrases) {
    if (low.includes(phrase)) {
      return {
        buyerHours,
        estimatedHours: config.minimumHours,
        finalHours: Math.max(buyerHours ?? 0, config.minimumHours),
        requiresManualReview: true,
        reason: `Scope contains open-ended / multi-tech language: '${phrase}'.`,
        matchedRules: [`manual_phrase:${phrase}`],
      };
    }
  }

  let estimate = 0;

  // 2) Quantity-driven rules.
  const drops = findQty(low, ["cable drops?", "drops?", "runs?"]);
  if (drops) {
    estimate += drops * config.hoursPerCableDrop;
    rules.push(`${drops} drop(s) x ${config.hoursPerCableDrop}h`);
  }

  const cameras = findQty(low, ["cameras?", "ip cameras?"]);
  if (cameras) {
    estimate += cameras * config.hoursPerCamera;
    rules.push(`${cameras} camera(s) x ${config.hoursPerCamera}h`);
  }

  const aps = findQty(low, ["access points?", "aps?", "wireless access points?"]);
  if (aps) {
    estimate += aps * config.hoursPerAccessPoint;
    rules.push(`${aps} AP(s) x ${config.hoursPerAccessPoint}h`);
  }

  const pos = findQty(low, ["pos terminals?", "pos systems?", "registers?", "terminals?"]);
  if (pos) {
    estimate += pos * config.hoursPerPosTerminal;
    rules.push(`${pos} POS unit(s) x ${config.hoursPerPosTerminal}h`);
  }

  // 3) Recognized simple single-visit jobs default to the 2h minimum.
  const simpleMarkers = ["troubleshoot", "site survey", "survey", "swap", "replace", "replacement", "install"];
  const matchedSimple = simpleMarkers.some((m) => low.includes(m));

  if (estimate === 0 && matchedSimple) {
    rules.push("recognized single-visit task -> 2h minimum");
    estimate = config.minimumHours;
  }

  // 4) Nothing recognized at all -> manual review.
  if (estimate === 0 && !matchedSimple) {
    return {
      buyerHours,
      estimatedHours: config.minimumHours,
      finalHours: Math.max(buyerHours ?? 0, config.minimumHours),
      requiresManualReview: true,
      reason: "Scope did not match any known service pattern; cannot estimate.",
      matchedRules: [],
    };
  }

  const estimated = Math.max(estimate, config.minimumHours);
  const final = Math.max(estimated, buyerHours ?? 0);
  let reason = "Estimated from scope: " + rules.join("; ");
  if (buyerHours && buyerHours > estimated) {
    reason += `. Buyer-stated ${buyerHours}h is higher; using that.`;
  }
  return {
    buyerHours,
    estimatedHours: round2(estimated),
    finalHours: round2(final),
    requiresManualReview: false,
    reason,
    matchedRules: rules,
  };
}
