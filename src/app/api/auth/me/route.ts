import { getCurrentSession, publicSessionPayload } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json({ user: null, workspaces: [] });
  }

  return Response.json(publicSessionPayload(session));
}
