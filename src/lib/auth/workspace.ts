import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

type OrganizationBody = {
  organizationId?: unknown;
} | null | undefined;

export type WorkspaceResolution = {
  organizationId: string | null;
  authenticated: boolean;
  authorized: boolean;
  userId?: string;
  role?: string;
  reason?: "missing_organization" | "missing_session" | "not_member" | "insufficient_role";
};

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const writeRoles = new Set(["owner", "admin", "manager", "member"]);

export function requestedOrganizationId(request: NextRequest, body?: OrganizationBody) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId") ??
    (typeof body?.organizationId === "string" ? body.organizationId : null);

  return organizationId?.trim() || null;
}

export async function resolveWorkspaceAccess(request: NextRequest, body?: OrganizationBody): Promise<WorkspaceResolution> {
  const requestedId = requestedOrganizationId(request, body);
  const session = await getCurrentSession();

  if (session) {
    const memberships = session.user.memberships;
    const organizationId = requestedId || memberships[0]?.organization.id || null;

    if (!organizationId) {
      return {
        organizationId: null,
        authenticated: true,
        authorized: false,
        userId: session.user.id,
        reason: "missing_organization",
      };
    }

    const membership = memberships.find((item) => item.organization.id === organizationId);
    const authorized = Boolean(membership);

    if (membership && mutatingMethods.has(request.method) && !writeRoles.has(membership.role)) {
      return {
        organizationId: null,
        authenticated: true,
        authorized: false,
        userId: session.user.id,
        role: membership.role,
        reason: "insufficient_role",
      };
    }

    return {
      organizationId: authorized ? organizationId : null,
      authenticated: true,
      authorized,
      userId: session.user.id,
      role: membership?.role,
      reason: authorized ? undefined : "not_member",
    };
  }

  if (!requestedId) {
    return {
      organizationId: null,
      authenticated: false,
      authorized: false,
      reason: "missing_organization",
    };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      organizationId: null,
      authenticated: false,
      authorized: false,
      reason: "missing_session",
    };
  }

  return {
    organizationId: requestedId,
    authenticated: false,
    authorized: true,
  };
}

export async function resolveWorkspaceId(request: NextRequest, body?: OrganizationBody) {
  const access = await resolveWorkspaceAccess(request, body);
  return access.authorized ? access.organizationId : null;
}

export async function requireWorkspaceRole(
  request: NextRequest,
  body: OrganizationBody,
  allowedRoles: readonly string[],
) {
  const access = await resolveWorkspaceAccess(request, body);

  if (!access.authorized || !access.organizationId) {
    return { error: workspaceAccessError(access) };
  }

  if (!access.authenticated || !access.userId || !access.role) {
    return {
      error: Response.json({ error: "Sign in is required for this workspace action" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      error: Response.json({ error: "Workspace role cannot perform this action" }, { status: 403 }),
    };
  }

  return {
    organizationId: access.organizationId,
    userId: access.userId,
    role: access.role,
  };
}

export function workspaceAccessError(access: WorkspaceResolution) {
  if (access.reason === "not_member") {
    return Response.json({ error: "Workspace access denied" }, { status: 403 });
  }

  if (access.reason === "insufficient_role") {
    return Response.json({ error: "Workspace role cannot modify this resource" }, { status: 403 });
  }

  if (access.reason === "missing_session") {
    return Response.json({ error: "Sign in is required for workspace access" }, { status: 401 });
  }

  return Response.json({ error: "organizationId is required" }, { status: 400 });
}
