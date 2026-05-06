"use client";

import { useEffect, useState } from "react";
import { Users, RefreshCw, Search, Shield, UserCircle, Building2 } from "lucide-react";
import { api, AdminUser } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-amber-100 text-amber-800 border-amber-200",
  REVIEWER: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DEPT_USER: "bg-violet-100 text-violet-800 border-violet-200",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.admin.users()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">User Management</h1>
            <p className="text-slate-500 text-xs">
              {loading ? "Loading…" : `${filtered.length} user${filtered.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, dept…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-60"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            Could not load users: {error}
          </div>
        )}

        {/* Role summary chips */}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-5">
            {(["ADMIN", "REVIEWER", "DEPT_USER"] as const).map((role) => {
              const count = users.filter((u) => u.role === role).length;
              return (
                <div key={role} className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", ROLE_STYLES[role])}>
                  <Shield className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-xl font-bold leading-tight">{count}</p>
                    <p className="text-xs font-medium capitalize">{role.replace("_", " ").toLowerCase()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["User", "Email", "Role", "Department", "Designation", "State"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <UserCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">{users.length === 0 ? "No users registered yet" : "No users match your search"}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                          {initials(u.name)}
                        </div>
                        <span className="font-medium text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", ROLE_STYLES[u.role] ?? "bg-slate-100 text-slate-700")}>
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-36 truncate">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        {u.department ?? <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-32 truncate">{u.designation ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.state ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
