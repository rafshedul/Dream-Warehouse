"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { RoleGate } from "../../components/auth-provider";

type Category = {
  id: number;
  name: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCategories = useCallback(
    () => apiFetch<Category[]>("/categories/"),
    [],
  );

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorText(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchCategories, refreshKey]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) =>
      `${category.name} ${category.description ?? ""}`.toLowerCase().includes(query),
    );
  }, [categories, search]);

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const created = await apiFetch<Category>("/categories/", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      setCategories((current) => [created, ...current]);
      setName("");
      setDescription("");
      setSuccess(`Category “${created.name}” was created.`);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function refreshCategories() {
    setLoading(true);
    setError("");
    setRefreshKey((key) => key + 1);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div>
            
            <h1 className="mt-2 text-2xl font-bold">Categories</h1>
            <p className="mt-1 text-sm text-slate-500">Manage the categories used to organize products.</p>
          </div>
          <button type="button" onClick={refreshCategories} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </header>

        {error && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Category request failed</p><p className="mt-1">{error}</p>
          {error.includes("403") && <p className="mt-2">Viewing categories is public, but creating them requires an Admin or Manager account.</p>}
        </section>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div><h2 className="font-bold">Category list</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading categories…" : `${categories.length} categories`}</p></div>
              <label className="sr-only" htmlFor="category-search">Search categories</label>
              <input id="category-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-56" />
            </div>
            {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading categories from the API…</p> :
              filteredCategories.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{categories.length === 0 ? "No categories yet. Create one with the form." : "No categories match your search."}</p> :
                <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                    <th className="px-5 py-3">ID</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Created</th>
                  </tr></thead>
                  <tbody>{filteredCategories.map((category) => <tr key={category.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 text-slate-500">{category.id}</td><td className="px-5 py-4 font-semibold">{category.name}</td><td className="max-w-xs px-5 py-4 text-slate-600">{category.description || "—"}</td>
                    <td className="px-5 py-4 text-slate-500">{category.created_at ? new Date(category.created_at).toLocaleDateString() : "—"}</td>
                  </tr>)}</tbody>
                </table></div>}
          </div>

          <RoleGate roles={["admin", "manager"]} fallback={<p className="h-fit rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Creating categories requires an Admin or Manager account.</p>}><section className="h-fit rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="font-bold">Add category</h2>
            <p className="mt-1 text-sm text-slate-500">New categories can be selected when creating products.</p>
            <form onSubmit={handleCreateCategory} className="mt-5 space-y-4">
              <div><label htmlFor="category-name" className="mb-1.5 block text-sm font-medium">Name <span className="text-red-600">*</span></label>
                <input id="category-name" required minLength={1} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Electronics" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <div><label htmlFor="category-description" className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea id="category-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional details about this category" className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <button type="submit" disabled={saving || !name.trim()} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Saving…" : "Create category"}
              </button>
              <p className="text-xs text-slate-500">Creating a category requires an Admin or Manager role.</p>
            </form>
          </section></RoleGate>
        </section>
      </div>
    </main>
  );
}
