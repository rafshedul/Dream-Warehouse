"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "../../lib/api";

type RegisterResponse = {
  message: string;
  email: string;
  role: string;
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdEmail, setCreatedEmail] = useState("");

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch<RegisterResponse>("/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          email: email.trim(),
          password,
        }),
      });
      setCreatedEmail(result.email);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setError("This email is already registered. Sign in with it or choose another email.");
      else if (cause instanceof ApiError && cause.status === 404) setError("Registration endpoint not found. Start the backend with: uvicorn app.main:app --reload");
      else setError(cause instanceof Error ? cause.message : "Could not register. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f7f5fc] p-5 text-slate-900">
    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-violet-100/70 sm:p-8">
      <div className="mb-6 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-700 text-2xl text-white">📦</div><div><p className="text-lg font-bold">Dream Warehouse</p><p className="text-sm text-slate-500">ERP</p></div></div>
      {createdEmail ? <section role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h1 className="text-xl font-bold text-emerald-900">Registration complete</h1><p className="mt-2 text-sm leading-6 text-emerald-800">Your User account for <strong>{createdEmail}</strong> is ready. Sign in to continue.</p><Link href="/login" className="mt-5 inline-flex rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800">Go to sign in</Link></section> : <>
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">Register to access your Dream Warehouse workspace.</p>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <form onSubmit={register} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="register-name" className="mb-1.5 block text-sm font-medium">Full name</label><input id="register-name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Your name" /></div>
          <div><label htmlFor="register-phone" className="mb-1.5 block text-sm font-medium">Phone</label><input id="register-phone" required autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Phone number" /></div>
          <div><label htmlFor="register-address" className="mb-1.5 block text-sm font-medium">Address</label><input id="register-address" required autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="City or address" /></div>
          <div className="sm:col-span-2"><label htmlFor="register-email" className="mb-1.5 block text-sm font-medium">Email</label><input id="register-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="you@company.com" /></div>
          <div><label htmlFor="register-password" className="mb-1.5 block text-sm font-medium">Password</label><input id="register-password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Create a password" /></div>
          <div><label htmlFor="register-confirm-password" className="mb-1.5 block text-sm font-medium">Confirm password</label><input id="register-confirm-password" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Enter it again" /></div>
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-3 sm:col-span-2"><button type="submit" disabled={loading} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60">{loading ? "Creating account…" : "Register"}</button><Link href="/login" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-800">Sign in</Link></div>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">New registrations have the basic User role. Admin, Manager, and Staff roles must be assigned by an administrator.</p>
      </>}
    </div>
  </main>;
}
