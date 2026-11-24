"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { useCart } from "./cart-provider";

export type UserRole = "admin" | "manager" | "staff" | "user";
export type SessionUser = {
  user_id: number;
  email: string;
  role: UserRole;
  is_active?: boolean;
  profile?: { name?: string | null; phone?: string | null; address?: string | null };
};

type AuthContextValue = {
  user: SessionUser | null;
  refreshSession: () => Promise<SessionUser>;
  signOut: () => Promise<void>;
  openProfile: () => void;
};

type ProfileForm = { name: string; email: string; phone: string; address: string };

const AuthContext = createContext<AuthContextValue | null>(null);
const publicPaths = new Set(["/login", "/register", "/products", "/categories", "/cart", "/payment/result"]);
const routeRoles: Record<string, UserRole[]> = {
  "/checkout": ["user"],
  "/my-orders": ["user"],
  "/api-test": ["admin"],
  "/users": ["admin"],
  "/dashboard": ["admin", "manager", "staff"],
  "/suppliers": ["admin", "manager"],
  "/customers": ["admin", "manager", "staff"],
  "/purchases": ["admin", "manager"],
  "/sales": ["admin", "manager", "staff"],
  "/warehouses": ["admin", "manager", "staff"],
  "/stocks": ["admin", "manager", "staff"],
  "/stock-activities": ["admin", "manager", "staff"],
  "/transactions": ["admin", "manager"],
  "/invoices": ["admin", "manager"],
  "/shipments": ["admin", "manager", "staff"],
  "/reports": ["admin", "manager", "staff"],
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function RoleGate({
  roles,
  children,
  fallback,
}: {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? children : fallback ?? null;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileForm>({ name: "", email: "", phone: "", address: "" });
  const cart = useCart();
  const clearCart = cart.clear;

  const openProfile = useCallback(() => {
    setProfileForm({
      name: user?.profile?.name ?? "",
      email: user?.email ?? "",
      phone: user?.profile?.phone ?? "",
      address: user?.profile?.address ?? "",
    });
    setProfileError("");
    setProfileEditing(false);
    setProfileOpen(true);
  }, [user]);

  const refreshSession = useCallback(async () => {
    const currentUser = await apiFetch<SessionUser>("/auth/me");
    setUser(currentUser);
    setAuthChecked(true);
    return currentUser;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch<{ message: string }>("/logout", { method: "POST" });
    } catch {
      // Clear the local session state even if the API is unavailable.
    } finally {
      setUser(null);
      setAuthChecked(true);
      clearCart(); // don't leave this customer's cart in the browser for the next person
      router.replace("/login");
    }
  }, [router, clearCart]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileSaving(true);
    try {
      const updated = await apiFetch<SessionUser>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileForm.name.trim(),
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim(),
          address: profileForm.address.trim(),
        }),
      });
      setUser(updated);
      setProfileEditing(false);
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : "Could not update your profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  useEffect(() => {
    if (authChecked || pathname === "/login" || pathname === "/register") return;
    let active = true;
    apiFetch<SessionUser>("/auth/me")
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setAuthChecked(true);
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, [authChecked, pathname]);

  useEffect(() => {
    if (!authChecked || publicPaths.has(pathname)) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [authChecked, pathname, router, user]);

  const contextValue = useMemo(() => ({ user, refreshSession, signOut, openProfile }), [openProfile, refreshSession, signOut, user]);
  const isPublic = publicPaths.has(pathname);
  const matchedRoute = Object.keys(routeRoles).find((route) => pathname === route || pathname.startsWith(`${route}/`));
  const permittedRoles = matchedRoute ? routeRoles[matchedRoute] : undefined;
  const allowed = !permittedRoles || (user !== null && permittedRoles.includes(user.role));

  let content = children;
  if (!isPublic && user && !allowed) {
    content = <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-8"><div className="max-w-md rounded-2xl border border-amber-200 bg-white p-7 text-center shadow-sm"><h1 className="text-xl font-bold">Access denied</h1><p className="mt-2 text-sm text-slate-600">Your {user?.role} account does not have permission to open this page.</p><Link href="/dashboard" className="mt-5 inline-flex rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold">Back to dashboard</Link></div></main>;
  }
  if (!isPublic && permittedRoles && !user) {
    content = <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-8 text-sm text-slate-600">Checking your session…</main>;
  }

  return <AuthContext.Provider value={contextValue}>
    {pathname !== "/" && <div className="relative z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 sm:px-6 md:px-8">
      <Link href="/" aria-label="Go to Home page" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-800"><span aria-hidden="true">⌂</span>Home</Link>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {(!user || user.role === "user") && <Link href="/cart" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cart ({cart.count})</Link>}
        {user?.role === "user" && <Link href="/my-orders" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">My Orders</Link>}
        {user ? <div className="flex items-center gap-2 sm:gap-3">{user.role === "admin" && <Link href="/users#registered-users" className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 transition hover:bg-violet-100">User List</Link>}<button type="button" onClick={openProfile} aria-label="Open profile details" title="Profile" className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-base font-bold uppercase text-violet-800">{(user.profile?.name || user.email).charAt(0)}</span><span className="max-w-32 truncate">{user.profile?.name || "Profile"}</span></button><button type="button" onClick={() => void signOut()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:bg-slate-50">Sign out</button></div> : pathname !== "/login" ? <div className="flex items-center gap-3"><span className="hidden sm:inline">Guest view · Some data and actions may require an account.</span><Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">Sign in</Link></div> : null}
        <Link href="/dashboard" aria-label="Go to Dashboard" className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-800"><span aria-hidden="true">▦</span>Dashboard</Link>
      </div>
    </div>}
    {content}
    {profileOpen && user && <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 pt-16 sm:justify-end sm:pr-8" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Account</p><h2 id="profile-dialog-title" className="mt-1 text-xl font-bold">My Profile</h2><p className="mt-1 text-sm text-slate-500">Your saved account details.</p></div><button type="button" aria-label="Close profile" onClick={() => setProfileOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">✕</button></header>
        {profileError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{profileError}</p>}
        {profileEditing ? <form onSubmit={saveProfile} className="mt-5 space-y-4">
          {(["name", "email", "phone", "address"] as const).map((field) => <div key={field}><label htmlFor={`profile-${field}`} className="mb-1.5 block text-sm font-medium capitalize">{field}</label><input id={`profile-${field}`} type={field === "email" ? "email" : "text"} required maxLength={field === "name" ? 150 : field === "phone" ? 50 : field === "address" ? 255 : undefined} value={profileForm[field]} onChange={(event) => setProfileForm((current) => ({ ...current, [field]: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500" /></div>)}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => { setProfileEditing(false); setProfileError(""); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">Cancel</button><button type="submit" disabled={profileSaving} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{profileSaving ? "Saving…" : "Save changes"}</button></div>
        </form> : <>
          <dl className="mt-5 space-y-4">{[
            { label: "Name", value: user.profile?.name },
            { label: "Email", value: user.email },
            { label: "Phone", value: user.profile?.phone },
            { label: "Address", value: user.profile?.address },
            { label: "Role", value: user.role },
            { label: "Account status", value: user.is_active ? "Active" : "Inactive" },
          ].map((item) => <div key={item.label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</dt><dd className="mt-1 break-words text-sm font-medium capitalize text-slate-800">{item.value || "Not provided"}</dd></div>)}</dl>
          <div className="mt-6 flex justify-between gap-3">{user.role === "admin" && <Link href="/users#registered-users" onClick={() => setProfileOpen(false)} className="rounded-lg border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50">User List</Link>}<button type="button" onClick={() => { setProfileEditing(true); setProfileError(""); }} className="ml-auto rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">Edit profile</button></div>
        </>}
      </section>
    </div>}
  </AuthContext.Provider>;
}
