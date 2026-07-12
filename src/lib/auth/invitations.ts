import { Prisma } from "@prisma/client";

import { hashInviteToken, normalizeEmail } from "@/lib/auth/session";

type Tx = Prisma.TransactionClient;

export type InviteAcceptanceResult = {
  organizationId: string;
  role: string;
};

export async function acceptWorkspaceInvitation(params: {
  tx: Tx;
  rawToken: string;
  userId: string;
  email: string;
}): Promise<InviteAcceptanceResult> {
  const tokenHash = hashInviteToken(params.rawToken);
  const email = normalizeEmail(params.email);
  const invitation = await params.tx.workspaceInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!invitation || invitation.status !== "pending") {
    throw new Error("Invitation is invalid or has already been used.");
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    await params.tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "expired" },
    });
    throw new Error("Invitation has expired.");
  }

  if (normalizeEmail(invitation.email) !== email) {
    throw new Error("Invitation email does not match this account.");
  }

  await params.tx.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: invitation.organizationId,
        userId: params.userId,
      },
    },
    update: { role: invitation.role },
    create: {
      organizationId: invitation.organizationId,
      userId: params.userId,
      role: invitation.role,
    },
  });

  await params.tx.workspaceInvitation.update({
    where: { id: invitation.id },
    data: {
      status: "accepted",
      acceptedById: params.userId,
      acceptedAt: new Date(),
    },
  });

  return {
    organizationId: invitation.organizationId,
    role: invitation.role,
  };
}
