import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export type ServerSession = {
  uid: string;
  email: string | null;
  active: boolean;
  role: string | null;
};

export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      active: decoded.active === true,
      role: typeof decoded.role === "string" ? decoded.role : null,
    };
  } catch {
    return null;
  }
}
