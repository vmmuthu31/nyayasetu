"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { ActionPlan, api, CaseDetail, CaseListItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDepartmentOptions } from "@/lib/use-department-options";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";

const PAGE_SIZE = 5;

type VerifiedCase = CaseListItem & {
  department: string;
  verifiedOn: string;
  complianceStatus: string;
};

export default function VerifiedCasesPage() {
  const [cases, setCases] = useState<VerifiedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);

      try {
        const items = await api.cases.list({ status: "VERIFIED", limit: 100 });
        const enriched = await Promise.all(
          items.map(async (item) => {
            const detail = await api.cases.get(item.id).catch(() => null);
            const actionPlans = await api.actionPlans.byCase(item.id).catch(() => [] as ActionPlan[]);
            return toVerifiedCase(item, detail, actionPlans);
          }),
        );
        setCases(enriched);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

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
      const verifiedOn = new Date(item.verifiedOn).getTime();
      const afterStart =
        !dateRange.startDate || verifiedOn >= new Date(dateRange.startDate).getTime();
      const beforeEnd =
        !dateRange.endDate || verifiedOn <= new Date(`${dateRange.endDate}T23:59:59`).getTime();
      return matchesSearch && matchesDepartment && afterStart && beforeEnd;
    });
  }, [cases, dateRange.endDate, dateRange.startDate, department, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const visibleCases = filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Verified Cases</h1>
          <p className="mt-3 text-[15px] text-slate-500">
            All verified cases with approved directives and action plans.
          </p>
        </header>

        <section className="mt-10 grid grid-cols-[minmax(190px,290px)_minmax(240px,280px)_1fr] gap-4">
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

          <DateRangeFilter label="Verified date range" value={dateRange} onChange={setDateRange} />

          <div className="relative h-[52px] rounded-md border border-slate-200 bg-white shadow-sm">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search verified cases..."
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
                {["CASE TITLE / COURT", "DEPARTMENT", "VERIFIED ON", "DIRECTIVES", "STATUS", "ACTIONS"].map(
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
                      Loading verified cases
                    </span>
                  </td>
                </tr>
              ) : visibleCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    No verified cases found
                  </td>
                </tr>
              ) : (
                visibleCases.map((item) => (
                  <tr key={item.id} className="text-sm text-slate-600">
                    <td className="w-[36%] px-4 py-5">
                      <p className="truncate text-[15px] font-semibold text-slate-900">{caseTitle(item)}</p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-500">{item.court}</p>
                    </td>
                    <td className="w-[20%] px-4 py-5 font-medium text-slate-700">{item.department}</td>
                    <td className="w-[16%] px-4 py-5 font-medium text-slate-500">{formatShortDate(item.verifiedOn)}</td>
                    <td className="w-[12%] px-4 py-5 font-semibold text-slate-700">{item.directive_count}</td>
                    <td className="w-[10%] px-4 py-5">
                        <span className={cn(
                          "rounded-md px-3 py-1 text-xs font-bold",
                          item.complianceStatus === "Completed" && "bg-emerald-50 text-emerald-600",
                          item.complianceStatus === "Awaiting Review" && "bg-violet-50 text-violet-600",
                          item.complianceStatus === "In Progress" && "bg-blue-50 text-blue-600",
                          item.complianceStatus === "Pending" && "bg-amber-50 text-amber-600",
                          item.complianceStatus === "Escalated" && "bg-rose-50 text-rose-600",
                        )}>
                          {item.complianceStatus}
                        </span>
                    </td>
                    <td className="w-[8%] px-4 py-5">
                      <Link
                        href={`/cases/${item.id}/review`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-100 bg-white px-3 text-sm font-bold text-indigo-600 shadow-sm transition hover:border-indigo-100 hover:bg-indigo-50"
                      >
                        View
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
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
              <PageButton key={pageNumber} active={pageNumber === page} onClick={() => setPage(pageNumber)}>
                {pageNumber}
              </PageButton>
            ))}
            <PageButton
              disabled={page === totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
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

function toVerifiedCase(item: CaseListItem, detail: CaseDetail | null, actionPlans: ActionPlan[]): VerifiedCase {
  const firstDepartment = detail?.directives.find((directive) => directive.department)?.department;
  return {
    ...item,
    department: firstDepartment || departmentFromCourt(item.court),
    verifiedOn: item.judgment_date || item.filed_at,
    complianceStatus: summarizeCompliance(actionPlans),
  };
}

function summarizeCompliance(actionPlans: ActionPlan[]) {
  if (actionPlans.some((item) => item.status === "AWAITING_REVIEW")) return "Awaiting Review";
  if (actionPlans.some((item) => item.status === "ESCALATED")) return "Escalated";
  if (actionPlans.length > 0 && actionPlans.every((item) => item.status === "COMPLETED")) return "Completed";
  if (actionPlans.some((item) => item.status === "IN_PROGRESS")) return "In Progress";
  return "Pending";
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
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
