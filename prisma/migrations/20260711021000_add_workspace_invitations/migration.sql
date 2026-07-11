-- CreateEnum
CREATE TYPE "WorkspaceInvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'member',
    "status" "WorkspaceInvitationStatus" NOT NULL DEFAULT 'pending',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_tokenHash_key" ON "workspace_invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_organizationId_email_status_key" ON "workspace_invitations"("organizationId", "email", "status");

-- CreateIndex
CREATE INDEX "workspace_invitations_organizationId_idx" ON "workspace_invitations"("organizationId");

-- CreateIndex
CREATE INDEX "workspace_invitations_email_idx" ON "workspace_invitations"("email");

-- CreateIndex
CREATE INDEX "workspace_invitations_status_idx" ON "workspace_invitations"("status");

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
