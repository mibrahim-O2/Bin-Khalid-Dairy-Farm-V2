"use client";

import { useRef, useState, type ReactNode } from "react";
import { Download, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { downloadDataUrl, generateShareImagePng } from "./generate-share-image";

/**
 * Renders `children` (a printable template, e.g. BillInvoiceTemplate) off
 * -screen and offers two explicit actions once it's finalized: "Send via
 * WhatsApp" and "Save" — replacing the earlier single generic Share
 * button (see git history for share-image-button.tsx).
 *
 * A wa.me link can pre-fill a chat's text but can NEVER attach a file —
 * that's a WhatsApp/browser limitation, not something any web app can
 * work around. So "Send via WhatsApp" also downloads the image (exactly
 * like "Save" does) and shows an inline note explaining that it needs to
 * be attached manually in the chat that just opened.
 */
export function WhatsAppShareButtons({
  children,
  fileName,
  whatsappNumber,
  whatsappMessage,
  saveLabel = "Save",
  whatsappLabel = "Send via WhatsApp",
}: {
  children: ReactNode;
  fileName: string;
  /** No WhatsApp number on file for this customer/supplier/employee — hide that button, Save still works. */
  whatsappNumber: string | null;
  whatsappMessage: string;
  /** Override the button copy for a specific document type (e.g. "Save Bill", "Share on WhatsApp") — defaults match every existing call site. */
  saveLabel?: string;
  whatsappLabel?: string;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"save" | "whatsapp" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!targetRef.current) return;
    setBusy("save");
    setError(null);
    setNote(null);
    try {
      const dataUrl = await generateShareImagePng(targetRef.current);
      downloadDataUrl(dataUrl, fileName);
    } catch {
      setError("Failed to generate the image. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleWhatsApp() {
    if (!targetRef.current || !whatsappNumber) return;
    setBusy("whatsapp");
    setError(null);
    setNote(null);
    try {
      const dataUrl = await generateShareImagePng(targetRef.current);
      downloadDataUrl(dataUrl, fileName);
      window.open(buildWhatsAppLink(whatsappNumber, whatsappMessage), "_blank", "noopener,noreferrer");
      setNote("Image downloaded — attach it in the chat that just opened.");
    } catch {
      setError("Failed to generate the image. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-2">
        {whatsappNumber ? (
          <Button variant="outline" size="sm" disabled={!!busy} onClick={handleWhatsApp}>
            <MessageCircle className="size-4" />
            {busy === "whatsapp" ? "Preparing…" : whatsappLabel}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" disabled={!!busy} onClick={handleSave}>
          <Download className="size-4" />
          {busy === "save" ? "Preparing…" : saveLabel}
        </Button>
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
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
