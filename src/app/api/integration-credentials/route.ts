import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";
import {
  checkEnvCredentialStatus,
  defaultCredentialLabel,
  isIntegrationKind,
  isIntegrationProvider,
} from "@/lib/integrations/credentials";

export const dynamic = "force-dynamic";

type CredentialBody = {
  organizationId?: unknown;
  provider?: unknown;
  kind?: unknown;
  label?: unknown;
  envKeyName?: unknown;
  envSecretName?: unknown;
  scopes?: unknown;
  config?: unknown;
  disabled?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as CredentialBody;
  } catch {
    return null;
  }
}

async function resolveOrganizationId(request: NextRequest, body?: CredentialBody | null) {
  return resolveWorkspace(request, body);
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function stringList(value: unknown) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function publicCredential<T extends {
  envKeyName: string | null;
  envSecretName: string | null;
  status: string;
}>(credential: T) {
  return {
    ...credential,
    envKeyPresent: credential.envKeyName ? Boolean(process.env[credential.envKeyName]) : null,
    envSecretPresent: credential.envSecretName ? Boolean(process.env[credential.envSecretName]) : null,
  };
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return jsonError("Related organization was not found", 400);
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const credentials = await prisma.integrationCredential.findMany({
      where: { organizationId },
      orderBy: [{ provider: "asc" }, { kind: "asc" }],
    });

    return Response.json({ credentials: credentials.map(publicCredential) });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const workspace = await resolveOrganizationId(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;
  const label = optionalString(body.label);
  const envKeyName = optionalString(body.envKeyName);
  const envSecretName = optionalString(body.envSecretName);
  const scopes = stringList(body.scopes);


  if (!isIntegrationProvider(body.provider)) {
    return jsonError("provider is invalid", 400);
  }

  if (!isIntegrationKind(body.kind)) {
    return jsonError("kind is invalid", 400);
  }

  if ([label, envKeyName, envSecretName].includes(undefined) || scopes === null) {
    return jsonError("Credential fields are invalid", 400);
  }

  const nextStatus = body.disabled === true
    ? "disabled"
    : checkEnvCredentialStatus({ envKeyName, envSecretName });
  const now = new Date();

  try {
    const credential = await prisma.integrationCredential.upsert({
      where: {
        organizationId_provider_kind: {
          organizationId,
          provider: body.provider,
          kind: body.kind,
        },
      },
      create: {
        organizationId,
        provider: body.provider,
        kind: body.kind,
        label: label ?? defaultCredentialLabel(body.provider, body.kind),
        envKeyName,
        envSecretName,
        scopes,
        config: body.config && typeof body.config === "object" ? body.config : undefined,
        status: nextStatus,
        lastCheckedAt: now,
        connectedAt: nextStatus === "configured" ? now : undefined,
        disabledAt: nextStatus === "disabled" ? now : undefined,
      },
      update: {
        label: label ?? defaultCredentialLabel(body.provider, body.kind),
        envKeyName,
        envSecretName,
        scopes,
        config: body.config && typeof body.config === "object" ? body.config : undefined,
        status: nextStatus,
        lastCheckedAt: now,
        connectedAt: nextStatus === "configured" ? now : undefined,
        disabledAt: nextStatus === "disabled" ? now : null,
      },
    });

    return Response.json({ credential: publicCredential(credential) });
  } catch (error) {
    return handlePrismaError(error);
  }
}
