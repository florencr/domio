"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";
import { pollApiHeaders } from "@/lib/polls/poll-api-auth-headers";
import { BarChart3, ChevronDown, ChevronUp, Lock, Pencil, Rocket, Trash2 } from "lucide-react";

type PollRow = {
  id: string;
  title: string;
  classification: string;
  category_scope: string;
  status: string;
  published_at: string | null;
  created_at: string;
};

type OptDraft = { label: string; explanation: string };
type QDraft = { prompt: string; help_text: string; kind: "single_select" | "multi_select"; options: OptDraft[] };

const emptyQ = (): QDraft => ({
  prompt: "",
  help_text: "",
  kind: "single_select",
  options: [{ label: "", explanation: "" }, { label: "", explanation: "" }],
});

type PollResultsOption = { optionId: string; label: string; votes: number };
type PollResultsQuestion = {
  questionId: string;
  prompt: string;
  kind: string;
  options: PollResultsOption[];
  participationCount: number;
};

type PollManagerResults = {
  pollId: string;
  classification: string;
  category_scope: string;
  totalRegisteredUnits: number;
  open: boolean;
  thresholdPercent: number;
  approvalUnitVotes: number;
  resolutionPassed: boolean | null;
  questions: PollResultsQuestion[];
};

function isPollManagerResults(j: unknown): j is PollManagerResults {
  if (typeof j !== "object" || j === null) return false;
  const o = j as Record<string, unknown>;
  return typeof o.pollId === "string" && Array.isArray(o.questions);
}

