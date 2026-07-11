const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function extractEmailAddress(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(EMAIL_PATTERN);
  return match?.[0]?.toLowerCase() ?? null;
}

export function emailDomain(value: string | null | undefined) {
  const email = extractEmailAddress(value);
  const domain = email?.split("@")[1]?.trim().toLowerCase();

  return domain || null;
}
