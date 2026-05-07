"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  EllipsisVertical,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api, type DepartmentOption, type DeptSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ALL_DEPARTMENTS } from "@/lib/gov-catalog";

type DepartmentRow = {
  name: string;
  code: string;
  ministry: string;
  state: string;
  casesAssigned: number;
  complianceRate: number | null;
  active: boolean;
};

export default function AdminDepartmentsPage() {
  const [catalogDepartments, setCatalogDepartments] = useState<DepartmentOption[]>(
    ALL_DEPARTMENTS.map((name, index) => ({
      id: `fallback-${index + 1}`,
      name,
      code: `DEPT-${String(index + 1).padStart(3, "0")}`,
      email: null,
    })),
  );
  const [summary, setSummary] = useState<DeptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [ministryFilter, setMinistryFilter] = useState("All Ministries");
  const [stateFilter, setStateFilter] = useState("All States / UTs");

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const [departmentOptions, departmentSummary] = await Promise.all([
          api.auth.options().catch(() => null),
          api.departments.summary().catch(() => [] as DeptSummary[]),
        ]);
        if (departmentOptions?.departments.length) {
          setCatalogDepartments(departmentOptions.departments);
        }
        setSummary(departmentSummary);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const summaryByDepartment = useMemo(
    () => new Map(summary.map((item) => [item.department, item])),
    [summary],
  );

  const rows = useMemo<DepartmentRow[]>(
    () =>
      catalogDepartments.map((department) => {
        const live = summaryByDepartment.get(department.name);
        const complianceRate =
          live && live.total > 0
            ? Math.round(
                ((live.by_action.COMPLY + live.by_action.INFORM) / live.total) *
                  100,
              )
            : null;

        return {
          name: department.name,
          code: department.code,
          ministry: ministryLabel(department.name),
          state: "All India",
          casesAssigned: live?.total ?? 0,
          complianceRate,
          active: Boolean(live && live.total > 0),
        };
      }),
    [catalogDepartments, summaryByDepartment],
  );

  const ministryOptions = useMemo(
    () => ["All Ministries", ...new Set(rows.map((row) => row.ministry))],
    [rows],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.code.toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "All Status" ||
        (statusFilter === "Active" ? row.active : !row.active);
      const matchesMinistry =
        ministryFilter === "All Ministries" || row.ministry === ministryFilter;
      const matchesState =
        stateFilter === "All States / UTs" || row.state === stateFilter;

      return (
        matchesSearch && matchesStatus && matchesMinistry && matchesState
      );
    });
  }, [ministryFilter, rows, search, stateFilter, statusFilter]);

  const totalDepartments = rows.length;
  const activeDepartments = rows.filter((row) => row.active).length;
  const casesAssigned = rows.reduce((sum, row) => sum + row.casesAssigned, 0);
  const complianceRate = averageCompliance(rows);

  return (
    <main className="h-full overflow-y-auto bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-8 py-8">
        <section className="rounded-[30px] border border-white/80 bg-white/95 p-8 shadow-[0_32px_90px_-45px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[42px] font-semibold tracking-tight text-slate-950">
                Departments
              </h1>
              <p className="mt-2 text-[16px] text-slate-500">
                Manage departments and their hierarchy. Assign reviewers and
                manage access.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-[0_16px_36px_-18px_rgba(79,70,229,0.75)] transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-4">
            <MetricCard
              icon={Building2}
              label="Total Departments"
              value={totalDepartments}
              detail="All departments"
              tone="indigo"
            />
            <MetricCard
              icon={ShieldCheck}
              label="Active Departments"
              value={activeDepartments}
              detail="Currently active"
              tone="emerald"
            />
            <MetricCard
              icon={ClipboardList}
              label="Cases Assigned"
              value={casesAssigned}
              detail="Total across all"
              tone="amber"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Compliance Rate"
              value={`${complianceRate}%`}
              detail="Catalog-wide proxy rate"
              tone="sky"
            />
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_180px_180px_180px_auto_auto]">
            <SearchField value={search} onChange={setSearch} />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={["All Status", "Active", "Inactive"]}
            />
            <FilterSelect
              value={ministryFilter}
              onChange={setMinistryFilter}
              options={ministryOptions}
            />
            <FilterSelect
              value={stateFilter}
              onChange={setStateFilter}
              options={["All States / UTs", "All India"]}
            />
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("All Status");
                setMinistryFilter("All Ministries");
                setStateFilter("All States / UTs");
              }}
              className="inline-flex h-11 items-center justify-center text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
            >
              Reset
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-7 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full table-fixed bg-white">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <th className="w-[4%] px-4 py-4" />
                  <th className="w-[22%] px-4 py-4">Department Name</th>
                  <th className="w-[14%] px-4 py-4">Department Code</th>
                  <th className="w-[22%] px-4 py-4">Ministry / Head</th>
                  <th className="w-[10%] px-4 py-4">State / UT</th>
                  <th className="w-[10%] px-4 py-4">Cases Assigned</th>
                  <th className="w-[12%] px-4 py-4">Compliance Rate</th>
                  <th className="w-[8%] px-4 py-4">Status</th>
                  <th className="w-[8%] px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-20 text-center text-sm text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading departments
                      </span>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-20 text-center text-sm text-slate-400">
                      No departments match these filters
                    </td>
                  </tr>
                ) : (
                  filteredRows.slice(0, 10).map((row) => (
                    <tr key={row.code} className="text-sm text-slate-600">
                      <td className="px-4 py-5">
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </td>
                      <td className="px-4 py-5 font-medium text-slate-800">
                        {row.name}
                      </td>
                      <td className="px-4 py-5 font-medium text-slate-500">
                        {row.code}
                      </td>
                      <td className="px-4 py-5 text-slate-500">
                        {row.ministry}
                      </td>
                      <td className="px-4 py-5 text-slate-500">{row.state}</td>
                      <td className="px-4 py-5 font-medium text-slate-700">
                        {row.casesAssigned}
                      </td>
                      <td className="px-4 py-5">
                        {row.complianceRate === null ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-sm font-medium text-slate-700">
                              {row.complianceRate}%
                            </span>
                            <div className="h-1.5 w-[84px] overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  progressTone(row.complianceRate),
                                )}
                                style={{ width: `${row.complianceRate}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            row.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-600",
                          )}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex items-center justify-end gap-3 text-slate-400">
                          <button type="button" className="transition hover:text-indigo-600">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" className="transition hover:text-slate-600">
                            <EllipsisVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <p>
              Showing {filteredRows.length === 0 ? 0 : 1} to{" "}
              {Math.min(filteredRows.length, 10)} of {filteredRows.length}{" "}
              departments
            </p>
            <div className="flex items-center gap-3">
              <FilterSelect
                value="10 / page"
                onChange={() => {}}
                options={["10 / page"]}
                compact
              />
              <PaginationButton active>1</PaginationButton>
              <PaginationButton>2</PaginationButton>
              <PaginationButton>3</PaginationButton>
              <PaginationButton>
                <ChevronRight className="h-4 w-4" />
              </PaginationButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search department name or code..."
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
      />
    </div>
  );
}

function FilterSelect({
  compact,
  onChange,
  options,
  value,
}: {
  compact?: boolean;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm",
        compact && "min-w-[112px]",
      )}
    >
      <span className="truncate">{value}</span>
      <ChevronDown className="h-4 w-4 text-slate-400" />
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
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "amber" | "emerald" | "indigo" | "sky";
  value: number | string;
}) {
  const iconTone = {
    amber: "bg-amber-50 text-amber-500",
    emerald: "bg-emerald-50 text-emerald-500",
    indigo: "bg-indigo-50 text-indigo-500",
    sky: "bg-blue-50 text-blue-500",
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.5)]">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            iconTone[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-[22px] font-semibold text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function PaginationButton({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition",
        active
          ? "border-indigo-200 bg-indigo-600 text-white"
          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function averageCompliance(rows: DepartmentRow[]) {
  const rates = rows
    .map((row) => row.complianceRate)
    .filter((value): value is number => value !== null);
  if (rates.length === 0) return 0;
  return Math.round(
    rates.reduce((sum, value) => sum + value, 0) / rates.length,
  );
}

function ministryLabel(name: string) {
  const base = name
    .replace(/\s+Department$/i, "")
    .replace(/\s+Ministry$/i, "");

  const specialCases: Record<string, string> = {
    "Commerce & Industry": "Ministry of Commerce & Industry",
    "Environment & Climate": "Ministry of Environment, Forest & Climate",
    "Health & Family Welfare": "Ministry of Health & Family Welfare",
    "Housing & Urban Affairs": "Ministry of Housing & Urban Affairs",
    "Information & Broadcasting": "Ministry of Information & Broadcasting",
    "Jal Shakti / Water Resources": "Ministry of Jal Shakti",
    "Labour & Employment": "Ministry of Labour & Employment",
    "Micro, Small & Medium Enterprises":
      "Ministry of MSME",
    "Ports, Shipping & Waterways":
      "Ministry of Ports, Shipping & Waterways",
    "Road Transport & Highways":
      "Ministry of Road Transport & Highways",
    "Social Justice & Empowerment":
      "Ministry of Social Justice & Empowerment",
    "Women & Child Development":
      "Ministry of Women & Child Development",
    "Youth Affairs & Sports": "Ministry of Youth Affairs & Sports",
  };

  return specialCases[name] ?? `Ministry of ${base}`;
}

function progressTone(value: number) {
  if (value >= 70) return "bg-emerald-400";
  if (value >= 60) return "bg-amber-400";
  return "bg-orange-400";
}
