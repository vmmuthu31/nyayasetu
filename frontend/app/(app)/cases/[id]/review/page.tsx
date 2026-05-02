"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Bell, Sun, Moon, ChevronRight, ChevronDown,
  Calendar, FileText, Hash, Building2,
  CheckCircle2, Edit2, AlertCircle, Clock,
  Download, ExternalLink, Maximize2, Minus, Plus,
  RotateCw, Save, CheckCheck, X,
} from "lucide-react";
import { api, CaseDetail, Directive, AuditEntry } from "@/lib/api";
import { formatDate, cn, daysUntil } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

/* ─── Confidence helpers ─────────────────────────────────── */

function confBadge(score: number) {
  const pct = Math.round(score * 100);
  if (score >= 0.8)  return { label: "Verified", pct, color: "text-emerald-600", dot: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50" };
  if (score >= 0.5)  return { label: "Review",   pct, color: "text-amber-600",   dot: "bg-amber-400",   ring: "border-amber-200  bg-amber-50"  };
  return               { label: "Low",      pct, color: "text-red-600",     dot: "bg-red-400",     ring: "border-red-200    bg-red-50"    };
}

function statusBadge(status: string) {
  if (status === "VERIFIED")     return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "REJECTED")     return "text-red-700 bg-red-50 border-red-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

function actionColor(type: string) {
  if (type === "COMPLY")  return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (type === "APPEAL")  return "bg-orange-100 text-orange-700 border-orange-200";
  if (type === "INFORM")  return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-violet-100 text-violet-700 border-violet-200";
}

/* ─── Page ───────────────────────────────────────────────── */

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [caseData,   setCaseData]   = useState<CaseDetail | null>(null);
  const [selected,   setSelected]   = useState<Directive | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<Directive>>({});
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);
  const [pdfUrl,     setPdfUrl]     = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<"pdf" | "text" | "blocks">("pdf");
  const [darkMode,   setDarkMode]   = useState(false);
  const [auditLogs,  setAuditLogs]  = useState<AuditEntry[]>([]);
  const [activeBlock, setActiveBlock] = useState(0);

  useEffect(() => {
    Promise.all([
      api.cases.get(id),
      api.cases.pdfUrl(id).catch(() => ({ url: null })),
      api.audit.logs({ case_id: id, limit: 5 }),
    ]).then(([c, pdf, logs]) => {
      setCaseData(c);
      const first = c.directives.find((d) => d.status === "PENDING_REVIEW") ?? c.directives[0];
      if (first) { setSelected(first); setEditForm(first); }
      setPdfUrl(pdf.url);
      setAuditLogs(logs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDecide = async (directive: Directive, decision: "approve" | "reject") => {
    setSubmitting(true);
    try {
      await api.review.decide(
        directive.id, decision,
        editingId === directive.id ? {
          action_type: editForm.action_type,
          department:  editForm.department,
          deadline:    editForm.deadline ?? undefined,
        } : undefined,
        notes || undefined,
      );
      showToast(`Directive ${decision === "approve" ? "approved ✓" : "rejected"}`, decision === "approve");
      const updated = await api.cases.get(id);
      setCaseData(updated);
      const next = updated.directives.find((d) => d.status === "PENDING_REVIEW");
      const sel = next ?? updated.directives[0] ?? null;
      setSelected(sel);
      if (sel) setEditForm(sel);
      setEditingId(null);
      setNotes("");
      // Refresh audit
      api.audit.logs({ case_id: id, limit: 5 }).then(setAuditLogs).catch(() => {});
    } catch (e: unknown) {
      showToast((e as Error).message, false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAll = async () => {
    if (!caseData) return;
    setSubmitting(true);
    try {
      await api.review.setCaseStatus(id, "VERIFIED", "Submitted by reviewer");
      showToast("Case submitted as Verified", true);
      setTimeout(() => router.push("/cases"), 1500);
    } catch (e: unknown) {
      showToast((e as Error).message, false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading case…</p>
      </div>
    </div>
  );

  if (!caseData) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Case not found.</div>
  );

  const summary   = caseData.summary;
  const verified  = summary?.verified_count  ?? 0;
  const total     = summary?.total_directives ?? 0;
  const confidence= Math.round(caseData.confidence_score * 100);
  const confLabel = confidence >= 80 ? "Good" : confidence >= 60 ? "Fair" : "Low";
  const confColor = confidence >= 80 ? "text-emerald-600" : confidence >= 60 ? "text-amber-600" : "text-red-600";

  const initials = user?.name?.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase() ?? "U";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* ── TOP BAR ── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm">
          <Link href="/cases" className="text-slate-500 hover:text-indigo-600 transition-colors">Cases</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <Link href={`/cases/${id}`} className="text-slate-500 hover:text-indigo-600 transition-colors">
            {caseData.case_number}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-800 font-semibold">Review & Verify</span>
        </div>
        {/* Right controls */}
        <div className="flex items-center gap-3">
          <button className="relative text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">9</span>
          </button>
          <button
            onClick={() => setDarkMode(v => !v)}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name}</p>
              <p className="text-[10px] text-slate-400 leading-tight capitalize">
                {user?.role?.replace("_", " ").toLowerCase()}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* ── CASE HEADER ── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: case info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{caseData.case_number}</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                {caseData.court}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-3 truncate">
              {caseData.petitioners} vs {caseData.respondents}
            </p>
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Order Date: <strong className="text-slate-700">{formatDate(caseData.judgment_date)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Received: <strong className="text-slate-700">{formatDate(caseData.received_at ?? caseData.filed_at)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Pages: <strong className="text-slate-700">{caseData.page_count || "—"}</strong>
              </span>
            </div>
          </div>

          {/* Right: confidence + progress + actions */}
          <div className="flex items-start gap-6 shrink-0">
            {/* Overall Confidence */}
            <div className="text-center min-w-[110px]">
              <p className="text-xs text-slate-400 mb-1">Overall Confidence</p>
              <p className={cn("text-2xl font-bold", confColor)}>{confidence}%</p>
              <p className={cn("text-xs font-semibold", confColor)}>{confLabel}</p>
              <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", confidence >= 80 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-400" : "bg-red-400")}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>

            {/* Review Progress */}
            <div className="text-center min-w-[110px]">
              <p className="text-xs text-slate-400 mb-1">Review Progress</p>
              <p className="text-2xl font-bold text-slate-800">
                {verified} <span className="text-slate-400 text-lg">/ {total}</span>
              </p>
              <p className="text-xs text-slate-500">Fields Verified</p>
              <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: total > 0 ? `${(verified / total) * 100}%` : "0%" }}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <Save className="w-3.5 h-3.5" /> Save Draft
              </button>
              <button
                onClick={handleSubmitAll}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors shadow-sm"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Submit Verified
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN 3-COLUMN AREA ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── COLUMN 1: PDF / Viewer ── */}
        <div className="flex flex-col w-[420px] shrink-0 border-r border-slate-200 bg-white overflow-hidden">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-0 border-b border-slate-200 px-3 pt-3">
            {(["pdf", "text", "blocks"] as const).map((tab) => {
              const labels: Record<string, string> = {
                pdf: "PDF Viewer",
                text: "Extracted Text",
                blocks: `Directive Blocks`,
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
                    activeTab === tab
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  {tab === "blocks"
                    ? <>Directive Blocks <span className="ml-1 bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">{caseData.directives.length}</span></>
                    : labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Viewer body */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === "pdf" && (
              <div className="h-full flex flex-col">
                {/* PDF toolbar */}
                <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <span className="font-medium truncate max-w-[160px]">
                    {caseData.case_number}_Judgment.pdf
                  </span>
                  <div className="flex items-center gap-1">
                    <button className="p-1 hover:bg-slate-200 rounded"><Minus className="w-3 h-3" /></button>
                    <span className="px-1">100%</span>
                    <button className="p-1 hover:bg-slate-200 rounded"><Plus className="w-3 h-3" /></button>
                    <span className="mx-1 text-slate-300">|</span>
                    <button className="p-1 hover:bg-slate-200 rounded"><RotateCw className="w-3 h-3" /></button>
                    <button className="p-1 hover:bg-slate-200 rounded"><Maximize2 className="w-3 h-3" /></button>
                  </div>
                </div>
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="flex-1 w-full border-0"
                    title="Case PDF"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    <div className="text-center">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>PDF not available</p>
                      <p className="text-xs mt-1">Upload a PDF to view here</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "text" && (
              <div className="h-full overflow-y-auto p-4">
                {selected ? (
                  <div className="space-y-3">
                    {selected.highlight_coords?.map((h, i) => (
                      <div key={i} className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-slate-800 leading-relaxed">
                        {selected.text}
                      </div>
                    )) ?? (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-slate-800 leading-relaxed">
                        {selected.text}
                      </div>
                    )}
                    {selected.page_number && (
                      <p className="text-xs text-slate-400">
                        Page {selected.page_number}
                        {selected.highlight_coords?.length ? ` · ${selected.highlight_coords.length} region(s)` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Select a directive to see extracted text</p>
                )}
              </div>
            )}

            {activeTab === "blocks" && (
              <div className="h-full overflow-y-auto p-4 space-y-2">
                {caseData.directives.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => { setSelected(d); setEditForm(d); setActiveTab("text"); }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all",
                      selected?.id === d.id
                        ? "border-indigo-400 bg-indigo-50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-slate-500">Block {i + 1}</span>
                      {d.page_number && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          Pg {d.page_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">{d.text}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", actionColor(d.action_type))}>
                        {d.action_type}
                      </span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", statusBadge(d.status))}>
                        {d.status === "PENDING_REVIEW" ? "Pending" : d.status === "VERIFIED" ? "Verified" : "Rejected"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Directive Blocks bottom bar (shown on PDF/text tabs) */}
          {activeTab !== "blocks" && caseData.directives.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">
                  Directive Blocks ({caseData.directives.length})
                </p>
                <button
                  onClick={() => setActiveTab("blocks")}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {caseData.directives.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => { setSelected(d); setEditForm(d); setActiveBlock(i); }}
                    className={cn(
                      "shrink-0 w-[72px] rounded-lg border p-2 text-left transition-all",
                      selected?.id === d.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <p className="text-[10px] font-semibold text-slate-600">Block {i + 1}</p>
                    {d.page_number && (
                      <p className="text-[10px] text-slate-400">Pg {d.page_number}</p>
                    )}
                    <div className={cn(
                      "mt-1 w-1.5 h-1.5 rounded-full",
                      d.status === "VERIFIED" ? "bg-emerald-500" :
                      d.status === "REJECTED" ? "bg-red-400" : "bg-amber-400"
                    )} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── COLUMN 2: Extracted Fields ── */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="p-4 space-y-0">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-800">Extracted Fields</h2>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-600 text-white">
                Review Mode
              </span>
            </div>

            {/* Case-level fields */}
            <FieldRow
              label="Case Number"
              value={caseData.case_number}
              confidence={caseData.confidence_score}
              icon={Hash}
            />
            <FieldRow
              label="Parties"
              value={`${caseData.petitioners} vs ${caseData.respondents}`}
              confidence={caseData.confidence_score * 0.95}
              icon={Building2}
            />
            <FieldRow
              label="Court"
              value={caseData.court}
              confidence={caseData.confidence_score * 0.98}
              icon={Building2}
            />
            <FieldRow
              label="Order Date"
              value={formatDate(caseData.judgment_date)}
              confidence={caseData.judgment_date ? 0.95 : 0}
              icon={Calendar}
            />
            <FieldRow
              label="Received Date"
              value={formatDate(caseData.received_at ?? caseData.filed_at)}
              confidence={0.95}
              icon={Calendar}
            />

            {/* Directive fields */}
            {caseData.directives.map((d, i) => {
              const isSelected = selected?.id === d.id;
              const isEditing  = editingId === d.id;
              const cb = confBadge(d.confidence_score);

              return (
                <div
                  key={d.id}
                  className={cn(
                    "border rounded-xl overflow-hidden mb-2 transition-all",
                    isSelected ? "border-indigo-300 shadow-sm" : "border-slate-200"
                  )}
                >
                  {/* Directive header row */}
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer",
                      isSelected ? "bg-indigo-50/60" : "bg-white hover:bg-slate-50"
                    )}
                    onClick={() => { setSelected(d); setEditForm(d); }}
                  >
                    <div className="shrink-0 mt-0.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", actionColor(d.action_type))}>
                        Direction {i + 1} ({d.action_type})
                      </span>
                    </div>
                    <p className="flex-1 text-xs text-slate-700 leading-relaxed line-clamp-2">{d.text}</p>
                    <div className="shrink-0 flex items-center gap-2 ml-2">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1", cb.ring, cb.color)}>
                        {d.status === "VERIFIED"
                          ? <><CheckCircle2 className="w-3 h-3" /> Verified</>
                          : <><AlertCircle className="w-3 h-3" /> {cb.label}</>}
                      </span>
                      <span className="text-[10px] text-slate-400">{cb.pct}%</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : d.id); setEditForm(d); setSelected(d); }}
                        className="text-xs text-slate-400 hover:text-indigo-600 px-2 py-0.5 border border-slate-200 hover:border-indigo-300 rounded-md transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Sub-fields (always visible when selected) */}
                  {isSelected && (
                    <div className="bg-white border-t border-slate-100 divide-y divide-slate-100">
                      {/* Department */}
                      <SubFieldRow label="Responsible Department" value={
                        isEditing ? (
                          <input
                            value={editForm.department ?? d.department}
                            onChange={(e) => setEditForm(f => ({ ...f, department: e.target.value }))}
                            className="text-xs border border-slate-200 rounded px-2 py-1 w-full focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                          />
                        ) : d.department
                      } verified={d.status === "VERIFIED"} />

                      {/* Deadline */}
                      <SubFieldRow label={d.deadline_text ? "Timeline" : "Due Date"} value={
                        isEditing ? (
                          <input
                            type="date"
                            value={editForm.deadline ? editForm.deadline.split("T")[0] : ""}
                            onChange={(e) => setEditForm(f => ({ ...f, deadline: e.target.value }))}
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                          />
                        ) : (d.deadline_text || formatDate(d.deadline) || "—")
                      } verified={d.status === "VERIFIED"} />

                      {/* Action type */}
                      <SubFieldRow label="Action Type" value={
                        isEditing ? (
                          <select
                            value={editForm.action_type ?? d.action_type}
                            onChange={(e) => setEditForm(f => ({ ...f, action_type: e.target.value }))}
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                          >
                            {["COMPLY","APPEAL","INFORM","MONITOR"].map(t => <option key={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", actionColor(d.action_type))}>
                            {d.action_type}
                          </span>
                        )
                      } verified={d.status === "VERIFIED"} />

                      {/* Appeal limitation */}
                      {d.limitation_days != null && (
                        <SubFieldRow
                          label="Appeal Limitation"
                          value={`${d.limitation_days} days from ${formatDate(caseData.judgment_date)}`}
                          verified={d.status === "VERIFIED"}
                          warn={d.limitation_days < 30}
                        />
                      )}

                      {/* Approve / Reject buttons */}
                      {d.status === "PENDING_REVIEW" && (
                        <div className="px-4 py-3 flex items-center gap-2 bg-slate-50/50">
                          {isEditing && (
                            <textarea
                              rows={2}
                              placeholder="Reviewer notes…"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-400 focus:outline-none resize-none"
                            />
                          )}
                          <button
                            onClick={() => handleDecide(d, "approve")}
                            disabled={submitting}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleDecide(d, "reject")}
                            disabled={submitting}
                            className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Confidence legend */}
            <div className="flex items-center gap-4 pt-4 pb-2 text-[10px] text-slate-500 border-t border-slate-100 mt-4">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> High (&gt;=80%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Medium (50-79%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Low (&lt;50%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Not Extracted</span>
            </div>
          </div>
        </div>

        {/* ── COLUMN 3: Right Panel ── */}
        <div className="w-[280px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Action Plan Summary */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">
                Action Plan Summary
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <SummaryCard label="Total Directions" value={summary?.total_directives ?? 0} accent="indigo" />
                <SummaryCard label="To Departments"   value={summary?.to_departments    ?? 0} accent="violet" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <SummaryCard label="Comply"  value={summary?.comply_count  ?? 0} accent="emerald" small />
                <SummaryCard label="Appeal"  value={summary?.appeal_count  ?? 0} accent="orange"  small />
                <SummaryCard label="Inform"  value={summary?.inform_count  ?? 0} accent="blue"    small />
              </div>
            </div>

            {/* Deadlines */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Deadlines</h3>
                <Link href="/calendar" className="text-[10px] text-indigo-600 hover:underline">View Calendar</Link>
              </div>
              <div className="space-y-2">
                {caseData.directives
                  .filter((d) => d.deadline)
                  .slice(0, 3)
                  .map((d) => {
                    const days = daysUntil(d.deadline);
                    const onTrack = days === null || days > 14;
                    return (
                      <div key={d.id} className="flex items-start gap-2">
                        <div className={cn("mt-1 w-2 h-2 rounded-full shrink-0", onTrack ? "bg-emerald-500" : "bg-red-500")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700 truncate">{d.department}</p>
                          <p className="text-[10px] text-slate-400">Due: {formatDate(d.deadline)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {days !== null && (
                            <p className="text-[10px] text-slate-500">in {days}d</p>
                          )}
                          <p className={cn("text-[10px] font-semibold", onTrack ? "text-emerald-600" : "text-red-600")}>
                            {onTrack ? "On Track" : "Overdue"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                {caseData.directives.filter(d => d.deadline).length === 0 && (
                  <p className="text-xs text-slate-400">No deadlines extracted</p>
                )}
              </div>
            </div>

            {/* Audit Trail */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Audit Trail</h3>
                <Link href="/audit" className="text-[10px] text-indigo-600 hover:underline">View All</Link>
              </div>
              <div className="space-y-3">
                {auditLogs.length === 0 && (
                  <p className="text-xs text-slate-400">No audit entries yet</p>
                )}
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] font-bold shrink-0">
                      {log.user_id ? initials : "S"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700 leading-tight">
                        {log.user_id ? user?.name : "System"}
                        <span className="font-normal text-slate-400 ml-1">
                          ({log.user_id ? user?.role : "AI Extractor"})
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-600 leading-tight mt-0.5 line-clamp-2">
                        {log.event.replace(/_/g, " ").toLowerCase()}
                        {log.details && typeof log.details === "object" && "notes" in log.details
                          ? ` — ${log.details.notes}` : ""}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Export</h3>
              <div className="space-y-2">
                <a
                  href={api.cases.exportActionPlan(id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2.5 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg text-xs text-slate-700 hover:text-indigo-700 transition-all group"
                >
                  <Download className="w-3.5 h-3.5 group-hover:text-indigo-600" />
                  Export Verified Action Plan
                </a>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2.5 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg text-xs text-slate-700 hover:text-indigo-700 transition-all group"
                  >
                    <ExternalLink className="w-3.5 h-3.5 group-hover:text-indigo-600" />
                    Export PDF
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all",
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function FieldRow({
  label, value, confidence, icon: Icon,
}: {
  label: string; value: string; confidence: number; icon: React.ElementType;
}) {
  const cb = confBadge(confidence);
  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-xl mb-2 bg-white hover:bg-slate-50 transition-colors">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 font-medium truncate">{value || "—"}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1", cb.ring, cb.color)}>
          <CheckCircle2 className="w-3 h-3" /> {cb.label}
        </span>
        <span className="text-[10px] text-slate-400">{cb.pct}%</span>
        <button className="text-[10px] text-slate-400 hover:text-indigo-600 px-2 py-0.5 border border-slate-200 hover:border-indigo-300 rounded-md transition-colors">
          Edit
        </button>
      </div>
    </div>
  );
}

function SubFieldRow({
  label, value, verified, warn,
}: {
  label: string; value: React.ReactNode; verified: boolean; warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-28 shrink-0">{label}</p>
      <div className="flex-1 text-xs text-slate-700">{value}</div>
      <span className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0",
        verified
          ? "text-emerald-600 bg-emerald-50 border-emerald-200"
          : warn
          ? "text-red-600 bg-red-50 border-red-200"
          : "text-amber-600 bg-amber-50 border-amber-200"
      )}>
        {verified ? <><CheckCircle2 className="w-3 h-3" />Verified</> : "Review"}
      </span>
      <button className="text-[10px] text-slate-400 hover:text-indigo-600 px-2 py-0.5 border border-slate-200 hover:border-indigo-300 rounded-md transition-colors ml-1">
        Edit
      </button>
    </div>
  );
}

const accentMap: Record<string, string> = {
  indigo:  "text-indigo-700  bg-indigo-50  border-indigo-200",
  violet:  "text-violet-700  bg-violet-50  border-violet-200",
  emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
  orange:  "text-orange-700  bg-orange-50  border-orange-200",
  blue:    "text-blue-700    bg-blue-50    border-blue-200",
};

function SummaryCard({
  label, value, accent, small,
}: {
  label: string; value: number; accent: string; small?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-3 text-center", accentMap[accent] ?? "text-slate-700 bg-slate-50 border-slate-200")}>
      <p className={cn("font-bold", small ? "text-xl" : "text-2xl")}>{value}</p>
      <p className="text-[10px] font-medium opacity-80 leading-tight mt-0.5">{label}</p>
    </div>
  );
}
