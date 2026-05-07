"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileSearch,
  FileText,
  Moon,
  Search,
  SunMedium,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import {
  api,
  DashboardActivity,
  DashboardDeadline,
  DashboardOverview,
  DashboardRecentCase,
  DashboardStatusItem,
  DashboardTopDepartment,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { label: "This Month", value: 30 },
  { label: "Last 2 Weeks", value: 14 },
  { label: "Last 6 Weeks", value: 42 },
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [periodDays, setPeriodDays] = useState<number>(30);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.dashboard.overview({
          department: department || undefined,
          period_days: periodDays,
        });
        setOverview(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, [department, periodDays]);

  const filteredCases = useMemo(() => {
    const cases = overview?.recent_cases ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return cases;
    return cases.filter((item) =>
      [item.case_number, item.petitioner, item.department, item.status]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [overview?.recent_cases, search]);

  const metrics = overview?.metrics;
  const totalCases = metrics?.total_cases ?? 0;

  return (
    <main className="h-full overflow-y-auto bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)] sm:px-5 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center">
              <label className="flex h-12 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by case number, petitioner, department..."
                  className="h-full w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                <span className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-400 sm:inline-flex">
                  ⌘K
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                  6
                </span>
              </button>
              <button className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50">
                <Moon className="h-4 w-4" />
                <SunMedium className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5c49d6] text-sm font-semibold text-white">
                  {initials(user?.name ?? "User")}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">{user?.name ?? "NyayaSetu User"}</p>
                  <p className="text-xs text-slate-500">{user?.designation ?? user?.role ?? "Officer"}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Could not load dashboard data: {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-[34px] font-semibold tracking-tight text-slate-950">Dashboard</h1>
                <p className="mt-2 text-[15px] text-slate-500">
                  Monitor court judgment compliance and department actions
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <FilterSelect
                  value={department || "All Departments"}
                  onChange={(value) => setDepartment(value === "All Departments" ? "" : value)}
                  options={["All Departments", ...(overview?.department_options.map((item) => item.name) ?? [])]}
                />
                <FilterSelect
                  value={PERIOD_OPTIONS.find((item) => item.value === periodDays)?.label ?? "This Month"}
                  onChange={(value) => {
                    const match = PERIOD_OPTIONS.find((item) => item.label === value);
                    setPeriodDays(match?.value ?? 30);
                  }}
                  options={PERIOD_OPTIONS.map((item) => item.label)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Total Cases"
                value={metrics?.total_cases ?? 0}
                note={metrics ? `Across ${metrics.departments} departments` : "Loading"}
                tone="indigo"
                icon={FileText}
              />
              <MetricCard
                title="Verified"
                value={metrics?.verified ?? 0}
                note={metrics ? percentage(metrics.verified, totalCases) : "Loading"}
                tone="emerald"
                icon={CheckCircle2}
              />
              <MetricCard
                title="Pending Review"
                value={metrics?.pending_review ?? 0}
                note={metrics?.pending_review ? `${metrics.pending_review} awaiting review` : "No backlog"}
                tone="amber"
                icon={Clock3}
              />
              <MetricCard
                title="Overdue"
                value={metrics?.overdue ?? 0}
                note={metrics?.overdue ? "Needs attention" : "No overdue items"}
                tone="rose"
                icon={CalendarDays}
              />
              <MetricCard
                title="Departments"
                value={metrics?.departments ?? 0}
                note={department ? "Filtered view" : "Active scope"}
                tone="violet"
                icon={FileSearch}
              />
            </div>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <Panel title="Case Status Overview">
                <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="h-[280px]">
                    {overview?.status_overview?.some((item) => item.value > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={overview.status_overview}
                            innerRadius={76}
                            outerRadius={104}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {overview.status_overview.map((item) => (
                              <Cell key={item.label} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState text="No case status data available yet." />
                    )}
                  </div>

                  <div className="space-y-3">
                    {(overview?.status_overview ?? []).map((item) => (
                      <LegendRow key={item.label} item={item} total={totalCases} />
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel title="Trend (Last 30 Days)">
                <div className="h-[280px]">
                  {overview?.trend?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overview.trend}>
                        <Tooltip />
                        <Area type="monotone" dataKey="ingested" stroke="#5957ff" fill="url(#ingestedFill)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="verified" stroke="#35c88a" fill="url(#verifiedFill)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="overdue" stroke="#ff6767" fill="url(#overdueFill)" strokeWidth={2.5} />
                        <defs>
                          <linearGradient id="ingestedFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#5957ff" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#5957ff" stopOpacity={0.04} />
                          </linearGradient>
                          <linearGradient id="verifiedFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#35c88a" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#35c88a" stopOpacity={0.04} />
                          </linearGradient>
                          <linearGradient id="overdueFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#ff6767" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#ff6767" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState text="No trend data available for this period." />
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
              <Panel title="Recent Cases" actionLabel="View all">
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="hidden grid-cols-[1.05fr_1.35fr_0.95fr_0.7fr_0.7fr] bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                    <span>Case Number</span>
                    <span>Petitioner</span>
                    <span>Department</span>
                    <span>Status</span>
                    <span>Updated</span>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {loading ? (
                      <div className="px-5 py-10 text-sm text-slate-400">Loading cases...</div>
                    ) : filteredCases.length === 0 ? (
                      <div className="px-5 py-10 text-sm text-slate-400">No recent cases found.</div>
                    ) : (
                      filteredCases.map((item) => <RecentCaseRow key={item.id} item={item} />)
                    )}
                  </div>
                </div>
              </Panel>

              <Panel title="Top Departments">
                <div className="space-y-5">
                  {(overview?.top_departments ?? []).length === 0 ? (
                    <EmptyState text="No department activity available yet." />
                  ) : (
                    overview?.top_departments.map((item, index) => (
                      <TopDepartmentRow
                        key={item.department}
                        item={item}
                        max={overview.top_departments[0]?.count ?? item.count}
                        tone={["indigo", "sky", "emerald", "amber", "violet"][index % 5] as TopDepartmentTone}
                      />
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </section>

          <aside className="space-y-5">
            <Panel title="Upcoming Deadlines" actionLabel="View all">
              <div className="space-y-4">
                {(overview?.upcoming_deadlines ?? []).length === 0 ? (
                  <EmptyState text="No upcoming deadlines for this filter." />
                ) : (
                  overview?.upcoming_deadlines.map((item) => <DeadlineRow key={item.case_id + item.title} item={item} />)
                )}
              </div>
            </Panel>

            <Panel title="Recent Activity">
              <div className="space-y-5">
                {(overview?.recent_activity ?? []).length === 0 ? (
                  <EmptyState text="No recent backend activity available." />
                ) : (
                  overview?.recent_activity.map((item, index) => <ActivityRow key={item.id} item={item} isLast={index === (overview.recent_activity.length - 1)} />)
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Panel({
  actionLabel,
  children,
  title,
}: {
  actionLabel?: string;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.34)] lg:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold text-slate-900 lg:text-[20px]">{title}</h2>
        {actionLabel ? (
          <button className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700">
            {actionLabel} →
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FilterSelect({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div className="relative flex h-11 min-w-[160px] items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
      <span className="truncate text-sm font-medium text-slate-700">{value}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  note,
  title,
  tone,
  value,
}: {
  icon: typeof FileText;
  note: string;
  title: string;
  tone: "amber" | "emerald" | "indigo" | "rose" | "violet";
  value: number;
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.3)]">
      <div className="flex items-start gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-[42px] font-semibold leading-none text-slate-950">{value}</p>
          <p className="mt-3 text-sm text-slate-500">{note}</p>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ item, total }: { item: DashboardStatusItem; total: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="text-sm font-medium text-slate-700">{item.label}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-lg font-semibold text-slate-950">{item.value}</span>
        <span className="min-w-[42px] text-right text-sm text-slate-500">{percentage(item.value, total)}</span>
      </div>
    </div>
  );
}

function RecentCaseRow({ item }: { item: DashboardRecentCase }) {
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.05fr_1.35fr_0.95fr_0.7fr_0.7fr] md:items-center">
      <div className="text-sm font-semibold text-slate-900">{item.case_number}</div>
      <div className="text-sm text-slate-600">{item.petitioner}</div>
      <div className="text-sm text-slate-600">{item.department}</div>
      <div>
        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusPillTone(item.status))}>
          {humanizeStatus(item.status)}
        </span>
      </div>
      <div className="text-sm text-slate-500">{timeAgo(item.updated_at)}</div>
    </div>
  );
}

type TopDepartmentTone = "amber" | "emerald" | "indigo" | "sky" | "violet";

function TopDepartmentRow({
  item,
  max,
  tone,
}: {
  item: DashboardTopDepartment;
  max: number;
  tone: TopDepartmentTone;
}) {
  const tones = {
    indigo: "bg-indigo-500",
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-500">
          <FileText className="h-4 w-4" />
        </div>
        <span className="truncate text-sm font-semibold text-slate-800">{item.department}</span>
      </div>
      <div className="w-[120px] overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-2 rounded-full", tones[tone])} style={{ width: `${Math.max(12, (item.count / Math.max(1, max)) * 100)}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold text-slate-900">{item.count}</span>
    </div>
  );
}

function DeadlineRow({ item }: { item: DashboardDeadline }) {
  const badge = deadlineBadge(item.days_left, item.status);
  return (
    <div className="rounded-[22px] border border-slate-100 bg-white px-4 py-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,0.26)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{item.case_number}</p>
          <p className="mt-1 text-sm text-slate-700">{humanizeAction(item.title)}</p>
          <p className="mt-3 text-xs text-slate-500">{item.department}</p>
        </div>
        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", badge.tone)}>
          {badge.label}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{item.deadline ? formatLongDate(item.deadline) : "No deadline"}</span>
        <span>{item.days_left !== null ? `${item.days_left} days` : "—"}</span>
      </div>
    </div>
  );
}

function ActivityRow({ isLast, item }: { isLast: boolean; item: DashboardActivity }) {
  return (
    <div className="relative pl-8">
      <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full bg-[#5957ff]" />
      {!isLast ? <span className="absolute left-[7px] top-6 h-[calc(100%+14px)] w-px bg-slate-200" /> : null}
      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
      <p className="mt-2 text-sm text-slate-600">{item.subtitle}</p>
      <p className="mt-2 text-xs text-slate-400">{timeAgo(item.created_at)}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function percentage(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function humanizeStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function humanizeAction(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function statusPillTone(status: string) {
  if (status === "VERIFIED") return "bg-emerald-50 text-emerald-600";
  if (status === "PENDING_REVIEW") return "bg-amber-50 text-amber-600";
  if (status === "ACTIONED") return "bg-blue-50 text-blue-600";
  if (status === "APPEALED") return "bg-violet-50 text-violet-600";
  return "bg-slate-100 text-slate-500";
}

function deadlineBadge(daysLeft: number | null, status: string) {
  if (status === "OVERDUE" || (daysLeft !== null && daysLeft < 0)) {
    return { label: "Overdue", tone: "bg-rose-50 text-rose-600" };
  }
  if (daysLeft !== null && daysLeft <= 3) {
    return { label: "Due in 3d", tone: "bg-amber-50 text-amber-600" };
  }
  if (daysLeft !== null && daysLeft <= 7) {
    return { label: "Due in 7d", tone: "bg-indigo-50 text-indigo-600" };
  }
  return { label: "Upcoming", tone: "bg-slate-100 text-slate-500" };
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day ago`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
