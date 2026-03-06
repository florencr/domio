"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UnitType } from "./types";

export function SendNotificationForm({ unitTypes, onClose }: { unitTypes: UnitType[]; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState<"owners" | "tenants" | "both">("both");
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

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
      setMsg({ text: `Sent to ${json.recipients ?? 0} recipients`, ok: true });
      setTimeout(() => { setTitle(""); setBody(""); setSelectedUnitTypes([]); setUnpaidOnly(false); onClose(); }, 800);
    } else {
      setMsg({ text: json.error || "Failed to send", ok: false });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Send new message</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-foreground">✕</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Payment reminder" className="mt-1" />
          </div>
          <div>
            <Label>Message (optional)</Label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1" />
          </div>
          <div>
            <Label>Send to</Label>
            <Select value={targetAudience} onValueChange={(v: "owners" | "tenants" | "both") => setTargetAudience(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owners">Owners only</SelectItem>
                <SelectItem value="tenants">Tenants only</SelectItem>
                <SelectItem value="both">Owners and Tenants</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {unitTypes.length > 0 && (
            <div>
              <Label>Filter by unit type (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {unitTypes.map(ut => (
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
            <Label htmlFor="unpaid" className="cursor-pointer">Only users with unpaid bills</Label>
          </div>
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <Button onClick={send} disabled={sending} className="text-white border-0 bg-black hover:bg-black/90">{sending ? "Sending..." : "Send"}</Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
