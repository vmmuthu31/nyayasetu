"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { ActionPlan, ActionPlanStatus, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/rbac";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: ""; label: string } | { value: ActionPlanStatus; label: string }> = [
  { value: "", label: "All Status" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "AWAITING_REVIEW", label: "Awaiting Review" },
  { value: "REOPENED", label: "Reopened" },
];

const PRIORITY_OPTIONS = ["All Priority", "High", "Medium", "Low"] as const;

export default function DepartmentActionPlansPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ActionPlanStatus | "">("");
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>("All Priority");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.actionPlans.myDepartment({ limit: 200 });
        setPlans(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const filteredPlans = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return plans.filter((plan) => {
      const matchesSearch =
        !needle ||
        plan.case_number.toLowerCase().includes(needle) ||
        plan.directive_text.toLowerCase().includes(needle) ||
        plan.assigned_department.toLowerCase().includes(needle);
      const matchesStatus =
        !status ||
        plan.status === status ||
        (status === "OVERDUE" && priorityForPlan(plan) === "High" && plan.status !== "COMPLETED");
      const planPriority = priorityForPlan(plan);
      const matchesPriority = priority === "All Priority" || planPriority === priority;
      const dueTime = plan.due_date ? new Date(plan.due_date).getTime() : Number.NaN;
      const afterStart =
        !dateRange.startDate || !Number.isFinite(dueTime) || dueTime >= new Date(dateRange.startDate).getTime();
      const beforeEnd =
        !dateRange.endDate || !Number.isFinite(dueTime) || dueTime <= new Date(`${dateRange.endDate}T23:59:59`).getTime();
      return matchesSearch && matchesStatus && matchesPriority && afterStart && beforeEnd;
    });
  }, [dateRange.endDate, dateRange.startDate, plans, priority, search, status]);

  return (
    <main className="h-full overflow-y-auto bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-8 py-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[30px] font-semibold leading-tight text-slate-950">Department Action Plans</h1>
            <p className="mt-3 text-[15px] text-slate-500">
              Operational workspace for department officers to search, filter, and execute court compliance directives.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Role: {user?.role ?? "Unknown"}
            <div>{can(user, "update_compliance") ? "Can update compliance workflow" : "Read-only review access"}</div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_190px_190px_280px_auto]">
          <div className="relative h-[52px] rounded-md border border-slate-200 bg-white shadow-sm">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case title or directive"
              className="h-full w-full rounded-md bg-transparent pl-12 pr-4 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <SelectShell value={labelForStatus(status)}>
            <select value={status} onChange={(event) => setStatus(event.target.value as ActionPlanStatus | "")} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SelectShell>

          <SelectShell value={priority}>
            <select value={priority} onChange={(event) => setPriority(event.target.value as (typeof PRIORITY_OPTIONS)[number])} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </SelectShell>

          <DateRangeFilter label="Due date range" value={dateRange} onChange={setDateRange} />

          <button
            type="button"
            onClick={() => downloadWorkspaceCsv(filteredPlans)}
            className="inline-flex h-[52px] items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Export
          </button>
        </section>

        {error ? (
          <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full table-fixed text-left">
            <thead className="bg-slate-50">
              <tr>
                {["Case", "Directive", "Assigned Officer", "Due Date", "Status", "Priority", "Actions"].map((heading) => (
                  <th key={heading} className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                    Loading action plans
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                    No action plans found for these filters
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => (
                  <tr key={plan.id} className="text-sm text-slate-600">
                    <td className="w-[16%] px-4 py-5">
                      <div className="font-semibold text-slate-900">{plan.case_number}</div>
                      <div className="mt-1 text-xs text-slate-500">{plan.court}</div>
                    </td>
                    <td className="w-[31%] px-4 py-5 font-medium text-slate-700">
                      <p className="line-clamp-2">{plan.directive_text}</p>
                    </td>
                    <td className="w-[15%] px-4 py-5 font-medium text-slate-500">
                      {plan.assigned_officer_name ?? "Department Officer"}
                    </td>
                    <td className="w-[12%] px-4 py-5 font-medium text-slate-500">{formatShortDate(plan.due_date)}</td>
                    <td className="w-[10%] px-4 py-5">
                      <span className={cn("rounded-md px-3 py-1 text-xs font-bold", badgeTone(plan.status))}>
                        {humanizeStatus(plan.status)}
                      </span>
                    </td>
                    <td className="w-[8%] px-4 py-5 font-semibold text-slate-700">{priorityForPlan(plan)}</td>
                    <td className="w-[8%] px-4 py-5">
                      <Link
                        href={`/action-plan/${plan.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-100 bg-white px-3 text-sm font-bold text-indigo-600 shadow-sm transition hover:border-indigo-100 hover:bg-indigo-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function SelectShell({ children, value }: { children: React.ReactNode; value: string }) {
  return (
    <div className="relative flex h-[52px] items-center justify-between rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm">
      <span className="truncate">{value}</span>
      <ChevronDown className="h-4 w-4 text-slate-400" />
      {children}
    </div>
  );
}

function labelForStatus(value: ActionPlanStatus | "") {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? "All Status";
}

function humanizeStatus(status: ActionPlanStatus) {
  return status.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function badgeTone(status: ActionPlanStatus) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-600";
  if (status === "AWAITING_REVIEW") return "bg-violet-50 text-violet-600";
  if (status === "IN_PROGRESS") return "bg-blue-50 text-blue-600";
  if (status === "ESCALATED" || status === "OVERDUE") return "bg-rose-50 text-rose-600";
  return "bg-amber-50 text-amber-600";
}

function priorityForPlan(plan: ActionPlan) {
  if (!plan.due_date || plan.status === "COMPLETED") return "Low";
  const daysRemaining = Math.ceil((new Date(plan.due_date).getTime() - Date.now()) / 86400000);
  if (plan.status === "ESCALATED" || plan.status === "OVERDUE" || daysRemaining <= 3) return "High";
  if (daysRemaining <= 10) return "Medium";
  return "Low";
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function downloadWorkspaceCsv(plans: ActionPlan[]) {
  const rows = [
    ["Case", "Directive", "Assigned Officer", "Due Date", "Status", "Priority"],
    ...plans.map((plan) => [
      plan.case_number,
      plan.directive_text,
      plan.assigned_officer_name ?? "Department Officer",
      formatShortDate(plan.due_date),
      humanizeStatus(plan.status),
      priorityForPlan(plan),
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "department-action-plans.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
