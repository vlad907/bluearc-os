import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown>) {
  const organizationId =
    request.headers.get("x-organization-id") ??
    request.nextUrl.searchParams.get("organizationId") ??
    (typeof body?.organizationId === "string" ? body.organizationId : null);

  return organizationId?.trim() || null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return new Date();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function classifyInboundEmail(body: string) {
  const normalized = body.toLowerCase();

  if (normalized.includes("unsubscribe") || normalized.includes("remove me")) {
    return "unsubscribe";
  }

  if (normalized.includes("price") || normalized.includes("cost") || normalized.includes("quote")) {
    return "pricing_request";
  }

  if (normalized.includes("meeting") || normalized.includes("call") || normalized.includes("schedule")) {
    return "meeting_request";
  }

  if (normalized.includes("not interested") || normalized.includes("no thanks")) {
    return "not_interested";
  }

  if (normalized.includes("?")) {
    return "question";
  }

  if (normalized.includes("interested") || normalized.includes("tell me more")) {
    return "interested";
  }

  return "unknown";
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return jsonError("Related CRM record was not found", 400);
    }
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function GET(request: NextRequest) {
  const organizationId = resolveOrganizationId(request);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  const status = request.nextUrl.searchParams.get("status")?.trim();
  const classification = request.nextUrl.searchParams.get("classification")?.trim();
  const q = request.nextUrl.searchParams.get("q")?.trim();

  try {
    const threads = await prisma.emailThread.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(classification ? { classification } : {}),
        ...(q
          ? {
              OR: [
                { subject: { contains: q, mode: "insensitive" } },
                { messages: { some: { body: { contains: q, mode: "insensitive" }, deletedAt: null } } },
              ],
            }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        lead: { select: { id: true, title: true } },
        outreach: { select: { id: true, subject: true, status: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: [{ receivedAt: "asc" }, { sentAt: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    });

    return Response.json({ threads });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const organizationId = resolveOrganizationId(request, body);
  const subject = optionalString(body.subject);
  const messageBody = optionalString(body.body);

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  if (!subject) {
    return jsonError("subject is required", 400);
  }

  if (!messageBody) {
    return jsonError("body is required", 400);
  }

  const receivedAt = parseOptionalDate(body.receivedAt);
  const classification = classifyInboundEmail(messageBody);

  try {
    const thread = await prisma.emailThread.create({
      data: {
        organizationId,
        companyId: optionalString(body.companyId),
        contactId: optionalString(body.contactId),
        leadId: optionalString(body.leadId),
        outreachId: optionalString(body.outreachId),
        subject,
        status: "open",
        classification,
        lastMessageAt: receivedAt,
        messages: {
          create: {
            organizationId,
            direction: "inbound",
            fromEmail: optionalString(body.fromEmail),
            toEmail: optionalString(body.toEmail),
            subject,
            body: messageBody,
            classification,
            receivedAt,
          },
        },
      },
      include: { messages: true },
    });

    return Response.json({ thread }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
