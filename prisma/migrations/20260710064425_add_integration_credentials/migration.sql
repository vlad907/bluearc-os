-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('openai', 'anthropic', 'google_gmail', 'google_oauth');

-- CreateEnum
CREATE TYPE "IntegrationCredentialKind" AS ENUM ('ai_provider', 'oauth_app', 'oauth_connection');

-- CreateEnum
CREATE TYPE "IntegrationCredentialStatus" AS ENUM ('configured', 'missing_env', 'invalid', 'connected', 'disabled');

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "kind" "IntegrationCredentialKind" NOT NULL,
    "status" "IntegrationCredentialStatus" NOT NULL DEFAULT 'missing_env',
    "label" TEXT,
    "envKeyName" TEXT,
    "envSecretName" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB,
    "metadata" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_credentials_organizationId_idx" ON "integration_credentials"("organizationId");

-- CreateIndex
CREATE INDEX "integration_credentials_provider_idx" ON "integration_credentials"("provider");

-- CreateIndex
CREATE INDEX "integration_credentials_kind_idx" ON "integration_credentials"("kind");

-- CreateIndex
CREATE INDEX "integration_credentials_status_idx" ON "integration_credentials"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_organizationId_provider_kind_key" ON "integration_credentials"("organizationId", "provider", "kind");

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
