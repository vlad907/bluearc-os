-- CreateEnum
CREATE TYPE "AgentJobType" AS ENUM ('lead_generate_draft');

-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "agent_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AgentJobType" NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'queued',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_jobs_organizationId_idx" ON "agent_jobs"("organizationId");

-- CreateIndex
CREATE INDEX "agent_jobs_type_idx" ON "agent_jobs"("type");

-- CreateIndex
CREATE INDEX "agent_jobs_status_idx" ON "agent_jobs"("status");

-- CreateIndex
CREATE INDEX "agent_jobs_entityType_entityId_idx" ON "agent_jobs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "agent_jobs_queuedAt_idx" ON "agent_jobs"("queuedAt");

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
