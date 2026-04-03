"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";
import { pollApiHeaders } from "@/lib/polls/poll-api-auth-headers";

type PollListItem = {
  id: string;
  title: string;
  description: string | null;
  classification: string;
  category_scope: string;
  status: string;
  published_at: string | null;
  open: boolean;
  hasSubmitted: boolean;
  attachment_filename: string | null;
};

type Option = { id: string; label: string; explanation: string | null };
type Question = { id: string; prompt: string; help_text: string | null; kind: string; options: Option[] };

export function ResidentPollsSection() {
  const { locale } = useLocale();
  const [polls, setPolls] = useState<PollListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    poll: Record<string, unknown>;
    questions: Question[];
    attachmentUrl: string | null;
    open: boolean;
    canVote: boolean;
    hasSubmitted: boolean;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/polls/resident", {
      cache: "no-store",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    setPolls(Array.isArray(j.polls) ? j.polls : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function fetchDetail(pollId: string) {
    const res = await fetch(`/api/polls/resident/${pollId}`, {
      cache: "no-store",
      credentials: "include",
      headers: await pollApiHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error || "Error");
      setDetail(null);
      return false;
    }
    setDetail({
      poll: j.poll,
      questions: j.questions || [],
      attachmentUrl: j.attachmentUrl ?? null,
      open: !!j.open,
      canVote: !!j.canVote,
      hasSubmitted: !!j.hasSubmitted,
    });
    const init: Record<string, string | string[]> = {};
    (j.questions || []).forEach((q: Question) => {
      init[q.id] = q.kind === "multi_select" ? [] : "";
    });
    setAnswers(init);
    return true;
  }

  async function openPoll(pollId: string) {
    setMsg("");
    if (activeId === pollId) {
      setActiveId(null);
      setDetail(null);
      setAnswers({});
      return;
    }
    setActiveId(pollId);
    await fetchDetail(pollId);
  }

  function toggleMulti(qid: string, oid: string) {
    setAnswers((prev) => {
      const cur = prev[qid];
      const arr = Array.isArray(cur) ? [...cur] : [];
      const i = arr.indexOf(oid);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(oid);
      return { ...prev, [qid]: arr };
    });
  }

  async function submitVote(pollId: string) {
    if (!detail) return;
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/polls/resident/${pollId}/vote`, {
      method: "POST",
      credentials: "include",
      headers: await pollApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ answers }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(j.error || "Failed");
      return;
    }
    setMsg(t(locale, "polls.voteRecorded"));
    await loadList();
    setActiveId(pollId);
    await fetchDetail(pollId);
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="rounded bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-xs px-2 py-0.5 font-semibold">{t(locale, "polls.badgePolls")}</span>
          {t(locale, "polls.residentSectionTitle")} ({polls.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm py-4">{t(locale, "common.loading")}</p>
        ) : polls.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t(locale, "polls.noPollsForYou")}</p>
        ) : (
          <div className="space-y-2">
            {polls.map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.classification === "formal_resolution" ? t(locale, "polls.formal") : t(locale, "polls.informal")}
                      {" · "}
                      {p.category_scope}
                      {p.open ? ` · ${t(locale, "polls.open")}` : ` · ${t(locale, "polls.closed")}`}
                      {p.hasSubmitted ? ` · ${t(locale, "polls.youResponded")}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openPoll(p.id)}>
                    {activeId === p.id ? t(locale, "common.close") : t(locale, "polls.viewOrVote")}
                  </Button>
                </div>
                {activeId === p.id && detail && (
                  <div className="mt-4 pt-4 border-t space-y-4 text-sm">
                    {typeof detail.poll.description === "string" && detail.poll.description.length > 0 ? (
                      <p className="text-muted-foreground whitespace-pre-wrap">{detail.poll.description}</p>
                    ) : null}
                    {detail.attachmentUrl && (
                      <a href={detail.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                        {p.attachment_filename || t(locale, "polls.downloadDoc")}
                      </a>
                    )}
                    {detail.questions.map((q) => (
                      <div key={q.id} className="space-y-2">
                        <Label className="text-sm font-medium">{q.prompt}</Label>
                        {q.help_text && <p className="text-xs text-muted-foreground">{q.help_text}</p>}
                        <div className="space-y-2 pl-1">
                          {q.options.map((o) =>
                            q.kind === "multi_select" ? (
                              <label key={o.id} className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="mt-1 rounded"
                                  checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(o.id)}
                                  disabled={!detail.open || !detail.canVote || detail.hasSubmitted}
                                  onChange={() => toggleMulti(q.id, o.id)}
                                />
                                <span>
                                  <span className="font-medium">{o.label}</span>
                                  {o.explanation ? <span className="block text-xs text-muted-foreground">{o.explanation}</span> : null}
                                </span>
                              </label>
                            ) : (
                              <label key={o.id} className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={q.id}
                                  className="mt-1"
                                  checked={answers[q.id] === o.id}
                                  disabled={!detail.open || !detail.canVote || detail.hasSubmitted}
                                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                                />
                                <span>
                                  <span className="font-medium">{o.label}</span>
                                  {o.explanation ? <span className="block text-xs text-muted-foreground">{o.explanation}</span> : null}
                                </span>
                              </label>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                    {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
                    {detail.open && detail.canVote && !detail.hasSubmitted && (
                      <Button
                        size="sm"
                        disabled={saving}
                        className="text-white bg-black hover:bg-black/90 border-0"
                        onClick={() => submitVote(p.id)}
                      >
                        {saving ? "…" : t(locale, "polls.submitVote")}
                      </Button>
                    )}
                    {detail.hasSubmitted && <p className="text-xs text-muted-foreground">{t(locale, "polls.thanks")}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
