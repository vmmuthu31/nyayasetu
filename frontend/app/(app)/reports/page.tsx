"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";
import { api, ReportExportRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type ReportCard = {
  title: string;
  description: string;
  icon: typeof FileText;
};

const REPORT_CARDS: ReportCard[] = [
  { title: "Compliance Summary", description: "Overview of compliance status by department.", icon: FileText },
  { title: "Action Plan Status", description: "Detailed state of all action plans.", icon: FileSpreadsheet },
  { title: "Department Performance", description: "Performance metrics and operational rankings by department.", icon: FileText },
  { title: "Audit Summary", description: "Tamper-evident audit exports with event hash traces.", icon: FileText },
  { title: "Ingestion Summary", description: "Upload throughput, extraction volume, and ingestion quality indicators.", icon: FileSpreadsheet },
  { title: "User Activity", description: "Operational activity report across platform users.", icon: FileText },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);
  const [form, setForm] = useState<ReportExportRequest>({
    report_type: "Compliance Summary",
    format: "pdf",
    start_date: "",
    end_date: "",
    department: "",
  });

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const [options, summary] = await Promise.all([
          api.auth.options().catch(() => null),
          api.departments.summary().catch(() => []),
        ]);
        const optionNames = options?.departments.map((department) => department.name) ?? [];
        const summaryNames = summary.map((item) => item.department);
        setDepartments(Array.from(new Set([...optionNames, ...summaryNames])).sort());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, [user]);

  const departmentOptions = useMemo(
    () => departments,
    [departments],
  );

  async function generateReport() {
    if (!selectedReport) return;
    setGenerating(true);
    setError(null);
    try {
      const payload: ReportExportRequest = {
        ...form,
        report_type: selectedReport.title,
        department: form.department || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      };
      const { blob, filename } = await api.reports.export(payload);
      triggerDownload(filename, blob);
      setSelectedReport(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-8 py-8">
        <header className="max-w-4xl">
          <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Reports</h1>
          <p className="mt-3 max-w-3xl text-[15px] text-slate-500">
            Generate downloadable compliance documents with filters, export metadata, and backend audit logging for each report run.
          </p>
        </header>

        {error ? (
          <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                    Audit Ready
                  </span>
                </div>
                <h2 className="mt-5 text-[18px] font-semibold text-slate-900">{card.title}</h2>
                <p className="mt-3 min-h-16 text-sm leading-6 text-slate-500">{card.description}</p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setSelectedReport(card);
                    setForm((current) => ({ ...current, report_type: card.title }));
                  }}
                  className="mt-6 inline-flex h-10 items-center rounded-md border border-indigo-100 bg-white px-4 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60"
                >
                  Generate Report
                </button>
              </div>
            );
          })}
        </section>
      </div>

      {selectedReport ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_32px_90px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Generate Report</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedReport.title} will be compiled from live backend data and logged into the audit trail.
                </p>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Report Type
                <input value={selectedReport.title} readOnly className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Department
                <select
                  value={form.department}
                  onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-indigo-300"
                >
                  <option value="">All Departments</option>
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Start Date
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-indigo-300"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                End Date
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-indigo-300"
                />
              </label>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-slate-700">Format</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[
                  { value: "pdf", label: "PDF", desc: "Official document export" },
                  { value: "excel", label: "Excel", desc: "Operational spreadsheet view" },
                  { value: "csv", label: "CSV", desc: "Raw data export" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, format: option.value as ReportExportRequest["format"] }))}
                    className={`rounded-2xl border p-4 text-left transition ${
                      form.format === option.value
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{option.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              The export will include metadata, filters used, timestamp, and an audit log entry for traceability.
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => void generateReport()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
