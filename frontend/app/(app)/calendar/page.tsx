"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, AlertTriangle, Clock, CheckCircle, RefreshCw } from "lucide-react";
import { api, StatsResponse } from "@/lib/api";
import { formatDate, daysUntil, cn } from "@/lib/utils";

type DeadlineItem = StatsResponse["upcoming_deadlines"][number];

export default function ActionCalendarPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.cases.stats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const deadlines = stats?.upcoming_deadlines ?? [];

  // Group by urgency
  const overdue = deadlines.filter((d) => { const x = daysUntil(d.deadline); return x !== null && x < 0; });
  const thisWeek = deadlines.filter((d) => { const x = daysUntil(d.deadline); return x !== null && x >= 0 && x <= 7; });
  const thisMonth = deadlines.filter((d) => { const x = daysUntil(d.deadline); return x !== null && x > 7 && x <= 30; });
  const upcoming = deadlines.filter((d) => { const x = daysUntil(d.deadline); return x !== null && x > 30; });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Action Calendar</h1>
            <p className="text-slate-500 text-xs">
              {loading ? "Loading…" : `${deadlines.length} upcoming deadline${deadlines.length !== 1 ? "s" : ""}`}
            </p>
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

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Loading deadlines…
          </div>
        ) : deadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No deadlines found</p>
            <p className="text-slate-400 text-sm mt-1">Deadlines appear here once cases are ingested</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-4 gap-4">
              <SummaryChip label="Overdue" count={overdue.length} color="red" icon={AlertTriangle} />
              <SummaryChip label="This Week" count={thisWeek.length} color="orange" icon={Clock} />
              <SummaryChip label="This Month" count={thisMonth.length} color="amber" icon={Calendar} />
              <SummaryChip label="Later" count={upcoming.length} color="emerald" icon={CheckCircle} />
            </div>

            {/* Groups */}
            {overdue.length > 0 && (
              <DeadlineGroup
                title="Overdue"
                items={overdue}
                headerClass="bg-red-50 border-red-200 text-red-800"
                dotClass="bg-red-500"
              />
            )}
            {thisWeek.length > 0 && (
              <DeadlineGroup
                title="Due This Week"
                items={thisWeek}
                headerClass="bg-orange-50 border-orange-200 text-orange-800"
                dotClass="bg-orange-500"
              />
            )}
            {thisMonth.length > 0 && (
              <DeadlineGroup
                title="Due This Month"
                items={thisMonth}
                headerClass="bg-amber-50 border-amber-200 text-amber-800"
                dotClass="bg-amber-400"
              />
            )}
            {upcoming.length > 0 && (
              <DeadlineGroup
                title="Upcoming (30+ days)"
                items={upcoming}
                headerClass="bg-slate-50 border-slate-200 text-slate-700"
                dotClass="bg-emerald-500"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryChip({
  label, count, color, icon: Icon,
}: { label: string; count: number; color: string; icon: React.ElementType }) {
  const styles: Record<string, string> = {
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", styles[color])}>
      <Icon className="w-5 h-5 shrink-0" />
      <div>
        <p className="text-2xl font-bold leading-tight">{count}</p>
        <p className="text-xs font-medium">{label}</p>
      </div>
    </div>
  );
}

function DeadlineGroup({
  title, items, headerClass, dotClass,
}: { title: string; items: DeadlineItem[]; headerClass: string; dotClass: string }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      <div className={cn("px-4 py-2.5 border-b text-sm font-semibold", headerClass)}>
        {title} <span className="ml-2 font-normal opacity-70">({items.length})</span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item, i) => {
          const days = daysUntil(item.deadline);
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.department}</p>
                  {item.action_type && (
                    <span className={cn(
                      "shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                      item.action_type === "COMPLY" ? "bg-emerald-100 text-emerald-700" :
                      item.action_type === "APPEAL" ? "bg-red-100 text-red-700" :
                      item.action_type === "INFORM" ? "bg-blue-100 text-blue-700" :
                      "bg-violet-100 text-violet-700"
                    )}>{item.action_type}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">Case: {item.case_number}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-slate-700">{formatDate(item.deadline)}</p>
                <p className="text-[10px] text-slate-400">
                  {days === null ? "—" : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `in ${days}d`}
                </p>
              </div>
              <Link
                href={`/cases/${item.case_id}/review`}
                className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                View →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
