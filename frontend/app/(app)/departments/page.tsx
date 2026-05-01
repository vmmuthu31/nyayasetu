"use client";

/**
 * Department-wise Action Plan Dashboard
 * Shows ONLY verified directives — trusted view for decision-makers.
 * Per the problem statement: "Display only approved action plans."
 */
import { useEffect, useState } from "react";
import { Building2, ChevronRight, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { daysUntil, formatDate, cn } from "@/lib/utils";

interface DeptSummary {
  department: string;
  total: number;
  by_action: { COMPLY: number; APPEAL: number; INFORM: number; MONITOR: number };
  earliest_deadline: string | null;
  days_until_deadline: number | null;
}

interface DeptAction {
  directive_id: string;
  case_id: string;
  case_number: string;
  court: string;
  judgment_date: string | null;
  directive_text: string;
  action_type: string;
  department: string;
  deadline: string | null;
  confidence_score: number;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

async function fetchDeptSummary(): Promise<DeptSummary[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("ns_token") : null;
  const res = await fetch(`${BASE}/departments/summary`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to load department summary");
  return res.json();
}

async function fetchDeptActions(dept: string): Promise<DeptAction[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("ns_token") : null;
  const res = await fetch(`${BASE}/departments/actions?department=${encodeURIComponent(dept)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to load department actions");
  return res.json();
}

const ACTION_COLORS: Record<string, string> = {
  COMPLY: "bg-emerald-100 text-emerald-700",
  APPEAL: "bg-violet-100 text-violet-700",
  INFORM: "bg-sky-100 text-sky-700",
  MONITOR: "bg-slate-100 text-slate-600",
};

export default function DepartmentsPage() {
  const [summaries, setSummaries] = useState<DeptSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [actions, setActions] = useState<DeptAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeptSummary()
      .then((d) => { setSummaries(d); if (d.length > 0) setSelected(d[0].department); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setActionsLoading(true);
    fetchDeptActions(selected)
      .then(setActions)
      .catch(() => setActions([]))
      .finally(() => setActionsLoading(false));
  }, [selected]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Department Action Plans</h1>
        <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          Showing <strong>verified records only</strong> — trusted view for decision-makers
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-5">
        {/* Left: Department list */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {loading ? (
            <div className="card p-8 flex justify-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : summaries.length === 0 ? (
            <div className="card p-6 text-center text-slate-400 text-sm">
              No verified action plans yet.<br />Review and approve cases first.
            </div>
          ) : summaries.map((s) => {
            const urgent = s.days_until_deadline !== null && s.days_until_deadline <= 7;
            const warning = s.days_until_deadline !== null && s.days_until_deadline <= 30;
            return (
              <button
                key={s.department}
                onClick={() => setSelected(s.department)}
                className={cn(
                  "w-full text-left card p-4 hover:border-blue-300 transition-colors",
                  selected === s.department && "border-blue-500 bg-blue-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-slate-800 leading-tight">{s.department}</span>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 flex-shrink-0 mt-0.5 text-slate-300", selected === s.department && "text-blue-500")} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span>{s.total} action{s.total !== 1 ? "s" : ""}</span>
                  {s.earliest_deadline && (
                    <span className={cn("font-medium", urgent ? "text-red-600" : warning ? "text-amber-600" : "text-slate-500")}>
                      {s.days_until_deadline !== null && s.days_until_deadline <= 0
                        ? "⚠ Overdue"
                        : `${s.days_until_deadline}d deadline`}
                    </span>
                  )}
                </div>
                {/* Mini action breakdown */}
                <div className="mt-2 flex gap-1 flex-wrap">
                  {Object.entries(s.by_action).filter(([, v]) => v > 0).map(([k, v]) => (
                    <span key={k} className={cn("text-xs px-1.5 py-0.5 rounded font-medium", ACTION_COLORS[k])}>
                      {v} {k}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Action details */}
        <div className="flex-1 card overflow-hidden">
          {!selected ? (
            <div className="p-10 text-center text-slate-400 text-sm">Select a department</div>
          ) : actionsLoading ? (
            <div className="p-10 flex justify-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : actions.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No verified actions for this department</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Case No.", "Court", "Action Required", "Directive", "Deadline", "Confidence"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map((a) => {
                  const days = a.deadline ? daysUntil(a.deadline) : null;
                  const urgent = days !== null && days <= 7;
                  const warning = days !== null && days <= 30;
                  return (
                    <tr key={a.directive_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{a.case_number}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-28 truncate">{a.court}</td>
                      <td className="px-4 py-3">
                        <span className={cn("badge", ACTION_COLORS[a.action_type])}>{a.action_type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-56 truncate" title={a.directive_text}>
                        {a.directive_text}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className={cn("font-medium", urgent ? "text-red-600" : warning ? "text-amber-600" : "text-slate-600")}>
                          {formatDate(a.deadline)}
                        </div>
                        {days !== null && (
                          <div className="text-slate-400">
                            {days <= 0 ? "Overdue" : `${days}d left`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {Math.round(a.confidence_score * 100)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
