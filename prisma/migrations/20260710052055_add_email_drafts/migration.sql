-- CreateEnum
CREATE TYPE "EmailDraftStatus" AS ENUM ('draft', 'needs_review', 'approved', 'rejected', 'sent');

-- CreateEnum
CREATE TYPE "EmailDraftMode" AS ENUM ('signal', 'fallback', 'soft', 'partnership');

-- CreateTable
CREATE TABLE "email_drafts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outreachId" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "mode" "EmailDraftMode" NOT NULL DEFAULT 'signal',
    "status" "EmailDraftStatus" NOT NULL DEFAULT 'needs_review',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "usedSignal" TEXT,
    "verifierDecision" TEXT,
    "verifierReason" TEXT,
    "verifierEditedBody" TEXT,
    "agent2Output" JSONB,
    "agent3Output" JSONB,
    "promptKey" TEXT NOT NULL,
    "promptSource" TEXT NOT NULL,
    "verifierPromptKey" TEXT,
    "verifierPromptSource" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "gmailDraftId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_drafts_organizationId_idx" ON "email_drafts"("organizationId");

-- CreateIndex
CREATE INDEX "email_drafts_outreachId_idx" ON "email_drafts"("outreachId");

-- CreateIndex
CREATE INDEX "email_drafts_companyId_idx" ON "email_drafts"("companyId");

-- CreateIndex
CREATE INDEX "email_drafts_contactId_idx" ON "email_drafts"("contactId");

-- CreateIndex
CREATE INDEX "email_drafts_leadId_idx" ON "email_drafts"("leadId");

-- CreateIndex
CREATE INDEX "email_drafts_status_idx" ON "email_drafts"("status");

-- CreateIndex
CREATE INDEX "email_drafts_mode_idx" ON "email_drafts"("mode");

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "outreach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
