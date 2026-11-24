"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../components/auth-provider";

type LoginResponse = { message: string; email: string; role: "admin" | "manager" | "staff" | "user" };

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    let result: LoginResponse;
    try {
      result = await apiFetch<LoginResponse>("/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) setError("Email or password is incorrect. If this account was just registered, it has the basic User role; ask an administrator to assign an operational role if needed.");
      else if (cause instanceof ApiError && cause.status === 403) setError("This account is inactive. Ask an administrator to reactivate it.");
      else if (cause instanceof ApiError && cause.status === 404) setError("The login endpoint was not found. Start the backend from the project folder with: uvicorn app.main:app --reload");
      else setError(cause instanceof Error ? cause.message : "Could not reach the backend. Start it with: uvicorn app.main:app --reload");
      setLoading(false);
      return;
    }

    try {
      await refreshSession();
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null; // same-site paths only
      router.replace(safeNext && result.role === "user" ? safeNext : result.role === "user" ? "/products" : "/dashboard");
    } catch (cause) {
      setError(`Credentials were accepted, but the session could not be verified. Open this site at http://localhost:3000 and confirm the backend is running. ${cause instanceof Error ? cause.message : ""}`.trim());
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5 text-slate-900">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-lg">
      <div className="mb-7 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl">📦</div><div><p className="text-lg font-bold">Dream Warehouse</p><p className="text-sm text-slate-500">ERP</p></div></div>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">Use your ERP account to open your workspace.</p>
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <form onSubmit={signIn} className="mt-6 space-y-4">
        <div><label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">Email</label><input id="login-email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="you@company.com" /></div>
        <div><label htmlFor="login-password" className="mb-1.5 block text-sm font-medium">Password</label><input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Enter your password" /></div>
        <div className="grid grid-cols-[1fr_auto] gap-3"><button type="submit" disabled={loading || !email.trim() || !password} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60">{loading ? "Signing in…" : "Sign in"}</button><Link href="/register" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-800">Register</Link></div>
      </form>
      <p className="mt-5 text-xs leading-5 text-slate-500">Your access depends on your account role. Ask your administrator for an Admin, Manager, or Staff account if you need operational pages.</p>
    </div>
  </main>;
}
