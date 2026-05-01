"use client";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  VERIFIED:       "bg-emerald-100 text-emerald-800",
  ACTIONED:       "bg-blue-100 text-blue-800",
  APPEALED:       "bg-violet-100 text-violet-800",
  REJECTED:       "bg-red-100 text-red-800",
  COMPLY:         "bg-emerald-100 text-emerald-800",
  APPEAL:         "bg-violet-100 text-violet-800",
  INFORM:         "bg-sky-100 text-sky-800",
  MONITOR:        "bg-slate-100 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pending Review",
  VERIFIED:       "Verified",
  ACTIONED:       "Actioned",
  APPEALED:       "Appealed",
  REJECTED:       "Rejected",
  COMPLY:         "Comply",
  APPEAL:         "Appeal",
  INFORM:         "Inform",
  MONITOR:        "Monitor",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("badge", STATUS_STYLES[value] ?? "bg-slate-100 text-slate-700", className)}>
      {STATUS_LABELS[value] ?? value}
    </span>
  );
}
