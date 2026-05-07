"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
} from "lucide-react";
import { api, StatsResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type DeadlineItem = StatsResponse["upcoming_deadlines"][number];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const EVENT_STYLES: Record<string, string> = {
  COMPLY: "border-teal-200 bg-teal-50 text-teal-700",
  APPEAL: "border-violet-200 bg-violet-50 text-violet-700",
  INFORM: "border-blue-200 bg-blue-50 text-blue-700",
  MONITOR: "border-orange-200 bg-orange-50 text-orange-700",
};

export default function ActionCalendarPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.cases
      .stats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const deadlines = useMemo(() => stats?.upcoming_deadlines ?? [], [stats]);
  const monthCells = useMemo(() => buildMonthCells(viewDate), [viewDate]);
  const eventsByDay = useMemo(
    () => groupDeadlinesByDay(deadlines),
    [deadlines],
  );
  const todayKey = toDateKey(new Date());
  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const moveMonth = (amount: number) => {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  };

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">
            Action Calendar
          </h1>
          <p className="mt-3 text-[15px] text-slate-500">
            Schedule and track departmental actions and deadlines.
          </p>
        </header>

        <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewDate(new Date())}
              className="h-11 rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50"
            >
              Today
            </button>
            <IconButton label="Previous month" onClick={() => moveMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
            <IconButton label="Next month" onClick={() => moveMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </IconButton>
            <IconButton label="Jump forward" onClick={() => moveMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </IconButton>
            <button
              type="button"
              className="ml-3 inline-flex h-11 items-center gap-3 rounded-md px-2 text-[20px] font-semibold text-slate-950"
            >
              {monthLabel}
              <ChevronDown className="h-4 w-4 text-slate-300" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="grid h-11 grid-cols-3 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              {["Month", "Week", "List"].map((label) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50",
                    label === "Month" &&
                      "border border-indigo-100 text-indigo-600 shadow-sm",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-r border-slate-200 py-1 text-center text-xs font-bold text-slate-500 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthCells.map((cell) => {
              const dayEvents = eventsByDay.get(cell.key) ?? [];
              return (
                <div
                  key={cell.key}
                  className="relative min-h-[114px] border-r border-b border-slate-200 bg-white p-3 last:border-r-0"
                >
                  <div className="flex justify-center">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-[17px] font-semibold",
                        cell.inMonth ? "text-slate-700" : "text-slate-300",
                        cell.key === todayKey &&
                          "bg-indigo-600 text-white shadow-[0_6px_12px_rgba(79,70,229,0.25)]",
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <Link
                        key={`${event.case_id}-${event.deadline}-${event.action_type}`}
                        href={`/cases/${event.case_id}/review`}
                        className={cn(
                          "mx-auto flex max-w-[170px] items-center gap-1.5 truncate rounded-md border px-2 py-1 text-xs font-semibold shadow-sm transition hover:brightness-95",
                          EVENT_STYLES[event.action_type ?? ""] ??
                            "border-slate-200 bg-slate-50 text-slate-600",
                        )}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
                        <span className="truncate">{eventLabel(event)}</span>
                      </Link>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-center text-[11px] font-semibold text-slate-400">
                        +{dayEvents.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 border-t border-slate-100 py-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading deadlines
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600"
    >
      {children}
    </button>
  );
}

function buildMonthCells(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      inMonth: date.getMonth() === month,
    };
  });
}

function groupDeadlinesByDay(items: DeadlineItem[]) {
  const grouped = new Map<string, DeadlineItem[]>();
  for (const item of items) {
    const key = toDateKey(new Date(item.deadline));
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  return grouped;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eventLabel(item: DeadlineItem) {
  if (item.action_type === "COMPLY") return "Submit Compliance Report";
  if (item.action_type === "APPEAL") return "File Affidavit";
  if (item.action_type === "INFORM") return "Progress Update";
  if (item.action_type === "MONITOR") return "Action Plan Due";
  return item.department || item.case_number;
}
