"use client";

import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, TrendingUp, CheckCircle, Clock, Gavel, Zap, Building2, AlertTriangle } from "lucide-react";
import { api, StatsResponse, DeptSummary } from "@/lib/api";
import { formatDate, daysUntil, cn } from "@/lib/utils";

export default function ReportsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [depts, setDepts] = useState<DeptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.cases.stats(), api.departments.summary()])
      .then(([s, d]) => { setStats(s); setDepts(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const counts = stats?.status_counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const verified = counts.VERIFIED ?? 0;
  const pending = counts.PENDING_REVIEW ?? 0;
  const actioned = counts.ACTIONED ?? 0;
  const appealed = counts.APPEALED ?? 0;

  const verifiedRate = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Reports & Analytics</h1>
            <p className="text-slate-500 text-xs">System-wide performance and compliance overview</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Clock} label="Pending Review" value={pending} sub="awaiting action" color="amber" />
          <KpiCard icon={CheckCircle} label="Verified" value={verified} sub={`${verifiedRate}% completion rate`} color="emerald" />
          <KpiCard icon={Zap} label="Actioned" value={actioned} sub="in execution" color="blue" />
          <KpiCard icon={Gavel} label="Appealed" value={appealed} sub="under legal process" color="violet" />
        </div>

        {/* Compliance rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-800">Overall Verification Rate</h2>
            </div>
            <span className="text-2xl font-bold text-emerald-600">{verifiedRate}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${verifiedRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>0%</span>
            <span>{total} total cases</span>
            <span>100%</span>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" /> Status Breakdown
            </h2>
            <div className="space-y-3">
              {[
                { label: "Pending Review", value: pending, total, color: "bg-amber-400" },
                { label: "Verified", value: verified, total, color: "bg-emerald-500" },
                { label: "Actioned", value: actioned, total, color: "bg-blue-500" },
                { label: "Appealed", value: appealed, total, color: "bg-violet-500" },
                { label: "Rejected", value: counts.REJECTED ?? 0, total, color: "bg-red-400" },
              ].map(({ label, value, color }) => {
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-medium text-slate-800">{value} <span className="text-slate-400">({pct}%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming deadlines summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Deadline Risk Summary
            </h2>
            {loading ? (
              <p className="text-slate-400 text-sm text-center py-6">Loading…</p>
            ) : (stats?.upcoming_deadlines ?? []).length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No upcoming deadlines</p>
            ) : (
              <div className="space-y-2">
                {(stats?.upcoming_deadlines ?? []).slice(0, 6).map((d, i) => {
                  const days = daysUntil(d.deadline);
                  const urgent = days !== null && days <= 7;
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700 truncate">{d.department}</p>
                        <p className="text-[10px] text-slate-400 truncate">{d.case_number}</p>
                      </div>
                      <div className={cn("shrink-0 ml-4 text-xs font-semibold", urgent ? "text-red-600" : "text-slate-500")}>
                        {days === null ? "—" : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Department table */}
        {depts.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">Department-wise Directive Load</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Department", "Total", "Comply", "Appeal", "Inform", "Monitor", "Earliest Deadline"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {depts.map((dept) => (
                  <tr key={dept.department} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-44 truncate">{dept.department}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{dept.total}</td>
                    <td className="px-4 py-3 text-emerald-700">{dept.by_action.COMPLY}</td>
                    <td className="px-4 py-3 text-red-600">{dept.by_action.APPEAL}</td>
                    <td className="px-4 py-3 text-blue-600">{dept.by_action.INFORM}</td>
                    <td className="px-4 py-3 text-violet-600">{dept.by_action.MONITOR}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {dept.earliest_deadline ? (
                        <span className={cn(dept.days_until_deadline !== null && dept.days_until_deadline <= 7 ? "text-red-600 font-semibold" : "")}>
                          {formatDate(dept.earliest_deadline)}
                          {dept.days_until_deadline !== null && (
                            <span className="ml-1 text-[10px]">({dept.days_until_deadline}d)</span>
                          )}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, color,
}: { icon: React.ElementType; label: string; value: number; sub: string; color: string }) {
  const styles: Record<string, { bg: string; text: string; icon: string }> = {
    amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-500" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", icon: "text-violet-500" },
  };
  const s = styles[color];
  return (
    <div className={cn("rounded-xl border p-4", s.bg, "border-" + color + "-200")}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", s.icon)} />
        <span className={cn("text-xs font-medium", s.text)}>{label}</span>
      </div>
      <p className={cn("text-3xl font-bold", s.text)}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
