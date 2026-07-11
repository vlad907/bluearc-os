CREATE TABLE "gmail_connections" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "IntegrationCredentialStatus" NOT NULL DEFAULT 'connected',
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "encryptedAccessToken" TEXT NOT NULL,
  "encryptedRefreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "metadata" JSONB,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gmail_connections_organizationId_userId_email_key" ON "gmail_connections"("organizationId", "userId", "email");
CREATE INDEX "gmail_connections_organizationId_idx" ON "gmail_connections"("organizationId");
CREATE INDEX "gmail_connections_userId_idx" ON "gmail_connections"("userId");
CREATE INDEX "gmail_connections_email_idx" ON "gmail_connections"("email");
CREATE INDEX "gmail_connections_status_idx" ON "gmail_connections"("status");

ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
