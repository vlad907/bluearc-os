import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "bluearc.session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const PASSWORD_KEY_LENGTH = 64;

type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

function getSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createRawSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function createRawInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(`invite:${token}`).digest("hex");
}

export function getSessionExpiry() {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, getSessionCookieOptions());
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function readSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function createUserSession(userId: string) {
  const token = createRawSessionToken();

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: getSessionExpiry(),
    },
  });

  await setSessionCookie(token);
}

export async function destroyCurrentSession() {
  const token = await readSessionToken();

  if (token) {
    await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  await clearSessionCookie();
}

export async function getCurrentSession() {
  const token = await readSessionToken();

  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          memberships: {
            select: {
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  plan: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    await destroyCurrentSession();
    return null;
  }

  await prisma.userSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session;
}

export function publicSessionPayload(session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>) {
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    workspaces: session.user.memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      role: membership.role,
    })),
  };
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
