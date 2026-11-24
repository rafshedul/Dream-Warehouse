
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function ApiTestPage() {
  const [products, setProducts] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await apiFetch<unknown>("/products/");
        setProducts(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <h1 className="mb-6 text-2xl font-bold">
        ERP - API Test
      </h1>

      {loading && <p>Loading products...</p>}

      {error && (
        <p className="text-red-600">
          API Error: {error}
        </p>
      )}

      {products !== null && (
        <pre className="overflow-auto rounded-lg bg-white p-5 text-sm">
          {JSON.stringify(products, null, 2)}
        </pre>
      )}
    </main>
  );
}
