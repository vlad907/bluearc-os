"use client";

import { useMemo, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { estimateLaborHours } from "@/lib/fieldnation/estimator";
import {
  DEFAULT_PRICING_CONFIG,
  recommendBid,
  type BidStrategy,
  type CompensationType,
  type PostedCompensation,
} from "@/lib/fieldnation/pricing";

// Field Nation bid evaluator. Given a job (estimated hours, one-way drive time,
// posted compensation) it computes Blue Arc's minimum offer and recommends
// accept / counter / manual-review. Pure client-side calculation via the ported
// deterministic pricing engine — no network, updates as you type.

const STRATEGY_LABEL: Record<BidStrategy, string> = {
  accept_posted: "Accept posted",
  counter_travel: "Counter (add travel)",
  counter_labor: "Counter (labor minimum)",
  bid_standard: "Bid standard minimum",
  manual_review: "Manual review",
};

const STRATEGY_STYLE: Record<BidStrategy, string> = {
  accept_posted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  counter_travel: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  counter_labor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  bid_standard: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  manual_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function money(value: number | null | undefined) {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

export default function FieldJobsPage() {
  const [hours, setHours] = useState("2");
  const [scope, setScope] = useState("");
  const [driveMinutes, setDriveMinutes] = useState("20");
  const [compType, setCompType] = useState<CompensationType>("hourly");
  const [hourlyRate, setHourlyRate] = useState("65");
  const [fixedAmount, setFixedAmount] = useState("300");
  const [blendedRate, setBlendedRate] = useState("60");
  const [minimumHours, setMinimumHours] = useState("2");
  const [travelReimbursement, setTravelReimbursement] = useState("0");
  const [prohibitsTravelCharge, setProhibitsTravelCharge] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);

  const num = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // When a job scope is pasted, estimate labor hours from it (using the typed
  // hours as the buyer-stated floor); otherwise use the typed hours directly.
  const estimate = useMemo(
    () => (scope.trim() ? estimateLaborHours(scope, num(hours) || null) : null),
    [scope, hours],
  );
  const effectiveHours = estimate ? estimate.finalHours : num(hours);

  const recommendation = useMemo(() => {
    const posted: PostedCompensation = {
      compType,
      hourlyRate: compType === "hourly" ? num(hourlyRate) : null,
      fixedAmount: compType === "fixed" ? num(fixedAmount) : null,
      blendedRate: compType === "blended" ? num(blendedRate) : null,
      minimumHours: num(minimumHours) || null,
      travelReimbursement: num(travelReimbursement),
      prohibitsTravelCharge,
      ambiguous,
    };
    return recommendBid({
      estimatedLaborHours: effectiveHours,
      oneWayMinutes: num(driveMinutes),
      posted,
      forceManualReview: estimate?.requiresManualReview ?? false,
    });
  }, [effectiveHours, estimate, driveMinutes, compType, hourlyRate, fixedAmount, blendedRate, minimumHours, travelReimbursement, prohibitsTravelCharge, ambiguous]);

  const { pricing } = recommendation;
  const cfg = DEFAULT_PRICING_CONFIG;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Field Jobs"
        description="Evaluate a Field Nation job: compute your minimum offer and get a bid recommendation. Ported from the Blue Arc Field Nation bidder."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_1fr]">
        {/* Inputs */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="font-semibold text-gray-900 dark:text-white">Job details</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label={estimate ? "Buyer-stated hours (floor)" : "Estimated labor hours"}>
              <input className={inputClass} type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
            <Field label="One-way drive (min)">
              <input className={inputClass} type="number" min="0" step="5" value={driveMinutes} onChange={(e) => setDriveMinutes(e.target.value)} />
            </Field>
          </div>

          <Field label="Job scope / description (optional — auto-estimates hours)">
            <textarea
              className={`${inputClass} min-h-20`}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="e.g. Run 6 cable drops and install 3 IP cameras"
            />
          </Field>
          {estimate && (
            <div
              className={`rounded-lg border p-3 text-xs ${
                estimate.requiresManualReview
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                  : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-400"
              }`}
            >
              <span className="font-semibold">
                {estimate.requiresManualReview ? "Manual review" : `Estimated ${estimate.finalHours}h`}
              </span>
              {" — "}
              {estimate.reason}
            </div>
          )}

          <Field label="Posted compensation type">
            <select className={inputClass} value={compType} onChange={(e) => setCompType(e.target.value as CompensationType)}>
              <option value="hourly">Hourly</option>
              <option value="fixed">Fixed</option>
              <option value="blended">Blended</option>
              <option value="unknown">Unknown / unclear</option>
            </select>
          </Field>

          {compType === "hourly" && (
            <Field label="Posted hourly rate ($/hr)">
              <input className={inputClass} type="number" min="0" step="5" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </Field>
          )}
          {compType === "fixed" && (
            <Field label="Posted fixed amount ($)">
              <input className={inputClass} type="number" min="0" step="10" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
            </Field>
          )}
          {compType === "blended" && (
            <Field label="Posted blended rate ($/hr)">
              <input className={inputClass} type="number" min="0" step="5" value={blendedRate} onChange={(e) => setBlendedRate(e.target.value)} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Buyer minimum hours">
              <input className={inputClass} type="number" min="0" step="0.5" value={minimumHours} onChange={(e) => setMinimumHours(e.target.value)} />
            </Field>
            <Field label="Travel reimbursement ($)">
              <input className={inputClass} type="number" min="0" step="10" value={travelReimbursement} onChange={(e) => setTravelReimbursement(e.target.value)} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={prohibitsTravelCharge} onChange={(e) => setProhibitsTravelCharge(e.target.checked)} />
            Listing prohibits travel charges
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={ambiguous} onChange={(e) => setAmbiguous(e.target.checked)} />
            Compensation is ambiguous / contradictory
          </label>

          <p className="border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800">
            Rates: ${cfg.standardLaborRate}/hr labor (min {cfg.minimumLaborHours}h / ${cfg.minimumLaborTotal}), travel billed past{" "}
            {cfg.travelThresholdMinutes} min at ${cfg.travelRatePerHour}/hr round-trip.
          </p>
        </div>

        {/* Recommendation */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Recommendation</p>
                <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${STRATEGY_STYLE[recommendation.strategy]}`}>
                  {STRATEGY_LABEL[recommendation.strategy]}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Recommended bid</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{money(recommendation.recommendedAmount)}</p>
                {recommendation.recommendedHourlyRate != null && (
                  <p className="text-sm text-gray-500">{money(recommendation.recommendedHourlyRate)}/hr</p>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Posted payout (est.)" value={money(recommendation.postedPayoutEstimate)} />
              <Metric label="Our calculated offer" value={money(recommendation.calculatedOffer)} />
              <Metric label="Minimum acceptable" value={money(recommendation.minimumAcceptablePayout)} />
            </div>

            {recommendation.rationale.length > 0 && (
              <div className="mt-5">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Why</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {recommendation.rationale.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Cost breakdown</h3>
            <dl className="space-y-2 text-sm">
              <BreakdownRow
                label={`Labor (${pricing.labor.billableHours}h billable @ ${money(pricing.labor.rate)}/hr)`}
                value={money(pricing.labor.charge)}
              />
              <BreakdownRow
                label={
                  pricing.travel.billable
                    ? `Travel (${pricing.travel.roundTripHours}h round-trip @ ${money(pricing.travel.rate)}/hr${pricing.travel.reimbursementApplied > 0 ? `, −${money(pricing.travel.reimbursementApplied)} reimbursed` : ""})`
                    : `Travel (${pricing.travel.oneWayMinutes} min ≤ ${pricing.travel.thresholdMinutes} min — no charge)`
                }
                value={money(pricing.travel.charge)}
              />
              {pricing.additionalTotal > 0 && <BreakdownRow label="Additional charges" value={money(pricing.additionalTotal)} />}
              <div className="flex items-center justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
                <dt>Minimum offer</dt>
                <dd>{money(pricing.calculatedOffer)}</dd>
              </div>
            </dl>
            {pricing.notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                {pricing.notes.map((note, index) => (
                  <li key={index}>• {note}</li>
                ))}
              </ul>
            )}
            {recommendation.reducesBuyerRate && (
              <p className="mt-3 text-xs font-medium text-red-600">Warning: this would reduce the buyer&apos;s posted rate.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}
