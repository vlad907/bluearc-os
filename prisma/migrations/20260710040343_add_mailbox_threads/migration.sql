-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "outreachId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerThreadId" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "classification" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "direction" "OutreachDirection" NOT NULL,
    "fromEmail" TEXT,
    "toEmail" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "classification" TEXT,
    "suggestedSubject" TEXT,
    "suggestedBody" TEXT,
    "suggestedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_threads_organizationId_idx" ON "email_threads"("organizationId");

-- CreateIndex
CREATE INDEX "email_threads_companyId_idx" ON "email_threads"("companyId");

-- CreateIndex
CREATE INDEX "email_threads_contactId_idx" ON "email_threads"("contactId");

-- CreateIndex
CREATE INDEX "email_threads_leadId_idx" ON "email_threads"("leadId");

-- CreateIndex
CREATE INDEX "email_threads_outreachId_idx" ON "email_threads"("outreachId");

-- CreateIndex
CREATE INDEX "email_threads_status_idx" ON "email_threads"("status");

-- CreateIndex
CREATE INDEX "email_threads_classification_idx" ON "email_threads"("classification");

-- CreateIndex
CREATE INDEX "email_threads_lastMessageAt_idx" ON "email_threads"("lastMessageAt");

-- CreateIndex
CREATE INDEX "email_messages_organizationId_idx" ON "email_messages"("organizationId");

-- CreateIndex
CREATE INDEX "email_messages_threadId_idx" ON "email_messages"("threadId");

-- CreateIndex
CREATE INDEX "email_messages_direction_idx" ON "email_messages"("direction");

-- CreateIndex
CREATE INDEX "email_messages_classification_idx" ON "email_messages"("classification");

-- CreateIndex
CREATE INDEX "email_messages_receivedAt_idx" ON "email_messages"("receivedAt");

-- CreateIndex
CREATE INDEX "email_messages_sentAt_idx" ON "email_messages"("sentAt");

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "outreach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
