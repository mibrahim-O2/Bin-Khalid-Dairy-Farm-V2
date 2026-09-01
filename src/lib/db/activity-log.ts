import "server-only";
import { getDb } from "./client";
import { activityLogs } from "./schema";

/**
 * Records one row in the audit trail. `details` is intentionally a loose
 * jsonb bag rather than a rigid column set — the shape genuinely varies
 * per action type (an approval's role granted vs. a purge's per-table
 * counts), matching the Firestore version's loosely-typed per-action
 * fields. Server-only, called from inside a Server Action after its own
 * authorization check has already passed — this never gates anything
 * itself.
 */
export async function logActivity(entry: {
  action: string;
  targetType?: string;
  targetId?: string;
  actorUid?: string | null;
  actorEmail?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(activityLogs).values({
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    actorUid: entry.actorUid ?? null,
    actorEmail: entry.actorEmail ?? null,
    details: entry.details ?? null,
  });
}
