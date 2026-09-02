"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvoiceSettings } from "@/types/settings";
import { updateInvoiceSettings } from "./actions";

export function InvoiceNoticeCard({ invoiceSettings }: { invoiceSettings: InvoiceSettings }) {
  const router = useRouter();
  const [footerNote, setFooterNote] = useState(invoiceSettings.footerNote ?? "");
  const [footerNoteUrdu, setFooterNoteUrdu] = useState(invoiceSettings.footerNoteUrdu ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateInvoiceSettings({ footerNote, footerNoteUrdu });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice notice</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Replaces the default &quot;Thank you for your business&quot; line at the bottom of
          every shared bill and statement. Leave blank to use the default.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="footer-note">Footer note (English)</Label>
            <Textarea
              id="footer-note"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="footer-note-urdu">Footer note (Urdu)</Label>
            <Textarea
              id="footer-note-urdu"
              dir="rtl"
              value={footerNoteUrdu}
              onChange={(e) => setFooterNoteUrdu(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} className="self-start">
              Save
            </Button>
            {saved ? <span className="text-sm text-success">Saved.</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
