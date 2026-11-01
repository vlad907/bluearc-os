import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type ExtractContactsBody = {
  organizationId?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as ExtractContactsBody;
  } catch {
    return {};
  }
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const tokens = localPart.split(/[._-]+/).filter(Boolean);
  const firstName = capitalize(tokens[0] ?? "") || "Contact";
  const lastName = tokens.length > 1 ? capitalize(tokens[tokens.length - 1]) : null;
  return { firstName, lastName };
}

function readStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, companyId: true, metadata: true },
    });

    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    const metadata = lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Prisma.JsonObject)
      : {};

    // Prefer the aggregated emails from the latest website crawl, falling back
    // to whatever the lead metadata recorded.
    const snapshot = await prisma.websiteSnapshot.findFirst({
      where: { leadId: lead.id, organizationId },
      orderBy: { fetchedAt: "desc" },
      select: { metadata: true },
    });

    const snapshotEmails = snapshot && typeof snapshot.metadata === "object" && !Array.isArray(snapshot.metadata)
      ? readStringArray((snapshot.metadata as Prisma.JsonObject).extractedEmails)
      : [];

    const emails = Array.from(
      new Set([...snapshotEmails, ...readStringArray(metadata.extractedEmails)].map((email) => email.trim().toLowerCase())),
    ).filter((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));

    if (emails.length === 0) {
      return jsonError("No extracted emails found. Run website research first.", 400);
    }

    const existing = await prisma.contact.findMany({
      where: { organizationId, email: { in: emails }, deletedAt: null },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((contact) => (contact.email ?? "").toLowerCase()));

    const created = [];
    const skipped: string[] = [];

    for (const email of emails) {
      if (existingEmails.has(email)) {
        skipped.push(email);
        continue;
      }

      existingEmails.add(email);
      const { firstName, lastName } = nameFromEmail(email);

      const contact = await prisma.contact.create({
        data: {
          organizationId,
          companyId: lead.companyId,
          firstName,
          lastName,
          email,
          metadata: { source: "website_research", leadId: lead.id } as Prisma.JsonObject,
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      created.push(contact);
    }

    return Response.json({
      created,
      createdCount: created.length,
      skipped,
      skippedCount: skipped.length,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return jsonError("Related record was not found", 400);
    }

    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
