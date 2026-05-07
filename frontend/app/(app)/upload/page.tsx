"use client";

import { useCallback, useEffect, useMemo, useRef, useState, DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  FileText,
  Loader2,
  RefreshCw,
  RotateCw,
  Upload,
  XCircle,
} from "lucide-react";
import { api, CaseListItem, IngestResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type Stage = "idle" | "uploading" | "done" | "error";

const PAGE_SIZE = 4;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: "bg-blue-50 text-blue-700",
  VERIFIED: "bg-emerald-50 text-emerald-700",
  ACTIONED: "bg-emerald-50 text-emerald-700",
  APPEALED: "bg-violet-50 text-violet-700",
  REJECTED: "bg-rose-50 text-rose-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Processing",
  VERIFIED: "Completed",
  ACTIONED: "Completed",
  APPEALED: "Appealed",
  REJECTED: "Failed",
};

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(cases.length / PAGE_SIZE));
  const visibleCases = useMemo(
    () => cases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [cases, page],
  );

  const loadCases = useCallback(() => {
    setLoadingCases(true);
    api.cases
      .list({ limit: 50 })
      .then((items) => {
        setCases(items);
        setPage(1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingCases(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCases);
  }, [loadCases]);

  const handleFile = (selected: File) => {
    const lower = selected.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setError("Only PDF and DOCX files are supported");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("File size must be 50MB or less");
      return;
    }

    setFile(selected);
    setStage("idle");
    setError(null);
    setResult(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files[0];
    if (selected) handleFile(selected);
  };

  const handleIngest = async (selectedFile = file) => {
    if (!selectedFile || stage === "uploading") return;
    setStage("uploading");
    setError(null);

    try {
      const response = await api.ingest.upload(selectedFile);
      setResult(response);
      setStage("done");
      loadCases();
    } catch (e: unknown) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const chooseFile = () => inputRef.current?.click();

  return (
    <main className="h-full overflow-y-auto bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-8 py-8">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-slate-950">New Ingestion</h1>
            <p className="mt-3 text-[15px] text-slate-500">
              Upload court judgments and extract actionable insights.
            </p>
          </div>
          <button
            type="button"
            onClick={() => file ? handleIngest(file) : chooseFile()}
            disabled={stage === "uploading"}
            className="inline-flex h-12 items-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.28)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {stage === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload Document
          </button>
        </header>

        <section
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-[246px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition",
            dragging ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200 bg-white",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) handleFile(selected);
            }}
          />
          <CloudUpload className="h-12 w-12 stroke-[1.8] text-indigo-600" />
          <h2 className="mt-5 text-[17px] font-semibold text-slate-900">
            {file ? file.name : "Drag and drop your files here"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {file ? formatFileSize(file.size) : "Supports PDF, DOCX - Max 50MB"}
          </p>
          <button
            type="button"
            onClick={chooseFile}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md border border-indigo-100 bg-white px-6 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
          >
            Browse Files
          </button>
          {file && stage !== "uploading" && (
            <button
              type="button"
              onClick={() => handleIngest(file)}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600"
            >
              <FileText className="h-4 w-4" />
              Start ingestion
            </button>
          )}
        </section>

        {stage === "uploading" && (
          <StatusMessage tone="blue" icon={<Loader2 className="h-5 w-5 animate-spin" />}>
            Processing {file?.name}. This may take a moment while the backend extracts directives.
          </StatusMessage>
        )}

        {stage === "error" && error && (
          <StatusMessage tone="red" icon={<XCircle className="h-5 w-5" />}>
            {error}
          </StatusMessage>
        )}

        {stage === "done" && result && (
          <StatusMessage tone="green" icon={<FileText className="h-5 w-5" />}>
            {result.case_number} ingested with {result.directive_count} directive
            {result.directive_count === 1 ? "" : "s"}.{" "}
            <Link href={`/cases/${result.case_id}/review`} className="font-semibold underline-offset-2 hover:underline">
              Open review
            </Link>
          </StatusMessage>
        )}

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[20px] font-semibold text-slate-950">Recent Ingestions</h2>
            <button
              type="button"
              onClick={loadCases}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-50 hover:text-indigo-600"
              aria-label="Refresh recent ingestions"
            >
              <RefreshCw className={cn("h-4 w-4", loadingCases && "animate-spin")} />
            </button>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-100 bg-white">
            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  {["Title", "Uploaded By", "Uploaded On", "Status", "Actions"].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingCases ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      Loading recent ingestions...
                    </td>
                  </tr>
                ) : visibleCases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      No ingestions yet
                    </td>
                  </tr>
                ) : (
                  visibleCases.map((item) => (
                    <tr key={item.id} className="text-sm text-slate-600">
                      <td className="w-[34%] truncate px-4 py-4 font-medium text-slate-700">
                        {caseTitle(item)}
                      </td>
                      <td className="w-[22%] truncate px-4 py-4">{uploadedBy(item)}</td>
                      <td className="w-[18%] px-4 py-4">{formatShortDate(item.filed_at)}</td>
                      <td className="w-[16%] px-4 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-3 py-1 text-xs font-semibold",
                            STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-700",
                          )}
                        >
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="w-[10%] px-4 py-4">
                        <Link
                          href={`/cases/${item.id}/review`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-50 hover:text-indigo-600"
                          aria-label={`Open ${item.case_number}`}
                        >
                          <RotateCw className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <p>
              Showing {cases.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, cases.length)} of {cases.length}
            </p>
            <div className="flex items-center gap-2">
              <PageButton disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </PageButton>
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .slice(0, 3)
                .map((pageNumber) => (
                  <PageButton
                    key={pageNumber}
                    active={pageNumber === page}
                    onClick={() => setPage(pageNumber)}
                  >
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
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusMessage({
  children,
  icon,
  tone,
}: {
  children: ReactNode;
  icon: ReactNode;
  tone: "blue" | "green" | "red";
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    red: "border-rose-100 bg-rose-50 text-rose-700",
  };

  return (
    <div className={cn("mt-5 flex items-start gap-3 rounded-md border px-4 py-3 text-sm", styles[tone])}>
      {icon}
      <p>{children}</p>
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
  children: ReactNode;
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

function caseTitle(item: CaseListItem) {
  if (item.petitioners && item.petitioners !== "Unknown") return item.petitioners;
  return item.case_number;
}

function uploadedBy(item: CaseListItem) {
  const court = item.court?.replace("Court — pending review", "").trim();
  return court || "Manual Upload";
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
