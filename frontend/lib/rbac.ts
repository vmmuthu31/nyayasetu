"use client";

import type { User } from "./api";

export type AppRole = User["role"];

type Permission =
  | "upload_judgment"
  | "review_directive"
  | "verify_case"
  | "view_assigned_cases"
  | "update_compliance"
  | "export_reports"
  | "manage_users"
  | "manage_departments"
  | "manage_settings"
  | "view_audit"
  | "view_audit_full"
  | "view_reports"
  | "view_department_page";

const PERMISSIONS: Record<AppRole, Permission[]> = {
  ADMIN: [
    "upload_judgment",
    "review_directive",
    "verify_case",
    "view_assigned_cases",
    "update_compliance",
    "export_reports",
    "manage_users",
    "manage_departments",
    "manage_settings",
    "view_audit",
    "view_audit_full",
    "view_reports",
    "view_department_page",
  ],
  REVIEWER: [
    "upload_judgment",
    "review_directive",
    "verify_case",
    "view_assigned_cases",
    "export_reports",
    "view_audit",
    "view_reports",
  ],
  DEPT_USER: [
    "view_assigned_cases",
    "update_compliance",
    "view_department_page",
  ],
};

const ROLE_HOME: Record<AppRole, string> = {
  ADMIN: "/dashboard",
  REVIEWER: "/dashboard",
  DEPT_USER: "/dashboard",
};

const ROUTE_ACCESS: Array<{ match: (pathname: string) => boolean; roles: AppRole[] }> = [
  { match: (pathname) => pathname === "/dashboard", roles: ["ADMIN", "REVIEWER", "DEPT_USER"] },
  { match: (pathname) => pathname === "/upload", roles: ["ADMIN", "REVIEWER"] },
  { match: (pathname) => pathname === "/cases", roles: ["ADMIN", "REVIEWER"] },
  { match: (pathname) => pathname.startsWith("/cases/") && pathname.endsWith("/review"), roles: ["ADMIN", "REVIEWER", "DEPT_USER"] },
  { match: (pathname) => pathname === "/verified", roles: ["ADMIN", "REVIEWER", "DEPT_USER"] },
  { match: (pathname) => pathname === "/calendar", roles: ["ADMIN", "REVIEWER", "DEPT_USER"] },
  { match: (pathname) => pathname === "/departments", roles: ["ADMIN", "DEPT_USER"] },
  { match: (pathname) => pathname === "/audit", roles: ["ADMIN", "REVIEWER"] },
  { match: (pathname) => pathname === "/downloads", roles: ["ADMIN", "REVIEWER", "DEPT_USER"] },
  { match: (pathname) => pathname === "/reports", roles: ["ADMIN", "REVIEWER"] },
  { match: (pathname) => pathname.startsWith("/admin/"), roles: ["ADMIN"] },
];

export function can(user: User | null | undefined, permission: Permission) {
  if (!user) return false;
  return PERMISSIONS[user.role].includes(permission);
}

export function canAccessPath(user: User | null | undefined, pathname: string) {
  if (!user) return false;
  const rule = ROUTE_ACCESS.find((entry) => entry.match(pathname));
  if (!rule) return true;
  return rule.roles.includes(user.role);
}

export function roleHome(user: User | null | undefined) {
  if (!user) return "/login";
  return ROLE_HOME[user.role];
}
