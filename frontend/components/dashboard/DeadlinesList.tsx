"use client";

import Link from "next/link";
import { daysUntil, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DeadlineItem {
  case_number: string;
  department: string;
  deadline: string;
  case_id: string;
}

export function DeadlinesList({ deadlines }: { deadlines: DeadlineItem[] }) {
  if (deadlines.length === 0) {
    return <p className="text-slate-400 text-sm py-4 text-center">No upcoming deadlines</p>;
  }

  return (
    <ul className="space-y-3">
      {deadlines.map((d, i) => {
        const days = daysUntil(d.deadline);
        const urgent = days <= 7;
        const warning = days <= 30;
        return (
          <li key={i} className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
            <div>
              <Link href={`/cases/${d.case_id}`} className="text-sm font-medium text-blue-700 hover:underline">
                {d.department}
              </Link>
              <p className="text-xs text-slate-500">(Case: {d.case_number})</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-600">{formatDate(d.deadline)}</p>
              <span className={cn(
                "text-xs font-semibold",
                urgent ? "text-red-600" : warning ? "text-amber-600" : "text-emerald-600"
              )}>
                {days <= 0 ? "Overdue" : `${days} days left`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
