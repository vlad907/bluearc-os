import { prisma } from "@/lib/prisma";
import { createUserSession, normalizeEmail, publicSessionPayload, getCurrentSession, verifyPassword } from "@/lib/auth/session";
import { acceptWorkspaceInvitation } from "@/lib/auth/invitations";

export const dynamic = "force-dynamic";

type LoginBody = {
  email?: unknown;
  password?: unknown;
  inviteToken?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as LoginBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  if (!body) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const inviteToken = typeof body.inviteToken === "string" && body.inviteToken.trim() ? body.inviteToken.trim() : null;

  if (!email || !password) {
    return jsonError("Email and password are required.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonError("Invalid email or password.", 401);
  }

  if (inviteToken) {
    try {
      await prisma.$transaction(async (tx) => {
        await acceptWorkspaceInvitation({
          tx,
          rawToken: inviteToken,
          userId: user.id,
          email,
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("invitation")) {
        return jsonError(error.message, 400);
      }

      throw error;
    }
  }

  await createUserSession(user.id);

  const session = await getCurrentSession();

  if (!session) {
    return jsonError("Failed to create session", 500);
  }

  return Response.json(publicSessionPayload(session));
}
