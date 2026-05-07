"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { api, AuditEntry, CaseDetail, CaseListItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/rbac";
import { useDepartmentOptions } from "@/lib/use-department-options";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";

const PAGE_SIZE = 5;

type DownloadTab = "Documents" | "Extracts" | "Action Plans" | "Audit Logs";

type DownloadItem = {
  id: string;
  fileName: string;
  type: string;
  department: string;
  date: string;
  size: string;
  onDownload: () => Promise<void> | void;
};

export default function DownloadsPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [details, setDetails] = useState<Record<string, CaseDetail | null>>({});
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [tab, setTab] = useState<DownloadTab>("Documents");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const [verifiedCases, logs] = await Promise.all([
          api.cases.list({ status: "VERIFIED", limit: 100 }),
          can(user, "view_audit") ? api.audit.logs({ limit: 50 }).catch(() => [] as AuditEntry[]) : Promise.resolve([] as AuditEntry[]),
        ]);
        setCases(verifiedCases);
        setAuditLogs(logs);
        const pairs = await Promise.all(
          verifiedCases.map(async (item) => [item.id, await api.cases.get(item.id).catch(() => null)] as const),
        );
        setDetails(Object.fromEntries(pairs));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, [user]);

  const liveDepartments = useMemo(
    () =>
      Array.from(
        new Set(
          cases
            .map((item) => caseDepartment(details[item.id], item.court))
            .filter(Boolean),
        ),
      ).sort(),
    [cases, details],
  );
  const departments = useDepartmentOptions(liveDepartments);

  const items = useMemo(
    () => buildDownloadItems(tab, cases, details, auditLogs),
    [auditLogs, cases, details, tab],
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesDepartment = !department || item.department === department;
      const matchesSearch =
        !needle ||
        item.fileName.toLowerCase().includes(needle) ||
        item.type.toLowerCase().includes(needle) ||
        item.department.toLowerCase().includes(needle);
      const itemDate = new Date(item.date).getTime();
      const afterStart =
        !dateRange.startDate || itemDate >= new Date(dateRange.startDate).getTime();
      const beforeEnd =
        !dateRange.endDate || itemDate <= new Date(`${dateRange.endDate}T23:59:59`).getTime();
      return matchesDepartment && matchesSearch && afterStart && beforeEnd;
    });
  }, [dateRange.endDate, dateRange.startDate, department, items, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const availableTabs = (["Documents", "Extracts", "Action Plans", "Audit Logs"] as const).filter(
    (item) => item !== "Audit Logs" || can(user, "view_audit"),
  );

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Downloads</h1>
          <p className="mt-3 text-[15px] text-slate-500">Download documents, reports, and extracts.</p>
        </header>

        <div className="mt-8 flex items-center gap-8 border-b border-slate-100">
          {availableTabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTab(item);
                setPage(1);
              }}
              className={cn(
                "border-b-2 pb-3 text-sm font-semibold text-slate-500 transition",
                tab === item && "border-indigo-500 text-indigo-600",
                tab !== item && "border-transparent hover:text-slate-700",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <section className="mt-6 grid grid-cols-[minmax(190px,220px)_minmax(250px,290px)_1fr] gap-4">
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

          <DateRangeFilter label="Download date range" value={dateRange} onChange={setDateRange} />

          <div className="relative h-[52px] rounded-md border border-slate-200 bg-white shadow-sm">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search documents..."
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
                {["FILE NAME", "TYPE", "DEPARTMENT", "DATE", "SIZE", "ACTIONS"].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    Loading download items
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    No download items found
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr key={item.id} className="text-sm text-slate-600">
                    <td className="w-[36%] px-4 py-5 font-medium text-slate-800">{item.fileName}</td>
                    <td className="w-[12%] px-4 py-5 font-medium text-slate-700">{item.type}</td>
                    <td className="w-[18%] px-4 py-5 font-medium text-slate-700">{item.department}</td>
                    <td className="w-[14%] px-4 py-5 font-medium text-slate-500">{formatShortDate(item.date)}</td>
                    <td className="w-[10%] px-4 py-5 font-medium text-slate-500">{item.size}</td>
                    <td className="w-[10%] px-4 py-5">
                      <button
                        type="button"
                        onClick={() => void item.onDownload()}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-slate-50 hover:text-indigo-600"
                        aria-label={`Download ${item.fileName}`}
                      >
                        <Download className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-7 flex items-center justify-between text-sm text-slate-500">
          <p>
            Showing {filteredItems.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
          </p>
          <div className="flex items-center gap-2">
            <PageButton disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="size-4" />
            </PageButton>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
              <PageButton key={pageNumber} active={pageNumber === page} onClick={() => setPage(pageNumber)}>
                {pageNumber}
              </PageButton>
            ))}
            <PageButton disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <ChevronRight className="size-4" />
            </PageButton>
          </div>
        </footer>
      </div>
    </main>
  );
}

