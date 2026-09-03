"use client";

/**
 * Waits for every <img> inside `container` to finish loading before
 * resolving — html-to-image snapshots the DOM as-is, so an image that
 * hasn't decoded yet (or hasn't even started fetching) just renders blank
 * in the captured PNG.
 *
 * This matters specifically here because the whole template tree is
 * parked permanently off-screen at `left: -9999px` (see
 * WhatsAppShareButtons below) — an <img> that close to (but outside) the
 * viewport can sit forever below the browser's native lazy-loading
 * distance threshold, which Chrome deliberately *shrinks* on slower
 * connections to save data. Forcing `loading` to "eager" here re-triggers
 * the fetch immediately regardless of that threshold. (Belt-and-
 * suspenders: the templates' <Image priority> also avoids lazy-loading at
 * the source — this covers anything that isn't marked priority, now or in
 * the future.)
 */
function waitForImagesToLoad(container: HTMLElement, timeoutMs = 8000): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();

  const perImage = images.map((img) => {
    if (img.loading === "lazy") img.loading = "eager";
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const onSettled = () => {
        img.removeEventListener("load", onSettled);
        img.removeEventListener("error", onSettled);
        resolve();
      };
      // Resolve on error too — a genuinely broken image shouldn't hang
      // the whole share flow forever; toPng will just render it blank.
      img.addEventListener("load", onSettled);
      img.addEventListener("error", onSettled);
    });
  });

  // Never block the share flow indefinitely on a stalled network request.
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.all(perImage).then(() => undefined), timeout]);
}

/**
 * Rasterizes `node` (an off-screen-rendered invoice/statement template) to
 * a PNG — client-side, via html-to-image, so the browser's own text-
 * shaping engine handles complex scripts like Urdu Nastaliq correctly
 * (see bill-invoice-template.tsx's doc comment for why this isn't
 * server-side Satori/@vercel-og).
 */
export async function generateShareImagePng(node: HTMLElement): Promise<string> {
  await waitForImagesToLoad(node);
  const { toPng } = await import("html-to-image");
  return toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });
}

/** Triggers a browser download of a data: URL — no network round trip. */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
