"use client";

/**
 * Renders a PDF page (via <iframe> pointing to presigned S3 URL) with
 * a positioned highlight overlay drawn from real PyMuPDF bounding boxes.
 *
 * Coord system: PyMuPDF gives (x0, y0, x1, y1) in PDF points (72 dpi).
 * We convert to percentages of the page dimensions so the overlay scales
 * with any display size.
 */

import { useState, useEffect } from "react";
import { ExternalLink, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface HighlightBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  page_width: number;
  page_height: number;
}

interface Props {
  pdfUrl: string | null;
  highlights: HighlightBox[];
  activePage: number;
  className?: string;
}

export function PdfHighlightViewer({ pdfUrl, highlights, activePage, className }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const pageHighlights = highlights.filter((h) => h.page === activePage);

  if (!pdfUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 text-sm", className)}>
        PDF not available
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOverlay((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors",
              showOverlay
                ? "border-yellow-400 bg-yellow-50 text-yellow-800"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            <Layers className="w-3 h-3" />
            {showOverlay ? "Highlights ON" : "Highlights OFF"}
          </button>
          {pageHighlights.length > 0 && (
            <span className="text-xs text-slate-500">
              {pageHighlights.length} source region{pageHighlights.length > 1 ? "s" : ""} on page {activePage}
            </span>
          )}
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Open PDF
        </a>
      </div>

      {/* PDF + overlay container */}
      <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100" style={{ height: 500 }}>
        <iframe
          src={`${pdfUrl}#page=${activePage}`}
          className="w-full h-full border-0"
          onLoad={() => setLoaded(true)}
          title="Judgment PDF"
        />

        {/* Highlight overlay — positioned absolutely over the iframe */}
        {showOverlay && loaded && pageHighlights.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {pageHighlights.map((h, i) => {
              // Convert PDF point coords to % of container
              const left = `${(h.x0 / h.page_width) * 100}%`;
              const top = `${(h.y0 / h.page_height) * 100}%`;
              const width = `${((h.x1 - h.x0) / h.page_width) * 100}%`;
              const height = `${((h.y1 - h.y0) / h.page_height) * 100}%`;

              return (
                <div
                  key={i}
                  className="absolute rounded"
                  style={{
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: "rgba(251, 191, 36, 0.35)",
                    border: "2px solid rgba(245, 158, 11, 0.8)",
                  }}
                  title={`Source region ${i + 1}`}
                />
              );
            })}
          </div>
        )}

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
