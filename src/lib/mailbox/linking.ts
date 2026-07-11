import { OutreachDirection, Prisma } from "@prisma/client";

import { emailDomain, extractEmailAddress } from "@/lib/mailbox/email-address";
import { prisma } from "@/lib/prisma";

const PERSONAL_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
]);

type ResolveMailboxLinksParams = {
  organizationId: string;
  direction: OutreachDirection;
  fromEmail: string | null;
  toEmail: string | null;
};

export type ResolvedMailboxLinks = {
  companyId?: string;
  contactId?: string;
  metadata: Prisma.JsonObject;
};

function externalAddress(params: ResolveMailboxLinksParams) {
  return params.direction === "outbound"
    ? extractEmailAddress(params.toEmail)
    : extractEmailAddress(params.fromEmail);
}

export async function resolveMailboxLinks(params: ResolveMailboxLinksParams): Promise<ResolvedMailboxLinks> {
  const email = externalAddress(params);
  const domain = emailDomain(email);

  if (!email) {
    return { metadata: { mailboxLinkMatched: false } };
  }

  const contact = await prisma.contact.findFirst({
    where: {
      organizationId: params.organizationId,
      deletedAt: null,
      email: { equals: email, mode: "insensitive" },
    },
    select: { id: true, companyId: true, email: true },
  });

  if (contact) {
    return {
      companyId: contact.companyId ?? undefined,
      contactId: contact.id,
      metadata: {
        mailboxLinkMatched: true,
        mailboxLinkMatchedBy: "contact_email",
        mailboxLinkEmail: contact.email ?? email,
      },
    };
  }

  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return {
      metadata: {
        mailboxLinkMatched: false,
        mailboxLinkEmail: email,
        mailboxLinkDomain: domain,
      },
    };
  }

  const company = await prisma.company.findFirst({
    where: {
      organizationId: params.organizationId,
      deletedAt: null,
      OR: [
        { domain: { equals: domain, mode: "insensitive" } },
        { website: { contains: domain, mode: "insensitive" } },
      ],
    },
    select: { id: true, domain: true, name: true },
  });

  if (!company) {
    return {
      metadata: {
        mailboxLinkMatched: false,
        mailboxLinkEmail: email,
        mailboxLinkDomain: domain,
      },
    };
  }

  return {
    companyId: company.id,
    metadata: {
      mailboxLinkMatched: true,
      mailboxLinkMatchedBy: "company_domain",
      mailboxLinkEmail: email,
      mailboxLinkDomain: company.domain ?? domain,
      mailboxLinkCompanyName: company.name,
    },
  };
}