function scrollSectionIntoView(el: HTMLElement | null) {
  if (!el) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

export function ManagerPollsPanel() {
  const { locale } = useLocale();
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classification, setClassification] = useState<"informal_survey" | "formal_resolution">("informal_survey");
  const [categoryScope, setCategoryScope] = useState<"apartment" | "parking" | "garden" | "global">("apartment");
  const [closesAt, setClosesAt] = useState("");
  const [questions, setQuestions] = useState<QDraft[]>([emptyQ()]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [resultsId, setResultsId] = useState<string | null>(null);
  const [pollResults, setPollResults] = useState<PollManagerResults | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [thresholdQid, setThresholdQid] = useState("");
  const [approvalOid, setApprovalOid] = useState("");
  const [publishQuestions, setPublishQuestions] = useState<{ id: string; prompt: string; options: { id: string; label: string }[] }[]>([]);
  const [publishAndNotifyNow, setPublishAndNotifyNow] = useState(true);
  const [createThQIdx, setCreateThQIdx] = useState(0);
  const [createThOIdx, setCreateThOIdx] = useState(0);

  const pollFormSectionRef = useRef<HTMLDivElement>(null);
  const publishSectionRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showForm) scrollSectionIntoView(pollFormSectionRef.current);
  }, [showForm]);

  useEffect(() => {
    if (publishId) scrollSectionIntoView(publishSectionRef.current);
  }, [publishId]);

  useEffect(() => {
    if (pollResults && resultsId) scrollSectionIntoView(resultsSectionRef.current);
  }, [pollResults, resultsId]);

  const loadPolls = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/polls/manager", {
      cache: "no-store",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    setPolls(Array.isArray(j.polls) ? j.polls : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setClassification("informal_survey");
    setCategoryScope("apartment");
    setClosesAt("");
    setQuestions([emptyQ()]);
    setPublishAndNotifyNow(true);
    setCreateThQIdx(0);
    setCreateThOIdx(0);
    setMsg({ text: "", ok: true });
  }

  async function loadDraftForEdit(pollId: string) {
    const res = await fetch(`/api/polls/manager/${pollId}`, {
      cache: "no-store",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ text: j.error || "Failed", ok: false });
      return;
    }
    const p = j.poll;
    setEditingId(pollId);
    setTitle(p.title || "");
    setDescription(p.description || "");
    setClassification(p.classification);
    setCategoryScope(p.category_scope);
    setClosesAt(p.closes_at ? p.closes_at.slice(0, 16) : "");
    const qs: QDraft[] = (j.questions || []).map((q: { prompt: string; help_text: string | null; kind: string; options: { label: string; explanation: string | null }[] }) => ({
      prompt: q.prompt,
      help_text: q.help_text || "",
      kind: q.kind === "multi_select" ? "multi_select" : "single_select",
      options: (q.options || []).map((o: { label: string; explanation: string | null }) => ({
        label: o.label,
        explanation: o.explanation || "",
      })),
    }));
    setQuestions(qs.length ? qs : [emptyQ()]);
    setShowForm(true);
    setPublishAndNotifyNow(false);
    setCreateThQIdx(0);
    setCreateThOIdx(0);
    setMsg({ text: "", ok: true });
  }

  async function saveDraft() {
    if (!title.trim()) {
      setMsg({ text: t(locale, "polls.titleRequired"), ok: false });
      return;
    }
    for (const q of questions) {
      if (!q.prompt.trim()) {
        setMsg({ text: t(locale, "polls.questionPromptRequired"), ok: false });
        return;
      }
      if (q.options.length < 2) {
        setMsg({ text: t(locale, "polls.twoOptionsMinimum"), ok: false });
        return;
      }
      for (const o of q.options) {
        if (!o.label.trim()) {
          setMsg({ text: t(locale, "polls.optionLabelRequired"), ok: false });
          return;
        }
      }
    }

    if (!editingId && publishAndNotifyNow && classification === "formal_resolution") {
      const qi = Math.min(createThQIdx, Math.max(0, questions.length - 1));
      const q = questions[qi];
      if (!q || createThOIdx < 0 || createThOIdx >= q.options.length) {
        setMsg({ text: t(locale, "polls.pickThresholdCreate"), ok: false });
        return;
      }
    }

    setSaving(true);
    setMsg({ text: "", ok: true });
    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      classification,
      category_scope: categoryScope,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      questions: questions.map((q) => ({
        prompt: q.prompt.trim(),
        help_text: q.help_text.trim() || null,
        kind: q.kind,
        options: q.options.map((o) => ({
          label: o.label.trim(),
          explanation: o.explanation.trim() || null,
        })),
      })),
    };
    if (!editingId && publishAndNotifyNow) {
      body.publishAndNotify = true;
      if (classification === "formal_resolution") {
        const qi = Math.min(createThQIdx, questions.length - 1);
        body.thresholdQuestionIndex = qi;
        body.thresholdOptionIndex = Math.min(createThOIdx, questions[qi].options.length - 1);
      }
    }
    const url = editingId ? `/api/polls/manager/${editingId}` : "/api/polls/manager";
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      credentials: "include",
      headers: await pollApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg({ text: j.error || t(locale, "polls.saveFailed"), ok: false });
      return;
    }
    if (j.published) {
      setMsg({ text: t(locale, "polls.published", { count: String(j.recipients ?? 0) }), ok: true });
      resetForm();
      setShowForm(false);
    } else {
      setMsg({ text: t(locale, "polls.savedDraft"), ok: true });
      if (!editingId && j.pollId) setEditingId(j.pollId);
    }
    loadPolls();
  }

  async function uploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const pollId = editingId;
    const file = e.target.files?.[0];
    if (!pollId || !file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/polls/manager/${pollId}/attachment`, {
      method: "POST",
      credentials: "include",
      headers: await pollApiHeaders(),
      body: fd,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: j.error || "Upload failed", ok: false });
    else setMsg({ text: t(locale, "polls.uploaded"), ok: true });
    e.target.value = "";
  }

  async function openPublishDialog(pollId: string) {
    const res = await fetch(`/api/polls/manager/${pollId}`, {
      cache: "no-store",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ text: j.error || "Failed", ok: false });
      return;
    }
    const qs = (j.questions || []).map((q: { id: string; prompt: string; options: { id: string; label: string }[] }) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options || [],
    }));
    setPublishQuestions(qs);
    setPublishId(pollId);
    setThresholdQid("");
    setApprovalOid("");
    setMsg({ text: "", ok: true });
  }

  async function confirmPublish() {
    if (!publishId) return;
    const poll = polls.find((p) => p.id === publishId);
    const needsThreshold = poll?.classification === "formal_resolution";
    if (needsThreshold && (!thresholdQid || !approvalOid)) {
      setMsg({ text: t(locale, "polls.pickThreshold"), ok: false });
      return;
    }
    const res = await fetch(`/api/polls/manager/${publishId}/publish`, {
      method: "POST",
      credentials: "include",
      headers: await pollApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        thresholdQuestionId: needsThreshold ? thresholdQid : undefined,
        approvalOptionId: needsThreshold ? approvalOid : undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: j.error || t(locale, "polls.publishFailed"), ok: false });
    else {
      setMsg({ text: t(locale, "polls.published", { count: String(j.recipients ?? 0) }), ok: true });
      setPublishId(null);
    }
    loadPolls();
  }

  async function loadResults(pollId: string) {
    const res = await fetch(`/api/polls/manager/${pollId}/results`, {
      cache: "no-store",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ text: j.error || "Failed", ok: false });
      return;
    }
    if (!isPollManagerResults(j)) {
      setMsg({ text: "Invalid results", ok: false });
      return;
    }
    setResultsId(pollId);
    setPollResults(j);
  }

  async function closePoll(pollId: string) {
    if (!confirm(t(locale, "polls.closeConfirm"))) return;
    const res = await fetch(`/api/polls/manager/${pollId}/close`, {
      method: "POST",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: j.error || "Failed", ok: false });
    else setMsg({ text: t(locale, "polls.closeDone"), ok: true });
    loadPolls();
  }

  async function deleteDraft(pollId: string) {
    if (!confirm(t(locale, "polls.deleteDraftConfirm"))) return;
    const res = await fetch(`/api/polls/manager/${pollId}`, {
      method: "DELETE",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: j.error || "Failed", ok: false });
    else {
      setMsg({ text: t(locale, "polls.deleted"), ok: true });
      if (editingId === pollId) resetForm();
    }
    loadPolls();
  }

  const thresholdOpts = publishQuestions.find((q) => q.id === thresholdQid)?.options || [];

  function categoryScopeLabel(scope: string): string {
    if (scope === "apartment") return t(locale, "polls.scopeApartment");
    if (scope === "parking") return t(locale, "polls.scopeParking");
    if (scope === "garden") return t(locale, "polls.scopeGarden");
    if (scope === "global") return t(locale, "polls.scopeGlobal");
    return scope;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-base">{t(locale, "polls.panelTitle")}</CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={() => {
            setShowForm((v) => !v);
            if (showForm) resetForm();
            else {
              resetForm();
              setShowForm(true);
            }
          }}
        >
          {showForm ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {showForm ? t(locale, "common.close") : t(locale, "polls.createPoll")}
        </Button>
      </CardHeader>
      {showForm && (
        <div ref={pollFormSectionRef} className="scroll-mt-20">
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-xs">{t(locale, "polls.pollTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs">{t(locale, "polls.pollDescription")}</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <Label className="text-xs">{t(locale, "polls.classification")}</Label>
              <Select value={classification} onValueChange={(v: "informal_survey" | "formal_resolution") => setClassification(v)}>
                <SelectTrigger className="mt-1 h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informal_survey">{t(locale, "polls.informal")}</SelectItem>
                  <SelectItem value="formal_resolution">{t(locale, "polls.formal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t(locale, "polls.category")}</Label>
              <Select
                value={categoryScope}
                onValueChange={(v: "apartment" | "parking" | "garden" | "global") => setCategoryScope(v)}
              >
                <SelectTrigger className="mt-1 h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartment">{t(locale, "polls.scopeApartment")}</SelectItem>
                  <SelectItem value="parking">{t(locale, "polls.scopeParking")}</SelectItem>
                  <SelectItem value="garden">{t(locale, "polls.scopeGarden")}</SelectItem>
                  <SelectItem value="global">{t(locale, "polls.scopeGlobal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t(locale, "polls.closesAtOptional")}</Label>
              <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="mt-1 h-9 w-52" />
            </div>
          </div>
          {!editingId && (
            <div className="space-y-3 rounded-md border border-dashed p-3 bg-muted/10">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={publishAndNotifyNow}
                  onChange={(e) => setPublishAndNotifyNow(e.target.checked)}
                />
                <span>{t(locale, "polls.notifyParticipantsNow")}</span>
              </label>
              {publishAndNotifyNow && classification === "formal_resolution" && (
                <div className="flex flex-wrap gap-4 pl-6">
                  <div>
                    <Label className="text-xs">{t(locale, "polls.thresholdQuestionCreate")}</Label>
                    <Select
                      value={String(Math.min(createThQIdx, questions.length - 1))}
                      onValueChange={(v) => {
                        setCreateThQIdx(Number(v));
                        setCreateThOIdx(0);
                      }}
                    >
                      <SelectTrigger className="mt-1 h-9 w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {questions.map((q, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {(q.prompt || `Q${i + 1}`).slice(0, 55)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t(locale, "polls.approvalOptionCreate")}</Label>
                    <Select value={String(createThOIdx)} onValueChange={(v) => setCreateThOIdx(Number(v))}>
                      <SelectTrigger className="mt-1 h-9 w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(questions[Math.min(createThQIdx, questions.length - 1)]?.options || []).map((o, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {o.label || `Option ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
          {editingId && (
            <div>
              <Label className="text-xs">{t(locale, "polls.attachDoc")}</Label>
              <Input type="file" onChange={uploadAttachment} className="mt-1 h-9 text-sm" />
            </div>
          )}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-xs font-medium">{t(locale, "polls.questions")}</Label>
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{t(locale, "polls.questionN", { n: String(qi + 1) })}</span>
                  {questions.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}>
                      {t(locale, "polls.removeQuestion")}
                    </Button>
                  )}
                </div>
                <Input placeholder={t(locale, "polls.questionPrompt")} value={q.prompt} onChange={(e) => setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, prompt: e.target.value } : x)))} className="h-9" />
                <Input placeholder={t(locale, "polls.helpText")} value={q.help_text} onChange={(e) => setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, help_text: e.target.value } : x)))} className="h-9" />
                <Select value={q.kind} onValueChange={(v: "single_select" | "multi_select") => setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, kind: v } : x)))}>
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_select">{t(locale, "polls.singleChoice")}</SelectItem>
                    <SelectItem value="multi_select">{t(locale, "polls.multiChoice")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-2 pl-2 border-l-2">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex flex-col gap-1">
                      <div className="flex gap-2 items-center">
                        <Input placeholder={t(locale, "polls.optionLabel")} value={o.label} onChange={(e) => setQuestions((prev) => prev.map((qx, i) => (i === qi ? { ...qx, options: qx.options.map((oo, j) => (j === oi ? { ...oo, label: e.target.value } : oo)) } : qx)))} className="h-8 flex-1" />
                        {q.options.length > 2 && (
                          <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => setQuestions((prev) => prev.map((qx, i) => (i === qi ? { ...qx, options: qx.options.filter((_, j) => j !== oi) } : qx)))}>
                            ×
                          </Button>
                        )}
                      </div>
                      <Input placeholder={t(locale, "polls.optionExplain")} value={o.explanation} onChange={(e) => setQuestions((prev) => prev.map((qx, i) => (i === qi ? { ...qx, options: qx.options.map((oo, j) => (j === oi ? { ...oo, explanation: e.target.value } : oo)) } : qx)))} className="h-8" />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="h-8 mt-1" onClick={() => setQuestions((prev) => prev.map((qx, i) => (i === qi ? { ...qx, options: [...qx.options, { label: "", explanation: "" }] } : qx)))}>
                    {t(locale, "polls.addOption")}
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" className="h-9" onClick={() => setQuestions((prev) => [...prev, emptyQ()])}>
              {t(locale, "polls.addQuestion")}
            </Button>
          </div>
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={saveDraft} className="h-9 text-white bg-black hover:bg-black/90 border-0">
              {saving ? "…" : t(locale, "polls.saveDraft")}
            </Button>
            {editingId && (
              <Button size="sm" variant="outline" className="h-9" onClick={() => openPublishDialog(editingId)}>
                {t(locale, "polls.publishThis")}
              </Button>
            )}
          </div>
        </CardContent>
        </div>
      )}

      <CardContent className={showForm ? "pt-0" : ""}>
        <h3 className="text-sm font-medium mb-1">{t(locale, "polls.pollListTitle")}</h3>
        {loading ? (
          <p className="text-muted-foreground text-sm py-4">{t(locale, "common.loading")}</p>
        ) : polls.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t(locale, "polls.noPollsYet")}</p>
        ) : (
          <div className="overflow-x-auto text-sm">
            <table className="w-full min-w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "polls.pollTitle")}</th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "polls.type")}</th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "polls.status")}</th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground min-w-[12rem]">{t(locale, "common.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {polls.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium align-top">{p.title}</td>
                    <td className="py-3 pr-4 text-muted-foreground align-top">
                      {p.classification === "formal_resolution" ? t(locale, "polls.formalShort") : t(locale, "polls.informalShort")}
                    </td>
                    <td className="py-3 pr-4 capitalize align-top">{p.status}</td>
                    <td className="py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {p.status === "draft" && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 px-2.5 text-xs font-medium bg-background"
                              onClick={() => loadDraftForEdit(p.id)}
                            >
                              <Pencil className="size-3.5 shrink-0 opacity-80" aria-hidden />
                              {t(locale, "polls.edit")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1.5 px-2.5 text-xs font-medium text-white bg-black hover:bg-black/90 border-0 shadow-sm"
                              onClick={() => openPublishDialog(p.id)}
                            >
                              <Rocket className="size-3.5 shrink-0 opacity-90" aria-hidden />
                              {t(locale, "polls.publish")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 px-2.5 text-xs font-medium border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => deleteDraft(p.id)}
                            >
                              <Trash2 className="size-3.5 shrink-0" aria-hidden />
                              {t(locale, "common.delete")}
                            </Button>
                          </>
                        )}
                        {(p.status === "published" || p.status === "closed") && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 px-2.5 text-xs font-medium bg-background"
                              onClick={() => loadResults(p.id)}
                            >
                              <BarChart3 className="size-3.5 shrink-0 opacity-80" aria-hidden />
                              {t(locale, "polls.results")}
                            </Button>
                            {p.status === "published" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 px-2.5 text-xs font-medium bg-background"
                                onClick={() => closePoll(p.id)}
                              >
                                <Lock className="size-3.5 shrink-0 opacity-80" aria-hidden />
                                {t(locale, "polls.close")}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {publishId && (
        <div ref={publishSectionRef} className="scroll-mt-20">
        <CardContent className="border-t bg-muted/20 py-4 space-y-3">
          <p className="text-sm font-medium">{t(locale, "polls.publishHeading")}</p>
          {polls.find((x) => x.id === publishId)?.classification === "formal_resolution" && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">{t(locale, "polls.thresholdQuestion")}</Label>
                <Select value={thresholdQid} onValueChange={(v) => { setThresholdQid(v); setApprovalOid(""); }}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder={t(locale, "polls.pickQuestion")} />
                  </SelectTrigger>
                  <SelectContent>
                    {publishQuestions.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.prompt.slice(0, 80)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t(locale, "polls.approvalOption")}</Label>
                <Select value={approvalOid} onValueChange={setApprovalOid} disabled={!thresholdQid}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder={t(locale, "polls.pickOption")} />
                  </SelectTrigger>
                  <SelectContent>
                    {thresholdOpts.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmPublish} className="h-9 text-white bg-black hover:bg-black/90 border-0">
              {t(locale, "polls.confirmPublish")}
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setPublishId(null)}>
              {t(locale, "common.close")}
            </Button>
          </div>
        </CardContent>
        </div>
      )}

      {resultsId && pollResults && (
        <div
          ref={resultsSectionRef}
          className="scroll-mt-20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        >
        <CardContent className="border-t py-4 space-y-4 max-h-[min(70vh,32rem)] overflow-y-auto">
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-medium">{t(locale, "polls.resultsTitle")}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 bg-background font-medium"
              onClick={() => {
                setResultsId(null);
                setPollResults(null);
              }}
            >
              {t(locale, "common.close")}
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">{t(locale, "polls.type")}: </span>
              <span className="font-medium">
                {pollResults.classification === "formal_resolution"
                  ? t(locale, "polls.formalShort")
                  : t(locale, "polls.informalShort")}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">{t(locale, "polls.category")}: </span>
              <span className="font-medium">{categoryScopeLabel(pollResults.category_scope)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t(locale, "polls.resultsRegisteredUnits")}: </span>
              <span className="font-medium tabular-nums">{pollResults.totalRegisteredUnits}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t(locale, "polls.status")}: </span>
              <span className="font-medium">
                {pollResults.open ? t(locale, "polls.resultsStillOpen") : t(locale, "polls.resultsVotingClosed")}
              </span>
            </p>
            {pollResults.classification === "formal_resolution" && (
              <>
                <p>
                  <span className="text-muted-foreground">{t(locale, "polls.resultsFormalThreshold")}: </span>
                  <span className="font-medium tabular-nums">{pollResults.thresholdPercent}%</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{t(locale, "polls.resultsApprovalVotes")}: </span>
                  <span className="font-medium tabular-nums">{pollResults.approvalUnitVotes}</span>
                </p>
                {pollResults.resolutionPassed !== null && (
                  <p>
                    <span className="text-muted-foreground">{t(locale, "polls.resultsOutcome")}: </span>
                    <span className="font-medium">
                      {pollResults.resolutionPassed ? t(locale, "polls.resultsPassed") : t(locale, "polls.resultsNotPassed")}
                    </span>
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            {pollResults.questions.map((q, qi) => {
              const maxVotes = Math.max(1, ...q.options.map((o) => o.votes));
              return (
                <div key={q.questionId} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      {t(locale, "polls.questionN", { n: String(qi + 1) })}: {q.prompt}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {q.kind === "multi_select"
                        ? t(locale, "polls.resultsMultiChoice")
                        : t(locale, "polls.resultsSingleChoice")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(locale, "polls.resultsBallots", { count: String(q.participationCount) })}
                  </p>
                  <ul className="space-y-2 pt-1">
                    {q.options.map((o) => (
                      <li key={o.optionId} className="space-y-1">
                        <div className="flex justify-between gap-2 text-sm">
                          <span>{o.label}</span>
                          <span className="tabular-nums text-muted-foreground shrink-0">
                            {t(locale, "polls.resultsVotesCount", { count: String(o.votes) })}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/80 transition-[width]"
                            style={{ width: `${(o.votes / maxVotes) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
        </div>
      )}
    </Card>
  );
}
