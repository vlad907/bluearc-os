/**
 * Draft-quality eval harness.
 *
 * Runs a set of real company websites through the full provider pipeline
 * (research → draft → verify) WITHOUT creating any lead/draft records, and
 * scores every draft against the criteria from docs/CRM_AGENT_FEATURE_AUDIT.md:
 * valid output, no placeholders, a real signature, non-empty subject/body, the
 * verifier decision, and whether the draft is grounded in the research signals.
 *
 * Usage:  npx tsx scripts/eval-drafts.mts [organizationId]
 * Requires: Postgres up, ANTHROPIC_API_KEY set + Anthropic connected for the org.
 */
import "dotenv/config";

import { runProviderAgent1, runProviderAgent2, runProviderAgent3 } from "@/lib/ai/provider-agents";
import { validateAgent2Draft } from "@/lib/outreach/draft-quality";
import { crawlWebsite } from "@/lib/research/website";
import { prisma } from "@/lib/prisma";

type JsonObject = Record<string, unknown>;

const ORG = process.argv[2] ?? "5ce03864-eedb-4671-8e8e-8f9503fe7ecb";

const SITES: Array<{ company: string; url: string }> = [
  { company: "Basecamp", url: "https://basecamp.com" },
  { company: "ServiceTitan", url: "https://www.servicetitan.com" },
  { company: "Rackspace", url: "https://www.rackspace.com" },
  { company: "JLL", url: "https://www.jll.com" },
  { company: "DigitalOcean", url: "https://www.digitalocean.com" },
  { company: "HubSpot", url: "https://www.hubspot.com" },
];

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((v): v is JsonObject => !!v && typeof v === "object" && !Array.isArray(v)) : [];
}
function str(v: unknown) {
  return typeof v === "string" ? v : "";
}

// Grounding proxy: does the draft reuse language from a real research signal?
// Compares the draft body against each signal's words; a solid overlap means
// the email is talking about something actually found on the site.
function groundingScore(body: string, agent1Output: JsonObject): boolean {
  const signals = [...asArray(agent1Output.signals_found), ...asArray(agent1Output.pain_points_detected)];
  const summary = agent1Output.website_summary as JsonObject | undefined;
  const sources = [
    ...signals.map((s) => `${str(s.signal)} ${str(s.pain)} ${str(s.evidence_quote)}`),
    str(summary?.one_liner),
  ];
  const bodyWords = new Set(body.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  for (const source of sources) {
    const words = (source.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter(
      (w) => !["with", "that", "this", "from", "your", "their", "have", "will", "which", "about"].includes(w),
    );
    if (words.length === 0) continue;
    const hits = words.filter((w) => bodyWords.has(w)).length;
    if (hits >= 3) return true;
  }
  return false;
}

async function main() {
  const profile = await prisma.workspaceProfile.findUnique({ where: { organizationId: ORG } });
  if (!profile) {
    console.error(`No workspace profile for org ${ORG}. Fill it in via onboarding/Settings first.`);
    process.exit(1);
  }
  const workspaceProfile = profile as unknown as JsonObject;

  const rows: Array<Record<string, string>> = [];
  let sendable = 0;
  let verifierSend = 0;
  let grounded = 0;
  let providerUsed = 0;

  for (const site of SITES) {
    const row: Record<string, string> = { company: site.company };
    try {
      // 1) Research
      const pages = await crawlWebsite(site.url, 3).catch(() => []);
      const text = pages.map((p) => p.rawText).join("\n\n").slice(0, 30000);
      if (!text) {
        row.result = "research failed (site blocked or empty)";
        rows.push(row);
        continue;
      }
      const agent1 = (await runProviderAgent1(ORG, text)) as JsonObject | null;
      const agent1Output = agent1 ?? {};
      const mode = asArray(agent1Output.signals_found).length ? "signal" : "soft";

      // 2) Draft
      const draft = await runProviderAgent2(ORG, {
        mode: mode as "signal" | "soft",
        leadTitle: site.company,
        companyName: site.company,
        websiteUrl: site.url,
        agent1Output,
        workspaceProfile,
      });
      if (!draft) {
        row.result = "no draft (provider skipped — check credential)";
        rows.push(row);
        continue;
      }
      providerUsed += draft.generationMode?.startsWith("provider_") ? 1 : 0;

      // 3) Verify
      const verdict = await runProviderAgent3({
        organizationId: ORG,
        draft,
        agent1Output,
        mode: mode as "signal" | "soft",
        workspaceProfile,
      });
      const finalSubject = verdict?.final_subject ?? draft.subject;
      const finalBody = verdict?.final_email ?? draft.email_body;

      // Score
      const hardIssues = validateAgent2Draft({ subject: finalSubject, email_body: finalBody }, { profile: workspaceProfile }).hardIssues;
      const isSendable = hardIssues.length === 0;
      const decision = verdict?.decision ?? "(none)";
      const isGrounded = groundingScore(finalBody, agent1Output);

      if (isSendable) sendable += 1;
      if (decision === "send") verifierSend += 1;
      if (isGrounded) grounded += 1;

      row.mode = mode;
      row.sendable = isSendable ? "yes" : `NO (${hardIssues.join("; ")})`;
      row.verifier = decision;
      row.reason = verdict?.reason ?? "";
      row.grounded = isGrounded ? "yes" : "no";
      row.subject = finalSubject;
      row.result = "ok";
    } catch (error) {
      row.result = `error: ${error instanceof Error ? error.message : "failed"}`;
    }
    rows.push(row);
  }

  const n = SITES.length;
  console.log("\n================ DRAFT QUALITY EVAL ================");
  for (const row of rows) {
    console.log(`\n• ${row.company} — ${row.result}`);
    if (row.result === "ok") {
      console.log(`   mode=${row.mode}  sendable=${row.sendable}  verifier=${row.verifier}  grounded=${row.grounded}`);
      console.log(`   subject: ${row.subject}`);
      if (row.verifier === "hold") console.log(`   HOLD reason: ${row.reason}`);
    }
  }
  console.log("\n---------------- AGGREGATE ----------------");
  console.log(`sites:            ${n}`);
  console.log(`provider-backed:  ${providerUsed}/${n}`);
  console.log(`sendable:         ${sendable}/${n}  (${Math.round((sendable / n) * 100)}%)`);
  console.log(`verifier = send:  ${verifierSend}/${n}  (${Math.round((verifierSend / n) * 100)}%)`);
  console.log(`grounded:         ${grounded}/${n}  (${Math.round((grounded / n) * 100)}%)`);
  console.log("===========================================\n");
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
