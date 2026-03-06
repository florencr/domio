"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<{ id: string; created_at: string; user_email: string | null; action: string; entity_type: string; entity_id: string | null; entity_label: string | null; old_values: unknown; new_values: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("all");

  useEffect(() => {
    let u = "/api/admin/audit-log?limit=100";
    if (entityType !== "all") u += "&entityType=" + entityType;
    fetch(u)
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(j => { setEntries(j.entries ?? []); setLoading(false); });
  }, [entityType]);

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const formatChange = (oldV: unknown, newV: unknown, action: string) => {
    if (action === "create" && newV) return JSON.stringify(newV);
    if (action === "delete" && oldV) return "was: " + JSON.stringify(oldV);
    if (oldV && newV) return "→ " + JSON.stringify(newV);
    return "";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <p className="text-sm text-muted-foreground">Who changed what and when.</p>
          </div>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="site">Sites</SelectItem>
              <SelectItem value="building">Buildings</SelectItem>
              <SelectItem value="manager">Managers</SelectItem>
              <SelectItem value="unit">Units</SelectItem>
              <SelectItem value="service">Services</SelectItem>
              <SelectItem value="bill">Bills</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {entries.map(e => (
                <div key={e.id} className="text-sm py-2 px-3 rounded border bg-muted/30">
                  <span className="text-muted-foreground">{formatDate(e.created_at)}</span>
                  {" · "}
                  <span className="font-medium">{e.user_email ?? "system"}</span>
                  {" "}
                  <span className="text-amber-600">{e.action}</span>
                  {" "}
                  <span>{e.entity_type}</span>
                  {e.entity_label && <span className="text-muted-foreground"> ({e.entity_label})</span>}
                  {formatChange(e.old_values, e.new_values, e.action) && <p className="text-xs mt-1 text-muted-foreground truncate">{formatChange(e.old_values, e.new_values, e.action)}</p>}
                </div>
              ))}
            </div>
          )}
          {!loading && !entries.length && <p className="py-6 text-center text-muted-foreground">No audit entries yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
