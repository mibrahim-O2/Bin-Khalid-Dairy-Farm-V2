"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessSettings } from "@/types/settings";
import { updateBusinessSettings } from "./actions";

export function BusinessInfoCard({ businessInfo }: { businessInfo: BusinessSettings }) {
  const router = useRouter();
  const [name, setName] = useState(businessInfo.name);
  const [nameUrdu, setNameUrdu] = useState(businessInfo.nameUrdu);
  const [phone, setPhone] = useState(businessInfo.phone ?? "");
  const [address, setAddress] = useState(businessInfo.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !nameUrdu.trim()) {
      setError("Business name is required in both languages.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateBusinessSettings({ name, nameUrdu, phone, address });
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
        <CardTitle>Business info</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Shown on the header of every shared bill and statement.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="business-name">Business name (English)</Label>
              <Input id="business-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="business-name-urdu">Business name (Urdu)</Label>
              <Input
                id="business-name-urdu"
                dir="rtl"
                value={nameUrdu}
                onChange={(e) => setNameUrdu(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="business-phone">Phone</Label>
              <Input id="business-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="business-address">Address</Label>
              <Textarea
                id="business-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={1}
              />
            </div>
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
