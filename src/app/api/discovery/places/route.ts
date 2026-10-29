import { NextRequest } from "next/server";

import { resolveWorkspace } from "@/lib/auth/workspace";
import { GooglePlacesClient, GooglePlacesError } from "@/lib/research/places";

export const dynamic = "force-dynamic";

type PlacesBody = {
  organizationId?: unknown;
  location?: unknown;
  radius?: unknown;
  categories?: unknown;
  category?: unknown;
  missingWebsiteOnly?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as PlacesBody;
  } catch {
    return null;
  }
}

function parseCategories(body: PlacesBody): string[] {
  const raw = body.categories ?? body.category;
  if (Array.isArray(raw)) {
    const list = raw.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    return list.length ? list : ["business"];
  }
  if (typeof raw === "string" && raw.trim()) {
    const list = raw.split(",").map((item) => item.trim()).filter(Boolean);
    return list.length ? list : ["business"];
  }
  return ["business"];
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const workspace = await resolveWorkspace(request, body);

  if ("error" in workspace) {
    return workspace.error;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!apiKey.trim()) {
    return jsonError(
      "Google Places is not configured. Add GOOGLE_PLACES_API_KEY to the server environment (Places API + Geocoding API enabled).",
      400,
    );
  }

  const location = typeof body.location === "string" ? body.location.trim() : "";
  if (!location) {
    return jsonError("location is required (a place name, address, or 'lat,lng')", 400);
  }

  const rawRadius = typeof body.radius === "number" ? body.radius : Number(body.radius);
  const radius = Number.isFinite(rawRadius) ? Math.max(1000, Math.min(Math.round(rawRadius), 50000)) : 16000;
  const categories = parseCategories(body);
  const missingWebsiteOnly = body.missingWebsiteOnly === true;

  try {
    const client = new GooglePlacesClient(apiKey);
    const businesses = await client.discoverBusinesses({
      location,
      radius,
      businessTypes: categories,
      missingWebsiteOnly,
    });

    return Response.json({ businesses, count: businesses.length, resolvedRadius: radius, categories });
  } catch (error) {
    if (error instanceof GooglePlacesError) {
      return jsonError(error.message, 502);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
