"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "../../lib/api";
import { RoleGate } from "../../components/auth-provider";

type Warehouse = { id: number; name: string; location: string; created_at: string };

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchWarehouses = useCallback(() => apiFetch<Warehouse[]>("/warehouses/"), []);

  useEffect(() => {
    let active = true;
    fetchWarehouses()
      .then((items) => {
        if (active) {
          setWarehouses(items);
          setListError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setListError(errorText(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchWarehouses, refreshKey]);

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setSaving(true);
    try {
      const created = await apiFetch<Warehouse>("/warehouses/", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), location: location.trim() }),
      });
      setWarehouses((current) => [...current, created].sort((a, b) => a.id - b.id));
      setName("");
      setLocation("");
      setSuccess(`Warehouse “${created.name}” was created.`);
    } catch (cause) {
      setFormError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function refresh() {
    setLoading(true);
    setListError("");
    setRefreshKey((key) => key + 1);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div><h1 className="mt-2 text-2xl font-bold">Warehouses</h1><p className="mt-1 text-sm text-slate-500">Manage the locations where your inventory is stored.</p></div>
          <div className="flex gap-2"><Link href="/stocks" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">View stock</Link><button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{loading ? "Loading…" : "↻ Refresh"}</button></div>
        </header>

        {listError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Could not load warehouses</p><p className="mt-1">{listError}</p><p className="mt-2">Viewing warehouses requires a signed-in Admin, Manager, or Staff account.</p></section>}
        {formError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Could not create warehouse</p><p className="mt-1">{formError}</p>{formError.includes("403") && <p className="mt-2">Only an Admin can create warehouses.</p>}</section>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><h2 className="font-bold">Warehouse list</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading…" : `${warehouses.length} warehouses`}</p></div>
            {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading warehouse data…</p> : warehouses.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No warehouses found.</p> :
              <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">Warehouse</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Created</th></tr></thead>
                <tbody>{warehouses.map((warehouse) => <tr key={warehouse.id} className="border-t border-slate-100"><td className="px-5 py-4 text-slate-500">{warehouse.id}</td><td className="px-5 py-4 font-semibold">{warehouse.name}</td><td className="px-5 py-4">{warehouse.location}</td><td className="px-5 py-4 text-slate-500">{new Date(warehouse.created_at).toLocaleDateString()}</td></tr>)}</tbody>
              </table></div>}
          </div>

          <RoleGate roles={["admin"]} fallback={<p className="h-fit rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Creating warehouses requires an Admin account.</p>}><section className="h-fit rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="font-bold">Add warehouse</h2><p className="mt-1 text-sm text-slate-500">Add a storage location for products and stock.</p>
            <form onSubmit={createWarehouse} className="mt-5 space-y-4">
              <div><label htmlFor="warehouse-name" className="mb-1.5 block text-sm font-medium">Name *</label><input id="warehouse-name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Main Warehouse" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
              <div><label htmlFor="warehouse-location" className="mb-1.5 block text-sm font-medium">Location *</label><input id="warehouse-location" required maxLength={255} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Dhaka, Bangladesh" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
              <button type="submit" disabled={saving || !name.trim() || !location.trim()} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Create warehouse"}</button>
              <p className="text-xs text-slate-500">Creating a warehouse requires an Admin account.</p>
            </form>
          </section></RoleGate>
        </section>
      </div>
    </main>
  );
}
