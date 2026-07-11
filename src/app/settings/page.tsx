"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { useTheme } from "@/context/ThemeContext";

type IntegrationCredential = {
  id: string;
  provider: "openai" | "anthropic" | "local_openai" | "google_gmail" | "google_oauth";
  kind: "ai_provider" | "oauth_app" | "oauth_connection";
  status: "configured" | "missing_env" | "invalid" | "connected" | "disabled";
  label: string | null;
  envKeyName: string | null;
  envSecretName: string | null;
  envKeyPresent: boolean | null;
  envSecretPresent: boolean | null;
  scopes: string[];
};

type CredentialPreset = {
  provider: IntegrationCredential["provider"];
  kind: IntegrationCredential["kind"];
  label: string;
  envKeyName: string;
  envSecretName: string;
  scopes: string[];
  description: string;
};

type AiUsagePayload = {
  totals?: {
    calls: number;
    success: number;
    failed: number;
    skipped: number;
    totalTokens: number;
    requestTokens: number;
    responseTokens: number;
    averageDurationMs: number | null;
  };
  byProvider?: Record<string, number>;
  byAgent?: Record<string, number>;
  failures?: Array<{
    id: string;
    provider: string | null;
    model: string | null;
    agent: string;
    promptKey: string | null;
    error: string | null;
    createdAt: string;
  }>;
  error?: string;
};

