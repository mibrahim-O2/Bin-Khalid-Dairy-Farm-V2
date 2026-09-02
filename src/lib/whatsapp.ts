/**
 * Builds a wa.me deep link from a Pakistani local number as stored in
 * Settings (e.g. "0324-2991303"). Strips everything but digits, drops a
 * leading trunk "0", and prefixes the country code — wa.me requires the
 * full international number with no punctuation.
 */
export function buildWhatsAppLink(localPhone: string, message?: string): string {
  const digits = localPhone.replace(/\D/g, "").replace(/^0/, "");
  const url = `https://wa.me/92${digits}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}
