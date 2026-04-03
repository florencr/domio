"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerData } from "../../context";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";
import { ManagerPollsPanel } from "./manager-polls-panel";

type SentNotification = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  target_audience: string;
  recipients: number;
};

export default function ConfigNotificationsPage() {
  const { data, loading } = useManagerData();
  const { locale } = useLocale();
  const [sentLog, setSentLog] = useState<SentNotification[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState<"owners" | "tenants" | "both">("both");
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [showSendForm, setShowSendForm] = useState(false);

  const loadSent = useCallback(async () => {
    setLogLoading(true);
    const res = await fetch("/api/notifications/sent");
    const j = await res.json().catch(() => ({ notifications: [] }));
    setSentLog(j.notifications ?? []);
    setLogLoading(false);
  }, []);

  useEffect(() => { loadSent(); }, [loadSent]);

  const toggleUnitType = (name: string) => {
    setSelectedUnitTypes(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  async function send() {
    if (!title.trim()) { setMsg({ text: "Enter a title", ok: false }); return; }
    setSending(true);
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim() || null,
        targetAudience,
        targetUnitTypes: selectedUnitTypes.length > 0 ? selectedUnitTypes : null,
        unpaidOnly,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok && json.success) {
      setMsg({ text: t(locale, "notifications.sentToRecipients", { count: String(json.recipients ?? 0) }), ok: true });
      setTitle("");
      setBody("");
      setSelectedUnitTypes([]);
      setUnpaidOnly(false);
      loadSent();
    } else {
      setMsg({ text: json.error || t(locale, "notifications.failedToSend"), ok: false });
    }
  }

  async function deleteNotification(id: string) {
    if (!confirm(t(locale, "notifications.deleteConfirm"))) return;
    const res = await fetch(`/api/notifications/sent?id=${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.success) {
      setMsg({ text: t(locale, "notifications.deleted"), ok: true });
      loadSent();
    } else setMsg({ text: j.error || t(locale, "notifications.deleteFailed"), ok: false });
  }

  const audienceLabel = (a: string) => {
    if (a === "owners") return t(locale, "notifications.ownersOnly");
    if (a === "tenants") return t(locale, "notifications.tenantsOnly");
    return t(locale, "notifications.ownersAndTenants");
  };

  if (loading) return <p className="text-muted-foreground">{t(locale, "common.loading")}</p>;

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base">{t(locale, "notifications.sendMessageTitle")}</CardTitle>
          <Button size="sm" className={`h-8 gap-1 ${showSendForm ? "bg-transparent text-foreground hover:bg-muted border" : "text-white border-0 bg-black hover:bg-black/90"}`} onClick={() => setShowSendForm(v => !v)}>
            {showSendForm ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showSendForm ? t(locale, "common.close") : t(locale, "notifications.sendMessageTitle")}
          </Button>
        </CardHeader>
        {showSendForm && (
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-xs">{t(locale, "notifications.messageTitle")}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t(locale, "notifications.messagePlaceholder")} className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs">{t(locale, "notifications.messageBody")}</Label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={t(locale, "notifications.messageBodyPlaceholder")} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t(locale, "notifications.sendTo")}</Label>
            <Select value={targetAudience} onValueChange={(v: "owners" | "tenants" | "both") => setTargetAudience(v)}>
              <SelectTrigger className="mt-1 h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owners">{t(locale, "notifications.ownersOnly")}</SelectItem>
                <SelectItem value="tenants">{t(locale, "notifications.tenantsOnly")}</SelectItem>
                <SelectItem value="both">{t(locale, "notifications.ownersAndTenants")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data.unitTypes.length > 0 && (
            <div>
              <Label className="text-xs">{t(locale, "notifications.filterByUnitType")}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.unitTypes.map(ut => (
                  <button key={ut.id} type="button" onClick={() => toggleUnitType(ut.name)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedUnitTypes.includes(ut.name) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted"}`}>
                    {ut.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="unpaid" checked={unpaidOnly} onChange={e => setUnpaidOnly(e.target.checked)} className="rounded" />
            <Label htmlFor="unpaid" className="cursor-pointer text-xs">{t(locale, "notifications.onlyUsersWithUnpaidBills")}</Label>
          </div>
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <Button onClick={send} disabled={sending} size="sm" className="h-9 text-white bg-black hover:bg-black/90 border-0">{sending ? t(locale, "notifications.sending") : t(locale, "notifications.send")}</Button>
            <Button variant="outline" size="sm" className="h-9 bg-transparent" onClick={() => setShowSendForm(false)}>{t(locale, "common.close")}</Button>
          </div>
        </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "notifications.sentNotifications")} ({sentLog.length})</CardTitle></CardHeader>
        <CardContent>
          {logLoading ? (
            <p className="text-muted-foreground">{t(locale, "common.loading")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "notifications.messageTitle")}</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "notifications.audience")}</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "notifications.recipients")}</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "notifications.sent")}</th>
                    <th className="pb-3 font-medium text-muted-foreground">{t(locale, "common.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sentLog.map(n => (
                    <tr key={n.id} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{n.title}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{audienceLabel(n.target_audience)}</td>
                      <td className="py-3 pr-4">{n.recipients}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(n.created_at).toLocaleString()}</td>
                      <td className="py-3">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => deleteNotification(n.id)}>
                          <Trash2 className="size-3.5 mr-1" />{t(locale, "common.delete")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!sentLog.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{t(locale, "notifications.noNotificationsSentYet")}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ManagerPollsPanel />
    </div>
  );
}
