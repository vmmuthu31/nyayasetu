"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { api, AdminUser, AdminUserUpsert } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 5;

type RoleFilter = "" | "ADMIN" | "REVIEWER" | "DEPT_USER";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  REVIEWER: "Reviewer",
  DEPT_USER: "Dept. User",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    void Promise.resolve().then(loadUsers);
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesSearch =
        !needle ||
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        (user.department ?? "").toLowerCase().includes(needle);
      return matchesRole && matchesSearch;
    });
  }, [roleFilter, search, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const visibleUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.users();
      setUsers(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-8 py-8">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Users</h1>
            <p className="mt-3 text-[15px] text-slate-500">Manage system users and their roles.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            Add User
          </button>
        </header>

        <section className="mt-10 grid grid-cols-[minmax(180px,220px)_1fr] gap-4">
          <SelectShell value={roleFilter ? ROLE_LABELS[roleFilter] : "All Roles"}>
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as RoleFilter);
                setPage(1);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Filter by role"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="REVIEWER">Reviewer</option>
              <option value="DEPT_USER">Dept. User</option>
            </select>
          </SelectShell>

          <div className="relative h-[52px] rounded-md border border-slate-200 bg-white shadow-sm">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search users..."
              className="h-full w-full rounded-md bg-transparent pl-12 pr-4 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-8 overflow-hidden bg-white">
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {["USER", "ROLE", "DEPARTMENT", "EMAIL", "STATUS", "ACTIONS"].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    Loading users
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => (
                  <tr key={user.id} className="text-sm text-slate-600">
                    <td className="w-[20%] px-4 py-5 font-medium text-slate-800">{user.name}</td>
                    <td className="w-[14%] px-4 py-5 font-medium text-slate-700">{ROLE_LABELS[user.role] ?? user.role}</td>
                    <td className="w-[20%] px-4 py-5 font-medium text-slate-700">{user.department ?? "-"}</td>
                    <td className="w-[24%] px-4 py-5 font-medium text-slate-500">{user.email}</td>
                    <td className="w-[10%] px-4 py-5">
                      <span
                        className={cn(
                          "rounded-md px-3 py-1 text-xs font-bold",
                          user.department ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
                        )}
                      >
                        {user.department ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="w-[12%] px-4 py-5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          className="rounded-md p-2 text-slate-400 transition hover:bg-slate-50 hover:text-indigo-600"
                          aria-label={`Edit ${user.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(user.email)}
                          className="rounded-md p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                          aria-label={`Copy ${user.email}`}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-7 flex items-center justify-between text-sm text-slate-500">
          <p>
            Showing {filteredUsers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
          </p>
          <div className="flex items-center gap-2">
            <PageButton disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="size-4" />
            </PageButton>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
              <PageButton key={pageNumber} active={pageNumber === page} onClick={() => setPage(pageNumber)}>
                {pageNumber}
              </PageButton>
            ))}
            <PageButton disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <ChevronRight className="size-4" />
            </PageButton>
          </div>
        </footer>
      </div>

      <UserDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={async () => {
          setCreateOpen(false);
          await loadUsers();
        }}
      />

      <UserDialog
        mode="edit"
        open={Boolean(editingUser)}
        user={editingUser}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
        onSaved={async () => {
          setEditingUser(null);
          await loadUsers();
        }}
      />
    </main>
  );
}

function UserDialog({
  mode,
  onOpenChange,
  onSaved,
  open,
  user,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  user?: AdminUser | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AdminUserUpsert>({
    name: "",
    email: "",
    password: "",
    role: "REVIEWER",
    department: "",
    designation: "",
    state: "",
    mobile: "",
    office_unit: "",
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setForm({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department ?? "",
        designation: user.designation ?? "",
        state: user.state ?? "",
        mobile: user.mobile ?? "",
        office_unit: user.office_unit ?? "",
      });
    } else {
      setForm({
        name: "",
        email: "",
        password: "",
        role: "REVIEWER",
        department: "",
        designation: "",
        state: "",
        mobile: "",
        office_unit: "",
      });
    }
    setError(null);
  }, [mode, open, user]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "create") {
        await api.admin.createUser({
          ...form,
          password: form.password || "ChangeMe123!",
        });
      } else if (user) {
        await api.admin.updateUser(user.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          department: form.department,
          designation: form.designation,
          state: form.state,
          mobile: form.mobile,
          office_unit: form.office_unit,
        });
      }
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add User" : "Edit User"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new system user and assign their role."
              : "Update the user profile, role, and department details."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="Email">
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          {mode === "create" && (
            <Field label="Password">
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
          )}
          <Field label="Role">
            <select
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as AdminUserUpsert["role"] }))
              }
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ADMIN">Admin</option>
              <option value="REVIEWER">Reviewer</option>
              <option value="DEPT_USER">Dept. User</option>
            </select>
          </Field>
          <Field label="Department">
            <input
              value={form.department ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="Designation">
            <input
              value={form.designation ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="State">
            <input
              value={form.state ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="inline-flex h-10 items-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function SelectShell({ children, value }: { children: React.ReactNode; value: string }) {
  return (
    <div className="relative flex h-[52px] items-center justify-between rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm">
      <span className="truncate">{value}</span>
      <ChevronDown className="size-4 text-slate-400" />
      {children}
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
  children: React.ReactNode;
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
