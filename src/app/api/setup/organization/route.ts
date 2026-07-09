import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CreateOrganizationBody = {
  name?: unknown;
  slug?: unknown;
};

function getDatabaseConfigError() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return "DATABASE_URL is missing. Set it to a PostgreSQL/Supabase connection string before creating a workspace.";
  }

  try {
    const parsedUrl = new URL(databaseUrl);

    if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
      return "DATABASE_URL must use PostgreSQL. Replace the current local value with a postgresql:// or postgres:// Supabase connection string.";
    }
  } catch {
    return "DATABASE_URL is not a valid connection string.";
  }

  return null;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as CreateOrganizationBody;
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function POST(request: Request) {
  const databaseConfigError = getDatabaseConfigError();

  if (databaseConfigError) {
    return jsonError(databaseConfigError, 503);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const requestedSlug = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = slugify(requestedSlug || name);

  if (!name) {
    return jsonError("Workspace name is required", 400);
  }

  if (name.length > 100) {
    return jsonError("Workspace name must be 100 characters or fewer", 400);
  }

  if (slug.length < 3) {
    return jsonError("Workspace slug must be at least 3 URL-safe characters", 400);
  }

  try {
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        settings: {
          createdFrom: "development_setup",
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
      },
    });

    return Response.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Workspace slug is already in use", 409);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "ECONNREFUSED") {
      return jsonError("PostgreSQL refused the connection. Confirm Supabase is running/reachable and DATABASE_URL points to the correct host and port.", 503);
    }

    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
