// Field Nation bid evaluator — a faithful TypeScript port of FN-automation's
// deterministic pricing + comparison engine (app/pricing/{engine,comparison}.py).
// Pure functions, no I/O. Computes Blue Arc's own minimum offer and turns it,
// together with the buyer's posted compensation, into a single bid recommendation.
//
// Core invariants (preserved from the source):
//   * Never reduce a rate the buyer already offered that beats our standard rate.
//   * Never double-charge travel the buyer already reimburses.
//   * When posted pay already meets our minimum, accept/bid at the posted number.
//   * Anything ambiguous or contradictory → manual review.

export type CompensationType = "hourly" | "fixed" | "blended" | "unknown";

export type BidStrategy =
  | "accept_posted" // posted pay already meets/exceeds our minimum
  | "counter_travel" // counter to add round-trip travel
  | "counter_labor" // counter up to our labor minimum
  | "bid_standard" // nearby job, bid our standard minimum
  | "manual_review"; // do not auto-decide

export type PricingConfig = {
  standardLaborRate: number;
  minimumLaborHours: number;
  minimumLaborTotal: number;
  laborRoundIncrementHours: number;
  travelThresholdMinutes: number;
  travelRatePerHour: number;
  travelChargeIncrement: number;
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  standardLaborRate: 70.0,
  minimumLaborHours: 2.0,
  minimumLaborTotal: 140.0,
  laborRoundIncrementHours: 0.5,
  travelThresholdMinutes: 30.0,
  travelRatePerHour: 50.0,
  travelChargeIncrement: 25.0,
};

export type AdditionalCharge = {
  kind: string;
  amount: number;
  approved: boolean;
  note?: string;
};

export type PostedCompensation = {
  compType: CompensationType;
  hourlyRate?: number | null;
  fixedAmount?: number | null;
  blendedRate?: number | null;
  minimumHours?: number | null;
  travelReimbursement: number;
  prohibitsTravelCharge: boolean;
  ambiguous: boolean;
  rawText?: string;
};

export type LaborBreakdown = {
  estimatedHours: number;
  roundedHours: number;
  billableHours: number;
  rate: number;
  charge: number;
};

export type TravelBreakdown = {
  oneWayMinutes: number;
  thresholdMinutes: number;
  billable: boolean;
  roundTripHours: number;
  rate: number;
  rawCharge: number;
  grossCharge: number;
  charge: number;
  reimbursementAvailable: number;
  reimbursementApplied: number;
};

export type PricingResult = {
  labor: LaborBreakdown;
  travel: TravelBreakdown;
  additionalCharges: AdditionalCharge[];
  additionalTotal: number;
  calculatedOffer: number;
  config: PricingConfig;
  notes: string[];
};

export type BidRecommendation = {
  strategy: BidStrategy;
  recommendedAmount: number;
  recommendedHourlyRate: number | null;
  postedPayoutEstimate: number | null;
  calculatedOffer: number;
  minimumAcceptablePayout: number;
  reducesBuyerRate: boolean;
  requiresManualReview: boolean;
  rationale: string[];
  pricing: PricingResult;
  posted: PostedCompensation;
};

// --- rounding helpers (match the Python engine) ---------------------------

function roundUpToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.ceil((value - 1e-9) / increment) * increment;
}

