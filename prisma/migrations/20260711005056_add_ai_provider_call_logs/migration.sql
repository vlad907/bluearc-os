-- CreateEnum
CREATE TYPE "AiProviderCallStatus" AS ENUM ('success', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "ai_provider_calls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider",
    "model" TEXT,
    "agent" TEXT NOT NULL,
    "promptKey" TEXT,
    "status" "AiProviderCallStatus" NOT NULL,
    "durationMs" INTEGER,
    "inputChars" INTEGER,
    "outputChars" INTEGER,
    "requestTokens" INTEGER,
    "responseTokens" INTEGER,
    "totalTokens" INTEGER,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_provider_calls_organizationId_idx" ON "ai_provider_calls"("organizationId");

-- CreateIndex
CREATE INDEX "ai_provider_calls_provider_idx" ON "ai_provider_calls"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_calls_agent_idx" ON "ai_provider_calls"("agent");

-- CreateIndex
CREATE INDEX "ai_provider_calls_status_idx" ON "ai_provider_calls"("status");

-- CreateIndex
CREATE INDEX "ai_provider_calls_createdAt_idx" ON "ai_provider_calls"("createdAt");

-- AddForeignKey
ALTER TABLE "ai_provider_calls" ADD CONSTRAINT "ai_provider_calls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
