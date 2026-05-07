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
  Upload,
  Shield,
  MoreVertical,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  DashboardOverview,
  DashboardRecentCase,
  DashboardTopDepartment,
  DashboardStatusItem,
  DashboardDeadline,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StatusOverviewItem extends DashboardStatusItem {
  percentage?: string;
}

interface ActivityItemType {
  id: string;
  title: string;
  subtitle: string;
  created_at: string;
  type: "upload" | "verify" | "clock" | "shield";
}

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
  const totalCases = metrics?.total_cases ?? 532; // Fallback to match image if loading

  return (
    <main className="h-full min-h-screen overflow-y-auto bg-[#f8fafc] text-slate-900">
      <div className="mx-auto flex w-full max-w-400 flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Top Header */}
        <header className="flex w-full flex-col gap-4 rounded-2xl bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex w-full flex-1 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 sm:max-w-md">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by case number, petitioner, department..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <span className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline-flex">
              ⌘K
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 sm:gap-4">
            <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 border-2 border-slate-50" />
            </button>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
              <Moon className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 pl-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5c49d6] text-xs font-semibold text-white shadow-sm">
                {initials(user?.name ?? "Vairamuthu Admin")}
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Could not load dashboard data: {error}
          </div>
        )}

        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor court judgment compliance and department actions
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
            <FilterSelect
              value={department || "All Departments"}
              onChange={(value) =>
                setDepartment(value === "All Departments" ? "" : value)
              }
              options={[
                "All Departments",
                ...(overview?.department_options.map((item) => item.name) ??
                  []),
              ]}
            />
            <FilterSelect
              value={
                PERIOD_OPTIONS.find((item) => item.value === periodDays)
                  ?.label ?? "This Month"
              }
              onChange={(value) => {
                const match = PERIOD_OPTIONS.find(
                  (item) => item.label === value,
                );
                setPeriodDays(match?.value ?? 30);
              }}
              options={PERIOD_OPTIONS.map((item) => item.label)}
              icon={CalendarDays}
            />
          </div>
        </div>

        {/* Main Grid Layout - Sidebar is now properly aligned! */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_340px]">
          {/* Left Main Content */}
          <div className="flex flex-col gap-6">
            {/* Metric Cards Grid - MOVED INSIDE LEFT COLUMN */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <MetricCard
                title="Total Cases"
                value={metrics?.total_cases ?? 532}
                note={
                  <span className="text-emerald-500 font-medium text-xs">
                    ↑ +14%
                  </span>
                }
                tone="indigo"
                icon={FileText}
              />
              <MetricCard
                title="Verified"
                value={metrics?.verified ?? 386}
                note={
                  <span className="text-emerald-500 font-medium text-xs">
                    ↑ +72%
                  </span>
                }
                tone="emerald"
                icon={CheckCircle2}
              />
              <MetricCard
                title="Pending Review"
                value={metrics?.pending_review ?? 47}
                note={
                  <span className="flex items-center gap-1.5 text-rose-500 font-medium text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>{" "}
                    8 urgent
                  </span>
                }
                tone="amber"
                icon={Clock3}
              />
              <MetricCard
                title="Overdue"
                value={metrics?.overdue ?? 18}
                note={
                  <span className="flex items-center gap-1.5 text-rose-500 font-medium text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>{" "}
                    Needs attention
                  </span>
                }
                tone="rose"
                icon={CalendarDays}
              />
              <MetricCard
                title="Departments"
                value={metrics?.departments ?? 24}
                note={
                  <span className="flex items-center gap-1.5 text-slate-400 font-medium text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>{" "}
                    Active
                  </span>
                }
                tone="violet"
                icon={FileSearch}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel
                title="Case Status Overview"
                headerSlot={<PanelPill label="This Month" />}
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="relative h-55 w-full sm:w-55 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            overview?.status_overview || [
                              {
                                label: "Verified",
                                value: 386,
                                color: "#10b981",
                              },
                              { label: "Pending", value: 47, color: "#f59e0b" },
                              {
                                label: "In Progress",
                                value: 64,
                                color: "#3b82f6",
                              },
                              { label: "Overdue", value: 18, color: "#ef4444" },
                              { label: "Closed", value: 17, color: "#6b7280" },
                            ]
                          }
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {(
                            overview?.status_overview || [
                              { color: "#10b981" },
                              { color: "#f59e0b" },
                              { color: "#3b82f6" },
                              { color: "#ef4444" },
                              { color: "#6b7280" },
                            ]
                          ).map((item, index) => (
                            <Cell key={`cell-${index}`} fill={item.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-slate-900">
                        {totalCases}
                      </span>
                      <span className="text-xs text-slate-500">
                        Total Cases
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    {(
                      overview?.status_overview ||
                      ([
                        {
                          label: "Verified",
                          value: 386,
                          color: "#10b981",
                          percentage: "72%",
                        },
                        {
                          label: "Pending Review",
                          value: 47,
                          color: "#f59e0b",
                          percentage: "9%",
                        },
                        {
                          label: "In Progress",
                          value: 64,
                          color: "#3b82f6",
                          percentage: "12%",
                        },
                        {
                          label: "Overdue",
                          value: 18,
                          color: "#ef4444",
                          percentage: "3%",
                        },
                        {
                          label: "Closed",
                          value: 17,
                          color: "#6b7280",
                          percentage: "4%",
                        },
                      ] as StatusOverviewItem[])
                    ).map((item: StatusOverviewItem) => (
                      <LegendRow
                        key={item.label}
                        item={item}
                        total={totalCases}
                      />
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel title="Trend (Last 30 Days)">
                <div className="h-55 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={
                        overview?.trend || [
                          {
                            label: "May 1",
                            ingested: 5,
                            verified: 2,
                            overdue: 0,
                          },
                          {
                            label: "May 5",
                            ingested: 15,
                            verified: 8,
                            overdue: 2,
                          },
                          {
                            label: "May 10",
                            ingested: 25,
                            verified: 15,
                            overdue: 5,
                          },
                          {
                            label: "May 15",
                            ingested: 18,
                            verified: 10,
                            overdue: 3,
                          },
                          {
                            label: "May 20",
                            ingested: 35,
                            verified: 22,
                            overdue: 8,
                          },
                          {
                            label: "May 25",
                            ingested: 45,
                            verified: 30,
                            overdue: 15,
                          },
                          {
                            label: "Today",
                            ingested: 50,
                            verified: 32,
                            overdue: 18,
                          },
                        ]
                      }
                    >
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={24}
                      />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="ingested"
                        stroke="#6366f1"
                        fill="#e0e7ff"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="verified"
                        stroke="#10b981"
                        fill="#d1fae5"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="overdue"
                        stroke="#f43f5e"
                        fill="#ffe4e6"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500">
                  <TrendKey color="#6366f1" label="Ingested" />
                  <TrendKey color="#10b981" label="Verified" />
                  <TrendKey color="#f43f5e" label="Overdue" />
                </div>
              </Panel>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
              <Panel
                title="Recent Cases"
                actionLabel="View all →"
                href="/cases"
              >
                <div className="overflow-x-auto">
                  <div className="min-w-150">
                    <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr_1fr_auto] border-b border-slate-100 pb-3 text-xs font-semibold text-slate-500">
                      <span>Case Number</span>
                      <span>Petitioner</span>
                      <span>Department</span>
                      <span>Status</span>
                      <span>Updated</span>
                      <span className="w-4"></span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {loading ? (
                        <div className="py-8 text-center text-sm text-slate-400">
                          Loading cases...
                        </div>
                      ) : filteredCases.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-400">
                          No recent cases found.
                        </div>
                      ) : (
                        filteredCases.map((item) => (
                          <RecentCaseRow key={item.id} item={item} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Top Departments"
                headerSlot={<PanelPill label="Load ▾" />}
              >
                <div className="flex flex-col gap-5 pt-2">
                  {(
                    overview?.top_departments ?? [
                      { department: "Revenue Dept", count: 128 },
                      { department: "Law Dept", count: 96 },
                      { department: "Urban Development", count: 74 },
                      { department: "Public Works", count: 64 },
                      { department: "Education", count: 48 },
                    ]
                  ).map((item, index) => (
                    <TopDepartmentRow
                      key={item.department}
                      item={item}
                      max={128}
                      tone={
                        ["indigo", "sky", "emerald", "amber", "violet"][
                          index % 5
                        ] as TopDepartmentTone
                      }
                    />
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          {/* Right Sidebar Content */}
          <aside className="flex w-full flex-col gap-6">
            <Panel title="Upcoming Deadlines" actionLabel="View all →">
              <div className="flex flex-col gap-3">
                {(overview?.upcoming_deadlines ?? []).map((item, idx) => (
                  <DeadlineRow key={idx} item={item} />
                ))}
              </div>
            </Panel>

            <Panel title="Recent Activity">
              <div className="flex flex-col gap-6 pt-2">
                {(overview?.recent_activity ?? []).map(
                  (activity, index, arr) => {
                    const eventTypeMap: Record<
                      string,
                      "upload" | "verify" | "clock" | "shield"
                    > = {
                      upload: "upload",
                      ingest: "upload",
                      verify: "verify",
                      verified: "verify",
                      deadline: "clock",
                      shield: "shield",
                    };
                    const type: "upload" | "verify" | "clock" | "shield" =
                      eventTypeMap[activity.event?.toLowerCase()] || "upload";
                    const item: ActivityItemType = {
                      ...activity,
                      type,
                    };
                    return (
                      <ActivityRow
                        key={activity.id}
                        item={item}
                        type={type}
                        isLast={index === arr.length - 1}
                      />
                    );
                  },
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}

// Subcomponents

function Panel({
  actionLabel,
  children,
  headerSlot,
  title,
  href,
}: {
  actionLabel?: string;
  children: ReactNode;
  headerSlot?: ReactNode;
  title: string;
  href?: string;
}) {
  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2>
        {headerSlot ? (
          headerSlot
        ) : actionLabel ? (
          <Link
            href={href ? href : "#"}
            className="text-xs font-semibold text-[#5c49d6] transition hover:text-indigo-800"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function PanelPill({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
      {label}
    </button>
  );
}

function FilterSelect({
  onChange,
  options,
  value,
  icon: Icon,
}: {
  onChange: (value: string) => void;
  options: string[];
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="relative flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm hover:border-slate-300">
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
      <span className="text-xs font-medium text-slate-600">{value}</span>
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
  icon: LucideIcon;
  note: ReactNode;
  title: string;
  tone: "amber" | "emerald" | "indigo" | "rose" | "violet";
  value: number;
}) {
  const tones = {
    indigo: "bg-[#f5f3ff] text-[#5c49d6]",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-500",
    rose: "bg-rose-50 text-rose-500",
    violet: "bg-violet-50 text-violet-500",
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <p className="text-[13px] font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            {value}
          </h3>
          <div className="mt-1 flex items-center text-xs">{note}</div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({
  item,
  total,
}: {
  item: StatusOverviewItem;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="font-medium text-slate-600">{item.label}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-slate-900">{item.value}</span>
        <span className="w-10 text-right text-xs text-slate-400">
          {item.percentage || percentage(item.value, total)}
        </span>
      </div>
    </div>
  );
}

function RecentCaseRow({ item }: { item: DashboardRecentCase }) {
  return (
    <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr_1fr_auto] items-center gap-2 py-3">
      <div className="text-xs font-bold text-slate-900">{item.case_number}</div>
      <div className="truncate text-xs font-medium text-slate-600 pr-2">
        {item.petitioner}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Shield className="h-3 w-3 text-slate-400" />
        <span className="truncate">{item.department}</span>
      </div>
      <div>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            statusPillTone(item.status),
          )}
        >
          {humanizeStatus(item.status)}
        </span>
      </div>
      <div className="text-xs text-slate-500">{timeAgo(item.updated_at)}</div>
      <button className="text-slate-400 hover:text-slate-600">
        <MoreVertical className="h-4 w-4" />
      </button>
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
    indigo: "bg-[#5c49d6] text-[#5c49d6]",
    sky: "bg-[#38bdf8] text-[#38bdf8]",
    emerald: "bg-[#10b981] text-[#10b981]",
    amber: "bg-[#f59e0b] text-[#f59e0b]",
    violet: "bg-[#8b5cf6] text-[#8b5cf6]",
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-1 items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg bg-opacity-10",
            tones[tone].split(" ")[0].replace("bg-", "bg-").concat("/10"),
            tones[tone].split(" ")[1],
          )}
        >
          <FileText className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold text-slate-700">
          {item.department}
        </span>
      </div>
      <div className="flex w-30 items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full", tones[tone].split(" ")[0])}
            style={{ width: `${(item.count / max) * 100}%` }}
          />
        </div>
        <span className="w-6 text-right text-xs font-bold text-slate-900">
          {item.count}
        </span>
      </div>
    </div>
  );
}

function DeadlineRow({ item }: { item: DashboardDeadline }) {
  const badge = deadlineBadge(item.days_left, item.status);
  const daysLeft = item.days_left ?? 0;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-50">
            <FileText className="h-3 w-3 text-[#5c49d6]" />
          </div>
          <p className="text-xs font-bold text-slate-900">{item.case_number}</p>
        </div>
        <span
          className={cn(
            "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold",
            badge.tone,
          )}
        >
          {badge.label}
        </span>
      </div>
      <div className="pl-8">
        <p className="text-xs font-medium text-slate-700">{item.title}</p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" /> {item.department}
          </span>
          <span className="font-medium text-slate-400">
            {daysLeft < 0
              ? `${Math.abs(daysLeft)} days ago`
              : `${daysLeft} days`}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  isLast,
  item,
  type = "upload",
}: {
  isLast: boolean;
  item: ActivityItemType;
  type?: "upload" | "verify" | "clock" | "shield";
}) {
  const iconConfig = {
    upload: { icon: Upload, color: "bg-[#5c49d6] text-white" },
    verify: { icon: CheckCircle2, color: "bg-emerald-500 text-white" },
    clock: { icon: Clock3, color: "bg-amber-500 text-white" },
    shield: { icon: Shield, color: "bg-blue-500 text-white" },
  }[type] || { icon: Bell, color: "bg-slate-400 text-white" };

  const Icon = iconConfig.icon;

  return (
    <div className="relative flex gap-4">
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-sm",
            iconConfig.color,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!isLast && <div className="absolute top-7 h-full w-px bg-slate-200" />}
      </div>
      <div className="flex flex-col pb-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-900">{item.title}</p>
          <span className="text-[10px] text-slate-400">
            {timeAgo(item.created_at)}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
      </div>
    </div>
  );
}

function TrendKey({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-1 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}

function percentage(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function humanizeStatus(status: string) {
  if (!status) return "UNKNOWN";
  return status.replace(/_/g, " ");
}

function statusPillTone(status: string) {
  const s = status?.toUpperCase() || "";
  if (s.includes("VERIFIED")) return "bg-emerald-50 text-emerald-600";
  if (s.includes("PENDING")) return "bg-amber-50 text-amber-600";
  if (s.includes("PROGRESS")) return "bg-blue-50 text-blue-600";
  if (s.includes("OVERDUE")) return "bg-rose-50 text-rose-600";
  return "bg-slate-100 text-slate-600";
}

function deadlineBadge(daysLeft: number | null, status: string) {
  if (status === "OVERDUE" || (daysLeft !== null && daysLeft < 0)) {
    return { label: "Overdue", tone: "bg-rose-50 text-rose-600" };
  }
  if (daysLeft !== null && daysLeft <= 3) {
    return { label: "Due in 3d", tone: "bg-amber-50 text-amber-600" };
  }
  if (daysLeft !== null && daysLeft <= 7) {
    return { label: "Due in 7d", tone: "bg-blue-50 text-blue-600" };
  }
  return { label: `Due in ${daysLeft}d`, tone: "bg-slate-50 text-slate-600" };
}

function timeAgo(value: string | undefined) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hrs ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
