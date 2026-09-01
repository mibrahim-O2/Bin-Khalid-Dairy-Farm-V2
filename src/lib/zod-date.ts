import { z } from "zod";

/**
 * Every date field in this app is a plain yyyy-mm-dd string (never a
 * Firestore/JS Date object — see the money.ts-style rationale in each
 * schema file). `z.string().min(1)` alone only rejects an empty string,
 * not a malformed one — found live during Phase 8 testing: a native
 * `<input type="date">` fed a raw keystroke sequence instead of having its
 * value set directly produced a value like "+200101-08-31" that sailed
 * straight through validation and into Postgres. A real user's browser
 * date picker can't produce that, but the Server Action itself shouldn't
 * rely on the client UI being the only thing enforcing the shape.
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");
