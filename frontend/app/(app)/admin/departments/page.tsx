"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, type DepartmentOption, type DepartmentUpsert, type DeptSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type DepartmentRow = DepartmentOption & {
  ministry: string;
  state: string;
  casesAssigned: number;
  complianceRate: number | null;
  active: boolean;
};

const EMPTY_FORM: DepartmentUpsert = { name: "", code: "", email: "" };
const PAGE_SIZE = 10;

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [summary, setSummary] = useState<DeptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentOption | null>(null);
  const [form, setForm] = useState<DepartmentUpsert>(EMPTY_FORM);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [departmentList, departmentSummary] = await Promise.all([
        api.admin.departments(),
        api.departments.summary().catch(() => [] as DeptSummary[]),
      ]);
      setDepartments(departmentList);
      setSummary(departmentSummary);
      setPage(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const summaryByDepartment = useMemo(
    () => new Map(summary.map((item) => [item.department, item])),
    [summary],
  );

  const rows = useMemo<DepartmentRow[]>(
    () =>
      departments.map((department) => {
        const live = summaryByDepartment.get(department.name);
        const completed = (live?.by_action.COMPLY ?? 0) + (live?.by_action.INFORM ?? 0);
        const complianceRate = live && live.total > 0 ? Math.round((completed / live.total) * 100) : null;
        return {
          ...department,
          ministry: ministryLabel(department.name),
          state: "All India",
          casesAssigned: live?.total ?? 0,
          complianceRate,
          active: true,
        };
      }),
    [departments, summaryByDepartment],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.code.toLowerCase().includes(needle) ||
        (row.email ?? "").toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "All Status" ||
        (statusFilter === "Active" ? row.active : !row.active);
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalDepartments = rows.length;
  const activeDepartments = rows.filter((row) => row.active).length;
  const casesAssigned = rows.reduce((sum, row) => sum + row.casesAssigned, 0);
  const complianceRate = averageCompliance(rows);

  async function handleSubmit() {
    if (!form.name.trim() || !form.code.trim()) {
      setError("Department name and code are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: DepartmentUpsert = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        email: form.email?.trim() ? form.email.trim() : undefined,
      };
      if (editingDepartment) {
        await api.admin.updateDepartment(editingDepartment.id, payload);
      } else {
        await api.admin.createDepartment(payload);
      }
      setIsModalOpen(false);
      setEditingDepartment(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openCreateModal() {
    setEditingDepartment(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(department: DepartmentOption) {
    setEditingDepartment(department);
    setForm({
      name: department.name,
      code: department.code,
      email: department.email ?? "",
    });
    setIsModalOpen(true);
  }

  return (
    <main className="h-full overflow-y-auto bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-8 py-8">
        <section className="rounded-[30px] border border-white/80 bg-white/95 p-8 shadow-[0_32px_90px_-45px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[42px] font-semibold tracking-tight text-slate-950">Departments</h1>
              <p className="mt-2 text-[16px] text-slate-500">
                Manage department masters, contact codes, and downstream action-plan routing.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-[0_16px_36px_-18px_rgba(79,70,229,0.75)] transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-4">
            <MetricCard icon={Building2} label="Total Departments" value={totalDepartments} detail="Configured masters" tone="indigo" />
            <MetricCard icon={ShieldCheck} label="Active Departments" value={activeDepartments} detail="Available for routing" tone="emerald" />
            <MetricCard icon={ClipboardList} label="Cases Assigned" value={casesAssigned} detail="Across all departments" tone="amber" />
            <MetricCard icon={CheckCircle2} label="Compliance Rate" value={`${complianceRate}%`} detail="Current action-plan output" tone="sky" />
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
            <FilterSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              options={["All Status", "Active", "Inactive"]}
            />
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("All Status");
                setPage(1);
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
            <table className="w-full table-fixed bg-white">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <th className="w-[4%] px-4 py-4" />
                  <th className="w-[22%] px-4 py-4">Department Name</th>
                  <th className="w-[12%] px-4 py-4">Department Code</th>
                  <th className="w-[18%] px-4 py-4">Ministry / Head</th>
                  <th className="w-[18%] px-4 py-4">Contact Email</th>
                  <th className="w-[8%] px-4 py-4">Cases</th>
                  <th className="w-[10%] px-4 py-4">Compliance</th>
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
                  visibleRows.map((row) => (
                    <tr key={row.id} className="text-sm text-slate-600">
                      <td className="px-4 py-5">
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </td>
                      <td className="px-4 py-5 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-5 font-medium text-slate-500">{row.code}</td>
                      <td className="px-4 py-5 text-slate-500">{row.ministry}</td>
                      <td className="px-4 py-5 text-slate-500">{row.email || "-"}</td>
                      <td className="px-4 py-5 font-medium text-slate-700">{row.casesAssigned}</td>
                      <td className="px-4 py-5">
                        {row.complianceRate === null ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-sm font-medium text-slate-700">{row.complianceRate}%</span>
                            <div className="h-1.5 w-[84px] overflow-hidden rounded-full bg-slate-100">
                              <div className={cn("h-full rounded-full", progressTone(row.complianceRate))} style={{ width: `${row.complianceRate}%` }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-5">
                        <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex items-center justify-end gap-3 text-slate-400">
                          <button type="button" onClick={() => openEditModal(row)} className="transition hover:text-indigo-600">
                            <Pencil className="h-4 w-4" />
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
              Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} departments
            </p>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                10 / page
              </div>
              <PaginationButton disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Prev
              </PaginationButton>
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .slice(Math.max(0, safePage - 3), Math.max(0, safePage - 3) + 5)
                .map((pageNumber) => (
                  <PaginationButton key={pageNumber} active={pageNumber === safePage} onClick={() => setPage(pageNumber)}>
                    {pageNumber}
                  </PaginationButton>
                ))}
              <PaginationButton disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </PaginationButton>
            </div>
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_32px_90px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  {editingDepartment ? "Edit Department" : "Add Department"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Configure the department master used across registration, routing, and action-plan workspaces.
                </p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Department Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-indigo-300"
                  placeholder="Public Works Department"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Department Code
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-indigo-300"
                  placeholder="PWD"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Contact Email
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-indigo-300"
                  placeholder="pwd@gov.in"
                />
              </label>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSubmit()}
                className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingDepartment ? "Save Changes" : "Create Department"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
      <Search className="h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search departments, codes, or email"
        className="h-full w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
      />
    </label>
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
        "relative flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 shadow-sm",
        compact ? "h-10 min-w-[120px]" : "h-11",
      )}
    >
      <span className="truncate text-sm font-medium text-slate-600">{value}</span>
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

function PaginationButton({
  active,
  children,
  disabled,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition",
        active ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
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
  tone: "indigo" | "emerald" | "amber" | "sky";
  value: number | string;
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-[28px] font-semibold text-slate-950">{value}</p>
          <p className="mt-2 text-xs text-slate-400">{detail}</p>
        </div>
        <div className={cn("rounded-2xl p-3", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function averageCompliance(rows: DepartmentRow[]) {
  const withRate = rows.filter((row) => row.complianceRate !== null);
  if (withRate.length === 0) return 0;
  return Math.round(withRate.reduce((sum, row) => sum + (row.complianceRate ?? 0), 0) / withRate.length);
}

function progressTone(value: number) {
  if (value >= 75) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function ministryLabel(name: string) {
  if (/finance|revenue|tax/i.test(name)) return "Ministry of Finance";
  if (/education/i.test(name)) return "Ministry of Education";
  if (/health/i.test(name)) return "Ministry of Health";
  if (/home|police/i.test(name)) return "Ministry of Home Affairs";
  if (/urban|municipal|housing/i.test(name)) return "Ministry of Housing & Urban Affairs";
  return "Government Department";
}
