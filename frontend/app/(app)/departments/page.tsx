"use client";

/**
 * Department-wise Action Plan Dashboard
 * Shows ONLY verified directives — trusted view for decision-makers.
 * Per problem statement: "Display only approved action plans."
 */
import { useEffect, useState } from "react";
import { Building2, ChevronRight, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { api, DeptSummary, DeptAction } from "@/lib/api";
import { daysUntil, formatDate, cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  COMPLY:  "bg-emerald-100 text-emerald-700",
  APPEAL:  "bg-violet-100 text-violet-700",
  INFORM:  "bg-sky-100 text-sky-700",
  MONITOR: "bg-slate-100 text-slate-600",
};

export default function DepartmentsPage() {
  const [summaries, setSummaries]       = useState<DeptSummary[]>([]);
  const [selected, setSelected]         = useState<string | null>(null);
  const [actions, setActions]           = useState<DeptAction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const loadSummary = () => {
    setLoading(true);
    api.departments.summary()
      .then((d) => {
        setSummaries(d);
        if (d.length > 0 && !selected) setSelected(d[0].department);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSummary(); }, []);

  useEffect(() => {
    if (!selected) return;
    setActionsLoading(true);
    api.departments.actions(selected)
      .then(setActions)
      .catch(() => setActions([]))
      .finally(() => setActionsLoading(false));
  }, [selected]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Department Action Plans</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            Showing <strong className="text-slate-700 mx-1">verified records only</strong> — trusted view for decision-makers
          </p>
        </div>
        <button
          onClick={loadSummary}
          className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-5 items-start">
        {/* Left: Department list */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {loading ? (
            <div className="card p-8 flex justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : summaries.length === 0 ? (
            <div className="card p-6 text-center text-slate-400 text-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              No verified action plans yet.<br />
              <span className="text-xs">Review and approve directives first.</span>
            </div>
          ) : summaries.map((s) => {
            const urgent  = s.days_until_deadline !== null && s.days_until_deadline <= 7;
            const warning = s.days_until_deadline !== null && s.days_until_deadline <= 30;
            const active  = selected === s.department;
            return (
              <button
                key={s.department}
                onClick={() => setSelected(s.department)}
                className={cn(
                  "w-full text-left card p-4 hover:border-blue-300 transition-colors",
                  active && "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-slate-800 leading-tight">{s.department}</span>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 flex-shrink-0 mt-0.5 text-slate-300", active && "text-blue-500")} />
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{s.total} action{s.total !== 1 ? "s" : ""}</span>
                  {s.earliest_deadline && (
                    <span className={cn("font-semibold", urgent ? "text-red-600" : warning ? "text-amber-600" : "text-slate-400")}>
                      {s.days_until_deadline !== null && s.days_until_deadline <= 0
                        ? "⚠ Overdue"
                        : `${s.days_until_deadline}d left`}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex gap-1 flex-wrap">
                  {Object.entries(s.by_action)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => (
                      <span key={k} className={cn("text-xs px-1.5 py-0.5 rounded font-medium", ACTION_COLORS[k])}>
                        {v} {k}
                      </span>
                    ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Action details table */}
        <div className="flex-1 card overflow-hidden">
          {!selected ? (
            <div className="p-10 text-center text-slate-400 text-sm">Select a department</div>
          ) : actionsLoading ? (
            <div className="p-10 flex justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : actions.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              No verified actions for <strong>{selected}</strong>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{selected}</p>
                <span className="text-xs text-slate-400">{actions.length} verified directive{actions.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Case No.", "Action Required", "Directive (Summary)", "Judgment Date", "Deadline", "Confidence"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {actions.map((a) => {
                      const days   = a.deadline ? daysUntil(a.deadline) : null;
                      const urgent  = days !== null && days <= 7;
                      const warning = days !== null && days <= 30;
                      return (
                        <tr key={a.directive_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">{a.case_number}</td>
                          <td className="px-4 py-3">
                            <span className={cn("badge whitespace-nowrap", ACTION_COLORS[a.action_type])}>{a.action_type}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 max-w-xs">
                            <p className="line-clamp-2" title={a.directive_text}>{a.directive_text}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(a.judgment_date)}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <p className={cn("font-medium", urgent ? "text-red-600" : warning ? "text-amber-600" : "text-slate-700")}>
                              {formatDate(a.deadline)}
                            </p>
                            {days !== null && (
                              <p className={cn("text-xs", urgent ? "text-red-500 font-semibold" : warning ? "text-amber-500" : "text-slate-400")}>
                                {days <= 0 ? "⚠ Overdue" : `${days} days left`}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full", a.confidence_score >= 0.75 ? "bg-emerald-500" : a.confidence_score >= 0.5 ? "bg-amber-400" : "bg-red-400")}
                                  style={{ width: `${Math.round(a.confidence_score * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">{Math.round(a.confidence_score * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
