import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createUserSession, hashPassword, isUniqueConstraintError, normalizeEmail, publicSessionPayload, getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type SignupBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  workspaceName?: unknown;
  workspaceSlug?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as SignupBody;
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

async function getAvailableSlug(baseSlug: string) {
  const fallback = baseSlug.length >= 3 ? baseSlug : "bluearc-workspace";

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? fallback : `${fallback}-${index + 1}`;
    const existing = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } });

    if (!existing) {
      return candidate;
    }
  }

  return `${fallback}-${Date.now().toString(36)}`;
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }

  return null;
}

export async function POST(request: Request) {
  const existingSession = await getCurrentSession();

  if (existingSession) {
    return Response.json(publicSessionPayload(existingSession));
  }

  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const workspaceName = typeof body.workspaceName === "string" && body.workspaceName.trim()
    ? body.workspaceName.trim()
    : `${name || "Blue Arc"} Workspace`;
  const requestedSlug = typeof body.workspaceSlug === "string" ? body.workspaceSlug.trim() : "";

  if (name.length < 2) {
    return jsonError("Name must be at least 2 characters.", 400);
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonError("Valid email is required.", 400);
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    return jsonError(passwordError, 400);
  }

  if (workspaceName.length < 2 || workspaceName.length > 100) {
    return jsonError("Workspace name must be 2-100 characters.", 400);
  }

  try {
    const slug = await getAvailableSlug(slugify(requestedSlug || workspaceName));
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
        },
        select: { id: true },
      });

      const organization = await tx.organization.create({
        data: {
          name: workspaceName,
          slug,
          settings: { createdFrom: "signup" },
        },
        select: { id: true },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          role: "owner",
        },
      });

      const pendingInvitations = await tx.workspaceInvitation.findMany({
        where: {
          email,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          organizationId: true,
          role: true,
        },
      });

      for (const invitation of pendingInvitations) {
        if (invitation.organizationId === organization.id) {
          continue;
        }

        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: createdUser.id,
            },
          },
          update: { role: invitation.role },
          create: {
            organizationId: invitation.organizationId,
            userId: createdUser.id,
            role: invitation.role,
          },
        });

        await tx.workspaceInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "accepted",
            acceptedById: createdUser.id,
            acceptedAt: new Date(),
          },
        });
      }

      return createdUser;
    });

    await createUserSession(user.id);

    const session = await getCurrentSession();

    if (!session) {
      return jsonError("Failed to create session", 500);
    }

    return Response.json(publicSessionPayload(session), { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return jsonError("An account already exists for that email.", 409);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return jsonError("Database tables are missing. Run `npm run db:migrate`, then retry signup.", 503);
    }

    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
