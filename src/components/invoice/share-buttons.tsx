"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob, generateShareImageBlob } from "./generate-share-image";

/**
 * Renders `children` (a printable template, e.g. BillInvoiceTemplate) off
 * -screen and offers two explicit actions: "Share" and "Save".
 *
 * Share uses the native Web Share API with the image attached as a file, so
 * on a phone it opens the OS share sheet (WhatsApp, Messages, Drive, ...)
 * with the picture already attached. Where the browser can't share files
 * (most desktop browsers), it falls back to saving the image, with a note
 * to attach it manually.
 *
 * Web Share requires a fresh user gesture, and rasterizing the template
 * takes a second or two — long enough that iOS Safari can reject the share
 * as "not allowed". When that happens the finished image is kept and the
 * button switches to "Tap to share", so the second tap can share it
 * immediately, inside its own gesture.
 */
export function ShareButtons({
  children,
  fileName,
  shareText,
  saveLabel = "Save",
  shareLabel = "Share",
}: {
  children: ReactNode;
  fileName: string;
  /** Message sent along with the image, where the share target supports text. */
  shareText: string;
  saveLabel?: string;
  shareLabel?: string;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // An already-rendered image waiting for a second, gesture-fresh tap.
  const [readyBlob, setReadyBlob] = useState<Blob | null>(null);

  // The document behind this button changed (different month/bill/data) —
  // never share a stale image rendered from the previous content.
  useEffect(() => {
    setReadyBlob(null);
  }, [children, fileName]);

  async function shareBlob(blob: Blob): Promise<"shared" | "cancelled" | "unsupported" | "needs-tap"> {
    const file = new File([blob], fileName, { type: "image/png" });
    if (typeof navigator === "undefined" || !navigator.canShare || !navigator.canShare({ files: [file] })) {
      return "unsupported";
    }
    try {
      await navigator.share({ files: [file], text: shareText });
      return "shared";
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return "cancelled";
      if (name === "NotAllowedError") return "needs-tap";
      throw err;
    }
  }

  async function handleShare() {
    if (!targetRef.current) return;
    setBusy("share");
    setError(null);
    setNote(null);
    try {
      const blob = readyBlob ?? (await generateShareImageBlob(targetRef.current));
      const result = await shareBlob(blob);
      if (result === "needs-tap") {
        setReadyBlob(blob);
        setNote("Image is ready — tap Share again to send it.");
      } else if (result === "unsupported") {
        downloadBlob(blob, fileName);
        setNote("Sharing isn't supported in this browser — the image was saved instead. Attach it wherever you want to send it.");
      } else {
        setReadyBlob(null);
      }
    } catch {
      setError("Failed to generate the image. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!targetRef.current) return;
    setBusy("save");
    setError(null);
    setNote(null);
    try {
      const blob = readyBlob ?? (await generateShareImageBlob(targetRef.current));
      downloadBlob(blob, fileName);
    } catch {
      setError("Failed to generate the image. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!!busy} onClick={handleShare}>
          <Share2 className="size-4" />
          {busy === "share" ? "Preparing…" : readyBlob ? "Tap to share" : shareLabel}
        </Button>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={handleSave}>
          <Download className="size-4" />
          {busy === "save" ? "Preparing…" : saveLabel}
        </Button>
      </div>
      {note ? <p className="max-w-xs text-xs text-muted-foreground">{note}</p> : null}
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
