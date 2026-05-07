const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ns_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
    options: () => request<RegisterOptions>("/auth/options"),
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

  actionPlans: {
    myDepartment: (params?: { department?: string; status?: string; limit?: number }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<ActionPlan[]>(`/action-plans/my-department${q ? `?${q}` : ""}`);
    },
    get: (id: string) => request<ActionPlan>(`/action-plans/${id}`),
    byCase: (caseId: string) => request<ActionPlan[]>(`/action-plans/case/${caseId}`),
    reviewQueue: (limit?: number) =>
      request<ActionPlan[]>(`/action-plans/review-queue${limit ? `?limit=${limit}` : ""}`),
    updateStatus: (id: string, status: ActionPlanStatus, notes?: string) =>
      request<ActionPlan>(`/action-plans/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes }),
      }),
    addRemarks: (id: string, remarks: string) =>
      request<ActionPlan>(`/action-plans/${id}/remarks`, {
        method: "POST",
        body: JSON.stringify({ remarks }),
      }),
    uploadAffidavit: async (id: string, file: File, notes?: string) => {
      const form = new FormData();
      form.append("file", file);
      if (notes) form.append("notes", notes);
      return request<ActionPlan>(`/action-plans/${id}/upload`, {
        method: "POST",
        body: form,
      });
    },
    submit: (id: string, completion_notes?: string) =>
      request<ActionPlan>(`/action-plans/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ completion_notes }),
      }),
    review: (id: string, decision: "approve" | "request_changes" | "reopen", feedback?: string) =>
      request<ActionPlan>(`/action-plans/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, feedback }),
      }),
  },

  admin: {
    users: () => request<AdminUser[]>("/admin/users"),
    createUser: (payload: AdminUserUpsert) =>
      request<AdminUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateUser: (id: string, payload: Partial<AdminUserUpsert>) =>
      request<AdminUser>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    saveSettings: (settings: Record<string, unknown>) =>
      request("/admin/settings", {
        method: "POST",
        body: JSON.stringify(settings),
      }),
    getSettings: () => request<Record<string, unknown>>("/admin/settings"),
    systemInfo: () => request<SystemInfo>("/admin/system-info"),
    departments: () => request<DepartmentOption[]>("/admin/departments"),
    createDepartment: (payload: DepartmentUpsert) =>
      request<DepartmentOption>("/admin/departments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateDepartment: (id: string, payload: DepartmentUpsert) =>
      request<DepartmentOption>(`/admin/departments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },

  reports: {
    export: async (payload: ReportExportRequest) => {
      const token = getToken();
      const res = await fetch(`${BASE}/reports/export`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? `Request failed (${res.status})`);
      }
      return {
        blob: await res.blob(),
        filename: getFilenameFromHeaders(res.headers) ?? "report-download",
      };
    },
  },
};

function getFilenameFromHeaders(headers: Headers) {
  const disposition = headers.get("content-disposition");
  const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
  return match?.[1] ?? null;
}

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

export interface RoleOption {
  key: "ADMIN" | "REVIEWER" | "DEPT_USER";
  label: string;
  desc: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  email?: string | null;
}

export interface RegisterOptions {
  roles: RoleOption[];
  departments: DepartmentOption[];
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
    action_type?: string;   // COMPLY | APPEAL | INFORM | MONITOR
    status?: string;        // directive status
  }>;
}

export interface SystemInfo {
  version: string;
  service: string;
  python: string;
  platform: string;
  database: string;
  storage: string;
  llm: string;
  audit_chain: string;
  frontend_url: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "REVIEWER" | "DEPT_USER";
  department?: string;
  designation?: string;
  state?: string;
  mobile?: string;
  office_unit?: string;
}

export interface AdminUserUpsert {
  email: string;
  name: string;
  password?: string;
  role: "ADMIN" | "REVIEWER" | "DEPT_USER";
  department?: string;
  designation?: string;
  state?: string;
  mobile?: string;
  office_unit?: string;
}

export interface DepartmentUpsert {
  name: string;
  code: string;
  email?: string;
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

export type ActionPlanStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "AWAITING_REVIEW"
  | "COMPLETED"
  | "ESCALATED"
  | "OVERDUE"
  | "REOPENED";

export interface ActionPlanTimelineEntry {
  id: string;
  event_type: string;
  message: string;
  actor_label: string;
  created_at: string;
  details?: Record<string, unknown> | null;
}

export interface ActionPlan {
  id: string;
  case_id: string;
  case_number: string;
  court: string;
  directive_id: string;
  directive_text: string;
  action_type: string;
  assigned_department: string;
  assigned_officer_id?: string | null;
  assigned_officer_name?: string | null;
  status: ActionPlanStatus;
  due_date: string | null;
  remarks?: string | null;
  affidavit_url?: string | null;
  completion_notes?: string | null;
  reviewer_feedback?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  timeline: ActionPlanTimelineEntry[];
}

export interface ReportExportRequest {
  report_type: string;
  format: "pdf" | "excel" | "csv";
  start_date?: string;
  end_date?: string;
  department?: string;
}
