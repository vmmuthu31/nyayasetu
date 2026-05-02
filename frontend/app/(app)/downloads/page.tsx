"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Search, RefreshCw, FileText, FileJson } from "lucide-react";
import { api, CaseListItem } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

export default function DownloadsPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.cases
      .list({ status: "VERIFIED", search: search || undefined })
      .then(setCases)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handlePdfDownload = async (id: string) => {
    try {
      const { url } = await api.cases.pdfUrl(id);
      window.open(url, "_blank");
    } catch (e: unknown) {
      alert((e as Error).message ?? "Could not get PDF URL");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Downloads</h1>
            <p className="text-slate-500 text-xs">Export verified action plans and source judgments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search case…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Info banner */}
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Download className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Only <strong>verified cases</strong> are available for download. Pending cases must be reviewed first.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Case No.", "Court", "Petitioners", "Judgment Date", "Directives", "Action Plan (JSON)", "Source PDF"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Loading…
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No verified cases available for download</p>
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-blue-700">{c.case_number}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-36 truncate">{c.court}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-44 truncate">{c.petitioners}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.judgment_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-800">{c.directive_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={api.cases.exportActionPlan(c.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <FileJson className="w-3.5 h-3.5" /> Export JSON
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handlePdfDownload(c.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
