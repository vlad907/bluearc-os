import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (!fs.existsSync(".env")) {
    return undefined;
  }

  const env = fs.readFileSync(".env", "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  return match?.[1]?.trim().replace(/^['\"]|['\"]$/g, "");
}

const databaseUrl = loadDatabaseUrl();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

if (databaseUrl.startsWith("file:")) {
  throw new Error("Refusing to seed a file: database URL. Set DATABASE_URL to PostgreSQL/Supabase first.");
}

if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
  throw new Error("DATABASE_URL must be a PostgreSQL/Supabase connection string.");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function upsertCompany(organizationId, name, data) {
  const existing = await prisma.company.findFirst({
    where: { organizationId, name, deletedAt: null },
  });

  if (existing) {
    return prisma.company.update({ where: { id: existing.id }, data });
  }

  return prisma.company.create({ data: { organizationId, name, ...data } });
}

async function upsertContact(organizationId, email, data) {
  const existing = await prisma.contact.findFirst({
    where: { organizationId, email, deletedAt: null },
  });

  if (existing) {
    return prisma.contact.update({ where: { id: existing.id }, data });
  }

  return prisma.contact.create({ data: { organizationId, email, ...data } });
}

async function upsertByTitle(model, organizationId, title, data) {
  const existing = await prisma[model].findFirst({
    where: { organizationId, title, deletedAt: null },
  });

  if (existing) {
    return prisma[model].update({ where: { id: existing.id }, data });
  }

  return prisma[model].create({ data: { organizationId, title, ...data } });
}

async function upsertVendor(organizationId, name, data) {
  const existing = await prisma.vendor.findFirst({
    where: { organizationId, name, deletedAt: null },
  });

  if (existing) {
    return prisma.vendor.update({ where: { id: existing.id }, data });
  }

  return prisma.vendor.create({ data: { organizationId, name, ...data } });
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "blue-arc-networks" },
    update: {
      name: "Blue Arc Networks",
      plan: "pro",
      settings: { timezone: "America/Los_Angeles" },
    },
    create: {
      name: "Blue Arc Networks",
      slug: "blue-arc-networks",
      plan: "pro",
      settings: { timezone: "America/Los_Angeles" },
    },
  });

  const customer = await upsertCompany(organization.id, "Acme Property Group", {
    relationshipType: "customer",
    industry: "Property Management",
    size: "mid",
    status: "active",
    website: "https://example.com/acme-property-group",
    phone: "+1-555-0100",
    address: { city: "Los Angeles", region: "CA", country: "US" },
  });

  const vendorCompany = await upsertCompany(organization.id, "Summit Cabling LLC", {
    relationshipType: "vendor",
    industry: "Low Voltage",
    size: "smb",
    status: "active",
    website: "https://example.com/summit-cabling",
    phone: "+1-555-0180",
  });

  const contact = await upsertContact(organization.id, "morgan.lee@example.com", {
    companyId: customer.id,
    firstName: "Morgan",
    lastName: "Lee",
    phone: "+1-555-0110",
    title: "Facilities Director",
    role: "decision_maker",
    source: "referral",
    status: "active",
  });

  const lead = await upsertByTitle("lead", organization.id, "Managed Wi-Fi refresh", {
    companyId: customer.id,
    contactId: contact.id,
    stage: "evaluating",
    value: "45000",
    currency: "USD",
    probability: 60,
    source: "inbound",
    expectedClose: new Date("2026-08-31T00:00:00.000Z"),
  });

  const vendor = await upsertVendor(organization.id, "Summit Cabling", {
    companyId: vendorCompany.id,
    category: "Structured Cabling",
    contactName: "Riley Carter",
    email: "ops@summit-cabling.example.com",
    phone: "+1-555-0181",
    status: "active",
    rating: 5,
    notes: "Preferred cabling partner for LA County jobs.",
  });

  const job = await upsertByTitle("job", organization.id, "Acme HQ access point install", {
    companyId: customer.id,
    contactId: contact.id,
    vendorId: vendor.id,
    leadId: lead.id,
    description: "Install and test access points across the Acme HQ office.",
    status: "open",
    priority: "high",
    type: "wireless_install",
    siteAddress: { city: "Los Angeles", region: "CA", country: "US" },
    postedDate: new Date("2026-07-09T00:00:00.000Z"),
    bidDeadline: new Date("2026-07-16T00:00:00.000Z"),
    estimatedValue: "12000",
  });

  await upsertByTitle("task", organization.id, "Schedule Acme site survey", {
    entityType: "job",
    entityId: job.id,
    description: "Coordinate site walk with Morgan and Summit Cabling.",
    status: "todo",
    priority: "high",
    dueDate: new Date("2026-07-12T00:00:00.000Z"),
  });

  const existingOutreach = await prisma.outreach.findFirst({
    where: {
      organizationId: organization.id,
      subject: "Follow-up on managed Wi-Fi refresh",
      deletedAt: null,
    },
  });

  const outreachData = {
    companyId: customer.id,
    contactId: contact.id,
    leadId: lead.id,
    jobId: job.id,
    channel: "email",
    direction: "outbound",
    status: "draft",
    subject: "Follow-up on managed Wi-Fi refresh",
    body: "Thanks for discussing the Wi-Fi refresh. We will send next steps after the site survey.",
  };

  if (existingOutreach) {
    await prisma.outreach.update({ where: { id: existingOutreach.id }, data: outreachData });
  } else {
    await prisma.outreach.create({
      data: { organizationId: organization.id, ...outreachData },
    });
  }

  console.log(`Seeded organization ${organization.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
