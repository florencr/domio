"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerData } from "../../context";
import { Download, Trash2 } from "lucide-react";

type DocWithNames = {
  id: string;
  name: string;
  category: string;
  created_at: string;
  building_name: string;
  unit_name: string;
};

export default function ConfigDocumentsPage() {
  const { data, loading } = useManagerData();
  const [documents, setDocuments] = useState<DocWithNames[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [buildingId, setBuildingId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("__none__");
  const [category, setCategory] = useState<string>("other");
  const [file, setFile] = useState<File | null>(null);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    const res = await fetch("/api/documents?listAll=1");
    const j = await res.json().catch(() => ({ documents: [] }));
    setDocuments(j.documents ?? []);
    setDocsLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setMsg({ text: "Select a file", ok: false }); return; }
    if (!buildingId) { setMsg({ text: "Select a building", ok: false }); return; }
    setUploading(true);
    setMsg({ text: "", ok: true });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("buildingId", buildingId);
    if (unitId && unitId !== "__none__") fd.append("unitId", unitId);
    fd.append("category", category);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok && j.document) {
      setMsg({ text: "✓ Document uploaded.", ok: true });
      setFile(null);
      loadDocs();
    } else setMsg({ text: j.error || "Upload failed", ok: false });
  }

  async function handleDownload(id: string) {
    const res = await fetch(`/api/documents/${id}`);
    const j = await res.json().catch(() => ({}));
    if (j.url) window.open(j.url, "_blank");
    else setMsg({ text: "Download failed", ok: false });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.success) {
      setMsg({ text: "✓ Document deleted.", ok: true });
      loadDocs();
    } else setMsg({ text: j.error || "Delete failed", ok: false });
  }

  const unitsInBuilding = buildingId ? data.units.filter(u => u.building_id === buildingId) : [];

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader><CardTitle>Upload Document</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">File</Label>
              <Input type="file" className="h-9 mt-1" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label className="text-xs">Building</Label>
              <Select value={buildingId} onValueChange={v => { setBuildingId(v); setUnitId("__none__"); }}>
                <SelectTrigger className="h-9 w-40 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {data.buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="h-9 w-36 mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Building only</SelectItem>
                  {unitsInBuilding.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-32 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" className="h-9" disabled={uploading}>{uploading ? "..." : "Upload"}</Button>
          </form>
          {msg.text && <p className={`text-xs mt-2 ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents ({documents.length})</CardTitle></CardHeader>
        <CardContent>
          {docsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Doc name</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Building</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Unit</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Category</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Upload date</th>
                    <th className="pb-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.map(d => (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{d.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{d.building_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{d.unit_name}</td>
                      <td className="py-3 pr-4 capitalize">{d.category}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDownload(d.id)}><Download className="size-3.5 mr-1" />Download</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(d.id)}><Trash2 className="size-3.5 mr-1" />Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!documents.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No documents yet. Upload one above.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
