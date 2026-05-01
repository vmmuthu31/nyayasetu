"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, ChevronRight } from "lucide-react";
import { api, AuditEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; total_records?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.audit.logs({ limit: 100 }), api.audit.verify()])
      .then(([l, s]) => { setLogs(l); setChainStatus(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Immutable Audit Trail</h1>
          <p className="text-slate-500 text-sm mt-0.5">SHA-256 hash chain — tamper-evident log of all system events</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Chain Integrity Banner */}
      {chainStatus && (
        <div className={cn(
          "flex items-center gap-3 rounded-xl px-5 py-4",
          chainStatus.valid ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
        )}>
          {chainStatus.valid
            ? <ShieldCheck className="w-6 h-6 text-emerald-600" />
            : <ShieldAlert className="w-6 h-6 text-red-600" />
          }
          <div>
            <p className={cn("font-semibold text-sm", chainStatus.valid ? "text-emerald-800" : "text-red-800")}>
              {chainStatus.valid ? "Chain Integrity Verified" : "Chain Integrity Compromised!"}
            </p>
            <p className="text-xs text-slate-500">
              {chainStatus.total_records ?? 0} records · Each = SHA-256(data + prev_hash)
            </p>
          </div>
        </div>
      )}

      {/* Log Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Seq", "Event", "Case", "Hash", "Timestamp", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline" />
              </td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No audit logs yet</td></tr>
            ) : logs.map((log) => (
              <React.Fragment key={log.id}>
                <tr
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">{log.sequence}</td>
                  <td className="px-4 py-3">
                    <EventBadge event={log.event} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-24 truncate">
                    {log.case_id ? log.case_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-32 truncate" title={log.hash}>
                    {log.hash.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform", expanded === log.id && "rotate-90")} />
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="font-mono text-xs text-slate-600 space-y-1">
                        <p><span className="text-slate-400">hash:</span> {log.hash}</p>
                        <p><span className="text-slate-400">prev_hash:</span> {log.prev_hash}</p>
                        {log.details && (
                          <p><span className="text-slate-400">details:</span> {JSON.stringify(log.details)}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EVENT_STYLES: Record<string, string> = {
  CASE_INGESTED: "bg-blue-100 text-blue-800",
  DIRECTIVE_APPROVE: "bg-emerald-100 text-emerald-800",
  DIRECTIVE_REJECT: "bg-red-100 text-red-800",
  CASE_STATUS_CHANGED: "bg-violet-100 text-violet-800",
};

function EventBadge({ event }: { event: string }) {
  return (
    <span className={cn("badge", EVENT_STYLES[event] ?? "bg-slate-100 text-slate-700")}>
      {event.replace(/_/g, " ")}
    </span>
  );
}
