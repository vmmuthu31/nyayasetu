"use client";

import { useEffect, useState } from "react";
import { Building2, RefreshCw, Search, CheckCircle, AlertTriangle, Gavel, Eye } from "lucide-react";
import Link from "next/link";
import { api, DeptSummary } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  COMPLY: "text-emerald-600 bg-emerald-50",
  APPEAL: "text-red-600 bg-red-50",
  INFORM: "text-blue-600 bg-blue-50",
  MONITOR: "text-violet-600 bg-violet-50",
};

export default function AdminDepartmentsPage() {
  const [depts, setDepts] = useState<DeptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.departments.summary()
      .then(setDepts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = depts.filter((d) =>
    !search || d.department.toLowerCase().includes(search.toLowerCase())
  );

  const totalDirectives = depts.reduce((s, d) => s + d.total, 0);
  const critical = depts.filter((d) => d.days_until_deadline !== null && d.days_until_deadline <= 7).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Department Management</h1>
            <p className="text-slate-500 text-xs">
              {loading ? "Loading…" : `${filtered.length} department${filtered.length !== 1 ? "s" : ""} · ${totalDirectives} total directives`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Summary strips */}
        {!loading && depts.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-3">
              <Building2 className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold text-indigo-700">{depts.length}</p>
                <p className="text-xs text-indigo-600 font-medium">Active Departments</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-slate-700">{totalDirectives}</p>
                <p className="text-xs text-slate-500 font-medium">Total Directives</p>
              </div>
            </div>
            <div className={cn(
              "rounded-xl border px-4 py-3 flex items-center gap-3",
              critical > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
            )}>
              <AlertTriangle className={cn("w-5 h-5", critical > 0 ? "text-red-500" : "text-emerald-500")} />
              <div>
                <p className={cn("text-2xl font-bold", critical > 0 ? "text-red-700" : "text-emerald-700")}>{critical}</p>
                <p className={cn("text-xs font-medium", critical > 0 ? "text-red-600" : "text-emerald-600")}>Critical Deadlines (≤7d)</p>
              </div>
            </div>
          </div>
        )}

        {/* Department cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Loading departments…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No departments found</p>
            <p className="text-slate-400 text-sm mt-1">Departments appear here once cases are ingested with directives</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((dept) => {
              const isUrgent = dept.days_until_deadline !== null && dept.days_until_deadline <= 7;
              return (
                <div key={dept.department} className={cn(
                  "bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow",
                  isUrgent ? "border-red-200" : "border-slate-200"
                )}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{dept.department}</h3>
                    </div>
                    <span className="shrink-0 text-lg font-bold text-slate-700">{dept.total}</span>
                  </div>

                  {/* Action type breakdown */}
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {(["COMPLY", "APPEAL", "INFORM", "MONITOR"] as const).map((action) => (
                      <div key={action} className={cn("text-center py-1 rounded-lg", ACTION_COLORS[action])}>
                        <p className="text-sm font-bold">{dept.by_action[action]}</p>
                        <p className="text-[9px] font-medium uppercase tracking-wide">{action[0]}</p>
                      </div>
                    ))}
                  </div>

                  {/* Deadline */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    {dept.earliest_deadline ? (
                      <div className="flex items-center gap-1.5">
                        {isUrgent
                          ? <AlertTriangle className="w-3 h-3 text-red-500" />
                          : <Gavel className="w-3 h-3 text-slate-400" />
                        }
                        <span className={cn("text-xs font-medium", isUrgent ? "text-red-600" : "text-slate-500")}>
                          {formatDate(dept.earliest_deadline)}
                          {dept.days_until_deadline !== null && (
                            <span className="ml-1 opacity-70">({dept.days_until_deadline}d)</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">No deadline set</span>
                    )}
                    <Link
                      href={`/departments`}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <Eye className="w-3 h-3" /> View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
