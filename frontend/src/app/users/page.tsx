"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../../lib/api";
import type { UserRole } from "../../components/auth-provider";
import { useAuth } from "../../components/auth-provider";

type ManagedUser = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  created_at: string | null;
  role: UserRole;
  is_active: boolean;
  contact_id: number;
};

const roles: UserRole[] = ["user", "staff", "manager", "admin"];

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [registeredSearch, setRegisteredSearch] = useState("");

  const loadUsers = useCallback(() => apiFetch<ManagedUser[]>("/users/"), []);
  const registeredUsers = users
    .filter((account) => account.role === "user")
    .filter((account) => `${account.name ?? ""} ${account.phone ?? ""} ${account.address ?? ""} ${account.email}`.toLowerCase().includes(registeredSearch.trim().toLowerCase()))
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  useEffect(() => {
    let active = true;
    loadUsers()
      .then((items) => { if (active) { setUsers(items); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadUsers, refreshKey]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const created = await apiFetch<ManagedUser>("/users/", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(), phone: phone.trim(), address: address.trim(),
          email: email.trim(), password, role,
        }),
      });
      setUsers((current) => [created, ...current]);
      setName(""); setPhone(""); setAddress(""); setEmail(""); setPassword(""); setRole("user");
      setSuccess(`Account created for ${created.email} with the ${created.role} role.`);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(account: ManagedUser, nextRole: UserRole) {
    setError(""); setSuccess("");
    try {
      const updated = await apiFetch<ManagedUser>(`/users/${account.id}/role`, {
        method: "PATCH", body: JSON.stringify({ role: nextRole }),
      });
      setUsers((current) => current.map((item) => item.id === updated.id ? { ...item, role: updated.role } : item));
      setSuccess(`${account.email} now has the ${updated.role} role.`);
    } catch (cause) { setError(errorText(cause)); }
  }

  async function toggleStatus(account: ManagedUser) {
    setError(""); setSuccess("");
    try {
      const updated = await apiFetch<ManagedUser>(`/users/${account.id}/status`, {
        method: "PATCH", body: JSON.stringify({ is_active: !account.is_active }),
      });
      setUsers((current) => current.map((item) => item.id === updated.id ? { ...item, is_active: updated.is_active } : item));
      setSuccess(`${account.email} has been ${updated.is_active ? "activated" : "deactivated"}.`);
    } catch (cause) { setError(errorText(cause)); }
  }

  async function deleteAccount(account: ManagedUser) {
    const confirmed = window.confirm(`Permanently delete the account for ${account.email}?`);
    if (!confirmed) return;
    setError(""); setSuccess("");
    try {
      await apiFetch<{ message: string }>(`/users/${account.id}`, { method: "DELETE" });
      setUsers((current) => current.filter((item) => item.id !== account.id));
      setSuccess(`The account for ${account.email} was deleted.`);
    } catch (cause) { setError(errorText(cause)); }
  }

  function refresh() { setLoading(true); setRefreshKey((key) => key + 1); }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Admin tools</p><h1 className="mt-2 text-2xl font-bold">User management</h1><p className="mt-1 text-sm text-slate-500">Create accounts, assign roles, and control account access.</p></div>
          <div className="flex gap-2"><a href="#registered-users" className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">User List</a><button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{loading ? "Loading…" : "↻ Refresh"}</button></div>
        </header>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

        <section id="registered-users" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">Registered users</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading registrations…" : `${registeredUsers.length} matching registered users · newest first`}</p></div><input aria-label="Search registered users" value={registeredSearch} onChange={(event) => setRegisteredSearch(event.target.value)} placeholder="Search name, phone, address, email…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:max-w-sm" />
          </div>
          {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading registrations…</p> : registeredUsers.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No matching user registrations.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Address</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Registered</th></tr></thead><tbody>
              {registeredUsers.map((account) => <tr key={account.id} className="border-t border-slate-100"><td className="px-5 py-4 font-medium">{account.name || "—"}</td><td className="px-5 py-4">{account.phone ? <a className="text-violet-700 hover:underline" href={`tel:${account.phone}`}>{account.phone}</a> : "—"}</td><td className="max-w-xs px-5 py-4">{account.address || "—"}</td><td className="px-5 py-4"><a className="text-violet-700 hover:underline" href={`mailto:${account.email}`}>{account.email}</a></td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{account.created_at ? new Date(account.created_at).toLocaleString() : "—"}</td></tr>)}
            </tbody></table></div>}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold">Create account</h2><p className="mt-1 text-sm text-slate-500">The account and its contact profile are saved together.</p>
          <form onSubmit={createUser} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label htmlFor="user-name" className="mb-1.5 block text-sm font-medium">Full name</label><input id="user-name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
            <div><label htmlFor="user-phone" className="mb-1.5 block text-sm font-medium">Phone</label><input id="user-phone" required maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
            <div><label htmlFor="user-address" className="mb-1.5 block text-sm font-medium">Address</label><input id="user-address" required maxLength={255} value={address} onChange={(event) => setAddress(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
            <div><label htmlFor="user-email" className="mb-1.5 block text-sm font-medium">Email</label><input id="user-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
            <div><label htmlFor="user-password" className="mb-1.5 block text-sm font-medium">Temporary password</label><input id="user-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
            <div><label htmlFor="user-role" className="mb-1.5 block text-sm font-medium">Role</label><select id="user-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">{roles.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></div>
            <button type="submit" disabled={saving} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50 sm:col-span-2 lg:col-span-3">{saving ? "Creating account…" : "Create account"}</button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5"><h2 className="font-bold">Accounts</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading accounts…" : `${users.length} accounts`}</p></div>
          {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading user accounts…</p> : users.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No accounts found.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody>
              {users.map((account) => { const isSelf = account.id === currentUser?.user_id; return <tr key={account.id} className="border-t border-slate-100"><td className="px-5 py-4 font-medium">{account.name || `User #${account.id}`}{isSelf && <span className="ml-2 rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-700">You</span>}</td><td className="px-5 py-4">{account.email}</td><td className="px-5 py-4"><select aria-label={`Role for ${account.email}`} value={account.role} disabled={isSelf} onChange={(event) => void changeRole(account, event.target.value as UserRole)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 capitalize disabled:opacity-60">{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{account.is_active ? "Active" : "Inactive"}</span></td><td className="px-5 py-4"><div className="flex gap-2"><button type="button" disabled={isSelf} onClick={() => void toggleStatus(account)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{account.is_active ? "Deactivate" : "Activate"}</button><button type="button" disabled={isSelf} onClick={() => void deleteAccount(account)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Delete</button></div></td></tr>; })}
            </tbody></table></div>}
        </section>
      </div>
    </main>
  );
}
