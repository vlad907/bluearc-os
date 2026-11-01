// Shared draft-quality checks and repair used by both the deterministic and
// provider-backed Agent 2/3 paths. The goal is that a draft which reaches the
// user is always sendable: no placeholder brackets, a real signature when we
// have one, and a non-empty subject/body.

type JsonObject = Record<string, unknown>;

export type DraftParts = {
  subject: string;
  email_body: string;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildSignature(profile?: JsonObject | null) {
  const lines = ["Best regards"];
  const senderName = readString(profile?.senderName);
  const senderTitle = readString(profile?.senderTitle);
  const senderPhone = readString(profile?.senderPhone);
  const senderEmail = readString(profile?.senderEmail);

  if (senderName) {
    lines.push(senderName);
  }
  if (senderTitle) {
    lines.push(senderTitle);
  }
  if (senderPhone) {
    lines.push(senderPhone);
  }
  if (senderEmail) {
    lines.push(senderEmail);
  }

  return lines.join("\n");
}

const PLACEHOLDER_REGEX = /\[[^\]]+\]/g;

export function hasPlaceholders(text: string) {
  PLACEHOLDER_REGEX.lastIndex = 0;
  return PLACEHOLDER_REGEX.test(text);
}

export function listPlaceholders(text: string) {
  return Array.from(new Set(text.match(PLACEHOLDER_REGEX) ?? []));
}

// Replace known placeholder brackets with real sender values, drop any
// remaining unknown placeholders, and tidy the whitespace they leave behind.
export function repairPlaceholders(text: string, profile?: JsonObject | null) {
  const senderName = readString(profile?.senderName);
  const senderTitle = readString(profile?.senderTitle);
  const senderPhone = readString(profile?.senderPhone);
  const senderEmail = readString(profile?.senderEmail);
  const businessName = readString(profile?.businessName);

  const replacements: Array<[RegExp, string]> = [
    [/\[(your[\s_-]*(full[\s_-]*)?name)\]/gi, senderName],
    [/\[(your[\s_-]*(title|position|role))\]/gi, senderTitle],
    [/\[(your[\s_-]*(phone|phone[\s_-]*number|number|mobile|cell))\]/gi, senderPhone],
    [/\[(your[\s_-]*(email|email[\s_-]*address|e-mail))\]/gi, senderEmail],
    [/\[(your[\s_-]*(company|company[\s_-]*name|business|organization))\]/gi, businessName],
  ];

  let result = text;
  for (const [pattern, value] of replacements) {
    if (value) {
      result = result.replace(pattern, value);
    }
  }

  // Remove any placeholder brackets we could not fill, then collapse the
  // empty lines / dangling separators they may have left.
  result = result
    .replace(PLACEHOLDER_REGEX, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return result;
}

// Case-insensitive check that the signature carries the sender's identity.
// Matches on any name token (so "Vlad A." in the profile is satisfied by a
// body signed "Vlad") rather than requiring an exact substring.
function signaturePresent(body: string, profile?: JsonObject | null) {
  const senderName = readString(profile?.senderName);
  if (!senderName) {
    return true;
  }

  const lowerBody = body.toLowerCase();
  const tokens = senderName
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/gi, ""))
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.some((token) => lowerBody.includes(token.toLowerCase()));
}

export type DraftValidationResult = {
  issues: string[];
  // Problems a repair pass or a human must address before sending.
  hardIssues: string[];
};

export function validateAgent2Draft(
  draft: DraftParts,
  options: { profile?: JsonObject | null } = {},
): DraftValidationResult {
  const issues: string[] = [];
  const hardIssues: string[] = [];
  const subject = readString(draft.subject);
  const body = readString(draft.email_body);

  if (!subject) {
    hardIssues.push("subject is empty");
  } else if (subject.length > 120) {
    issues.push("subject is longer than 120 characters");
  }

  if (!body) {
    hardIssues.push("email body is empty");
  } else {
    if (hasPlaceholders(subject) || hasPlaceholders(body)) {
      hardIssues.push(`contains placeholder brackets: ${listPlaceholders(`${subject}\n${body}`).join(", ")}`);
    }
    if (!signaturePresent(body, options.profile)) {
      hardIssues.push("sign-off does not include the sender's name");
    }
    if (body.length < 120) {
      issues.push("email body is very short");
    }
    if (body.length > 2200) {
      issues.push("email body is very long");
    }
  }

  return { issues: [...hardIssues, ...issues], hardIssues };
}

// Deterministic safety net: fix placeholders and guarantee a signature so the
// draft is sendable even if the model (and its repair retry) failed to comply.
export function repairAgent2Draft(draft: DraftParts, profile?: JsonObject | null): DraftParts {
  const subject = repairPlaceholders(readString(draft.subject), profile).slice(0, 200) || "Quick note";
  let body = repairPlaceholders(readString(draft.email_body), profile);

  if (body && !signaturePresent(body, profile)) {
    body = `${body}\n\n${buildSignature(profile)}`;
  }

  return { subject, email_body: body };
}
