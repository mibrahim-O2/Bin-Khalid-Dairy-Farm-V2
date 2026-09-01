"use client";

import { useRef, useState, type ReactNode } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Renders `children` (a printable template, e.g. BillInvoiceTemplate) off
 * -screen, rasterizes it to a PNG on click via html-to-image (client-side —
 * uses the browser's own text-shaping engine, so complex scripts like Urdu
 * Nastaliq render correctly; see the M0-era decision against server-side
 * Satori/@vercel-og for this exact reason), then hands it to the OS share
 * sheet via the Web Share API (mobile Safari/Chrome — WhatsApp etc. appear
 * as share targets there) or falls back to a plain download on desktop
 * browsers that don't support sharing files.
 */
export function ShareImageButton({
  children,
  fileName,
  shareTitle,
  shareText,
}: {
  children: ReactNode;
  fileName: string;
  shareTitle: string;
  shareText?: string;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    if (!targetRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(targetRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title: string; text?: string }) => Promise<void>;
      };

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: shareTitle, text: shareText });
        return;
      }

      // Fallback for desktop browsers without file-sharing support: a plain
      // download, same PNG either way.
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      link.click();
    } catch (err) {
      // AbortError fires when the user just closes the native share sheet —
      // not a real failure, don't show it as an error.
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Failed to generate the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" disabled={busy} onClick={handleShare}>
        <Share2 className="size-4" />
        {busy ? "Preparing…" : "Share"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {/* Off-screen but laid out normally — html-to-image needs real
       *  dimensions/fonts/images to have loaded, which display:none or an
       *  unmounted node can't guarantee. */}
      <div className="pointer-events-none fixed left-[-9999px] top-0" aria-hidden="true">
        <div ref={targetRef}>{children}</div>
      </div>
    </div>
  );
}
