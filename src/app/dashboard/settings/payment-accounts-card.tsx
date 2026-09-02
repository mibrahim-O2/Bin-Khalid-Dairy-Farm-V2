"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentAccount, PaymentSettings } from "@/types/settings";
import { updatePaymentSettings } from "./actions";

export function PaymentAccountsCard({ paymentSettings }: { paymentSettings: PaymentSettings }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PaymentAccount[]>(paymentSettings.accounts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addAccount() {
    setAccounts((current) => [...current, { id: crypto.randomUUID(), label: "", accountNumber: "" }]);
  }

  function updateAccount(id: string, patch: Partial<PaymentAccount>) {
    setAccounts((current) => current.map((account) => (account.id === id ? { ...account, ...patch } : account)));
  }

  function removeAccount(id: string) {
    setAccounts((current) => current.filter((account) => account.id !== id));
  }

  async function handleSave() {
    if (accounts.some((account) => !account.label.trim() || !account.accountNumber.trim())) {
      setError("Every account needs a label and account number, or remove it.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updatePaymentSettings({ accounts });
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
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Payment accounts</CardTitle>
        <Button variant="outline" size="sm" onClick={addAccount}>
          Add account
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Shown on shared customer invoices, so customers know where to send payment (e.g. bank
          transfer, JazzCash, EasyPaisa).
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment accounts added yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {accounts.map((account, index) => (
              <div key={account.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor={`account-label-${index}`}>Label</Label>
                  <Input
                    id={`account-label-${index}`}
                    placeholder="Bank transfer, JazzCash, EasyPaisa…"
                    value={account.label}
                    onChange={(e) => updateAccount(account.id, { label: e.target.value })}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor={`account-number-${index}`}>Account number</Label>
                  <Input
                    id={`account-number-${index}`}
                    value={account.accountNumber}
                    onChange={(e) => updateAccount(account.id, { accountNumber: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove account"
                  onClick={() => removeAccount(account.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-3">
          <Button disabled={saving} onClick={handleSave} className="self-start">
            Save
          </Button>
          {saved ? <span className="text-sm text-success">Saved.</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
