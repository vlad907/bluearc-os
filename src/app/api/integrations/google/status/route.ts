import { NextRequest } from "next/server";
import { resolveWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspace = await resolveWorkspace(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const connections = await prisma.gmailConnection.findMany({
    where: { organizationId: workspace.organizationId },
    orderBy: { connectedAt: "desc" },
    select: {
      id: true,
      email: true,
      status: true,
      scopes: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      lastError: true,
      connectedAt: true,
      disconnectedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return Response.json({
    connected: connections.some((connection) => connection.status === "connected"),
    connections,
  });
}
