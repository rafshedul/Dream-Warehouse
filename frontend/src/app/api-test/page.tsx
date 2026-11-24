"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL, apiFetch, ApiError } from "../../lib/api";

type Product = {
  id: number;
  name: string;
  sku: string;
  unit_price: number | string;
  reorder_level: number;
};

type ProductPage = {
  total_products: number;
  total_pages: number;
  current_page: number;
  limit: number;
  products: Product[];
};

function displayError(cause: unknown) {
  const status = cause instanceof ApiError ? ` (${cause.status})` : "";
  return `${cause instanceof Error ? cause.message : "Something went wrong"}${status}`;
}

export default function ApiTestPage() {
  const [result, setResult] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestProducts = useCallback(
    () => apiFetch<ProductPage>("/products/?page=1&limit=10"),
    [],
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await requestProducts();
      setResult(data);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setLoading(false);
    }
  }, [requestProducts]);

  useEffect(() => {
    let active = true;
    requestProducts()
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(displayError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestProducts]);

  return (
    <main className="min-h-screen bg-slate-100 p-5 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">Milestone 1 · API connection</p>
            <h1 className="mt-1 text-2xl font-bold">Product API check</h1>
            <p className="mt-2 text-sm text-slate-600">
              Testing <code className="rounded bg-white px-1.5 py-0.5">GET /products/</code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadProducts()}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Connecting…" : "Retry connection"}
          </button>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">API configuration</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Base URL</dt><dd className="mt-1 break-all font-mono">{API_BASE_URL}</dd></div>
            <div><dt className="text-slate-500">Connection</dt><dd className="mt-1 font-medium">{loading ? "Checking…" : error ? "Failed" : "Connected"}</dd></div>
          </dl>
        </section>

        {loading && <section role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
          Connecting to the API and loading products…
        </section>}

        {error && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
          <h2 className="font-semibold">API connection failed</h2>
          <p className="mt-1 text-sm">{error}</p>
          <p className="mt-3 text-sm">Check that the backend is running at the Base URL above and that its CORS settings allow this frontend origin.</p>
        </section>}

        {result && <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Products found</p><p className="mt-2 text-2xl font-bold">{result.total_products}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Pages</p><p className="mt-2 text-2xl font-bold">{result.total_pages}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Returned this page</p><p className="mt-2 text-2xl font-bold">{result.products.length}</p></div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">API response · products</h2></div>
            {result.products.length === 0 ? <p className="p-6 text-sm text-slate-500">Connection worked, but the database has no products yet.</p> :
              <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                  <th className="px-5 py-3">ID</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Product</th><th className="px-5 py-3">Unit price</th><th className="px-5 py-3">Reorder level</th>
                </tr></thead>
                <tbody>{result.products.map((product) => <tr key={product.id} className="border-t border-slate-100">
                  <td className="px-5 py-3">{product.id}</td><td className="px-5 py-3 font-mono">{product.sku}</td><td className="px-5 py-3 font-medium">{product.name}</td><td className="px-5 py-3">৳ {product.unit_price}</td><td className="px-5 py-3">{product.reorder_level}</td>
                </tr>)}</tbody>
              </table></div>}
          </section>

          <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold">Show raw JSON response</summary>
            <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </>}
      </div>
    </main>
  );
}
