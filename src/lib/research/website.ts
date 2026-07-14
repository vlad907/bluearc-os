export function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractEmails(text: string) {
  return Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []));
}

export function extractPhones(text: string) {
  return Array.from(new Set(text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) ?? []));
}

export function inferPageType(url: string) {
  const normalized = url.toLowerCase();

  if (normalized.includes("contact")) {
    return "contact";
  }

  if (normalized.includes("about") || normalized.includes("company")) {
    return "about";
  }

  if (normalized.includes("service") || normalized.includes("capabilit") || normalized.includes("solution") || normalized.includes("industr")) {
    return "services";
  }

  if (normalized.includes("team")) {
    return "team";
  }

  if (normalized.includes("career")) {
    return "careers";
  }

  return "home";
}

async function fetchWebsiteRaw(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BlueArcOS/0.1 WebsiteResearchBot",
      accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Website returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  return { contentType, raw };
}

function rawToText(contentType: string, raw: string) {
  return contentType.includes("text/html") ? stripHtmlToText(raw) : raw.replace(/\s+/g, " ").trim();
}

export async function fetchWebsiteText(url: string) {
  const { contentType, raw } = await fetchWebsiteRaw(url);
  const text = rawToText(contentType, raw);

  if (!text) {
    throw new Error("Website returned no readable text");
  }

  return text.slice(0, 60000);
}

// Internal pages worth pulling in for research: the ones that carry service
// scope, company context, and contact details.
const INTEREST_KEYWORDS = [
  "about",
  "service",
  "services",
  "contact",
  "team",
  "company",
  "capabilities",
  "industries",
  "solutions",
  "work",
  "careers",
];

export function extractInternalLinks(html: string, baseUrl: string, limit: number) {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const basePath = `${base.origin}${base.pathname}`;
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    if (results.length >= limit) {
      break;
    }

    let resolved: URL;
    try {
      resolved = new URL(match[1], base);
    } catch {
      continue;
    }

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      continue;
    }

    if (resolved.host !== base.host) {
      continue;
    }

    const key = `${resolved.origin}${resolved.pathname}`;
    if (key === basePath || seen.has(key)) {
      continue;
    }

    const path = resolved.pathname.toLowerCase();
    if (!INTEREST_KEYWORDS.some((keyword) => path.includes(keyword))) {
      continue;
    }

    seen.add(key);
    results.push(resolved.toString());
  }

  return results;
}

export type CrawledPage = {
  url: string;
  pageType: string;
  rawText: string;
  extractedEmails: string[];
  extractedPhones: string[];
};

function toCrawledPage(url: string, text: string): CrawledPage {
  const rawText = text.slice(0, 60000);
  return {
    url,
    pageType: inferPageType(url),
    rawText,
    extractedEmails: extractEmails(rawText),
    extractedPhones: extractPhones(rawText),
  };
}

/**
 * Fetch the start URL plus a bounded set of same-origin internal pages
 * (about/services/contact/…). The start page must load or this throws; any
 * failed sub-page is skipped rather than failing the whole crawl.
 */
export async function crawlWebsite(startUrl: string, maxPages = 5): Promise<CrawledPage[]> {
  const { contentType, raw } = await fetchWebsiteRaw(startUrl);
  const startText = rawToText(contentType, raw);

  if (!startText) {
    throw new Error("Website returned no readable text");
  }

  const pages: CrawledPage[] = [toCrawledPage(startUrl, startText)];
  const links = contentType.includes("text/html")
    ? extractInternalLinks(raw, startUrl, Math.max(0, maxPages - 1))
    : [];

  for (const link of links) {
    try {
      const sub = await fetchWebsiteRaw(link);
      const subText = rawToText(sub.contentType, sub.raw);
      if (subText) {
        pages.push(toCrawledPage(link, subText));
      }
    } catch {
      // Best-effort: skip a sub-page that fails to load.
    }
  }

  return pages;
}
