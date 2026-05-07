"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, DeptAction, DeptSummary } from "@/lib/api";
import { cn, daysUntil } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type ActionPlanRow = {
  caseId: string;
  caseTitle: string;
  directives: number;
  pendingActions: number;
  dueDate: string | null;
  status: "In Progress" | "Pending" | "Completed";
  progress: number;
};

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<DeptSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [actions, setActions] = useState<DeptAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const data = await api.departments.actions(selected);
        setActions(data);
      } catch {
        setActions([]);
      } finally {
        setActionsLoading(false);
      }
    });
  }, [selected]);

  const selectedSummary = useMemo(
    () => summaries.find((item) => item.department === selected) ?? null,
    [selected, summaries],
  );

  const actionPlans = useMemo(() => groupActionPlans(actions), [actions]);
  const pendingCount = actionPlans.reduce(
    (sum, item) => sum + item.pendingActions,
    0,
  );
  const completedCount = actionPlans.filter(
    (item) => item.status === "Completed",
  ).length;
  const compliancePct =
    actionPlans.length === 0
      ? 0
      : Math.round((completedCount / actionPlans.length) * 100);
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
                {summaries.map((item) => (
                  <option key={item.department} value={item.department}>
                    {item.department}
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
            Recent Action Plans
          </h2>

          <div className="mt-6 overflow-hidden bg-white">
            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    "CASE TITLE",
                    "DIRECTIVES",
                    "PENDING ACTIONS",
                    "DUE DATE",
                    "STATUS",
                    "PROGRESS",
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
                      colSpan={6}
                      className="px-4 py-16 text-center text-sm text-slate-400"
                    >
                      Loading department action plans
                    </td>
                  </tr>
                ) : actionPlans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-16 text-center text-sm text-slate-400"
                    >
                      No action plans available for this department
                    </td>
                  </tr>
                ) : (
                  actionPlans.slice(0, 4).map((item) => (
                    <tr key={item.caseId} className="text-sm text-slate-600">
                      <td className="w-[28%] px-3 py-5 font-medium text-slate-800">
                        {item.caseTitle}
                      </td>
                      <td className="w-[14%] px-3 py-5 font-semibold text-slate-700">
                        {item.directives}
                      </td>
                      <td className="w-[18%] px-3 py-5 font-semibold text-slate-700">
                        {item.pendingActions}
                      </td>
                      <td className="w-[16%] px-3 py-5 font-medium text-slate-500">
                        {item.status === "Completed"
                          ? "Completed"
                          : formatShortDate(item.dueDate)}
                      </td>
                      <td className="w-[12%] px-3 py-5">
                        <span
                          className={cn(
                            "rounded-md px-3 py-1 text-xs font-bold",
                            item.status === "Completed" &&
                              "bg-emerald-50 text-emerald-600",
                            item.status === "In Progress" &&
                              "bg-blue-50 text-blue-600",
                            item.status === "Pending" &&
                              "bg-amber-50 text-amber-600",
                          )}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="w-[12%] px-3 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-600"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-500">
                            {item.progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <a
            href="/departments"
            className="mt-7 inline-flex text-base font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View all action plans {"->"}
          </a>
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

function groupActionPlans(actions: DeptAction[]): ActionPlanRow[] {
  const grouped = new Map<string, DeptAction[]>();

  for (const action of actions) {
    const key = action.case_id || action.case_number;
    const bucket = grouped.get(key) ?? [];
    bucket.push(action);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries()).map(([key, bucket]) => {
    const dueValues = bucket
      .map((item) => item.deadline)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const dueDate = dueValues[0] ?? null;
    const pendingActions = bucket.filter((item) => {
      const days = daysUntil(item.deadline);
      return days === null || days > 0;
    }).length;
    const directives = bucket.length;
    const progress =
      directives === 0
        ? 0
        : Math.round(((directives - pendingActions) / directives) * 100);
    const status =
      pendingActions === 0
        ? "Completed"
        : progress >= 50
          ? "In Progress"
          : "Pending";

    return {
      caseId: key,
      caseTitle: bucket[0]?.case_number || key,
      directives,
      pendingActions,
      dueDate,
      status,
      progress: Math.max(0, Math.min(progress, 100)),
    };
  });
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
