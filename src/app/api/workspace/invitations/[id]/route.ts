import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const memberAdminRoles = ["owner", "admin"] as const;

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteParams) {
  const auth = await requireWorkspaceRole(request, undefined, memberAdminRoles);

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id, organizationId: auth.organizationId, status: "pending" },
    select: { id: true },
  });

  if (!invitation) {
    return Response.json({ error: "Invitation not found" }, { status: 404 });
  }

  await prisma.workspaceInvitation.update({
    where: { id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
    },
  });

  return Response.json({ revoked: true });
}
