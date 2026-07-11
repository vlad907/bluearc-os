import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const stageColors: Record<string, string> = {
  new: "bg-blue-500",
  evaluating: "bg-indigo-500",
  bidding: "bg-violet-500",
  submitted: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-gray-500",
};

const stageLabels: Record<string, string> = {
  new: "New",
  evaluating: "Evaluating",
  bidding: "Bidding",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function resolveOrganizationId(request: NextRequest) {
  return resolveWorkspace(request);
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BA";
}

function formatTimestamp(value: Date) {
  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatDueDate(value: Date | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

export async function GET(request: NextRequest) {
  const workspace = await resolveOrganizationId(request);

  if ("error" in workspace) {
    return workspace.error;
  }

  const { organizationId } = workspace;

  try {
    const [
      companyCount,
      contactCount,
      leadCount,
      openJobCount,
      pendingTaskCount,
      outreachCount,
      overdueTaskCount,
      scheduledOutreachCount,
      biddingLeadCount,
      staleLeadCount,
      leadValue,
      pipelineGroups,
      recentCompanies,
      recentContacts,
      recentLeads,
      recentJobs,
      recentOutreach,
      followUpTasks,
      upcomingTasks,
      mailboxThreadCount,
      needsReplyThreadCount,
      draftedThreadCount,
      sentGmailMessageCount,
      connectedGmailCount,
      recentMailboxThreads,
    ] = await Promise.all([
      prisma.company.count({ where: { organizationId, deletedAt: null } }),
      prisma.contact.count({ where: { organizationId, deletedAt: null } }),
      prisma.lead.count({ where: { organizationId, deletedAt: null } }),
      prisma.job.count({ where: { organizationId, deletedAt: null, status: { in: ["open", "bidding", "in_progress"] } } }),
      prisma.task.count({ where: { organizationId, deletedAt: null, status: { in: ["todo", "in_progress"] } } }),
      prisma.outreach.count({ where: { organizationId, deletedAt: null } }),
      prisma.task.count({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: ["todo", "in_progress"] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.outreach.count({
        where: {
          organizationId,
          deletedAt: null,
          status: "scheduled",
        },
      }),
      prisma.lead.count({ where: { organizationId, deletedAt: null, stage: { in: ["bidding", "submitted"] } } }),
      prisma.lead.count({
        where: {
          organizationId,
          deletedAt: null,
          stage: { in: ["new", "evaluating", "bidding", "submitted"] },
          updatedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.lead.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { value: true },
      }),
      prisma.lead.groupBy({
        by: ["stage"],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.company.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.contact.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, firstName: true, lastName: true, createdAt: true },
      }),
      prisma.lead.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, stage: true, createdAt: true },
      }),
      prisma.job.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, status: true, createdAt: true },
      }),
      prisma.outreach.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, channel: true, subject: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          organizationId,
          deletedAt: null,
          dueDate: { not: null },
          status: { in: ["todo", "in_progress"] },
        },
        orderBy: { dueDate: "asc" },
        take: 4,
        select: { id: true, title: true, dueDate: true, priority: true },
      }),
      prisma.task.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 6,
        select: { id: true, title: true, dueDate: true, priority: true, status: true },
      }),
      prisma.emailThread.count({ where: { organizationId, deletedAt: null } }),
      prisma.emailThread.count({ where: { organizationId, deletedAt: null, status: "needs_reply" } }),
      prisma.emailThread.count({ where: { organizationId, deletedAt: null, status: "drafted" } }),
      prisma.emailMessage.count({
        where: {
          organizationId,
          deletedAt: null,
          direction: "outbound",
          metadata: { path: ["gmailDraftSentAt"], not: Prisma.JsonNull },
        },
      }),
      prisma.gmailConnection.count({ where: { organizationId, status: "connected" } }),
      prisma.emailThread.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: { id: true, subject: true, status: true, classification: true, lastMessageAt: true, createdAt: true },
      }),
    ]);

    const totalPipelineValue = decimalToNumber(leadValue._sum.value);
    const recentActivity = [
      ...recentCompanies.map((company) => ({
        id: `company-${company.id}`,
        type: "company",
        description: `${company.name} was added as a company`,
        timestamp: formatTimestamp(company.createdAt),
        user: "CRM",
        avatar: initials(company.name),
        createdAt: company.createdAt,
      })),
      ...recentContacts.map((contact) => {
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
        return {
          id: `contact-${contact.id}`,
          type: "contact",
          description: `${name} was added as a contact`,
          timestamp: formatTimestamp(contact.createdAt),
          user: "CRM",
          avatar: initials(name),
          createdAt: contact.createdAt,
        };
      }),
      ...recentLeads.map((lead) => ({
        id: `lead-${lead.id}`,
        type: "lead",
        description: `${lead.title} entered ${stageLabels[lead.stage] ?? lead.stage}`,
        timestamp: formatTimestamp(lead.createdAt),
        user: "Pipeline",
        avatar: "LD",
        createdAt: lead.createdAt,
      })),
      ...recentJobs.map((job) => ({
        id: `job-${job.id}`,
        type: "job",
        description: `${job.title} is ${job.status}`,
        timestamp: formatTimestamp(job.createdAt),
        user: "Jobs",
        avatar: "JB",
        createdAt: job.createdAt,
      })),
      ...recentOutreach.map((item) => ({
        id: `outreach-${item.id}`,
        type: "outreach",
        description: `${item.channel} outreach${item.subject ? `: ${item.subject}` : ""}`,
        timestamp: formatTimestamp(item.createdAt),
        user: "Outreach",
        avatar: "OR",
        createdAt: item.createdAt,
      })),
      ...recentMailboxThreads.map((thread) => ({
        id: `mailbox-${thread.id}`,
        type: "mailbox",
        description: `${thread.status === "needs_reply" ? "Reply needed" : "Mailbox"}: ${thread.subject}`,
        timestamp: formatTimestamp(thread.lastMessageAt ?? thread.createdAt),
        user: thread.classification ?? "Mailbox",
        avatar: "GM",
        createdAt: thread.lastMessageAt ?? thread.createdAt,
      })),
    ]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 6)
      .map((activity) => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        timestamp: activity.timestamp,
        user: activity.user,
        avatar: activity.avatar,
      }));

    const pipelineStages = pipelineGroups.map((group) => ({
      id: group.stage,
      name: stageLabels[group.stage] ?? group.stage,
      value: decimalToNumber(group._sum.value),
      count: group._count._all,
      color: stageColors[group.stage] ?? "bg-gray-500",
    }));

    return Response.json({
      kpis: [
        { id: "companies", label: "Companies", value: companyCount, change: 0, trend: "up", icon: "Building2", tone: "indigo" },
        { id: "contacts", label: "Contacts", value: contactCount, change: 0, trend: "up", icon: "Users", tone: "sky" },
        { id: "leads", label: "Active Leads", value: leadCount, change: 0, trend: "up", icon: "TrendingUp", tone: "violet" },
        { id: "pipeline", label: "Pipeline Value", value: totalPipelineValue, change: 0, trend: "up", icon: "DollarSign", tone: "emerald" },
        { id: "jobs", label: "Open Jobs", value: openJobCount, change: 0, trend: "up", icon: "Briefcase", tone: "amber" },
        { id: "tasks", label: "Open Tasks", value: pendingTaskCount, change: 0, trend: "up", icon: "CheckSquare", tone: overdueTaskCount > 0 ? "rose" : "slate" },
        { id: "outreach", label: "Outreach Items", value: outreachCount, change: 0, trend: "up", icon: "Mail", tone: "indigo" },
        { id: "mailbox", label: "Mailbox Threads", value: mailboxThreadCount, change: 0, trend: "up", icon: "Mail", tone: needsReplyThreadCount > 0 ? "rose" : "sky" },
      ],
      insights: [
        {
          id: "gmail-connected",
          label: "Gmail Accounts",
          value: connectedGmailCount,
          description: connectedGmailCount > 0 ? "Mailbox sync and draft send are available" : "Connect Gmail to unlock mailbox automation",
          href: "/settings",
          severity: connectedGmailCount > 0 ? "good" : "warning",
        },
        {
          id: "mailbox-needs-reply",
          label: "Needs Reply",
          value: needsReplyThreadCount,
          description: needsReplyThreadCount > 0 ? "Inbound Gmail threads need attention" : "No mailbox replies waiting",
          href: "/outreach",
          severity: needsReplyThreadCount > 0 ? "critical" : "good",
        },
        {
          id: "gmail-drafted",
          label: "Drafted Replies",
          value: draftedThreadCount,
          description: draftedThreadCount > 0 ? "Review and send drafted Gmail replies" : "No Gmail drafts waiting",
          href: "/outreach",
          severity: draftedThreadCount > 0 ? "neutral" : "good",
        },
        {
          id: "gmail-sent",
          label: "Gmail Sent",
          value: sentGmailMessageCount,
          description: sentGmailMessageCount > 0 ? "Outbound Gmail replies tracked in mailbox" : "No Gmail replies sent yet",
          href: "/outreach",
          severity: sentGmailMessageCount > 0 ? "neutral" : "warning",
        },
        {
          id: "overdue-tasks",
          label: "Overdue Tasks",
          value: overdueTaskCount,
          description: overdueTaskCount > 0 ? "Needs cleanup before work piles up" : "No overdue tasks",
          href: "/tasks",
          severity: overdueTaskCount > 0 ? "critical" : "good",
        },
        {
          id: "scheduled-outreach",
          label: "Scheduled Outreach",
          value: scheduledOutreachCount,
          description: scheduledOutreachCount > 0 ? "Queued customer touches" : "No outreach scheduled",
          href: "/outreach",
          severity: scheduledOutreachCount > 0 ? "neutral" : "warning",
        },
        {
          id: "active-bids",
          label: "Bids In Flight",
          value: biddingLeadCount,
          description: biddingLeadCount > 0 ? "Leads in bidding/submitted stages" : "No active bids",
          href: "/leads",
          severity: biddingLeadCount > 0 ? "neutral" : "warning",
        },
        {
          id: "stale-leads",
          label: "Stale Leads",
          value: staleLeadCount,
          description: staleLeadCount > 0 ? "Updated more than 14 days ago" : "Pipeline is fresh",
          href: "/leads",
          severity: staleLeadCount > 0 ? "warning" : "good",
        },
      ],
      recentActivity,
      followUps: followUpTasks.map((task) => ({
        id: task.id,
        contact: task.title,
        company: "Task",
        dueDate: formatDueDate(task.dueDate),
        priority: task.priority,
      })),
      pipelineStages,
      upcomingTasks: upcomingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: formatDueDate(task.dueDate),
        priority: task.priority,
        completed: task.status === "done",
        assignee: "Unassigned",
      })),
    });
  } catch (error) {
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
