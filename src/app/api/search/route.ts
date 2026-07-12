import { NextRequest } from "next/server";

import { resolveWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 80;
const MAX_PER_TYPE = 8;

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

function emptyResponse(query: string) {
  return Response.json({ query, results: [], counts: {} });
}

export async function GET(request: NextRequest) {
  const workspace = await resolveWorkspace(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const query = normalizedQuery(request);

  if (query.length < 2) {
    return emptyResponse(query);
  }

  const { organizationId } = workspace;
  const [companies, contacts, leads, jobs, vendors, tasks] = await Promise.all([
    prisma.company.findMany({
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
    }),
    prisma.contact.findMany({
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
    }),
    prisma.lead.findMany({
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
    }),
    prisma.job.findMany({
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
    }),
    prisma.vendor.findMany({
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
    }),
    prisma.task.findMany({
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
    }),
  ]);

  const results: SearchResult[] = [
    ...companies.map((company) => ({
      id: company.id,
      type: "company" as const,
      title: company.name,
      subtitle: company.industry,
      href: "/companies",
      status: company.status,
      updatedAt: company.updatedAt,
    })),
    ...contacts.map((contact) => ({
      id: contact.id,
      type: "contact" as const,
      title: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      subtitle: contact.company?.name ?? contact.email ?? contact.title,
      href: "/contacts",
      status: contact.status,
      updatedAt: contact.updatedAt,
    })),
    ...leads.map((lead) => ({
      id: lead.id,
      type: "lead" as const,
      title: lead.title,
      subtitle: lead.company?.name ?? null,
      href: "/leads",
      status: lead.stage,
      updatedAt: lead.updatedAt,
    })),
    ...jobs.map((job) => ({
      id: job.id,
      type: "job" as const,
      title: job.title,
      subtitle: job.company?.name ?? job.priority,
      href: "/jobs",
      status: job.status,
      updatedAt: job.updatedAt,
    })),
    ...vendors.map((vendor) => ({
      id: vendor.id,
      type: "vendor" as const,
      title: vendor.name,
      subtitle: vendor.category,
      href: "/vendors",
      status: vendor.status,
      updatedAt: vendor.updatedAt,
    })),
    ...tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      title: task.title,
      subtitle: task.entityType ?? task.priority,
      href: "/tasks",
      status: task.status,
      updatedAt: task.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

  return Response.json({
    query,
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
