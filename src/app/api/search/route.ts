import { NextRequest } from "next/server";

import { resolveWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 80;
const MAX_PER_TYPE = 8;
const searchTypes = ["all", "company", "contact", "lead", "job", "vendor", "task"] as const;

type SearchType = typeof searchTypes[number];

type SearchResult = {
  id: string;
  type: "company" | "contact" | "lead" | "job" | "vendor" | "task";
  title: string;
  subtitle: string | null;
  href: string;
  status: string | null;
  updatedAt: Date;
};

function normalizedQuery(request: NextRequest) {
  return (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

function requestedType(request: NextRequest): SearchType {
  const type = request.nextUrl.searchParams.get("type")?.trim();
  return searchTypes.includes(type as SearchType) ? type as SearchType : "all";
}

function shouldSearch(requested: SearchType, type: SearchType) {
  return requested === "all" || requested === type;
}

function recordHref(path: string, id: string) {
  return `${path}?highlight=${encodeURIComponent(id)}`;
}

function emptyResponse(query: string, type: SearchType) {
  return Response.json({ query, type, results: [], counts: {} });
}

export async function GET(request: NextRequest) {
  const workspace = await resolveWorkspace(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const query = normalizedQuery(request);
  const type = requestedType(request);

  if (query.length < 2) {
    return emptyResponse(query, type);
  }

  const { organizationId } = workspace;
  const [companies, contacts, leads, jobs, vendors, tasks] = await Promise.all([
    shouldSearch(type, "company") ? prisma.company.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { domain: { contains: query, mode: "insensitive" } },
          { industry: { contains: query, mode: "insensitive" } },
          { website: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_TYPE,
      select: { id: true, name: true, industry: true, status: true, updatedAt: true },
    }) : Promise.resolve([]),
    shouldSearch(type, "contact") ? prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { company: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_TYPE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        title: true,
        status: true,
        updatedAt: true,
        company: { select: { name: true } },
      },
    }) : Promise.resolve([]),
    shouldSearch(type, "lead") ? prisma.lead.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { source: { contains: query, mode: "insensitive" } },
          { company: { name: { contains: query, mode: "insensitive" } } },
          { contact: { email: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_TYPE,
      select: {
        id: true,
        title: true,
        stage: true,
        updatedAt: true,
        company: { select: { name: true } },
      },
    }) : Promise.resolve([]),
    shouldSearch(type, "job") ? prisma.job.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { type: { contains: query, mode: "insensitive" } },
          { company: { name: { contains: query, mode: "insensitive" } } },
          { vendor: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_TYPE,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        company: { select: { name: true } },
      },
    }) : Promise.resolve([]),
    shouldSearch(type, "vendor") ? prisma.vendor.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { contactName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { company: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_TYPE,
      select: { id: true, name: true, category: true, status: true, updatedAt: true },
    }) : Promise.resolve([]),
    shouldSearch(type, "task") ? prisma.task.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { entityType: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_TYPE,
      select: { id: true, title: true, status: true, priority: true, entityType: true, updatedAt: true },
    }) : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [
    ...companies.map((company) => ({
      id: company.id,
      type: "company" as const,
      title: company.name,
      subtitle: company.industry,
      href: recordHref("/companies", company.id),
      status: company.status,
      updatedAt: company.updatedAt,
    })),
    ...contacts.map((contact) => ({
      id: contact.id,
      type: "contact" as const,
      title: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      subtitle: contact.company?.name ?? contact.email ?? contact.title,
      href: recordHref("/contacts", contact.id),
      status: contact.status,
      updatedAt: contact.updatedAt,
    })),
    ...leads.map((lead) => ({
      id: lead.id,
      type: "lead" as const,
      title: lead.title,
      subtitle: lead.company?.name ?? null,
      href: recordHref("/leads", lead.id),
      status: lead.stage,
      updatedAt: lead.updatedAt,
    })),
    ...jobs.map((job) => ({
      id: job.id,
      type: "job" as const,
      title: job.title,
      subtitle: job.company?.name ?? job.priority,
      href: recordHref("/jobs", job.id),
      status: job.status,
      updatedAt: job.updatedAt,
    })),
    ...vendors.map((vendor) => ({
      id: vendor.id,
      type: "vendor" as const,
      title: vendor.name,
      subtitle: vendor.category,
      href: recordHref("/vendors", vendor.id),
      status: vendor.status,
      updatedAt: vendor.updatedAt,
    })),
    ...tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      title: task.title,
      subtitle: task.entityType ?? task.priority,
      href: recordHref("/tasks", task.id),
      status: task.status,
      updatedAt: task.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

  return Response.json({
    query,
    type,
    results,
    counts: {
      companies: companies.length,
      contacts: contacts.length,
      leads: leads.length,
      jobs: jobs.length,
      vendors: vendors.length,
      tasks: tasks.length,
    },
  });
}
