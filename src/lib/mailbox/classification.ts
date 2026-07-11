export function classifyInboundEmail(body: string) {
  const normalized = body.toLowerCase();

  if (normalized.includes("unsubscribe") || normalized.includes("remove me")) {
    return "unsubscribe";
  }

  if (normalized.includes("price") || normalized.includes("cost") || normalized.includes("quote")) {
    return "pricing_request";
  }

  if (normalized.includes("meeting") || normalized.includes("call") || normalized.includes("schedule")) {
    return "meeting_request";
  }

  if (normalized.includes("not interested") || normalized.includes("no thanks")) {
    return "not_interested";
  }

  if (normalized.includes("?")) {
    return "question";
  }

  if (normalized.includes("interested") || normalized.includes("tell me more")) {
    return "interested";
  }

  return "unknown";
}
