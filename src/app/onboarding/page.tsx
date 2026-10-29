"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useOrganization } from "@/context/OrganizationContext";

// First-run onboarding, modeled on the reference CRM app's wizard:
// account -> workspace -> AI providers -> Gmail -> business profile.
// Each step reuses the app's existing API routes. Unlike the reference app,
// Blue Arc OS never stores raw API keys; it references env-var names and
// reports whether the key is present, so the "AI providers" step connects and
// verifies providers against the environment rather than taking a pasted key.

type StepId = "account" | "workspace" | "providers" | "gmail" | "profile" | "done";

type Credential = {
  provider: string;
  kind: string;
  status: string;
  envKeyName: string | null;
  envKeyPresent: boolean | null;
};

type GmailStatus = {
  connected: boolean;
  connections?: Array<{ email: string | null; status: string }>;
};

const PROVIDER_DEFS: Array<{ provider: string; label: string; envKeyName: string; blurb: string }> = [
  {
    provider: "anthropic",
    label: "Anthropic (recommended)",
    envKeyName: "ANTHROPIC_API_KEY",
    blurb: "Best instruction-following for email drafting and verification.",
  },
  {
    provider: "openai",
    label: "OpenAI",
    envKeyName: "OPENAI_API_KEY",
    blurb: "Used for research agents and as a drafting fallback.",
  },
];

function orgHeaders(organizationId: string): HeadersInit {
  return organizationId
    ? { "Content-Type": "application/json", "x-organization-id": organizationId }
    : { "Content-Type": "application/json" };
}

