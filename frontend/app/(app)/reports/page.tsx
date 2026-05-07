"use client";

import { useEffect, useState } from "react";
import { api, AdminUser, AuditEntry, DeptSummary, StatsResponse } from "@/lib/api";

type ReportCard = {
  title: string;
  description: string;
  onGenerate: () => void;
};

export default function ReportsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [departments, setDepartments] = useState<DeptSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const [caseStats, deptSummary, logs, adminUsers] = await Promise.all([
          api.cases.stats(),
          api.departments.summary(),
          api.audit.logs({ limit: 100 }),
          api.admin.users().catch(() => [] as AdminUser[]),
        ]);
        setStats(caseStats);
        setDepartments(deptSummary);
        setAuditLogs(logs);
        setUsers(adminUsers);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const reportCards: ReportCard[] = [
    {
      title: "Compliance Summary",
      description: "Overview of compliance status by department.",
      onGenerate: () =>
        downloadJson("compliance-summary.json", {
          generated_at: new Date().toISOString(),
          departments,
        }),
    },
    {
      title: "Action Plan Status",
      description: "Detailed state of all action plans.",
      onGenerate: () =>
        downloadJson("action-plan-status.json", {
          generated_at: new Date().toISOString(),
          stats,
        }),
    },
    {
      title: "Department Performance",
      description: "Performance metrics by department.",
      onGenerate: () =>
        downloadCsv(
          "department-performance.csv",
          [
            ["Department", "Total", "Comply", "Appeal", "Inform", "Monitor", "Earliest Deadline"],
            ...departments.map((item) => [
              item.department,
              String(item.total),
              String(item.by_action.COMPLY),
              String(item.by_action.APPEAL),
              String(item.by_action.INFORM),
              String(item.by_action.MONITOR),
              item.earliest_deadline ?? "",
            ]),
          ],
        ),
    },
    {
      title: "Audit Summary",
      description: "Summary of audit activities and logs.",
      onGenerate: () =>
        downloadCsv(
          "audit-summary.csv",
          [
            ["Timestamp", "Event", "Case ID", "User ID", "Hash"],
            ...auditLogs.map((item) => [
              item.created_at,
              item.event,
              item.case_id ?? "",
              item.user_id ?? "",
              item.hash,
            ]),
          ],
        ),
    },
    {
      title: "Ingestion Summary",
      description: "Overview of ingested documents.",
      onGenerate: () =>
        downloadJson("ingestion-summary.json", {
          generated_at: new Date().toISOString(),
          pending_review: stats?.status_counts.PENDING_REVIEW ?? 0,
          verified: stats?.status_counts.VERIFIED ?? 0,
          total_audit_events: auditLogs.filter((item) => item.event === "CASE_INGESTED").length,
        }),
    },
    {
      title: "User Activity",
      description: "User activity and engagement report.",
      onGenerate: () =>
        downloadCsv(
          "user-activity.csv",
          [
            ["Name", "Email", "Role", "Department"],
            ...users.map((item) => [
              item.name,
              item.email,
              item.role,
              item.department ?? "",
            ]),
          ],
        ),
    },
  ];

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Reports</h1>
          <p className="mt-3 text-[15px] text-slate-500">
            Generate and download compliance and performance reports.
          </p>
        </header>

        {error && (
          <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-10 grid grid-cols-3 gap-6">
          {reportCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-[18px] font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">{card.description}</p>
              <button
                type="button"
                disabled={loading}
                onClick={card.onGenerate}
                className="mt-6 inline-flex h-10 items-center rounded-md border border-indigo-100 bg-white px-4 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60"
              >
                Generate Report
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(filename, blob);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(filename, blob);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
