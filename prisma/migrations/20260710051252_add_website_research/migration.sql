-- CreateTable
CREATE TABLE "website_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "textLength" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,

    CONSTRAINT "website_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_pages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "url" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'home',
    "rawText" TEXT NOT NULL,
    "extractedEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extractedPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_research_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "agent" TEXT NOT NULL DEFAULT 'agent1',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "output" JSONB NOT NULL,
    "promptKey" TEXT NOT NULL,
    "promptSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,

    CONSTRAINT "agent_research_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_snapshots_organizationId_idx" ON "website_snapshots"("organizationId");

-- CreateIndex
CREATE INDEX "website_snapshots_leadId_idx" ON "website_snapshots"("leadId");

-- CreateIndex
CREATE INDEX "website_snapshots_fetchedAt_idx" ON "website_snapshots"("fetchedAt");

-- CreateIndex
CREATE INDEX "website_pages_organizationId_idx" ON "website_pages"("organizationId");

-- CreateIndex
CREATE INDEX "website_pages_leadId_idx" ON "website_pages"("leadId");

-- CreateIndex
CREATE INDEX "website_pages_snapshotId_idx" ON "website_pages"("snapshotId");

-- CreateIndex
CREATE INDEX "agent_research_runs_organizationId_idx" ON "agent_research_runs"("organizationId");

-- CreateIndex
CREATE INDEX "agent_research_runs_leadId_idx" ON "agent_research_runs"("leadId");

-- CreateIndex
CREATE INDEX "agent_research_runs_snapshotId_idx" ON "agent_research_runs"("snapshotId");

-- CreateIndex
CREATE INDEX "agent_research_runs_agent_idx" ON "agent_research_runs"("agent");

-- AddForeignKey
ALTER TABLE "website_snapshots" ADD CONSTRAINT "website_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_snapshots" ADD CONSTRAINT "website_snapshots_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_snapshots" ADD CONSTRAINT "website_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_snapshots" ADD CONSTRAINT "website_snapshots_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "website_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_research_runs" ADD CONSTRAINT "agent_research_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_research_runs" ADD CONSTRAINT "agent_research_runs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_research_runs" ADD CONSTRAINT "agent_research_runs_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "website_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_research_runs" ADD CONSTRAINT "agent_research_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_research_runs" ADD CONSTRAINT "agent_research_runs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
