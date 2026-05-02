import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  const target = new Date(date);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pending Review",
  VERIFIED: "Verified",
  ACTIONED: "Actioned",
  APPEALED: "Appealed",
  REJECTED: "Rejected",
};

export const ACTION_LABELS: Record<string, string> = {
  COMPLY: "Comply",
  APPEAL: "Appeal",
  INFORM: "Inform",
  MONITOR: "Monitor",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: "#f59e0b",
  VERIFIED: "#10b981",
  ACTIONED: "#3b82f6",
  APPEALED: "#8b5cf6",
  REJECTED: "#ef4444",
};
