-- AlterTable
ALTER TABLE "ai_provider_calls" ADD COLUMN "estimatedCostUsd" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ai_usage_budgets" ADD COLUMN "monthlyCostLimitUsd" DOUBLE PRECISION;
ALTER TABLE "ai_usage_budgets" ADD COLUMN "perMinuteCallLimit" INTEGER;