export default function OnboardingPage() {
  const router = useRouter();
  const { organizationId, setOrganizationId, user, workspaces, sessionLoaded, refreshSession } = useOrganization();

  const [step, setStep] = useState<StepId>("account");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Account step
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Workspace step
  const [workspaceName, setWorkspaceName] = useState("");

  // Providers step
  const [credentials, setCredentials] = useState<Credential[]>([]);

  // Gmail step
  const [gmail, setGmail] = useState<GmailStatus | null>(null);

  // Profile step
  const [profile, setProfile] = useState({
    businessName: "",
    senderName: "",
    senderTitle: "",
    senderEmail: "",
    senderPhone: "",
    serviceArea: "",
    serviceSpecialties: "",
    preferredTone: "professional",
    preferredCta: "Would a short call next week make sense?",
  });

  // Once the session resolves, move past the account step if already signed in.
  useEffect(() => {
    if (!(sessionLoaded && user && step === "account")) {
      return;
    }
    const timer = window.setTimeout(() => setStep("workspace"), 0);
    return () => window.clearTimeout(timer);
  }, [sessionLoaded, user, step]);

  const STEPS: Array<{ id: StepId; label: string }> = useMemo(
    () => [
      { id: "account", label: "Account" },
      { id: "workspace", label: "Workspace" },
      { id: "providers", label: "AI providers" },
      { id: "gmail", label: "Gmail" },
      { id: "profile", label: "Business profile" },
    ],
    [],
  );

  const loadCredentials = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await fetch("/api/integration-credentials", { headers: orgHeaders(organizationId), cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { credentials: Credential[] };
      setCredentials(data.credentials ?? []);
    } catch {
      /* non-fatal */
    }
  }, [organizationId]);

  const loadGmail = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await fetch(`/api/integrations/google/status?organizationId=${encodeURIComponent(organizationId)}`, {
        headers: orgHeaders(organizationId),
        cache: "no-store",
      });
      if (!res.ok) return;
      setGmail((await res.json()) as GmailStatus);
    } catch {
      /* non-fatal */
    }
  }, [organizationId]);

  const loadProfile = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await fetch("/api/workspace/profile", { headers: orgHeaders(organizationId), cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { profile: Record<string, unknown> | null };
      const saved = data.profile ?? {};
      // Fall back to the signed-in account for the signature fields so a first
      // run isn't left unsigned.
      setProfile((prev) => ({
        ...prev,
        businessName: (saved.businessName as string) ?? prev.businessName,
        senderName: (saved.senderName as string) ?? prev.senderName ?? user?.name ?? "",
        senderTitle: (saved.senderTitle as string) ?? prev.senderTitle,
        senderEmail: (saved.senderEmail as string) ?? prev.senderEmail ?? user?.email ?? "",
        senderPhone: (saved.senderPhone as string) ?? prev.senderPhone,
        serviceArea: (saved.serviceArea as string) ?? prev.serviceArea,
        serviceSpecialties: Array.isArray(saved.serviceSpecialties)
          ? (saved.serviceSpecialties as string[]).join(", ")
          : prev.serviceSpecialties,
        preferredTone: (saved.preferredTone as string) ?? prev.preferredTone,
        preferredCta: (saved.preferredCta as string) ?? prev.preferredCta,
      }));
    } catch {
      /* non-fatal */
    }
  }, [organizationId, user]);

  useEffect(() => {
    // Defer the fetch-driven setState out of the effect body (the codebase's
    // convention) so the strict set-state-in-effect rule stays satisfied.
    const timer = window.setTimeout(() => {
      if (step === "providers") void loadCredentials();
      if (step === "gmail") void loadGmail();
      if (step === "profile") void loadProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [step, loadCredentials, loadGmail, loadProfile]);

  async function submitAccount() {
    setError(null);
    setBusy(true);
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        authMode === "signup"
          ? { name, email, password, workspaceName: workspaceName || undefined }
          : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not sign you in.");
      }
      await refreshSession();
      setStep("workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/setup/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not create the workspace.");
      }
      const data = (await res.json()) as { organization: { id: string } };
      await refreshSession();
      setOrganizationId(data.organization.id);
      setStep("providers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the workspace.");
    } finally {
      setBusy(false);
    }
  }

  async function connectProvider(provider: string, envKeyName: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/integration-credentials", {
        method: "POST",
        headers: orgHeaders(organizationId),
        body: JSON.stringify({ organizationId, provider, kind: "ai_provider", envKeyName }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not connect the provider.");
      }
      await loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect the provider.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/workspace/profile", {
        method: "PATCH",
        headers: orgHeaders(organizationId),
        body: JSON.stringify({
          organizationId,
          businessName: profile.businessName,
          senderName: profile.senderName,
          senderTitle: profile.senderTitle,
          senderEmail: profile.senderEmail,
          senderPhone: profile.senderPhone,
          serviceArea: profile.serviceArea,
          serviceSpecialties: profile.serviceSpecialties
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          preferredTone: profile.preferredTone,
          preferredCta: profile.preferredCta,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not save your profile.");
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  function credentialFor(provider: string) {
    return credentials.find((credential) => credential.provider === provider && credential.kind === "ai_provider");
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set up Blue Arc OS</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A few steps to get discovery, AI drafting, and Gmail sending ready.
        </p>
      </div>

      {/* Stepper */}
      {step !== "done" && (
        <ol className="mb-8 flex flex-wrap items-center gap-2 text-xs font-medium">
          {STEPS.map((item, index) => {
            const active = item.id === step;
            const complete = index < stepIndex;
            return (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : complete
                        ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950"
                        : "border-gray-300 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900",
                  ].join(" ")}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <span className={active ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}>
                  {item.label}
                </span>
                {index < STEPS.length - 1 && <span className="mx-1 text-gray-300 dark:text-gray-700">—</span>}
              </li>
            );
          })}
        </ol>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {step === "account" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${authMode === "signup" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${authMode === "login" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
              >
                Sign in
              </button>
            </div>
            {authMode === "signup" && (
              <Field label="Your name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </Field>
            )}
            <Field label="Email">
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </Field>
            <Field label="Password">
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            {authMode === "signup" && (
              <Field label="Workspace name (optional)">
                <input className={inputClass} value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Field Services" />
              </Field>
            )}
            <button type="button" disabled={busy} onClick={submitAccount} className={primaryBtn}>
              {busy ? "Working…" : authMode === "signup" ? "Create account & continue" : "Sign in & continue"}
            </button>
          </div>
        )}

        {step === "workspace" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Pick an existing workspace or create a new one. Everything you do is scoped to the selected workspace.
            </p>
            {workspaces.length > 0 && (
              <div className="space-y-2">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setOrganizationId(workspace.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm ${organizationId === workspace.id ? "border-blue-600 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-800"}`}
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{workspace.name}</span>
                    <span className="text-xs text-gray-400">{workspace.role}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700">
              <Field label="New workspace name">
                <input className={inputClass} value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Field Services" />
              </Field>
              <button type="button" disabled={busy || !workspaceName.trim()} onClick={createWorkspace} className={`${secondaryBtn} mt-3`}>
                {busy ? "Creating…" : "Create workspace"}
              </button>
            </div>
            <StepNav
              onBack={user ? undefined : () => setStep("account")}
              onNext={organizationId ? () => setStep("providers") : undefined}
              nextDisabled={!organizationId}
            />
          </div>
        )}

        {step === "providers" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Blue Arc OS reads provider keys from the server environment and never stores raw keys. Add the key to your{" "}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">.env</code>, then connect it here.
            </p>
            {PROVIDER_DEFS.map((def) => {
              const credential = credentialFor(def.provider);
              const present = credential?.envKeyPresent;
              return (
                <div key={def.provider} className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{def.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{def.blurb}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      env: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{def.envKeyName}</code>
                      {credential && (
                        <span className={present ? "ml-2 text-green-600" : "ml-2 text-amber-600"}>
                          {present ? "key detected" : "key missing from env"}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => connectProvider(def.provider, def.envKeyName)}
                    className={credential ? secondaryBtn : primaryBtnSmall}
                  >
                    {credential ? "Re-check" : "Connect"}
                  </button>
                </div>
              );
            })}
            <StepNav onBack={() => setStep("workspace")} onNext={() => setStep("gmail")} />
          </div>
        )}

        {step === "gmail" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Connect Gmail so approved drafts become real Gmail drafts you can send, and replies sync into the inbox. This
              step is optional — you can do it later in Settings.
            </p>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              {gmail?.connected ? (
                <p className="text-sm text-green-600">
                  Connected{gmail.connections?.[0]?.email ? ` as ${gmail.connections[0].email}` : ""}.
                </p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No Gmail account connected yet.</p>
              )}
              <a
                href={`/api/integrations/google/connect?organizationId=${encodeURIComponent(organizationId)}`}
                className={`${secondaryBtn} mt-3 inline-block`}
              >
                {gmail?.connected ? "Reconnect Gmail" : "Connect Gmail"}
              </a>
            </div>
            <StepNav onBack={() => setStep("providers")} onNext={() => setStep("profile")} nextLabel="Skip / Continue" />
          </div>
        )}

        {step === "profile" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This is what the AI uses to personalize every email and sign it. Required so drafts aren&apos;t sent unsigned.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Business name"><input className={inputClass} value={profile.businessName} onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))} /></Field>
              <Field label="Service area"><input className={inputClass} value={profile.serviceArea} onChange={(e) => setProfile((p) => ({ ...p, serviceArea: e.target.value }))} placeholder="Northern California" /></Field>
              <Field label="Your name (signature)"><input className={inputClass} value={profile.senderName} onChange={(e) => setProfile((p) => ({ ...p, senderName: e.target.value }))} /></Field>
              <Field label="Your title"><input className={inputClass} value={profile.senderTitle} onChange={(e) => setProfile((p) => ({ ...p, senderTitle: e.target.value }))} placeholder="Owner" /></Field>
              <Field label="Reply-to email"><input className={inputClass} type="email" value={profile.senderEmail} onChange={(e) => setProfile((p) => ({ ...p, senderEmail: e.target.value }))} /></Field>
              <Field label="Phone"><input className={inputClass} value={profile.senderPhone} onChange={(e) => setProfile((p) => ({ ...p, senderPhone: e.target.value }))} /></Field>
            </div>
            <Field label="Service specialties (comma-separated)">
              <input className={inputClass} value={profile.serviceSpecialties} onChange={(e) => setProfile((p) => ({ ...p, serviceSpecialties: e.target.value }))} placeholder="low-voltage cabling, network installation" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tone">
                <select className={inputClass} value={profile.preferredTone} onChange={(e) => setProfile((p) => ({ ...p, preferredTone: e.target.value }))}>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="direct">Direct</option>
                  <option value="casual">Casual</option>
                </select>
              </Field>
              <Field label="Default call-to-action"><input className={inputClass} value={profile.preferredCta} onChange={(e) => setProfile((p) => ({ ...p, preferredCta: e.target.value }))} /></Field>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setStep("gmail")} className={ghostBtn}>Back</button>
              <button type="button" disabled={busy || !profile.senderName.trim()} onClick={saveProfile} className={primaryBtn}>
                {busy ? "Saving…" : "Finish setup"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600 dark:bg-green-950">✓</div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">You&apos;re all set</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Head to Discovery to find leads, or open a lead and run the research → draft → verify pipeline.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/discovery" className={primaryBtn}>Go to Discovery</Link>
              <button type="button" onClick={() => router.push("/")} className={secondaryBtn}>Open dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";
const primaryBtn = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const primaryBtnSmall = "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const secondaryBtn =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";
const ghostBtn = "rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-200";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {onBack ? (
        <button type="button" onClick={onBack} className={ghostBtn}>Back</button>
      ) : (
        <span />
      )}
      <button type="button" onClick={onNext} disabled={!onNext || nextDisabled} className={primaryBtn}>
        {nextLabel}
      </button>
    </div>
  );
}
