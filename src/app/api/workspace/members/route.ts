import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRawInviteToken, hashInviteToken, normalizeEmail } from "@/lib/auth/session";
import { requireWorkspaceRole, resolveWorkspaceAccess, workspaceAccessError } from "@/lib/auth/workspace";
import { sendWorkspaceInviteEmail } from "@/lib/email/workspace-invitations";

export const dynamic = "force-dynamic";

const memberRoles = ["owner", "admin", "manager", "member", "viewer"] as const;
const memberAdminRoles = ["owner", "admin"] as const;

type MemberRole = typeof memberRoles[number];

type MemberBody = {
  organizationId?: unknown;
  email?: unknown;
  role?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as MemberBody;
  } catch {
    return null;
  }
}

function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && memberRoles.includes(value as MemberRole);
}

function inviteExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date;
}

function appOrigin(request: NextRequest) {
  const explicitOrigin = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicitOrigin) {
    return explicitOrigin.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const access = await resolveWorkspaceAccess(request);

  if (!access.authorized || !access.organizationId) {
    return workspaceAccessError(access);
  }

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: access.organizationId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
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

  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      organizationId: access.organizationId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return Response.json({ members, invitations });
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const auth = await requireWorkspaceRole(request, body, memberAdminRoles);

  if ("error" in auth) {
    return auth.error;
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const role = isMemberRole(body.role) ? body.role : "member";

  if (!email) {
    return jsonError("Member email is required", 400);
  }

  if (role === "owner" && auth.role !== "owner") {
    return jsonError("Only owners can add another owner", 403);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    const inviteToken = createRawInviteToken();
    const invitation = await prisma.workspaceInvitation.upsert({
      where: {
        organizationId_email_status: {
          organizationId: auth.organizationId,
          email,
          status: "pending",
        },
      },
      update: {
        role,
        tokenHash: hashInviteToken(inviteToken),
        invitedById: auth.userId,
        expiresAt: inviteExpiryDate(),
        revokedAt: null,
      },
      create: {
        organizationId: auth.organizationId,
        email,
        role,
        tokenHash: hashInviteToken(inviteToken),
        invitedById: auth.userId,
        expiresAt: inviteExpiryDate(),
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
    });
    const inviteUrl = `${appOrigin(request)}/settings?invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(email)}`;
    const inviteEmail = await sendWorkspaceInviteEmail({
      to: email,
      role,
      inviteUrl,
      workspaceName: invitation.organization.name,
      invitedByName: invitation.invitedBy.name,
      invitedByEmail: invitation.invitedBy.email,
    });
    const publicInvitation = {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: invitation.invitedBy,
    };

    return Response.json(
      {
        invitation: publicInvitation,
        inviteUrl,
        inviteEmail,
      },
      { status: 202 },
    );
  }

  const member = await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: auth.organizationId,
        userId: user.id,
      },
    },
    update: { role },
    create: {
      organizationId: auth.organizationId,
      userId: user.id,
      role,
    },
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

  return Response.json({ member }, { status: 201 });
}
