const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Formats an ISO date string as "31 Aug 2026" — deterministically, the same
 * on server and client. `toLocaleDateString()` (and Intl with no explicit
 * locale) format according to the runtime's locale, which differs between
 * the server and a visitor's browser and causes a hydration mismatch. This
 * avoids locale lookup entirely, and reads UTC components (not local time)
 * so server/client timezone differences can't shift the date either.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
