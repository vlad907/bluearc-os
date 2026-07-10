-- CreateEnum
CREATE TYPE "PartnerCandidateStatus" AS ENUM ('discovered', 'researching', 'qualified', 'contacted', 'converted', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "PartnershipType" AS ENUM ('subcontractor', 'vendor_network', 'referral_partner', 'field_service_partner', 'unknown');

-- CreateTable
CREATE TABLE "partner_candidates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "relevanceReason" TEXT,
    "partnershipType" "PartnershipType" NOT NULL DEFAULT 'unknown',
    "status" "PartnerCandidateStatus" NOT NULL DEFAULT 'discovered',
    "fitScore" DOUBLE PRECISION,
    "fitReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedOutreachAngle" TEXT,
    "contactEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactFormUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual_partnership_discovery',
    "promptKey" TEXT,
    "promptSource" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_candidates_organizationId_idx" ON "partner_candidates"("organizationId");

-- CreateIndex
CREATE INDEX "partner_candidates_companyId_idx" ON "partner_candidates"("companyId");

-- CreateIndex
CREATE INDEX "partner_candidates_contactId_idx" ON "partner_candidates"("contactId");

-- CreateIndex
CREATE INDEX "partner_candidates_leadId_idx" ON "partner_candidates"("leadId");

-- CreateIndex
CREATE INDEX "partner_candidates_status_idx" ON "partner_candidates"("status");

-- CreateIndex
CREATE INDEX "partner_candidates_partnershipType_idx" ON "partner_candidates"("partnershipType");

-- CreateIndex
CREATE INDEX "partner_candidates_fitScore_idx" ON "partner_candidates"("fitScore");

-- AddForeignKey
ALTER TABLE "partner_candidates" ADD CONSTRAINT "partner_candidates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_candidates" ADD CONSTRAINT "partner_candidates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_candidates" ADD CONSTRAINT "partner_candidates_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_candidates" ADD CONSTRAINT "partner_candidates_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
