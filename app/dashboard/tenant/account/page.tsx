"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DomioLogo } from "@/components/DomioLogo";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

type ProfileData = {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  contact_email?: string | null;
};

export default function TenantAccountPage() {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPwd, setResettingPwd] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [data, setData] = useState<ProfileData | null>(null);
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((json: ProfileData | null) => {
        if (json) {
          setData(json);
          setPhone(json.phone ?? "");
          setContactEmail(json.contact_email ?? "");
        }
        setLoading(false);
      });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.trim() || null,
        contact_email: contactEmail.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setMsg({ text: t(locale, "profileAccount.saveSuccess"), ok: true });
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
    const res = await fetch("/api/profile/reset-password", {
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

  if (loading) return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-4 border-b">
        <Link href="/dashboard/tenant" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto" />
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">{t(locale, "common.loading")}</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/dashboard/tenant" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto" />
          <span className="text-sm font-medium text-muted-foreground">{t(locale, "tenant.tenantDashboard")}</span>
        </Link>
        <Link href="/dashboard/tenant">
          <Button variant="ghost" size="sm">{t(locale, "common.back")}</Button>
        </Link>
      </header>

      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, "profileAccount.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(locale, "profileAccount.description")}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

            <form onSubmit={saveProfile} className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">{t(locale, "profileAccount.loginEmail")}</h3>
                <p className="text-sm text-muted-foreground">{data?.email ?? "—"}</p>
              </div>
              <div className="grid gap-3 max-w-md">
                <div>
                  <Label className="text-xs">{t(locale, "profileAccount.contactEmail")}</Label>
                  <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contact@example.com" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">{t(locale, "managerAccount.phone")}</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+355..." className="mt-1" />
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
    </div>
  );
}
