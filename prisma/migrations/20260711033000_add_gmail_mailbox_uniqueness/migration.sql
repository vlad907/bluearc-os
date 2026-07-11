CREATE UNIQUE INDEX "email_threads_organizationId_provider_providerThreadId_key" ON "email_threads"("organizationId", "provider", "providerThreadId");
CREATE UNIQUE INDEX "email_messages_organizationId_providerMessageId_key" ON "email_messages"("organizationId", "providerMessageId");
