import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SeedDemoDataBody = {
  organizationId?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as SeedDemoDataBody;
  } catch {
    return null;
  }
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function mergeSettings(settings: Prisma.JsonValue | null, seededAt: string) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { demoSeededAt: seededAt };
  }

  return {
    ...settings,
    demoSeededAt: seededAt,
  };
}

async function countWorkspaceRecords(organizationId: string) {
  const [
    companies,
    contacts,
    leads,
    tasks,
    vendors,
    jobs,
    outreach,
  ] = await Promise.all([
    prisma.company.count({ where: { organizationId, deletedAt: null } }),
    prisma.contact.count({ where: { organizationId, deletedAt: null } }),
    prisma.lead.count({ where: { organizationId, deletedAt: null } }),
    prisma.task.count({ where: { organizationId, deletedAt: null } }),
    prisma.vendor.count({ where: { organizationId, deletedAt: null } }),
    prisma.job.count({ where: { organizationId, deletedAt: null } }),
    prisma.outreach.count({ where: { organizationId, deletedAt: null } }),
  ]);

  return { companies, contacts, leads, tasks, vendors, jobs, outreach };
}

function hasExistingData(counts: Record<string, number>) {
  return Object.values(counts).some((count) => count > 0);
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";

  if (!organizationId) {
    return jsonError("organizationId is required", 400);
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, settings: true },
    });

    if (!organization) {
      return jsonError("Workspace not found", 404);
    }

    const existingCounts = await countWorkspaceRecords(organizationId);

    if (hasExistingData(existingCounts)) {
      return Response.json(
        {
          seeded: false,
          counts: existingCounts,
          error: "Workspace already has CRM data. Demo seed skipped to avoid duplicates.",
        },
        { status: 409 },
      );
    }

    const seededCounts = await prisma.$transaction(async (tx) => {
      const customer = await tx.company.create({
        data: {
          organizationId,
          name: "Acme Property Group",
          relationshipType: "customer",
          industry: "Property Management",
          size: "mid",
          status: "active",
          website: "https://example.com/acme-property-group",
          phone: "+1-555-0100",
          address: { city: "Los Angeles", region: "CA", country: "US" },
          metadata: { demo: true },
        },
      });

      const propertyManager = await tx.company.create({
        data: {
          organizationId,
          name: "Northstar Property Management",
          relationshipType: "property_manager",
          industry: "Commercial Real Estate",
          size: "enterprise",
          status: "prospect",
          website: "https://example.com/northstar",
          phone: "+1-555-0142",
          address: { city: "Irvine", region: "CA", country: "US" },
          metadata: { demo: true },
        },
      });

      const vendorCompany = await tx.company.create({
        data: {
          organizationId,
          name: "Summit Cabling LLC",
          relationshipType: "vendor",
          industry: "Low Voltage",
          size: "smb",
          status: "active",
          website: "https://example.com/summit-cabling",
          phone: "+1-555-0180",
          metadata: { demo: true },
        },
      });

      const contact = await tx.contact.create({
        data: {
          organizationId,
          companyId: customer.id,
          firstName: "Morgan",
          lastName: "Lee",
          email: "morgan.lee@example.com",
          phone: "+1-555-0110",
          title: "Facilities Director",
          role: "decision_maker",
          source: "referral",
          status: "active",
          metadata: { demo: true },
        },
      });

      await tx.contact.create({
        data: {
          organizationId,
          companyId: propertyManager.id,
          firstName: "Jordan",
          lastName: "Patel",
          email: "jordan.patel@example.com",
          phone: "+1-555-0143",
          title: "Regional Property Manager",
          role: "influencer",
          source: "cold_outreach",
          status: "active",
          metadata: { demo: true },
        },
      });

      const lead = await tx.lead.create({
        data: {
          organizationId,
          companyId: customer.id,
          contactId: contact.id,
          title: "Managed Wi-Fi refresh",
          stage: "evaluating",
          value: "45000",
          currency: "USD",
          probability: 60,
          source: "inbound",
          expectedClose: daysFromNow(30),
          metadata: { demo: true },
        },
      });

      await tx.lead.create({
        data: {
          organizationId,
          companyId: propertyManager.id,
          title: "Portfolio camera network rollout",
          stage: "bidding",
          value: "125000",
          currency: "USD",
          probability: 35,
          source: "outbound",
          expectedClose: daysFromNow(45),
          metadata: { demo: true },
        },
      });

      const vendor = await tx.vendor.create({
        data: {
          organizationId,
          companyId: vendorCompany.id,
          name: "Summit Cabling",
          category: "Structured Cabling",
          contactName: "Riley Carter",
          email: "ops@summit-cabling.example.com",
          phone: "+1-555-0181",
          status: "active",
          rating: 5,
          notes: "Preferred cabling partner for LA County jobs.",
          metadata: { demo: true },
        },
      });

      const job = await tx.job.create({
        data: {
          organizationId,
          companyId: customer.id,
          contactId: contact.id,
          vendorId: vendor.id,
          leadId: lead.id,
          title: "Acme HQ access point install",
          description: "Install and test access points across the Acme HQ office.",
          status: "open",
          priority: "high",
          type: "wireless_install",
          siteAddress: { city: "Los Angeles", region: "CA", country: "US" },
          postedDate: new Date(),
          bidDeadline: daysFromNow(7),
          estimatedValue: "12000",
          metadata: { demo: true },
        },
      });

      await tx.task.create({
        data: {
          organizationId,
          title: "Schedule Acme site survey",
          entityType: "job",
          entityId: job.id,
          description: "Coordinate site walk with Morgan and Summit Cabling.",
          status: "todo",
          priority: "high",
          dueDate: daysFromNow(3),
          metadata: { demo: true },
        },
      });

      await tx.task.create({
        data: {
          organizationId,
          title: "Send Northstar proposal outline",
          entityType: "company",
          entityId: propertyManager.id,
          description: "Draft the first-pass rollout scope and pricing assumptions.",
          status: "in_progress",
          priority: "medium",
          dueDate: daysFromNow(5),
          metadata: { demo: true },
        },
      });

      await tx.outreach.create({
        data: {
          organizationId,
          companyId: customer.id,
          contactId: contact.id,
          leadId: lead.id,
          jobId: job.id,
          channel: "email",
          direction: "outbound",
          status: "sent",
          subject: "Follow-up on managed Wi-Fi refresh",
          body: "Thanks for discussing the Wi-Fi refresh. We will send next steps after the site survey.",
          sentAt: new Date(),
          metadata: { demo: true },
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          settings: mergeSettings(organization.settings, new Date().toISOString()),
        },
      });

      return {
        companies: 3,
        contacts: 2,
        leads: 2,
        tasks: 2,
        vendors: 1,
        jobs: 1,
        outreach: 1,
      };
    });

    return Response.json({ seeded: true, counts: seededCounts }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return jsonError("Database tables are missing. Run `npm run db:migrate`, then retry demo seeding.", 503);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "ECONNREFUSED") {
      return jsonError("PostgreSQL refused the connection. Confirm the database is running and DATABASE_URL is correct.", 503);
    }

    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
