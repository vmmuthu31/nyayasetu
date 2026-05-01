"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, Edit2, ChevronLeft, AlertTriangle,
  Calendar, Building2, Tag, FileText, User, ShieldCheck,
} from "lucide-react";
import { api, CaseDetail, Directive } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [selected, setSelected] = useState<Directive | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Directive>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    api.cases.get(id).then((c) => {
      setCaseData(c);
      const first = c.directives.find((d) => d.status === "PENDING_REVIEW") ?? c.directives[0];
      if (first) { setSelected(first); setEditForm(first); }
      setLoading(false);
    });
  }, [id]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDecide = async (decision: "approve" | "reject") => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.review.decide(
        selected.id,
        decision,
        editing ? {
          action_type: editForm.action_type,
          department: editForm.department,
          deadline: editForm.deadline ?? undefined,
        } : undefined,
        notes || undefined,
      );
      showToast(`Directive ${decision === "approve" ? "approved" : "rejected"} successfully`, "success");
      // Refresh
      const updated = await api.cases.get(id);
      setCaseData(updated);
      const next = updated.directives.find((d) => d.status === "PENDING_REVIEW");
      setSelected(next ?? updated.directives[0] ?? null);
      if (next) { setEditForm(next); }
      setEditing(false);
      setNotes("");
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!caseData) return <div className="p-6 text-slate-500">Case not found</div>;

  const pending = caseData.directives.filter((d) => d.status === "PENDING_REVIEW").length;

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-4">
        <button onClick={() => router.push("/cases")} className="text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-slate-900 truncate">{caseData.case_number}</h1>
          <p className="text-xs text-slate-500">{caseData.court} · {caseData.petitioners}</p>
        </div>
        <Badge value={caseData.status} />
        <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
          {pending} pending
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2",
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Directive List */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Directives</p>
          </div>
          <ul>
            {caseData.directives.map((d) => (
              <li
                key={d.id}
                onClick={() => { setSelected(d); setEditForm(d); setEditing(false); }}
                className={cn(
                  "px-4 py-3 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors",
                  selected?.id === d.id && "bg-blue-50 border-l-2 border-l-blue-600"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-700 line-clamp-2 flex-1">{d.text}</p>
                  {d.is_ambiguous && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge value={d.status} />
                  <span className="text-xs text-slate-400">{Math.round(d.confidence_score * 100)}%</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Center: Judgment Text Viewer */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Directive Text</p>
            </div>
            {selected ? (
              <>
                {selected.is_ambiguous && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span><strong>Ambiguous:</strong> {selected.ambiguity_reason || "Human review required"}</span>
                  </div>
                )}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 text-sm text-slate-800 leading-relaxed font-serif">
                  {selected.text}
                </div>
                {selected.page_number && (
                  <p className="text-xs text-slate-400 mt-2">Page {selected.page_number}</p>
                )}

                {/* Case metadata */}
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <InfoRow icon={Building2} label="Court" value={caseData.court} />
                  <InfoRow icon={User} label="Petitioners" value={caseData.petitioners} />
                  <InfoRow icon={User} label="Respondents" value={caseData.respondents} />
                  <InfoRow icon={Calendar} label="Judgment Date" value={formatDate(caseData.judgment_date)} />
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Select a directive from the list</p>
            )}
          </div>
        </div>

        {/* Right: Action Form */}
        {selected && (
          <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Action Details</p>
                <button
                  onClick={() => setEditing((e) => !e)}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors",
                    editing
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Edit2 className="w-3 h-3" /> {editing ? "Editing" : "Edit"}
                </button>
              </div>
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">
              {/* Action Type */}
              <FormField label="Action Type" icon={Tag}>
                {editing ? (
                  <select
                    value={editForm.action_type ?? selected.action_type}
                    onChange={(e) => setEditForm({ ...editForm, action_type: e.target.value })}
                    className="form-select w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["COMPLY", "APPEAL", "INFORM", "MONITOR"].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                ) : (
                  <Badge value={selected.action_type} />
                )}
              </FormField>

              {/* Department */}
              <FormField label="Responsible Department" icon={Building2}>
                {editing ? (
                  <input
                    type="text"
                    value={editForm.department ?? selected.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-slate-700">{selected.department}</p>
                )}
              </FormField>

              {/* Deadline */}
              <FormField label="Deadline" icon={Calendar}>
                {editing ? (
                  <input
                    type="date"
                    value={editForm.deadline ? editForm.deadline.split("T")[0] : ""}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-slate-700">{formatDate(selected.deadline)}</p>
                )}
              </FormField>

              {/* Confidence */}
              <FormField label="Confidence Score" icon={ShieldCheck}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", selected.confidence_score >= 0.75 ? "bg-emerald-500" : selected.confidence_score >= 0.5 ? "bg-amber-400" : "bg-red-400")}
                      style={{ width: `${Math.round(selected.confidence_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{selected.confidence_score.toFixed(2)}</span>
                </div>
              </FormField>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Add reviewer notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Reviewer Info */}
              <div className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                <p className="font-semibold text-slate-700">{user?.name}</p>
                <p>{user?.designation}</p>
                <p>{new Date().toLocaleString("en-IN")}</p>
              </div>
            </div>

            {/* Action Buttons */}
            {selected.status === "PENDING_REVIEW" && (
              <div className="px-5 py-4 border-t border-slate-100 space-y-2">
                <button
                  disabled={submitting}
                  onClick={() => handleDecide("approve")}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <div className="flex gap-2">
                  <button
                    disabled={submitting}
                    onClick={() => handleDecide("reject")}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-slate-700 font-medium">{value}</p>
      </div>
    </div>
  );
}

function FormField({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      </div>
      {children}
    </div>
  );
}
