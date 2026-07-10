export const integrationProviders = ["openai", "anthropic", "google_gmail", "google_oauth"] as const;
export const integrationKinds = ["ai_provider", "oauth_app", "oauth_connection"] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];
export type IntegrationKind = (typeof integrationKinds)[number];

export function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return typeof value === "string" && integrationProviders.includes(value as IntegrationProvider);
}

export function isIntegrationKind(value: unknown): value is IntegrationKind {
  return typeof value === "string" && integrationKinds.includes(value as IntegrationKind);
}

export function checkEnvCredentialStatus(params: {
  envKeyName?: string | null;
  envSecretName?: string | null;
}) {
  const envKeyConfigured = params.envKeyName ? Boolean(process.env[params.envKeyName]) : true;
  const envSecretConfigured = params.envSecretName ? Boolean(process.env[params.envSecretName]) : true;

  return envKeyConfigured && envSecretConfigured ? "configured" : "missing_env";
}

export function defaultCredentialLabel(provider: IntegrationProvider, kind: IntegrationKind) {
  if (provider === "openai") {
    return "OpenAI";
  }

  if (provider === "anthropic") {
    return "Anthropic";
  }

  if (provider === "google_gmail") {
    return "Gmail";
  }

  return kind === "oauth_app" ? "Google OAuth App" : "Google OAuth";
}
