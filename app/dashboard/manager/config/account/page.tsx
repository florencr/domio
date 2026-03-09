"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

type AccountData = {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  has_site?: boolean;
  site_name: string | null;
  vat_account: string | null;
  tax_amount: number | null;
  bank_name: string | null;
  iban: string | null;
  swift_code: string | null;
};

export default function ConfigAccountPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPwd, setResettingPwd] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [data, setData] = useState<AccountData | null>(null);
  const [phone, setPhone] = useState("");
  const [vatAccount, setVatAccount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [hasSite, setHasSite] = useState(false);

  useEffect(() => {
    fetch("/api/manager/account")
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((json: AccountData | null) => {
        if (json) {
          setData(json);
          setPhone(json.phone ?? "");
          setVatAccount(json.vat_account ?? "");
          setTaxAmount(json.tax_amount != null ? String(json.tax_amount) : "");
          setBankName(json.bank_name ?? "");
          setIban(json.iban ?? "");
          setSwiftCode(json.swift_code ?? "");
          setHasSite(!!(json as AccountData).has_site);
        }
        setLoading(false);
      });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/manager/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.trim() || null,
        vat_account: vatAccount.trim() || null,
        tax_amount: taxAmount.trim() ? parseFloat(taxAmount) : null,
        bank_name: bankName.trim() || null,
        iban: iban.trim() || null,
        swift_code: swiftCode.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && json.success) {
      setMsg({ text: t(locale, "managerAccount.saveSuccess"), ok: true });
    } else {
      setMsg({ text: json.error || t(locale, "common.failed"), ok: false });
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setMsg({ text: t(locale, "configUsers.passwordMinLength"), ok: false });
      return;
    }
    setResettingPwd(true);
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/manager/account/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const json = await res.json().catch(() => ({}));
    setResettingPwd(false);
    if (res.ok && json.success) {
      setMsg({ text: t(locale, "configUsers.passwordReset"), ok: true });
      setNewPassword("");
    } else {
      setMsg({ text: json.error || t(locale, "common.failed"), ok: false });
    }
  }

  if (loading) return <p className="text-muted-foreground">{t(locale, "common.loading")}</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, "managerAccount.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t(locale, "managerAccount.description")}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

          <form onSubmit={saveProfile} className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">{t(locale, "managerAccount.contactDetails")}</h3>
              <div className="grid gap-3 max-w-md">
                {data?.site_name != null && (
                  <div>
                    <Label className="text-xs">{t(locale, "managerAccount.assignedSite")}</Label>
                    <p className="text-sm mt-1 font-medium">{data.site_name}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs">{t(locale, "managerAccount.phone")}</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+355..." className="mt-1" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">{t(locale, "owner.vat")} &amp; {t(locale, "managerAccount.taxPercent")}</h3>
                  <div className="grid gap-3 max-w-md sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">{t(locale, "managerAccount.vatAccount")}</Label>
                      <Input value={vatAccount} onChange={e => setVatAccount(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">{t(locale, "managerAccount.taxPercent")}</Label>
                      <Input type="number" step="0.01" min="0" max="100" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} className="mt-1" placeholder="e.g. 20" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t(locale, "managerAccount.bankDetails")}</h3>
                  <div className="grid gap-3 max-w-md">
                    <div>
                      <Label className="text-xs">{t(locale, "managerAccount.bankName")}</Label>
                      <Input value={bankName} onChange={e => setBankName(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">{t(locale, "managerAccount.iban")}</Label>
                      <Input value={iban} onChange={e => setIban(e.target.value)} className="mt-1" placeholder="AL..." />
                    </div>
                    <div>
                      <Label className="text-xs">{t(locale, "managerAccount.swiftCode")}</Label>
                      <Input value={swiftCode} onChange={e => setSwiftCode(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                </div>

            <Button type="submit" disabled={saving}>{saving ? t(locale, "common.loading") : t(locale, "common.save")}</Button>
          </form>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold mb-3">{t(locale, "configUsers.resetPassword")}</h3>
            <form onSubmit={resetPassword} className="flex flex-wrap gap-2 items-end max-w-md">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">{t(locale, "configUsers.newPasswordPlaceholder")}</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t(locale, "configUsers.newPasswordPlaceholder")} minLength={6} className="mt-1" />
              </div>
              <Button type="submit" variant="outline" disabled={resettingPwd || !newPassword}>{resettingPwd ? t(locale, "common.loading") : t(locale, "configUsers.set")}</Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
