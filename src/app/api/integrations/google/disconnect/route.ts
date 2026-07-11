import { NextRequest } from "next/server";
import { requireWorkspaceRole } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { connectionId?: unknown; organizationId?: unknown } | null;
  const workspace = await requireWorkspaceRole(request, body, ["owner", "admin", "manager", "member"]);

  if ("error" in workspace) {
    return workspace.error;
  }

  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : null;

  if (!connectionId) {
    return Response.json({ error: "connectionId is required" }, { status: 400 });
  }

  const result = await prisma.gmailConnection.updateMany({
    where: {
      id: connectionId,
      organizationId: workspace.organizationId,
    },
    data: {
      status: "disabled",
      disconnectedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return Response.json({ error: "Gmail connection not found" }, { status: 404 });
  }

  const activeConnections = await prisma.gmailConnection.count({
    where: {
      organizationId: workspace.organizationId,
      status: "connected",
    },
  });

  if (activeConnections === 0) {
    await prisma.integrationCredential.updateMany({
      where: {
        organizationId: workspace.organizationId,
        provider: "google_gmail",
        kind: "oauth_connection",
      },
      data: {
        status: "disabled",
        disabledAt: new Date(),
      },
    });
  }

  return Response.json({ disconnected: true });
}
