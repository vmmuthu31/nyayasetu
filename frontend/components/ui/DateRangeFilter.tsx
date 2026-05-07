"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

type DateRangeValue = {
  startDate: string;
  endDate: string;
};

export function DateRangeFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = useMemo(() => {
    if (value.startDate && value.endDate) {
      return `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`;
    }
    if (value.startDate) {
      return `From ${formatDate(value.startDate)}`;
    }
    if (value.endDate) {
      return `Until ${formatDate(value.endDate)}`;
    }
    return label;
  }, [label, value.endDate, value.startDate]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-[52px] w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-600 shadow-sm"
      >
        <CalendarDays className="h-4 w-4 text-slate-400" />
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full min-w-[270px] rounded-xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]">
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Start Date
              <input
                type="date"
                value={value.startDate}
                onChange={(event) => onChange({ ...value, startDate: event.target.value })}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              End Date
              <input
                type="date"
                value={value.endDate}
                onChange={(event) => onChange({ ...value, endDate: event.target.value })}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange({ startDate: "", endDate: "" });
                setOpen(false);
              }}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
