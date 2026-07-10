-- CreateTable
CREATE TABLE "workspace_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessName" TEXT,
    "businessDescription" TEXT,
    "serviceArea" TEXT,
    "industriesServed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceSpecialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTone" TEXT,
    "outreachStyle" TEXT,
    "preferredCta" TEXT,
    "doNotMention" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "senderName" TEXT,
    "senderTitle" TEXT,
    "senderPhone" TEXT,
    "senderEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_ai_strategies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedStrategy" JSONB,
    "selectedTargetCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selectedPriorityPainPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selectedCtaStyle" TEXT,
    "guardrails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_ai_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_profiles_organizationId_key" ON "workspace_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "workspace_profiles_organizationId_idx" ON "workspace_profiles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_ai_strategies_organizationId_key" ON "workspace_ai_strategies"("organizationId");

-- CreateIndex
CREATE INDEX "workspace_ai_strategies_organizationId_idx" ON "workspace_ai_strategies"("organizationId");

-- AddForeignKey
ALTER TABLE "workspace_profiles" ADD CONSTRAINT "workspace_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_ai_strategies" ADD CONSTRAINT "workspace_ai_strategies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
