const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ns_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Token expired — clear session and redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem("ns_token");
      localStorage.removeItem("ns_user");
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// Auth
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (data: RegisterData) =>
      request<{ access_token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  cases: {
    list: (params?: { status?: string; search?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<CaseListItem[]>(`/cases${q ? `?${q}` : ""}`);
    },
    get: (id: string) => request<CaseDetail>(`/cases/${id}`),
    stats: () => request<StatsResponse>(`/cases/stats`),
    pdfUrl: (id: string) => request<{ url: string }>(`/cases/${id}/pdf-url`),
    exportActionPlan: (id: string) => `${BASE}/cases/${id}/export/action-plan`,
  },

  ingest: {
    upload: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const token = getToken();
      const res = await fetch(`${BASE}/ingest`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Upload failed");
      }
      return res.json() as Promise<IngestResponse>;
    },
  },

  review: {
    decide: (directiveId: string, decision: "approve" | "reject", updates?: DirectiveUpdate, notes?: string) =>
      request(`/review/directives/${directiveId}`, {
        method: "POST",
        body: JSON.stringify({ decision, updates, notes }),
      }),
    setCaseStatus: (caseId: string, status: string, notes?: string) =>
      request(`/review/cases/${caseId}/status`, {
        method: "POST",
        body: JSON.stringify({ status, notes }),
      }),
  },

  audit: {
    logs: (params?: { case_id?: string; limit?: number }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<AuditEntry[]>(`/audit/logs${q ? `?${q}` : ""}`);
    },
    verify: () => request<{ valid: boolean; broken_at_sequence?: number; total_records?: number }>("/audit/verify"),
  },

  departments: {
    summary: () => request<DeptSummary[]>("/departments/summary"),
    actions: (department: string) =>
      request<DeptAction[]>(`/departments/actions?department=${encodeURIComponent(department)}`),
  },
};

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "REVIEWER" | "DEPT_USER";
  department?: string;
  designation?: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
  role?: string;
  department?: string;
  designation?: string;
  mobile?: string;
  office_unit?: string;
  state?: string;
}

export interface CaseListItem {
  id: string;
  case_number: string;
  court: string;
  petitioners: string;
  status: string;
  confidence_score: number;
  filed_at: string;
  judgment_date: string | null;
  directive_count: number;
}

export interface HighlightCoord {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  page_width: number;
  page_height: number;
}

export interface Directive {
  id: string;
  text: string;
  action_type: string;
  department: string;
  deadline: string | null;
  deadline_text?: string | null;          // Exact phrase e.g. "within 8 weeks"
  confidence_score: number;
  is_ambiguous: boolean;
  ambiguity_reason?: string;
  status: string;
  page_number?: number;
  highlight_coords?: HighlightCoord[];    // Real PyMuPDF bounding boxes
  limitation_days?: number;               // Days until appeal deadline expires
}

export interface ActionPlanSummary {
  total_directives: number;
  verified_count: number;
  pending_count: number;
  rejected_count: number;
  comply_count: number;
  appeal_count: number;
  inform_count: number;
  monitor_count: number;
  to_departments: number;
}

export interface CaseDetail {
  id: string;
  case_number: string;
  court: string;
  petitioners: string;
  respondents: string;
  judgment_date: string | null;
  received_at: string | null;             // When judgment was received
  filed_at: string;
  status: string;
  confidence_score: number;
  page_count: number;                     // Total PDF pages
  directives: Directive[];
  summary: ActionPlanSummary | null;      // Computed breakdown
}

export interface StatsResponse {
  status_counts: Record<string, number>;
  upcoming_deadlines: Array<{
    case_number: string;
    department: string;
    deadline: string;
    case_id: string;
  }>;
}

export interface IngestResponse {
  case_id: string;
  case_number: string;
  directive_count: number;
  quality_score: number;
  ambiguous_count: number;
  message: string;
}

export interface AuditEntry {
  id: string;
  sequence: number;
  event: string;
  case_id?: string;
  user_id?: string;
  details?: Record<string, unknown>;
  hash: string;
  prev_hash: string;
  created_at: string;
}

export interface DirectiveUpdate {
  action_type?: string;
  department?: string;
  deadline?: string;
  notes?: string;
}

export interface DeptSummary {
  department: string;
  total: number;
  by_action: { COMPLY: number; APPEAL: number; INFORM: number; MONITOR: number };
  earliest_deadline: string | null;
  days_until_deadline: number | null;
}

export interface DeptAction {
  directive_id: string;
  case_id: string;
  case_number: string;
  court: string;
  judgment_date: string | null;
  directive_text: string;
  action_type: string;
  department: string;
  deadline: string | null;
  confidence_score: number;
}
