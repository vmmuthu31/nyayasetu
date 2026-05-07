"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { api, CaseDetail, CaseListItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDepartmentOptions } from "@/lib/use-department-options";

const PAGE_SIZE = 5;

type ReviewCase = CaseListItem & {
  department: string;
  priority: "High" | "Medium" | "Low";
};

const PRIORITY_STYLES: Record<ReviewCase["priority"], string> = {
  High: "bg-rose-50 text-rose-600",
  Medium: "bg-amber-50 text-amber-600",
  Low: "bg-emerald-50 text-emerald-600",
};

export default function CasesPage() {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.cases
      .list({ status: "PENDING_REVIEW", limit: 100 })
      .then(async (items) => {
        const enriched = await Promise.all(
          items.map(async (item) => {
            const detail = await api.cases.get(item.id).catch(() => null);
            return toReviewCase(item, detail);
          }),
        );
        setCases(enriched);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const liveDepartments = useMemo(
    () => Array.from(new Set(cases.map((item) => item.department))).filter(Boolean).sort(),
    [cases],
  );
  const departments = useDepartmentOptions(liveDepartments);

  const filteredCases = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesSearch =
        !needle ||
        item.case_number.toLowerCase().includes(needle) ||
        item.petitioners.toLowerCase().includes(needle) ||
        item.court.toLowerCase().includes(needle);
      const matchesDepartment = !department || item.department === department;
      const matchesPriority = !priority || item.priority === priority;
      return matchesSearch && matchesDepartment && matchesPriority;
    });
  }, [cases, department, priority, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const visibleCases = filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Pending Review</h1>
          <p className="mt-3 text-[15px] text-slate-500">
            Review and verify extracted directives from ingested judgments.
          </p>
        </header>

        <section className="mt-10 grid grid-cols-[minmax(190px,290px)_minmax(170px,235px)_1fr] gap-4">
          <SelectShell value={department || "All Departments"}>
            <select
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setPage(1);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Filter by department"
            >
              <option value="">All Departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </SelectShell>

          <SelectShell value={priority || "All Priorities"}>
            <select
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Filter by priority"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </SelectShell>

          <div className="relative h-[52px] rounded-md border border-slate-200 bg-white shadow-sm">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by title or case no."
              className="h-full w-full rounded-md bg-transparent pl-12 pr-4 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-8 overflow-hidden bg-white">
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {["CASE TITLE / COURT", "DEPARTMENT", "DIRECTIVES", "INGESTED ON", "PRIORITY", "ACTIONS"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading pending reviews
                    </span>
                  </td>
                </tr>
              ) : visibleCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    No pending reviews found
                  </td>
                </tr>
              ) : (
                visibleCases.map((item) => (
                  <tr key={item.id} className="text-sm text-slate-600">
                    <td className="w-[34%] px-4 py-5">
                      <p className="truncate text-[15px] font-semibold text-slate-900">{caseTitle(item)}</p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-500">{item.court}</p>
                    </td>
                    <td className="w-[20%] px-4 py-5 font-medium text-slate-700">{item.department}</td>
                    <td className="w-[12%] px-4 py-5 font-semibold text-slate-700">{item.directive_count}</td>
                    <td className="w-[16%] px-4 py-5 font-medium text-slate-500">{formatShortDate(item.filed_at)}</td>
                    <td className="w-[10%] px-4 py-5">
                      <span className={cn("rounded-md px-3 py-1 text-xs font-bold", PRIORITY_STYLES[item.priority])}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="w-[8%] px-4 py-5">
                      <Link
                        href={`/cases/${item.id}/review`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-100 bg-white px-3 text-sm font-bold text-indigo-600 shadow-sm transition hover:border-indigo-100 hover:bg-indigo-50"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-7 flex items-center justify-between text-sm text-slate-500">
          <p>
            Showing {filteredCases.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, filteredCases.length)} of {filteredCases.length}
          </p>
          <div className="flex items-center gap-2">
            <PageButton disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </PageButton>
            {Array.from({ length: Math.min(totalPages, 4) }, (_, index) => index + 1).map((pageNumber) => (
              <PageButton key={pageNumber} active={pageNumber === page} onClick={() => setPage(pageNumber)}>
                {pageNumber}
              </PageButton>
            ))}
            <PageButton disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <ChevronRight className="h-4 w-4" />
            </PageButton>
          </div>
        </footer>
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

function PageButton({
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
        "flex h-10 min-w-10 items-center justify-center rounded-md border border-transparent px-3 text-sm font-semibold text-slate-500 transition",
        active && "border-indigo-100 text-indigo-600 shadow-sm",
        disabled ? "cursor-not-allowed opacity-40" : "hover:border-slate-100 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function toReviewCase(item: CaseListItem, detail: CaseDetail | null): ReviewCase {
  const firstDepartment = detail?.directives.find((directive) => directive.department)?.department;
  return {
    ...item,
    department: firstDepartment || departmentFromCourt(item.court),
    priority: getPriority(item),
  };
}

function getPriority(item: CaseListItem): ReviewCase["priority"] {
  if (item.confidence_score < 0.55 || item.directive_count >= 7) return "High";
  if (item.confidence_score < 0.78 || item.directive_count >= 4) return "Medium";
  return "Low";
}

function departmentFromCourt(court: string) {
  if (/municipal|urban|bombay/i.test(court)) return "Urban Development";
  if (/finance|tax|revenue/i.test(court)) return "Revenue Department";
  if (/supreme|union/i.test(court)) return "Finance Department";
  if (/home|criminal|police/i.test(court)) return "Home Department";
  return "Law Department";
}

function caseTitle(item: CaseListItem) {
  if (item.petitioners && item.petitioners !== "Unknown") return item.petitioners;
  return item.case_number;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
