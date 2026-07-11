import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const memberRoles = ["owner", "admin", "manager", "member", "viewer"] as const;
const memberAdminRoles = ["owner", "admin"] as const;

type MemberRole = typeof memberRoles[number];

type RouteParams = {
  params: Promise<{ id: string }>;
};

type MemberUpdateBody = {
  organizationId?: unknown;
  role?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as MemberUpdateBody;
  } catch {
    return null;
  }
}

function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && memberRoles.includes(value as MemberRole);
}

async function countOwners(organizationId: string) {
  return prisma.organizationMember.count({ where: { organizationId, role: "owner" } });
}

async function findMember(id: string, organizationId: string) {
  return prisma.organizationMember.findFirst({
    where: { id, organizationId },
    select: { id: true, userId: true, role: true },
  });
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const auth = await requireWorkspaceRole(request, body, memberAdminRoles);

  if ("error" in auth) {
    return auth.error;
  }

  const role = body.role;

  if (!isMemberRole(role)) {
    return jsonError("role is invalid", 400);
  }

  if (role === "owner" && auth.role !== "owner") {
    return jsonError("Only owners can promote another owner", 403);
  }

  const { id } = await context.params;
  const existingMember = await findMember(id, auth.organizationId);

  if (!existingMember) {
    return jsonError("Member not found", 404);
  }

  if (existingMember.role === "owner" && role !== "owner" && await countOwners(auth.organizationId) <= 1) {
    return jsonError("Workspace must keep at least one owner", 409);
  }

  const member = await prisma.organizationMember.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return Response.json({ member });
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const auth = await requireWorkspaceRole(request, undefined, memberAdminRoles);

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const existingMember = await findMember(id, auth.organizationId);

  if (!existingMember) {
    return jsonError("Member not found", 404);
  }

  if (existingMember.role === "owner" && await countOwners(auth.organizationId) <= 1) {
    return jsonError("Workspace must keep at least one owner", 409);
  }

  await prisma.organizationMember.delete({ where: { id } });

  return Response.json({ deleted: true });
}
