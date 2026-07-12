import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const taskStatuses = ["todo", "in_progress", "done", "cancelled"] as const;
const taskPriorities = ["low", "medium", "high", "urgent"] as const;
const taskEntityTypes = ["company", "contact", "lead", "job", "vendor"] as const;

const writableTaskFields = [
  "description",
  "status",
  "priority",
  "dueDate",
  "completedAt",
  "assignedToId",
  "entityType",
  "entityId",
  "metadata",
] as const;

type CreateTaskBody = {
  organizationId?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  completedAt?: unknown;
  assignedToId?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  metadata?: unknown;
};

type TaskWithEntityContext = Awaited<ReturnType<typeof prisma.task.findMany>>[number] & {
  entity: {
    id: string;
    type: string;
    label: string;
    subtitle: string | null;
  } | null;
};

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

async function resolveOrganizationId(request: NextRequest, body?: Record<string, unknown>) {
  return resolveWorkspace(request, body);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function assertOptionalString(value: unknown, field: string) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    return `${field} must be a string or null`;
  }

  return null;
}

function parseOptionalDate(value: unknown, field: string, errors: string[]) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${field} must be an ISO date string or null`);
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${field} must be a valid ISO date string or null`);
    return undefined;
  }

  return date;
}

function buildTaskData(body: CreateTaskBody) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const field of writableTaskFields) {
    const value = body[field];

    if (value === undefined) {
      continue;
    }

    if (field === "status" && !isOneOf(value, taskStatuses)) {
      errors.push("status is invalid");
      continue;
    }

    if (field === "priority" && !isOneOf(value, taskPriorities)) {
      errors.push("priority is invalid");
      continue;
    }

    if (["description", "assignedToId", "entityType", "entityId"].includes(field)) {
      const error = assertOptionalString(value, field);
      if (error) {
        errors.push(error);
        continue;
      }
    }

    if (field === "entityType" && value !== null && value !== undefined && !isOneOf(value, taskEntityTypes)) {
      errors.push("entityType is invalid");
      continue;
    }

    if (field === "dueDate" || field === "completedAt") {
      const date = parseOptionalDate(value, field, errors);
      if (date !== undefined) {
        data[field] = date;
      }
      continue;
    }

    data[field] = value;
  }

  return { data, errors };
}

async function validateTaskEntity(organizationId: string, data: Record<string, unknown>) {
  const entityType = data.entityType;
  const entityId = data.entityId;

  if (!entityType && !entityId) {
    return null;
  }

  if (typeof entityType !== "string" || !isOneOf(entityType, taskEntityTypes)) {
    return "entityType is required when entityId is provided";
  }

  if (typeof entityId !== "string" || !entityId.trim()) {
    return "entityId is required when entityType is provided";
  }

  const id = entityId.trim();
  const exists = entityType === "company"
    ? await prisma.company.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } })
    : entityType === "contact"
      ? await prisma.contact.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } })
      : entityType === "lead"
        ? await prisma.lead.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } })
        : entityType === "job"
          ? await prisma.job.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } })
          : await prisma.vendor.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });

  return exists ? null : "Linked task entity was not found";
}

async function attachEntityContext<T extends { entityType: string | null; entityId: string | null }>(
  organizationId: string,
  tasks: T[],
) {
  const idsByType = taskEntityTypes.reduce<Record<typeof taskEntityTypes[number], string[]>>((accumulator, type) => {
    accumulator[type] = [];
    return accumulator;
  }, {} as Record<typeof taskEntityTypes[number], string[]>);

  for (const task of tasks) {
    if (task.entityType && taskEntityTypes.includes(task.entityType as typeof taskEntityTypes[number]) && task.entityId) {
      idsByType[task.entityType as typeof taskEntityTypes[number]].push(task.entityId);
    }
  }

  const [companies, contacts, leads, jobs, vendors] = await Promise.all([
    prisma.company.findMany({
      where: { id: { in: idsByType.company }, organizationId, deletedAt: null },
      select: { id: true, name: true, industry: true },
    }),
    prisma.contact.findMany({
      where: { id: { in: idsByType.contact }, organizationId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.lead.findMany({
      where: { id: { in: idsByType.lead }, organizationId, deletedAt: null },
      select: { id: true, title: true, stage: true },
    }),
    prisma.job.findMany({
      where: { id: { in: idsByType.job }, organizationId, deletedAt: null },
      select: { id: true, title: true, status: true },
    }),
    prisma.vendor.findMany({
      where: { id: { in: idsByType.vendor }, organizationId, deletedAt: null },
      select: { id: true, name: true, category: true },
    }),
  ]);

  const entityLabels = new Map<string, TaskWithEntityContext["entity"]>();
  companies.forEach((company) => entityLabels.set(`company:${company.id}`, {
    id: company.id,
    type: "company",
    label: company.name,
    subtitle: company.industry,
  }));
  contacts.forEach((contact) => entityLabels.set(`contact:${contact.id}`, {
    id: contact.id,
    type: "contact",
    label: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    subtitle: contact.email,
  }));
  leads.forEach((lead) => entityLabels.set(`lead:${lead.id}`, {
    id: lead.id,
    type: "lead",
    label: lead.title,
    subtitle: lead.stage,
  }));
  jobs.forEach((job) => entityLabels.set(`job:${job.id}`, {
    id: job.id,
    type: "job",
    label: job.title,
    subtitle: job.status,
  }));
  vendors.forEach((vendor) => entityLabels.set(`vendor:${vendor.id}`, {
    id: vendor.id,
    type: "vendor",
    label: vendor.name,
    subtitle: vendor.category,
  }));

  return tasks.map((task) => ({
    ...task,
    entity: task.entityType && task.entityId
      ? entityLabels.get(`${task.entityType}:${task.entityId}`) ?? null
      : null,
  }));
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return jsonError("Related organization was not found", 400);
    }
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
    const tasks = await prisma.task.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ tasks: await attachEntityContext(organizationId, tasks) });
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
  const title = typeof body.title === "string" ? body.title.trim() : "";


  if (!title) {
    return jsonError("title is required", 400);
  }

  const { data, errors } = buildTaskData(body);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const entityError = await validateTaskEntity(organizationId, data);

  if (entityError) {
    return jsonError(entityError, 400);
  }

  try {
    const task = await prisma.task.create({
      data: {
        organizationId,
        title,
        ...data,
      },
    });

    const [taskWithEntity] = await attachEntityContext(organizationId, [task]);

    return Response.json({ task: taskWithEntity }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}
