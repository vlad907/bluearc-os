-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('free', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "CompanyRelationshipType" AS ENUM ('customer', 'vendor', 'msp', 'property_manager', 'contractor', 'partner');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('startup', 'smb', 'mid', 'enterprise');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('prospect', 'active', 'inactive', 'churned');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('decision_maker', 'influencer', 'user', 'admin', 'site_contact', 'dispatcher');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'evaluating', 'bidding', 'submitted', 'won', 'lost');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('active', 'inactive', 'blacklisted');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('open', 'bidding', 'awarded', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('email', 'phone', 'sms', 'linkedin', 'meeting', 'note', 'other');

-- CreateEnum
CREATE TYPE "OutreachDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('draft', 'scheduled', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "OrganizationPlan" NOT NULL DEFAULT 'free',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationshipType" "CompanyRelationshipType" NOT NULL DEFAULT 'customer',
    "domain" TEXT,
    "industry" TEXT,
    "size" "CompanySize",
    "status" "CompanyStatus" NOT NULL DEFAULT 'prospect',
    "website" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "role" "ContactRole",
    "source" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'new',
    "value" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER,
    "source" TEXT,
    "assignedToId" TEXT,
    "expectedClose" TIMESTAMP(3),
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'active',
    "rating" INTEGER,
    "notes" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "vendorId" TEXT,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'open',
    "priority" "JobPriority" NOT NULL DEFAULT 'medium',
    "type" TEXT,
    "siteAddress" JSONB,
    "postedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "bidDeadline" TIMESTAMP(3),
    "estimatedValue" DECIMAL(65,30),
    "assignedToId" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "jobId" TEXT,
    "channel" "OutreachChannel" NOT NULL DEFAULT 'email',
    "direction" "OutreachDirection" NOT NULL DEFAULT 'outbound',
    "status" "OutreachStatus" NOT NULL DEFAULT 'draft',
    "subject" TEXT,
    "body" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "companies_organizationId_idx" ON "companies"("organizationId");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "contacts_organizationId_idx" ON "contacts"("organizationId");

-- CreateIndex
CREATE INDEX "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE INDEX "leads_organizationId_idx" ON "leads"("organizationId");

-- CreateIndex
CREATE INDEX "leads_contactId_idx" ON "leads"("contactId");

-- CreateIndex
CREATE INDEX "leads_companyId_idx" ON "leads"("companyId");

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "tasks_organizationId_idx" ON "tasks"("organizationId");

-- CreateIndex
CREATE INDEX "tasks_entityType_entityId_idx" ON "tasks"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "vendors_organizationId_idx" ON "vendors"("organizationId");

-- CreateIndex
CREATE INDEX "vendors_companyId_idx" ON "vendors"("companyId");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "jobs_organizationId_idx" ON "jobs"("organizationId");

-- CreateIndex
CREATE INDEX "jobs_companyId_idx" ON "jobs"("companyId");

-- CreateIndex
CREATE INDEX "jobs_contactId_idx" ON "jobs"("contactId");

-- CreateIndex
CREATE INDEX "jobs_vendorId_idx" ON "jobs"("vendorId");

-- CreateIndex
CREATE INDEX "jobs_leadId_idx" ON "jobs"("leadId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "outreach_organizationId_idx" ON "outreach"("organizationId");

-- CreateIndex
CREATE INDEX "outreach_companyId_idx" ON "outreach"("companyId");

-- CreateIndex
CREATE INDEX "outreach_contactId_idx" ON "outreach"("contactId");

-- CreateIndex
CREATE INDEX "outreach_leadId_idx" ON "outreach"("leadId");

-- CreateIndex
CREATE INDEX "outreach_jobId_idx" ON "outreach"("jobId");

-- CreateIndex
CREATE INDEX "outreach_channel_idx" ON "outreach"("channel");

-- CreateIndex
CREATE INDEX "outreach_status_idx" ON "outreach"("status");

-- CreateIndex
CREATE INDEX "outreach_scheduledAt_idx" ON "outreach"("scheduledAt");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

