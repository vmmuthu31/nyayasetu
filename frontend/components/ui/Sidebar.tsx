"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Upload, LogOut, Scale, ClipboardList, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard",   label: "Dashboard",    icon: LayoutDashboard },
  { href: "/cases",       label: "Cases",        icon: FileText },
  { href: "/departments", label: "Dept. Actions",icon: Building2 },
  { href: "/upload",      label: "Ingest PDF",   icon: Upload },
  { href: "/audit",       label: "Audit Trail",  icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
        <div className="bg-blue-600 rounded-lg p-1.5">
          <Scale className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">NyayaSetu</p>
          <p className="text-slate-400 text-xs leading-tight">Court AI Engine</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn("sidebar-item", active ? "sidebar-item-active" : "sidebar-item-inactive")}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-item sidebar-item-inactive w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
