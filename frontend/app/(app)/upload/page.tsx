"use client";

import { useState, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { api, IngestResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type Stage = "idle" | "uploading" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".pdf")) { setError("Only PDF files are supported"); return; }
    setFile(f);
    setStage("idle");
    setError(null);
    setResult(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleIngest = async () => {
    if (!file) return;
    setStage("uploading");
    setError(null);
    try {
      const res = await api.ingest.upload(file);
      setResult(res);
      setStage("done");
    } catch (e: unknown) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ingest Judgment PDF</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload a court judgment PDF. The system will OCR, extract directives, and generate an action plan.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "card border-2 border-dashed p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors",
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        <Upload className={cn("w-12 h-12", dragging ? "text-blue-500" : "text-slate-300")} />
        {file ? (
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
              <p className="font-medium text-slate-800">{file.name}</p>
            </div>
            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium text-slate-600">Drop a PDF here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Karnataka High Court judgment PDFs supported</p>
          </div>
        )}
      </div>

      {/* Pipeline Steps */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">Processing Pipeline</p>
        <ol className="space-y-2">
          {[
            "PDF Ingestion & OCR (PyMuPDF + Tesseract)",
            "Legal Chunking & Directive Detection",
            "LLM Entity Extraction (Claude)",
            "Action Plan Generation & Timeline Engine",
            "SHA-256 Audit Log Entry",
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Action */}
      {stage !== "done" && (
        <button
          disabled={!file || stage === "uploading"}
          onClick={handleIngest}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {stage === "uploading" ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
          ) : (
            <><Upload className="w-5 h-5" /> Ingest & Process</>
          )}
        </button>
      )}

      {/* Error */}
      {stage === "error" && error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Ingestion failed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {stage === "done" && result && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-slate-900">{result.message}</p>
              <p className="text-sm text-slate-500">Case: {result.case_number}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Directives Found" value={result.directive_count} />
            <Metric label="Quality Score" value={`${Math.round(result.quality_score * 100)}%`} />
            <Metric label="Needs Review" value={result.ambiguous_count} warn={result.ambiguous_count > 0} />
          </div>
          {result.ambiguous_count > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {result.ambiguous_count} directive{result.ambiguous_count > 1 ? "s" : ""} flagged for human review
            </div>
          )}
          <button
            onClick={() => router.push(`/cases/${result.case_id}/review`)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            Open Review →
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg p-3 text-center", warn ? "bg-amber-50" : "bg-slate-50")}>
      <p className={cn("text-xl font-bold", warn ? "text-amber-700" : "text-slate-900")}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
