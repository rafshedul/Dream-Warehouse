"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "../../lib/api";
import { RoleGate } from "../../components/auth-provider";

type Product = { id: number; name: string; sku: string };
type ProductPage = { total_pages: number; products: Product[] };
type Warehouse = { id: number; name: string; location: string };
type Stock = { id: number; product_id: number; warehouse_id: number; quantity: number; updated_at: string };
type StockAlert = {
  product_id: number;
  product_name: string;
  sku: string;
  total_stock: number;
  reorder_level: number;
  status: "LOW_STOCK" | "OUT_OF_STOCK" | "IN_STOCK";
};
type AlertResponse = { total_alerts: number; alerts: StockAlert[] };

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

async function fetchAllProducts() {
  const first = await apiFetch<ProductPage>("/products/?page=1&limit=100");
  const rest = await Promise.all(Array.from(
    { length: Math.max(first.total_pages - 1, 0) },
    (_, index) => apiFetch<ProductPage>(`/products/?page=${index + 2}&limit=100`),
  ));
  return [...first.products, ...rest.flatMap((page) => page.products)];
}

export default function StocksPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const productNames = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const warehouseNames = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
  const filteredStocks = useMemo(() => stocks.filter((stock) =>
    (!productFilter || stock.product_id === Number(productFilter)) &&
    (!warehouseFilter || stock.warehouse_id === Number(warehouseFilter)),
  ), [productFilter, stocks, warehouseFilter]);

  const fetchInventory = useCallback(async () => {
    const results = await Promise.allSettled([
      apiFetch<Stock[]>("/stocks/"),
      fetchAllProducts(),
      apiFetch<Warehouse[]>("/warehouses/"),
      apiFetch<AlertResponse>("/stocks/alerts/"),
    ] as const);
    const messages: string[] = [];
    const value = <T,>(index: number, label: string): T | undefined => {
      const result = results[index];
      if (result.status === "fulfilled") return result.value as T;
      messages.push(`${label}: ${errorText(result.reason)}`);
      return undefined;
    };
    return {
      stocks: value<Stock[]>(0, "Stock records"),
      products: value<Product[]>(1, "Products"),
      warehouses: value<Warehouse[]>(2, "Warehouses"),
      alerts: value<AlertResponse>(3, "Stock alerts"),
      messages,
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchInventory().then((result) => {
      if (!active) return;
      setStocks(result.stocks ?? []);
      setProducts(result.products ?? []);
      setWarehouses(result.warehouses ?? []);
      setAlerts(result.alerts?.alerts ?? []);
      setErrors(result.messages);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchInventory, refreshKey]);

  async function addProductToWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setSaving(true);
    try {
      await apiFetch<Stock>("/stocks/", {
        method: "POST",
        body: JSON.stringify({ product_id: Number(productId), warehouse_id: Number(warehouseId) }),
      });
      setSuccess("Product added to the warehouse. Its starting quantity is 0.");
      setProductId("");
      setWarehouseId("");
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setFormError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function refresh() {
    setLoading(true);
    setErrors([]);
    setRefreshKey((key) => key + 1);
  }

  const lowStockCount = alerts.filter((alert) => alert.status === "LOW_STOCK").length;
  const outOfStockCount = alerts.filter((alert) => alert.status === "OUT_OF_STOCK").length;
  const totalUnits = stocks.reduce((sum, stock) => sum + stock.quantity, 0);

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div><h1 className="mt-2 text-2xl font-bold">Stock Management</h1><p className="mt-1 text-sm text-slate-500">View inventory by product and warehouse, and monitor stock alerts.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/stock-activities" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Record stock movement</Link><Link href="/warehouses" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Manage warehouses</Link><button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{loading ? "Loading…" : "↻ Refresh"}</button></div>
        </header>

        {errors.length > 0 && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Some inventory data could not be loaded.</p><p className="mt-1">Stock, warehouses, and alert endpoints require a signed-in Admin, Manager, or Staff account.</p><ul className="mt-2 list-inside list-disc">{errors.map((message) => <li key={message}>{message}</li>)}</ul></section>}
        {formError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Could not add stock record</p><p className="mt-1">{formError}</p>{formError.includes("403") && <p className="mt-2">Only an Admin can add a product to a warehouse.</p>}</section>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Stock records", value: stocks.length, icon: "▣" },
            { label: "Units on hand", value: totalUnits.toLocaleString(), icon: "📦" },
            { label: "Low stock products", value: lowStockCount, icon: "⚠️" },
            { label: "Out of stock products", value: outOfStockCount, icon: "⛔" },
          ].map((item) => <article key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{item.label}</p><span className="rounded-xl bg-blue-50 p-3 text-lg">{item.icon}</span></div><p className="mt-4 text-2xl font-bold">{loading ? "…" : item.value}</p></article>)}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">Inventory by warehouse</h2><p className="mt-1 text-sm text-slate-500">Filter stock records by product or storage location.</p></div>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="stock-product-filter">Filter by product</label><select id="stock-product-filter" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select>
              <label className="sr-only" htmlFor="stock-warehouse-filter">Filter by warehouse</label><select id="stock-warehouse-filter" value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All warehouses</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>
            </div>
          </div>
          {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading stock records…</p> : filteredStocks.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No stock records match these filters. Add a product to a warehouse below.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Warehouse</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Last updated</th></tr></thead>
              <tbody>{filteredStocks.map((stock) => <tr key={stock.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">{productNames.get(stock.product_id)?.name ?? `Product #${stock.product_id}`}</td><td className="px-5 py-4 font-mono text-slate-600">{productNames.get(stock.product_id)?.sku ?? "—"}</td><td className="px-5 py-4">{warehouseNames.get(stock.warehouse_id)?.name ?? `Warehouse #${stock.warehouse_id}`}</td><td className="px-5 py-4 font-bold">{stock.quantity}</td><td className="px-5 py-4 text-slate-500">{new Date(stock.updated_at).toLocaleString()}</td></tr>)}</tbody>
            </table></div>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5"><h2 className="font-bold">Stock alerts</h2><p className="mt-1 text-sm text-slate-500">Products at or below their reorder level, including products with no stock.</p></div>
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading stock alerts…</p> : alerts.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No stock alerts.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Available</th><th className="px-5 py-3">Reorder level</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody>{alerts.map((alert) => <tr key={alert.product_id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">{alert.product_name}</td><td className="px-5 py-4 font-mono text-slate-600">{alert.sku}</td><td className="px-5 py-4">{alert.total_stock}</td><td className="px-5 py-4">{alert.reorder_level}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.status === "OUT_OF_STOCK" ? "bg-red-50 text-red-700" : alert.status === "LOW_STOCK" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{alert.status.replaceAll("_", " ")}</span></td></tr>)}</tbody>
            </table></div>}
        </section>

        <RoleGate roles={["admin"]} fallback={<p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Adding product/warehouse stock records requires an Admin account.</p>}><section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold">Add product to a warehouse</h2><p className="mt-1 max-w-3xl text-sm text-slate-500">This creates the product/warehouse stock record with quantity 0. Use Stock Activities to record stock in or stock out and change the quantity.</p>
          {products.length === 0 || warehouses.length === 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Create at least one product and one warehouse before adding a stock record.</p> : null}
          <form onSubmit={addProductToWarehouse} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div><label htmlFor="stock-product" className="mb-1.5 block text-sm font-medium">Product *</label><select id="stock-product" required value={productId} onChange={(event) => setProductId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></div>
            <div><label htmlFor="stock-warehouse" className="mb-1.5 block text-sm font-medium">Warehouse *</label><select id="stock-warehouse" required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select a warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
            <button type="submit" disabled={saving || !productId || !warehouseId || products.length === 0 || warehouses.length === 0} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Adding…" : "Add stock record"}</button>
          </form>
          <p className="mt-3 text-xs text-slate-500">Adding a stock record requires an Admin account.</p>
        </section></RoleGate>
      </div>
    </main>
  );
}
