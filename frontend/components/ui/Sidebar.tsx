"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Upload, ClipboardList, Building2,
  Users, Settings, ChevronRight, LogOut, LifeBuoy,
  FileText, Calendar, Download, BarChart3,
  PanelLeftClose, PanelLeftOpen, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/* ─── Nav structure ──────────────────────────────────────── */

const WORKSPACE_NAV = [
  { href: "/upload",      label: "New Ingestion",    icon: Upload },
  { href: "/cases",       label: "Pending Review",   icon: Clock,  badge: "pending" },
  { href: "/verified",    label: "Verified Cases",   icon: FileText },
  { href: "/calendar",    label: "Action Calendar",  icon: Calendar },
  { href: "/departments", label: "Department View",  icon: Building2 },
];

const REPORTS_NAV = [
  { href: "/audit",     label: "Audit Trail",  icon: ClipboardList },
  { href: "/downloads", label: "Downloads",    icon: Download },
  { href: "/reports",   label: "Reports",      icon: BarChart3 },
];

const ADMIN_NAV = [
  { href: "/admin/users",       label: "Users",       icon: Users },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/settings",    label: "Settings",    icon: Settings },
];

/* ─── Component ──────────────────────────────────────────── */

export function Sidebar() {
  const pathname   = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    api.cases.stats()
      .then((s) => setPendingCount(s.status_counts["PENDING_REVIEW"] ?? 0))
      .catch(() => {});
  }, []);

  const initials = user?.name
    ?.split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() ?? "U";

  return (
    <aside
      className={cn(
        "flex-shrink-0 bg-[#0B1120] flex flex-col h-full transition-all duration-300 ease-in-out border-r border-slate-800",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* ── Logo + toggle ── */}
      <div className={cn(
        "flex items-center border-b border-slate-800 h-16 px-3 shrink-0",
        collapsed ? "justify-center" : "justify-between px-4"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <Image src="/logo.png" alt="NyayaSetu" width={34} height={34} className="rounded-lg shrink-0" />
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight">NyayaSetu</p>
              <p className="text-slate-500 text-[10px] leading-tight truncate">AI-Powered Court Judgment</p>
              <p className="text-slate-500 text-[10px] leading-tight truncate">Intelligence</p>
            </div>
          </div>
        )}
        {collapsed && (
          <Image src="/logo.png" alt="NyayaSetu" width={30} height={30} className="rounded-lg" />
        )}
        <button
          onClick={toggle}
          className={cn(
            "text-slate-400 hover:text-white hover:bg-slate-700/50 p-1.5 rounded-lg transition-colors shrink-0",
            collapsed && "mt-0"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Main nav (scrollable) ── */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {/* Dashboard */}
        <NavItem
          href="/dashboard"
          label="Dashboard"
          icon={LayoutDashboard}
          active={pathname === "/dashboard"}
          collapsed={collapsed}
        />

        {/* WORKSPACE */}
        <SectionLabel label="WORKSPACE" collapsed={collapsed} />
        {WORKSPACE_NAV.map(({ href, label, icon: Icon, badge }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={Icon}
            active={pathname === href || pathname.startsWith(href + "/")}
            collapsed={collapsed}
            badge={badge === "pending" && pendingCount > 0 ? String(pendingCount) : undefined}
          />
        ))}

        {/* AUDIT & REPORTS */}
        <SectionLabel label="AUDIT & REPORTS" collapsed={collapsed} />
        {REPORTS_NAV.map(({ href, label, icon: Icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={Icon}
            active={pathname === href || pathname.startsWith(href + "/")}
            collapsed={collapsed}
          />
        ))}

        {/* ADMIN — only for ADMIN role */}
        {user?.role === "ADMIN" && (
          <>
            <SectionLabel label="ADMIN" collapsed={collapsed} />
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={Icon}
                active={pathname === href || pathname.startsWith(href + "/")}
                collapsed={collapsed}
              />
            ))}
          </>
        )}
      </nav>

      {/* ── System status ── */}
      {!collapsed && (
        <div className="mx-2 mb-2 rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-200 text-xs font-medium">System Healthy</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-snug">
            Audit chain verified · {pendingCount} pending review
          </p>
        </div>
      )}
      {collapsed && (
        <div className="flex justify-center pb-2" title="System Healthy">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
      )}

      {/* ── User footer ── */}
      <div className={cn(
        "border-t border-slate-800 px-2 py-3 shrink-0",
      )}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <button
              onClick={logout}
              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-slate-400 text-[10px] truncate capitalize">
                {user?.role?.replace("_", " ").toLowerCase()}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-4" />;
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
      {label}
    </p>
  );
}

function NavItem({
  href, label, icon: Icon, active, collapsed, badge,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; collapsed: boolean; badge?: string;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 group relative",
        active
          ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", active ? "text-indigo-400" : "")} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate font-medium text-[13px]">{label}</span>
          {badge && (
            <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
              {badge}
            </span>
          )}
          {active && <ChevronRight className="w-3 h-3 opacity-60" />}
        </>
      )}
      {/* Tooltip when collapsed */}
      {collapsed && (
        <span className="absolute left-full ml-2 z-50 px-2 py-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
          {label}
          {badge && (
            <span className="ml-1.5 bg-orange-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
