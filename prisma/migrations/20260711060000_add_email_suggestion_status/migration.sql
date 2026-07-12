-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN "suggestionStatus" TEXT;

-- CreateIndex
CREATE INDEX "email_messages_suggestionStatus_idx" ON "email_messages"("suggestionStatus");
