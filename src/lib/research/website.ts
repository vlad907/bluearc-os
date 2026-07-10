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

  if (normalized.includes("about")) {
    return "about";
  }

  return "home";
}

export async function fetchWebsiteText(url: string) {
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
  const text = contentType.includes("text/html") ? stripHtmlToText(raw) : raw.replace(/\s+/g, " ").trim();

  if (!text) {
    throw new Error("Website returned no readable text");
  }

  return text.slice(0, 60000);
}
