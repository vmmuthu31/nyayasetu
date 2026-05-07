"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { api, AdminUser, AuditEntry, CaseDetail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";

const PAGE_SIZE = 5;

type EnrichedAuditEntry = AuditEntry & {
  actionLabel: string;
  userLabel: string;
  entityLabel: string;
  detailsLabel: string;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<EnrichedAuditEntry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);

      try {
        const [auditLogs, adminUsers] = await Promise.all([
          api.audit.logs({ limit: 100 }),
          api.admin.users().catch(() => [] as AdminUser[]),
        ]);

        const caseIds = Array.from(new Set(auditLogs.map((item) => item.case_id).filter(Boolean))) as string[];
        const caseEntries = await Promise.all(
          caseIds.map(async (caseId) => [caseId, await api.cases.get(caseId).catch(() => null)] as const),
        );
        const caseMap = new Map<string, CaseDetail | null>(caseEntries);
        const userMap = new Map(adminUsers.map((user) => [user.id, user]));

        setUsers(adminUsers);
        setLogs(auditLogs.map((entry) => enrichAuditEntry(entry, userMap, caseMap)));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((item) => item.actionLabel))).filter(Boolean).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return logs.filter((item) => {
      const matchesAction = !actionFilter || item.actionLabel === actionFilter;
      const matchesUser = !userFilter || item.userLabel === userFilter;
      const matchesSearch =
        !needle ||
        item.actionLabel.toLowerCase().includes(needle) ||
        item.userLabel.toLowerCase().includes(needle) ||
        item.entityLabel.toLowerCase().includes(needle) ||
        item.detailsLabel.toLowerCase().includes(needle);
      const createdAt = new Date(item.created_at).getTime();
      const afterStart =
        !dateRange.startDate || createdAt >= new Date(dateRange.startDate).getTime();
      const beforeEnd =
        !dateRange.endDate || createdAt <= new Date(`${dateRange.endDate}T23:59:59`).getTime();
      return matchesAction && matchesUser && matchesSearch && afterStart && beforeEnd;
    });
  }, [actionFilter, dateRange.endDate, dateRange.startDate, logs, search, userFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const visibleLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Audit Trail</h1>
          <p className="mt-3 text-[15px] text-slate-500">
            Immutable log of all activities performed on the platform.
          </p>
        </header>

        <section className="mt-10 grid grid-cols-[minmax(180px,220px)_minmax(180px,220px)_minmax(250px,290px)_1fr] gap-4">
          <SelectShell value={actionFilter || "All Actions"}>
            <select
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Filter by action"
            >
              <option value="">All Actions</option>
              {actionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </SelectShell>

          <SelectShell value={userFilter || "All Users"}>
            <select
              value={userFilter}
              onChange={(event) => {
                setUserFilter(event.target.value);
                setPage(1);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Filter by user"
            >
              <option value="">All Users</option>
              {users.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </SelectShell>

          <DateRangeFilter label="Log date range" value={dateRange} onChange={setDateRange} />

          <div className="relative h-[52px] rounded-md border border-slate-200 bg-white shadow-sm">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search logs..."
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
                {["TIMESTAMP", "USER", "ACTION", "ENTITY", "DETAILS", "HASH"].map((heading) => (
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
                    Loading audit logs
                  </td>
                </tr>
              ) : visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                visibleLogs.map((item) => (
                  <tr key={item.id} className="text-sm text-slate-600">
                    <td className="w-[20%] px-4 py-5 font-medium text-slate-700">{formatAuditTimestamp(item.created_at)}</td>
                    <td className="w-[16%] px-4 py-5 font-medium text-slate-700">{item.userLabel}</td>
                    <td className="w-[16%] px-4 py-5 font-medium text-slate-700">{item.actionLabel}</td>
                    <td className="w-[22%] px-4 py-5 font-medium text-slate-700">{item.entityLabel}</td>
                    <td className="w-[18%] px-4 py-5 font-medium text-slate-500">{item.detailsLabel}</td>
                    <td className="w-[8%] px-4 py-5 font-mono text-xs text-slate-400">{shortHash(item.hash)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-7 flex items-center justify-between text-sm text-slate-500">
          <p>
            Showing {filteredLogs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}
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
            {totalPages > 5 && <span className="px-2 text-slate-400">...</span>}
            {totalPages > 5 && (
              <PageButton active={page === totalPages} onClick={() => setPage(totalPages)}>
                {totalPages}
              </PageButton>
            )}
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

function enrichAuditEntry(
  entry: AuditEntry,
  userMap: Map<string, AdminUser>,
  caseMap: Map<string, CaseDetail | null>,
): EnrichedAuditEntry {
  const detailsString = entry.details ? JSON.stringify(entry.details) : "";
  return {
    ...entry,
    actionLabel: humanizeEvent(entry.event),
    userLabel: userMap.get(entry.user_id ?? "")?.name ?? shortUser(entry.user_id),
    entityLabel: caseMap.get(entry.case_id ?? "")?.case_number ?? systemEntity(entry),
    detailsLabel: detailLabel(entry, detailsString),
  };
}

function humanizeEvent(event: string) {
  const mapped: Record<string, string> = {
    CASE_INGESTED: "Uploaded Document",
    DIRECTIVE_APPROVE: "Verified Directive",
    DIRECTIVE_REJECT: "Rejected Directive",
    CASE_STATUS_CHANGED: "Updated Action",
    USER_LOGIN: "User Login",
  };
  return mapped[event] ?? event.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function detailLabel(entry: AuditEntry, detailsString: string) {
  if (entry.event === "CASE_INGESTED") return "Document ingested";
  if (entry.event === "DIRECTIVE_APPROVE") return "Directive verified";
  if (entry.event === "CASE_STATUS_CHANGED") return "Action item updated";
  if (detailsString.toLowerCase().includes("login")) return "Login successful";
  return detailsString ? trim(detailsString, 28) : "-";
}

function systemEntity(entry: AuditEntry) {
  if (!entry.case_id) return "System";
  return shortHash(entry.case_id);
}

function shortUser(userId?: string) {
  if (!userId) return "System";
  return `User ${userId.slice(0, 6)}`;
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...`;
}

function trim(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function formatAuditTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
