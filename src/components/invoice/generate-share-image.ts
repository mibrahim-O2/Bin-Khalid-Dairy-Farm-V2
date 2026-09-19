"use client";

/**
 * Waits for every <img> inside `container` to finish loading before
 * resolving — html-to-image snapshots the DOM as-is, so an image that
 * hasn't decoded yet (or hasn't even started fetching) just renders blank
 * in the captured PNG.
 *
 * This matters specifically here because the whole template tree is
 * parked permanently off-screen at `left: -9999px` (see
 * ShareButtons below) — an <img> that close to (but outside) the
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

// iOS Safari's canvas cap is ~16.7M pixels; a long statement at 2x can
// exceed it and come back blank, so the pixel ratio is scaled down to fit.
const MAX_CANVAS_PIXELS = 12_000_000;

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Rasterizes `node` (an off-screen-rendered invoice/statement template) to
 * a PNG Blob — client-side, via html-to-image, so the browser's own text-
 * shaping engine handles complex scripts like Urdu Nastaliq correctly
 * (see bill-invoice-template.tsx's doc comment for why this isn't
 * server-side Satori/@vercel-og).
 *
 * A Blob, not a data: URL: a 2x-resolution statement is several MB, and
 * mobile browsers refuse or silently drop downloads of data: URLs that
 * large (and it's what navigator.share needs for a File anyway).
 */
export async function generateShareImageBlob(node: HTMLElement): Promise<Blob> {
  await waitForImagesToLoad(node);
  if (document.fonts?.ready) await document.fonts.ready;
  const { toBlob } = await import("html-to-image");
  const rect = node.getBoundingClientRect();
  const pixelRatio = Math.max(1, Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(rect.width * rect.height, 1))));
  const options = { pixelRatio, backgroundColor: "#ffffff" };
  // WebKit renders images/fonts blank on the first pass over a node it
  // hasn't painted yet — a known html-to-image/Safari quirk; the second
  // pass is correct.
  if (isIosLike()) await toBlob(node, options);
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("Image generation returned nothing.");
  return blob;
}

/** Saves a Blob as a file via a temporary object URL. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  // Must be in the document for Firefox and some mobile browsers to honor it.
  document.body.appendChild(link);
  link.click();
  // iOS needs the URL to outlive the click while its download sheet opens.
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 30_000);
}