function roundToNearest(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

function money(value: number): number {
  return Math.round((value + 1e-9) * 100) / 100;
}

// Compact number formatting for rationale text, like Python's %g
// (70.0 -> "70", 137.5 -> "137.5").
const g = (value: number) => String(Math.round(value * 1000) / 1000);

// --- pricing engine -------------------------------------------------------

export function calculateLabor(estimatedHours: number, config: PricingConfig): LaborBreakdown {
  const hours = Math.max(0, estimatedHours);
  const rounded = roundUpToIncrement(hours, config.laborRoundIncrementHours);
  const billable = Math.max(rounded, config.minimumLaborHours);
  const charge = Math.max(billable * config.standardLaborRate, config.minimumLaborTotal);
  return { estimatedHours: hours, roundedHours: rounded, billableHours: billable, rate: config.standardLaborRate, charge: money(charge) };
}

export function calculateTravel(
  oneWayMinutes: number,
  config: PricingConfig,
  reimbursementAvailable = 0,
): TravelBreakdown {
  const minutes = Math.max(0, oneWayMinutes);
  if (minutes <= config.travelThresholdMinutes) {
    return {
      oneWayMinutes: minutes,
      thresholdMinutes: config.travelThresholdMinutes,
      billable: false,
      roundTripHours: 0,
      rate: config.travelRatePerHour,
      rawCharge: 0,
      grossCharge: 0,
      charge: 0,
      reimbursementAvailable,
      reimbursementApplied: 0,
    };
  }

  const roundTripHours = (minutes * 2) / 60;
  const raw = roundTripHours * config.travelRatePerHour;
  const gross = roundToNearest(raw, config.travelChargeIncrement);
  const applied = Math.min(reimbursementAvailable, gross);
  const net = Math.max(0, gross - applied);
  return {
    oneWayMinutes: minutes,
    thresholdMinutes: config.travelThresholdMinutes,
    billable: true,
    roundTripHours: Math.round(roundTripHours * 10000) / 10000,
    rate: config.travelRatePerHour,
    rawCharge: money(raw),
    grossCharge: money(gross),
    charge: money(net),
    reimbursementAvailable: money(reimbursementAvailable),
    reimbursementApplied: money(applied),
  };
}

export function calculateOffer(params: {
  estimatedLaborHours: number;
  oneWayMinutes: number;
  config?: PricingConfig;
  additionalCharges?: AdditionalCharge[];
  travelReimbursementAvailable?: number;
}): PricingResult {
  const config = params.config ?? DEFAULT_PRICING_CONFIG;
  const additionalCharges = params.additionalCharges ?? [];

  const labor = calculateLabor(params.estimatedLaborHours, config);
  const travel = calculateTravel(params.oneWayMinutes, config, params.travelReimbursementAvailable ?? 0);

  const approved = additionalCharges.filter((c) => c.approved);
  const additionalTotal = money(approved.reduce((sum, c) => sum + c.amount, 0));

  const notes: string[] = [];
  const unapproved = additionalCharges.filter((c) => !c.approved);
  if (unapproved.length) {
    notes.push("Unapproved potential charges present (not included): " + unapproved.map((c) => `${c.kind}($${g(c.amount)})`).join(", "));
  }
  if (travel.reimbursementApplied > 0) {
    notes.push(
      `Buyer travel reimbursement of $${g(travel.reimbursementAvailable)} applied; $${g(travel.reimbursementApplied)} offset our $${g(travel.rawCharge)} travel charge.`,
    );
  }

  const calculated = money(labor.charge + travel.charge + additionalTotal);
  return { labor, travel, additionalCharges, additionalTotal, calculatedOffer: calculated, config, notes };
}

// --- posted-compensation comparison & recommendation ----------------------

function billableHoursFor(config: PricingConfig, estimatedHours: number, postedMin?: number | null): number {
  let hours = Math.max(estimatedHours, config.minimumLaborHours);
  if (postedMin) hours = Math.max(hours, postedMin);
  return hours;
}

export function estimatePostedPayout(posted: PostedCompensation, billableHours: number): number | null {
  if (posted.compType === "fixed" && posted.fixedAmount != null) {
    return money(posted.fixedAmount + posted.travelReimbursement);
  }
  if (posted.compType === "hourly" && posted.hourlyRate != null) {
    return money(posted.hourlyRate * billableHours + posted.travelReimbursement);
  }
  if (posted.compType === "blended" && posted.blendedRate != null) {
    return money(posted.blendedRate * billableHours + posted.travelReimbursement);
  }
  return null;
}

function build(args: {
  strategy: BidStrategy;
  amount: number;
  rate: number | null;
  postedPayout: number | null;
  calculated: number;
  minAcceptable: number;
  rationale: string[];
  pricing: PricingResult;
  posted: PostedCompensation;
  reduces?: boolean;
}): BidRecommendation {
  return {
    strategy: args.strategy,
    recommendedAmount: money(args.amount),
    recommendedHourlyRate: args.rate,
    postedPayoutEstimate: args.postedPayout,
    calculatedOffer: args.calculated,
    minimumAcceptablePayout: args.minAcceptable,
    reducesBuyerRate: args.reduces ?? false,
    requiresManualReview: args.strategy === "manual_review",
    rationale: args.rationale,
    pricing: args.pricing,
    posted: args.posted,
  };
}

export function recommendBid(params: {
  estimatedLaborHours: number;
  oneWayMinutes: number;
  posted: PostedCompensation;
  config?: PricingConfig;
  additionalCharges?: AdditionalCharge[];
  forceManualReview?: boolean;
}): BidRecommendation {
  const config = params.config ?? DEFAULT_PRICING_CONFIG;
  const { posted } = params;

  const pricing = calculateOffer({
    estimatedLaborHours: params.estimatedLaborHours,
    oneWayMinutes: params.oneWayMinutes,
    config,
    additionalCharges: params.additionalCharges,
    travelReimbursementAvailable: posted.travelReimbursement,
  });
  const calculated = pricing.calculatedOffer;
  const billable = billableHoursFor(config, params.estimatedLaborHours, posted.minimumHours);
  const postedPayout = estimatePostedPayout(posted, billable);
  const rationale: string[] = [];

  // Minimum acceptable = our full economic value (labor + gross travel + additions),
  // independent of who pays the travel line.
  const minAcceptable = money(pricing.labor.charge + pricing.travel.grossCharge + pricing.additionalTotal);

  // Manual review short-circuit.
  if (params.forceManualReview || posted.ambiguous || posted.compType === "unknown") {
    rationale.push(
      posted.ambiguous || posted.compType === "unknown"
        ? "Posted compensation is ambiguous/unknown."
        : "Flagged for manual review upstream.",
    );
    return build({
      strategy: "manual_review",
      amount: Math.max(calculated, postedPayout ?? 0),
      rate: posted.hourlyRate ?? null,
      postedPayout,
      calculated,
      minAcceptable,
      rationale,
      pricing,
      posted,
    });
  }

  // Travel prohibited but we cannot meet the minimum.
  if (posted.prohibitsTravelCharge && pricing.travel.rawCharge > 0) {
    if ((postedPayout ?? 0) < minAcceptable) {
      rationale.push(
        `Listing prohibits travel charges, but posted payout ($${g(postedPayout ?? 0)}) is below our minimum ($${g(minAcceptable)}). Cannot bid profitably without travel — manual review.`,
      );
      return build({
        strategy: "manual_review",
        amount: Math.max(calculated, postedPayout ?? 0),
        rate: null,
        postedPayout,
        calculated,
        minAcceptable,
        rationale,
        pricing,
        posted,
      });
    }
  }

  // Fixed-price offers.
  if (posted.compType === "fixed" && posted.fixedAmount != null) {
    const payout = postedPayout ?? 0;
    if (payout >= calculated) {
      rationale.push(`Posted fixed $${g(posted.fixedAmount)} meets/exceeds our minimum $${g(calculated)}; bidding the posted amount (never reduce it).`);
      return build({ strategy: "accept_posted", amount: payout, rate: null, postedPayout, calculated, minAcceptable, rationale, pricing, posted });
    }
    rationale.push(`Posted fixed $${g(posted.fixedAmount)} is below our minimum $${g(calculated)}; countering to our calculated offer.`);
    return build({
      strategy: pricing.travel.billable ? "counter_travel" : "counter_labor",
      amount: calculated,
      rate: null,
      postedPayout,
      calculated,
      minAcceptable,
      rationale,
      pricing,
      posted,
    });
  }

  // Hourly / blended offers.
  const postedRate = posted.compType === "hourly" ? posted.hourlyRate : posted.blendedRate;
  const effectiveRate = Math.max(config.standardLaborRate, postedRate ?? 0);
  const ratePreserved = (postedRate ?? 0) > config.standardLaborRate;

  const laborAtEffective = Math.max(
    billable * effectiveRate,
    effectiveRate === config.standardLaborRate ? config.minimumLaborTotal : billable * effectiveRate,
  );
  const counterTotal = money(laborAtEffective + pricing.travel.charge + pricing.additionalTotal);

  const payout = postedPayout ?? 0;
  if (payout >= counterTotal && payout >= minAcceptable) {
    if (ratePreserved) {
      rationale.push(
        `Posted rate $${g(postedRate ?? 0)}/hr beats our standard $${g(config.standardLaborRate)}/hr; keeping it. Posted payout $${g(payout)} >= our minimum $${g(minAcceptable)}.`,
      );
    } else {
      rationale.push(`Posted payout $${g(payout)} already meets our minimum $${g(minAcceptable)}; bidding at the posted terms.`);
    }
    return build({ strategy: "accept_posted", amount: payout, rate: postedRate ?? null, postedPayout, calculated, minAcceptable, rationale, pricing, posted });
  }

  if (ratePreserved) {
    rationale.push(`Countering while preserving your higher posted rate $${g(postedRate ?? 0)}/hr.`);
  }
  const strategy: BidStrategy = pricing.travel.billable ? "counter_travel" : payout === 0 ? "bid_standard" : "counter_labor";
  if (pricing.travel.billable) {
    rationale.push(`Counter includes the two-hour labor minimum plus round-trip travel ($${g(pricing.travel.charge)}).`);
  } else {
    rationale.push(`Nearby job; countering to our labor minimum $${g(counterTotal)} (posted payout $${g(payout)} was below it).`);
  }
  return build({
    strategy,
    amount: counterTotal,
    rate: postedRate ? effectiveRate : null,
    postedPayout,
    calculated,
    minAcceptable,
    rationale,
    pricing,
    posted,
  });
}
