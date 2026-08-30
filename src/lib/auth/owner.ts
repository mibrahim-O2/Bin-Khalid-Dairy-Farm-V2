import "server-only";
import type { ServerSession } from "@/lib/auth/session";

/**
 * There is exactly one "Owner" account, identified here by UID and/or email
 * from environment variables — never hardcoded in source. This is NOT a
 * secret/password: it only tells the server which already-authenticated
 * account may perform owner-only actions (approving pending users). Nothing
 * is ever typed or compared as a credential.
 *
 * Set OWNER_UID and/or OWNER_EMAIL in .env.local. If both are set, either
 * matching is sufficient (UID is the more robust identifier; email is a
 * convenient fallback while the account's UID isn't known yet).
 */
export function isOwnerSession(session: Pick<ServerSession, "uid" | "email">): boolean {
  const ownerUid = process.env.OWNER_UID?.trim();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

  if (!ownerUid && !ownerEmail) return false;

  if (ownerUid && session.uid === ownerUid) return true;
  if (ownerEmail && session.email?.toLowerCase() === ownerEmail) return true;

  return false;
}
