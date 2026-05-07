"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ActionPlan, api, DeptSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useDepartmentOptions } from "@/lib/use-department-options";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<DeptSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const departmentOptions = useDepartmentOptions(
    summaries.map((item) => item.department),
  );

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.departments.summary();
        setSummaries(data);
        if (data.length > 0) {
          const preferred =
            user?.role === "DEPT_USER"
              ? data.find((item) => item.department === user.department)?.department
              : data[0].department;
          setSelected((current) => current || preferred || data[0].department);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!selected) return;
    void Promise.resolve().then(async () => {
      setActionsLoading(true);
      try {
        const data = await api.actionPlans.myDepartment({
          department: user?.role === "DEPT_USER" ? undefined : selected,
          limit: 100,
        });
        setActions(data);
      } catch {
        setActions([]);
      } finally {
        setActionsLoading(false);
      }
    });
  }, [selected, user]);

  useEffect(() => {
    if (selected) return;
    const fallback =
      user?.role === "DEPT_USER"
        ? user.department
        : departmentOptions[0];
    if (fallback) {
      void Promise.resolve().then(() => setSelected(fallback));
    }
  }, [departmentOptions, selected, user]);

  const selectedSummary = useMemo(
    () => summaries.find((item) => item.department === selected) ?? null,
    [selected, summaries],
  );

  const pendingCount = useMemo(
    () => actions.filter((item) => item.status !== "COMPLETED").length,
    [actions],
  );
  const completedCount = useMemo(
    () => actions.filter((item) => item.status === "COMPLETED").length,
    [actions],
  );
  const compliancePct =
    actions.length === 0
      ? 0
      : Math.round((completedCount / actions.length) * 100);
  const updatedLabel = selectedSummary?.earliest_deadline
    ? formatLongDate(selectedSummary.earliest_deadline)
    : formatLongDate(new Date().toISOString());

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">
            Department View
          </h1>
          <p className="mt-3 text-[15px] text-slate-500">
            Track action plans and compliance status by department.
          </p>
        </header>

        <section className="mt-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <p className="text-sm font-semibold text-slate-700">
              Select Department
            </p>
            <div className="relative flex h-[48px] w-[300px] items-center justify-between rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm">
              <span className="truncate">
                {selected || "Select department"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                disabled={user?.role === "DEPT_USER"}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Select department"
              >
                {departmentOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-400">
            Last updated: {updatedLabel}
          </p>
        </section>

        {error && (
          <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-8 grid grid-cols-4 gap-6">
          <MetricCard label="Total Cases" value={selectedSummary?.total ?? 0} />
          <MetricCard label="Pending Actions" value={pendingCount} />
          <MetricCard label="Completed" value={completedCount} />
          <MetricCard
            label="Compliance %"
            value={`${compliancePct}%`}
            ringValue={compliancePct}
          />
        </section>

        <section className="mt-10">
          <h2 className="text-[20px] font-semibold text-slate-950">
            {user?.role === "DEPT_USER" ? "My Assigned Actions" : "Recent Action Plans"}
          </h2>

          <div className="mt-6 overflow-hidden bg-white">
            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    "CASE",
                    "DIRECTIVE",
                    "DUE DATE",
                    "STATUS",
                    "ACTIONS",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-4 text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading || actionsLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-16 text-center text-sm text-slate-400"
                    >
                      Loading department action plans
                    </td>
                  </tr>
                ) : actions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-16 text-center text-sm text-slate-400"
                    >
                      No action plans available for this department
                    </td>
                  </tr>
                ) : (
                  actions.slice(0, 6).map((item) => (
                    <tr key={item.id} className="text-sm text-slate-600">
                      <td className="w-[22%] px-3 py-5">
                        <p className="font-medium text-slate-800">{item.case_number}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.court}</p>
                      </td>
                      <td className="w-[36%] px-3 py-5 font-medium text-slate-700">
                        <p className="line-clamp-2">{item.directive_text}</p>
                      </td>
                      <td className="w-[16%] px-3 py-5 font-medium text-slate-500">
                        {formatShortDate(item.due_date)}
                      </td>
                      <td className="w-[12%] px-3 py-5">
                        <span
                          className={cn(
                            "rounded-md px-3 py-1 text-xs font-bold",
                            item.status === "COMPLETED" &&
                              "bg-emerald-50 text-emerald-600",
                            item.status === "IN_PROGRESS" &&
                              "bg-blue-50 text-blue-600",
                            item.status === "AWAITING_REVIEW" &&
                              "bg-violet-50 text-violet-600",
                            (item.status === "PENDING" || item.status === "REOPENED") &&
                              "bg-amber-50 text-amber-600",
                            item.status === "ESCALATED" &&
                              "bg-rose-50 text-rose-600",
                          )}
                        >
                          {labelForStatus(item.status)}
                        </span>
                      </td>
                      <td className="w-[14%] px-3 py-5">
                        <Link
                          href={`/cases/${item.case_id}/review`}
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
          </div>

          <p className="mt-7 text-sm text-slate-500">
            Use the action detail view to upload affidavits, add department remarks, and submit compliance for review.
          </p>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  ringValue,
  value,
}: {
  label: string;
  ringValue?: number;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-7 py-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] whitespace-nowrap font-medium text-slate-700">
            {label}
          </p>
          <p className="mt-4 text-[28px] font-semibold text-slate-950">
            {value}
          </p>
        </div>
        {typeof ringValue === "number" && <ProgressRing value={ringValue} />}
      </div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const dashoffset =
    circumference - (Math.min(value, 100) / 100) * circumference;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="4"
      />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function labelForStatus(status: ActionPlan["status"]) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