function buildDownloadItems(
  tab: DownloadTab,
  cases: CaseListItem[],
  details: Record<string, CaseDetail | null>,
  auditLogs: AuditEntry[],
): DownloadItem[] {
  if (tab === "Audit Logs") {
    return auditLogs.map((item) => ({
      id: item.id,
      fileName: `audit_${item.sequence}.csv`,
      type: "Audit Log",
      department: "System",
      date: item.created_at,
      size: "1 KB",
      onDownload: () =>
        downloadCsv(`audit_${item.sequence}.csv`, [
          ["timestamp", "event", "case_id", "user_id", "hash"],
          [item.created_at, item.event, item.case_id ?? "", item.user_id ?? "", item.hash],
        ]),
    }));
  }

  return cases.map((item) => {
    const detail = details[item.id];
    const department = caseDepartment(detail, item.court);
    const directivesText = detail?.directives.map((directive) => directive.text).join("\n\n") ?? item.petitioners;

    if (tab === "Documents") {
      return {
        id: `${item.id}-document`,
        fileName: `${safeName(item.case_number)}_Judgment.pdf`,
        type: "Judgment",
        department,
        date: item.judgment_date || item.filed_at,
        size: `${Math.max(1, item.directive_count)}.4 MB`,
        onDownload: async () => {
          const { url } = await api.cases.pdfUrl(item.id);
          window.open(url, "_blank");
        },
      };
    }

    if (tab === "Extracts") {
      return {
        id: `${item.id}-extract`,
        fileName: `Extract_${safeName(item.case_number)}.txt`,
        type: "Extract",
        department,
        date: item.judgment_date || item.filed_at,
        size: `${Math.max(1, Math.ceil(directivesText.length / 1024))} KB`,
        onDownload: () => downloadText(`Extract_${safeName(item.case_number)}.txt`, directivesText),
      };
    }

    return {
      id: `${item.id}-action-plan`,
      fileName: `Action_Plan_${safeName(item.case_number)}.json`,
      type: "Action Plan",
      department,
      date: item.judgment_date || item.filed_at,
      size: `${Math.max(1, item.directive_count)}.1 MB`,
      onDownload: () => window.open(api.cases.exportActionPlan(item.id), "_blank"),
    };
  });
}

function caseDepartment(detail: CaseDetail | null | undefined, fallbackCourt: string) {
  return detail?.directives.find((directive) => directive.department)?.department ?? departmentFromCourt(fallbackCourt);
}

function departmentFromCourt(court: string) {
  if (/municipal|urban|bombay/i.test(court)) return "Urban Development";
  if (/finance|tax|revenue/i.test(court)) return "Revenue Department";
  if (/supreme|union/i.test(court)) return "Finance Department";
  if (/home|criminal|police/i.test(court)) return "Home Department";
  return "Law Department";
}

function safeName(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  triggerDownload(filename, blob);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SelectShell({ children, value }: { children: React.ReactNode; value: string }) {
  return (
    <div className="relative flex h-[52px] items-center justify-between rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm">
      <span className="truncate">{value}</span>
      <ChevronDown className="size-4 text-slate-400" />
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