const credentialPresets: CredentialPreset[] = [
  {
    provider: "openai",
    kind: "ai_provider",
    label: "OpenAI",
    envKeyName: "OPENAI_API_KEY",
    envSecretName: "",
    scopes: [],
    description: "Provider-backed Agent 1/2/3 execution and strategy generation.",
  },
  {
    provider: "anthropic",
    kind: "ai_provider",
    label: "Anthropic",
    envKeyName: "ANTHROPIC_API_KEY",
    envSecretName: "",
    scopes: [],
    description: "Alternative provider for high-quality outreach drafts.",
  },
  {
    provider: "local_openai",
    kind: "ai_provider",
    label: "Local OpenAI-Compatible Model",
    envKeyName: "LOCAL_LLM_BASE_URL",
    envSecretName: "LOCAL_LLM_API_KEY",
    scopes: [],
    description: "LM Studio, Ollama, vLLM, llama.cpp, or any local OpenAI-compatible endpoint. Used before paid providers when configured.",
  },
  {
    provider: "google_gmail",
    kind: "oauth_app",
    label: "Gmail OAuth App",
    envKeyName: "GOOGLE_CLIENT_ID",
    envSecretName: "GOOGLE_CLIENT_SECRET",
    scopes: ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.compose"],
    description: "Foundation for Gmail draft creation, inbox sync, and reply sending.",
  },
];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { organizationId, setOrganizationId } = useOrganization();
  const [workspaceName, setWorkspaceName] = useState("Blue Arc Workspace");
  const [workspaceSlug, setWorkspaceSlug] = useState("blue-arc-workspace");
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedingDemoData, setSeedingDemoData] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [credentials, setCredentials] = useState<IntegrationCredential[]>([]);
  const [credentialStatus, setCredentialStatus] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [savingCredential, setSavingCredential] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsagePayload | null>(null);
  const [loadingAiUsage, setLoadingAiUsage] = useState(false);
  const [aiUsageError, setAiUsageError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    businessName: "",
    businessDescription: "",
    serviceArea: "",
    industriesServed: "",
    serviceSpecialties: "",
    preferredTone: "professional, warm, direct",
    outreachStyle: "concise consultative outbound",
    preferredCta: "short call",
    doNotMention: "",
    senderName: "",
    senderTitle: "",
    senderPhone: "",
    senderEmail: "",
  });
  const [strategyForm, setStrategyForm] = useState({
    selectedTargetCategories: "",
    selectedPriorityPainPoints: "",
    selectedCtaStyle: "",
    guardrailNotes: "",
  });

  const loadWorkspaceProfile = useCallback(async () => {
    if (!organizationId.trim()) {
      return;
    }

    setProfileError(null);

    try {
      const [profileResponse, strategyResponse] = await Promise.all([
        fetch("/api/workspace/profile", {
          headers: { "x-organization-id": organizationId.trim() },
          cache: "no-store",
        }),
        fetch("/api/workspace/ai-strategy", {
          headers: { "x-organization-id": organizationId.trim() },
          cache: "no-store",
        }),
      ]);
      const profilePayload = await profileResponse.json() as {
        profile?: Partial<typeof profileForm> & {
          industriesServed?: string[];
          serviceSpecialties?: string[];
          doNotMention?: string[];
        } | null;
        error?: string;
      };
      const strategyPayload = await strategyResponse.json() as {
        strategy?: {
          selectedTargetCategories?: string[];
          selectedPriorityPainPoints?: string[];
          selectedCtaStyle?: string | null;
          guardrails?: { notes?: string[] } | null;
        } | null;
        error?: string;
      };

      if (!profileResponse.ok) {
        throw new Error(profilePayload.error ?? "Failed to load workspace profile");
      }

      if (!strategyResponse.ok) {
        throw new Error(strategyPayload.error ?? "Failed to load AI strategy");
      }

      const profile = profilePayload.profile;
      if (profile) {
        setProfileForm({
          businessName: profile.businessName ?? "",
          businessDescription: profile.businessDescription ?? "",
          serviceArea: profile.serviceArea ?? "",
          industriesServed: (profile.industriesServed ?? []).join(", "),
          serviceSpecialties: (profile.serviceSpecialties ?? []).join(", "),
          preferredTone: profile.preferredTone ?? "",
          outreachStyle: profile.outreachStyle ?? "",
          preferredCta: profile.preferredCta ?? "",
          doNotMention: (profile.doNotMention ?? []).join(", "),
          senderName: profile.senderName ?? "",
          senderTitle: profile.senderTitle ?? "",
          senderPhone: profile.senderPhone ?? "",
          senderEmail: profile.senderEmail ?? "",
        });
      }

      const strategy = strategyPayload.strategy;
      if (strategy) {
        setStrategyForm({
          selectedTargetCategories: (strategy.selectedTargetCategories ?? []).join(", "),
          selectedPriorityPainPoints: (strategy.selectedPriorityPainPoints ?? []).join(", "),
          selectedCtaStyle: strategy.selectedCtaStyle ?? "",
          guardrailNotes: (strategy.guardrails?.notes ?? []).join(", "),
        });
      }
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to load workspace profile");
    }
  }, [organizationId]);

  const loadCredentials = useCallback(async () => {
    if (!organizationId.trim()) {
      return;
    }

    setCredentialError(null);

    try {
      const response = await fetch("/api/integration-credentials", {
        headers: { "x-organization-id": organizationId.trim() },
        cache: "no-store",
      });
      const payload = await response.json() as {
        credentials?: IntegrationCredential[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load integration credentials");
      }

      setCredentials(payload.credentials ?? []);
    } catch (error) {
      setCredentialError(error instanceof Error ? error.message : "Failed to load integration credentials");
    }
  }, [organizationId]);

  const loadAiUsage = useCallback(async () => {
    if (!organizationId.trim()) {
      return;
    }

    setLoadingAiUsage(true);
    setAiUsageError(null);

    try {
      const response = await fetch("/api/ai-usage?days=30", {
        headers: { "x-organization-id": organizationId.trim() },
        cache: "no-store",
      });
      const payload = await response.json() as AiUsagePayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load AI usage");
      }

      setAiUsage(payload);
    } catch (error) {
      setAiUsageError(error instanceof Error ? error.message : "Failed to load AI usage");
    } finally {
      setLoadingAiUsage(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadWorkspaceProfile();
      void loadCredentials();
      void loadAiUsage();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAiUsage, loadCredentials, loadWorkspaceProfile, organizationId]);

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceName.trim()) {
      return;
    }

    setCreatingWorkspace(true);
    setSetupError(null);
    setSetupStatus(null);

    try {
      const response = await fetch("/api/setup/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspaceName.trim(),
          slug: workspaceSlug.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        organization?: { id: string; name: string; slug: string };
        error?: string;
      };

      if (!response.ok || !payload.organization) {
        throw new Error(payload.error ?? "Failed to create workspace");
      }

      setOrganizationId(payload.organization.id);
      setSetupStatus(`Created ${payload.organization.name} and selected it for this browser.`);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to create workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function handleSeedDemoData() {
    if (!organizationId.trim()) {
      return;
    }

    setSeedingDemoData(true);
    setSeedError(null);
    setSeedStatus(null);

    try {
      const response = await fetch("/api/setup/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organizationId.trim() }),
      });
      const payload = (await response.json()) as {
        seeded?: boolean;
        counts?: Record<string, number>;
        error?: string;
      };

      if (!response.ok || !payload.seeded) {
        throw new Error(payload.error ?? "Failed to seed demo data");
      }

      const totalRecords = Object.values(payload.counts ?? {}).reduce((sum, count) => sum + count, 0);
      setSeedStatus(`Seeded ${totalRecords} demo records into the selected workspace.`);
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : "Failed to seed demo data");
    } finally {
      setSeedingDemoData(false);
    }
  }

  function csvToList(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId.trim()) {
      return;
    }

    setSavingProfile(true);
    setProfileStatus(null);
    setProfileError(null);

    try {
      const [profileResponse, strategyResponse] = await Promise.all([
        fetch("/api/workspace/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-organization-id": organizationId.trim(),
          },
          body: JSON.stringify({
            businessName: profileForm.businessName,
            businessDescription: profileForm.businessDescription,
            serviceArea: profileForm.serviceArea,
            industriesServed: csvToList(profileForm.industriesServed),
            serviceSpecialties: csvToList(profileForm.serviceSpecialties),
            preferredTone: profileForm.preferredTone,
            outreachStyle: profileForm.outreachStyle,
            preferredCta: profileForm.preferredCta,
            doNotMention: csvToList(profileForm.doNotMention),
            senderName: profileForm.senderName,
            senderTitle: profileForm.senderTitle,
            senderPhone: profileForm.senderPhone,
            senderEmail: profileForm.senderEmail,
          }),
        }),
        fetch("/api/workspace/ai-strategy", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-organization-id": organizationId.trim(),
          },
          body: JSON.stringify({
            selectedTargetCategories: csvToList(strategyForm.selectedTargetCategories),
            selectedPriorityPainPoints: csvToList(strategyForm.selectedPriorityPainPoints),
            selectedCtaStyle: strategyForm.selectedCtaStyle,
            guardrails: {
              notes: csvToList(strategyForm.guardrailNotes),
            },
          }),
        }),
      ]);
      const profilePayload = await profileResponse.json() as { error?: string; errors?: string[] };
      const strategyPayload = await strategyResponse.json() as { error?: string; errors?: string[] };

      if (!profileResponse.ok) {
        throw new Error(profilePayload.errors?.join(", ") ?? profilePayload.error ?? "Failed to save profile");
      }

      if (!strategyResponse.ok) {
        throw new Error(strategyPayload.errors?.join(", ") ?? strategyPayload.error ?? "Failed to save strategy");
      }

      setProfileStatus("Workspace profile and AI strategy context saved.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save workspace profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveCredential(preset: CredentialPreset) {
    if (!organizationId.trim()) {
      return;
    }

    setSavingCredential(`${preset.provider}:${preset.kind}`);
    setCredentialStatus(null);
    setCredentialError(null);

    try {
      const response = await fetch("/api/integration-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId.trim(),
        },
        body: JSON.stringify({
          provider: preset.provider,
          kind: preset.kind,
          label: preset.label,
          envKeyName: preset.envKeyName || null,
          envSecretName: preset.envSecretName || null,
          scopes: preset.scopes,
        }),
      });
      const payload = await response.json() as {
        credential?: IntegrationCredential;
        error?: string;
      };

      if (!response.ok || !payload.credential) {
        throw new Error(payload.error ?? "Failed to save credential reference");
      }

      setCredentials((current) => {
        const withoutCurrent = current.filter((credential) => (
          credential.provider !== payload.credential?.provider || credential.kind !== payload.credential.kind
        ));
        return [...withoutCurrent, payload.credential as IntegrationCredential].sort((left, right) => left.provider.localeCompare(right.provider));
      });
      setCredentialStatus(`${preset.label} credential reference saved. Status: ${payload.credential.status}.`);
    } catch (error) {
      setCredentialError(error instanceof Error ? error.message : "Failed to save credential reference");
    } finally {
      setSavingCredential(null);
    }
  }

  function findCredential(preset: CredentialPreset) {
    return credentials.find((credential) => credential.provider === preset.provider && credential.kind === preset.kind) ?? null;
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Manage your account and application preferences."
      />
      <div className="space-y-6 max-w-3xl">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Workspace Setup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Create or select the workspace used by the app. This replaces manually hunting for an organization ID during development.
          </p>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Before creating a workspace, start PostgreSQL and run migrations: <code>npm run db:dev:up</code> then <code>npm run db:migrate</code>.
          </div>
          <form onSubmit={handleCreateWorkspace} className="mb-5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Workspace Name
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Workspace Slug
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={workspaceSlug}
                  onChange={(event) => setWorkspaceSlug(event.target.value)}
                />
              </div>
              <button
                className="self-end px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!workspaceName.trim() || creatingWorkspace}
                type="submit"
              >
                {creatingWorkspace ? "Creating..." : "Create Workspace"}
              </button>
            </div>
            {setupStatus && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{setupStatus}</p>}
            {setupError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{setupError}</p>}
          </form>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Current Workspace ID
              </label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Created workspace UUID"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              />
            </div>
            <button
              className="self-end px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              disabled={!organizationId}
              onClick={() => setOrganizationId("")}
            >
              Clear
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
            This is still a temporary development flow. Production signup will create the workspace after authentication and resolve it server-side.
          </p>
          <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Demo CRM Data</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Fill an empty workspace with realistic companies, leads, jobs, tasks, vendors, and outreach.
                </p>
              </div>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!organizationId.trim() || seedingDemoData}
                onClick={handleSeedDemoData}
                type="button"
              >
                {seedingDemoData ? "Seeding..." : "Seed Demo Data"}
              </button>
            </div>
            {seedStatus && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{seedStatus}</p>}
            {seedError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{seedError}</p>}
          </div>
        </div>

        <form
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Workspace Profile</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            This restores the CRM agent context: who you are, what you sell, how the AI writes, and how emails are signed.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ["businessName", "Business Name"],
              ["serviceArea", "Service Area"],
              ["industriesServed", "Industries Served"],
              ["serviceSpecialties", "Service Specialties"],
              ["preferredTone", "Preferred Tone"],
              ["outreachStyle", "Outreach Style"],
              ["preferredCta", "Preferred CTA"],
              ["doNotMention", "Do Not Mention"],
              ["senderName", "Sender Name"],
              ["senderTitle", "Sender Title"],
              ["senderPhone", "Sender Phone"],
              ["senderEmail", "Sender Email"],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {label}
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={profileForm[field as keyof typeof profileForm]}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, [field]: event.target.value }))
                  }
                  placeholder={["industriesServed", "serviceSpecialties", "doNotMention"].includes(field) ? "Comma separated" : undefined}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Business Description
            </label>
            <textarea
              className="min-h-24 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={profileForm.businessDescription}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, businessDescription: event.target.value }))
              }
              placeholder="What does this business do, and for whom?"
            />
          </div>
          <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">AI Strategy Selection</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Target Categories
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={strategyForm.selectedTargetCategories}
                  onChange={(event) =>
                    setStrategyForm((current) => ({ ...current, selectedTargetCategories: event.target.value }))
                  }
                  placeholder="restaurants, hotels, property managers"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Priority Pain Points
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={strategyForm.selectedPriorityPainPoints}
                  onChange={(event) =>
                    setStrategyForm((current) => ({ ...current, selectedPriorityPainPoints: event.target.value }))
                  }
                  placeholder="downtime, unreliable Wi-Fi, rollout delays"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  CTA Style
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={strategyForm.selectedCtaStyle}
                  onChange={(event) =>
                    setStrategyForm((current) => ({ ...current, selectedCtaStyle: event.target.value }))
                  }
                  placeholder="short call, site assessment, health check"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Guardrail Notes
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={strategyForm.guardrailNotes}
                  onChange={(event) =>
                    setStrategyForm((current) => ({ ...current, guardrailNotes: event.target.value }))
                  }
                  placeholder="no fake claims, no placeholders"
                />
              </div>
            </div>
          </div>
          <button
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!organizationId.trim() || savingProfile}
            type="submit"
          >
            {savingProfile ? "Saving..." : "Save Profile Context"}
          </button>
          {profileStatus && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{profileStatus}</p>}
          {profileError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{profileError}</p>}
        </form>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Integration Credentials</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Store references to server-side environment variables only. Raw API keys and OAuth secrets stay in `.env`, Vercel, or your secrets manager.
          </p>
          <div className="space-y-3">
            {credentialPresets.map((preset) => {
              const credential = findCredential(preset);
              const savingKey = `${preset.provider}:${preset.kind}`;
              const configured = credential?.status === "configured" || credential?.status === "connected";

              return (
                <div key={savingKey} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">{preset.label}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${configured ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                          {credential?.status ?? "not_saved"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">{preset.description}</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-500 dark:text-gray-500 md:grid-cols-2">
                        <div>
                          Key env: <code className="text-indigo-600 dark:text-indigo-400">{preset.envKeyName || "none"}</code>
                          {credential?.envKeyPresent !== null && credential?.envKeyPresent !== undefined ? ` · ${credential.envKeyPresent ? "present" : "missing"}` : ""}
                        </div>
                        <div>
                          Secret env: <code className="text-indigo-600 dark:text-indigo-400">{preset.envSecretName || "none"}</code>
                          {credential?.envSecretPresent !== null && credential?.envSecretPresent !== undefined ? ` · ${credential.envSecretPresent ? "present" : "missing"}` : ""}
                        </div>
                      </div>
                      {preset.scopes.length > 0 && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">Scopes: {preset.scopes.join(", ")}</p>
                      )}
                    </div>
                    <button
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                      disabled={!organizationId.trim() || savingCredential === savingKey}
                      onClick={() => void handleSaveCredential(preset)}
                      type="button"
                    >
                      {savingCredential === savingKey ? "Checking..." : "Save + Check"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
            Add missing values to `.env`, restart `npm run dev`, then click “Save + Check” again. This avoids storing secrets in Postgres.
          </div>
          {credentialStatus && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{credentialStatus}</p>}
          {credentialError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{credentialError}</p>}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">AI Usage + Provider Health</h3>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Last 30 days of provider attempts, retries, skips, token usage, and recent failures.
              </p>
            </div>
            <button
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              disabled={!organizationId.trim() || loadingAiUsage}
              onClick={() => void loadAiUsage()}
              type="button"
            >
              {loadingAiUsage ? "Refreshing..." : "Refresh Usage"}
            </button>
          </div>

          {aiUsage?.totals ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Calls", aiUsage.totals.calls],
                  ["Success", aiUsage.totals.success],
                  ["Failed", aiUsage.totals.failed],
                  ["Skipped", aiUsage.totals.skipped],
                  ["Tokens", aiUsage.totals.totalTokens],
                  ["Input Tokens", aiUsage.totals.requestTokens],
                  ["Output Tokens", aiUsage.totals.responseTokens],
                  ["Avg Latency", aiUsage.totals.averageDurationMs === null ? "—" : `${aiUsage.totals.averageDurationMs}ms`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-xs text-gray-500 dark:text-gray-500">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">By Provider</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    {Object.entries(aiUsage.byProvider ?? {}).map(([provider, count]) => (
                      <div className="flex justify-between" key={provider}>
                        <span>{provider}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                    {Object.keys(aiUsage.byProvider ?? {}).length === 0 && <p>No provider calls yet.</p>}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">By Agent</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    {Object.entries(aiUsage.byAgent ?? {}).map(([agent, count]) => (
                      <div className="flex justify-between" key={agent}>
                        <span>{agent}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                    {Object.keys(aiUsage.byAgent ?? {}).length === 0 && <p>No agent calls yet.</p>}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Recent Failures</p>
                <div className="mt-3 space-y-3">
                  {(aiUsage.failures ?? []).map((failure) => (
                    <div key={failure.id} className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">
                      <p className="font-medium">{failure.agent} · {failure.provider ?? "unknown"} · {failure.promptKey ?? "unknown prompt"}</p>
                      <p className="mt-1">{failure.error ?? "Unknown error"}</p>
                    </div>
                  ))}
                  {(aiUsage.failures ?? []).length === 0 && <p className="text-sm text-gray-500 dark:text-gray-500">No recent provider failures.</p>}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-500">No usage loaded yet.</p>
          )}
          {aiUsageError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{aiUsageError}</p>}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Appearance</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Customize the look and feel of Blue Arc.</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Switch between light and dark themes.</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-11 h-6 rounded-full transition-colors ${theme === "dark" ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${theme === "dark" ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Database Setup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Use PostgreSQL/Supabase only. `file:./dev.db` and SQLite URLs are not supported by the current Prisma adapter.
          </p>
          <div className="space-y-2">
            {[
              { command: "cp .env.example .env", desc: "Create local environment config" },
              { command: "npm run db:dev:up", desc: "Start local PostgreSQL with Docker" },
              { command: "npm run db:migrate", desc: "Apply Prisma migration to PostgreSQL" },
              { command: "npm run db:seed", desc: "Optional: seed demo CRM data" },
              { command: "npm run dev", desc: "Run the app, then create a workspace from this Settings page" },
            ].map((item) => (
              <div key={item.command} className="flex items-center justify-between gap-4 py-2">
                <div>
                  <code className="text-sm text-indigo-600 dark:text-indigo-400">{item.command}</code>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
