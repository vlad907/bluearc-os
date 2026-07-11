-- CreateTable
CREATE TABLE "ai_usage_budgets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enforce" BOOLEAN NOT NULL DEFAULT false,
    "monthlyCallLimit" INTEGER,
    "monthlyTokenLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_budgets_organizationId_key" ON "ai_usage_budgets"("organizationId");

-- CreateIndex
CREATE INDEX "ai_usage_budgets_organizationId_idx" ON "ai_usage_budgets"("organizationId");

-- AddForeignKey
ALTER TABLE "ai_usage_budgets" ADD CONSTRAINT "ai_usage_budgets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
