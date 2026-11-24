"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "../../lib/api";
import { RoleGate } from "../../components/auth-provider";

type Product = { id: number; category_id: number; name: string; sku: string };
type ProductPage = { total_pages: number; products: Product[] };
type Category = { id: number; name: string };
type Warehouse = { id: number; name: string };
type Activity = {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  date: string;
  movement_type: "IN" | "OUT" | "ADJUSTMENT";
  created_by: number | null;
};
type ActivityPage = {
  total_items: number;
  total_pages: number;
  current_page: number;
  limit: number;
  activities: Activity[];
};

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

export default function StockActivitiesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [referenceError, setReferenceError] = useState("");
  const [activities, setActivities] = useState<ActivityPage | null>(null);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [movementDate, setMovementDate] = useState("");

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
  const categoryProducts = useMemo(() => products.filter((product) => product.category_id === Number(categoryId)), [categoryId, products]);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (productFilter) params.set("product_id", productFilter);
    if (warehouseFilter) params.set("warehouse_id", warehouseFilter);
    if (movementFilter) params.set("movement_type", movementFilter);
    if (startDate) params.set("start_date", `${startDate}T00:00:00`);
    if (endDate) params.set("end_date", `${endDate}T23:59:59.999`);
    return `/stock-activities/?${params.toString()}`;
  }, [endDate, movementFilter, page, productFilter, startDate, warehouseFilter]);

  const fetchActivities = useCallback(() => apiFetch<ActivityPage>(requestUrl), [requestUrl]);

  useEffect(() => {
    let active = true;
    fetchActivities()
      .then((result) => {
        if (active) {
          setActivities(result);
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
  }, [fetchActivities, refreshKey]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAllProducts(), apiFetch<Warehouse[]>("/warehouses/"), apiFetch<Category[]>("/categories/")])
      .then(([productItems, warehouseItems, categoryItems]) => {
        if (!active) return;
        setProducts(productItems);
        setWarehouses(warehouseItems);
        setCategories(categoryItems);
      })
      .catch((cause: unknown) => {
        if (active) setReferenceError(`Could not load product, category, or warehouse options: ${errorText(cause)}`);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyFilter(change: () => void) {
    setLoading(true);
    setListError("");
    setPage(1);
    change();
  }

  async function createMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload: {
        product_id: number;
        warehouse_id: number;
        quantity: number;
        movement_type: "IN" | "OUT";
        date?: string;
      } = {
        product_id: Number(productId),
        warehouse_id: Number(warehouseId),
        quantity: Number(quantity),
        movement_type: movementType,
      };
      if (movementDate) payload.date = new Date(movementDate).toISOString();

      const created = await apiFetch<Activity>("/stock-activities/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const productName = productMap.get(created.product_id)?.name ?? `Product #${created.product_id}`;
      setSuccess(`Stock ${created.movement_type} saved for ${productName}; ${created.quantity} units ${created.movement_type === "IN" ? "added to" : "removed from"} warehouse stock.`);
      setQuantity("");
      setMovementDate("");
      setPage(1);
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
    setListError("");
    setRefreshKey((key) => key + 1);
  }

  const visibleActivities = activities?.activities ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div><h1 className="mt-2 text-2xl font-bold">Stock Activities</h1><p className="mt-1 text-sm text-slate-500">Review stock movements and record stock in or stock out.</p></div>
          <div className="flex gap-2"><Link href="/stocks" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">View stock</Link><button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{loading ? "Loading…" : "↻ Refresh"}</button></div>
        </header>

        {listError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Could not load stock activities</p><p className="mt-1">{listError}</p><p className="mt-2">Activity history requires a signed-in Admin, Manager, or Staff account.</p></section>}
        {referenceError && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Could not load product or warehouse options: {referenceError}</section>}
        {formError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Stock movement failed</p><p className="mt-1">{formError}</p>{formError.includes("403") && <p className="mt-2">Recording stock movements requires an Admin account.</p>}</section>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

        <section className="grid gap-4 sm:grid-cols-3">
          {[{ label: "Matching activities", value: activities?.total_items ?? 0 }, { label: "Current page", value: activities?.current_page ?? page }, { label: "Pages", value: activities?.total_pages ?? 0 }].map((item) => <article key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{item.label}</p><p className="mt-3 text-2xl font-bold">{loading ? "…" : item.value}</p></article>)}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5"><h2 className="font-bold">Activity history</h2><p className="mt-1 text-sm text-slate-500">Filter activity by product, warehouse, movement type, or date range.</p></div>
          <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-2 xl:grid-cols-5">
            <div><label htmlFor="activity-product-filter" className="mb-1 block text-xs font-medium text-slate-500">Product</label><select id="activity-product-filter" value={productFilter} onChange={(event) => applyFilter(() => setProductFilter(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></div>
            <div><label htmlFor="activity-warehouse-filter" className="mb-1 block text-xs font-medium text-slate-500">Warehouse</label><select id="activity-warehouse-filter" value={warehouseFilter} onChange={(event) => applyFilter(() => setWarehouseFilter(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All warehouses</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
            <div><label htmlFor="activity-type-filter" className="mb-1 block text-xs font-medium text-slate-500">Movement</label><select id="activity-type-filter" value={movementFilter} onChange={(event) => applyFilter(() => setMovementFilter(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All movements</option><option value="IN">Stock IN</option><option value="OUT">Stock OUT</option><option value="ADJUSTMENT">Adjustment</option></select></div>
            <div><label htmlFor="activity-start-date" className="mb-1 block text-xs font-medium text-slate-500">From date</label><input id="activity-start-date" type="date" value={startDate} max={endDate || undefined} onChange={(event) => applyFilter(() => setStartDate(event.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
            <div><label htmlFor="activity-end-date" className="mb-1 block text-xs font-medium text-slate-500">To date</label><input id="activity-end-date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => applyFilter(() => setEndDate(event.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          </div>
          {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading stock activity history…</p> : visibleActivities.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No activities match these filters.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Product</th><th className="px-5 py-3">Warehouse</th><th className="px-5 py-3">Movement</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Date</th></tr></thead>
              <tbody>{visibleActivities.map((activity) => <tr key={activity.id} className="border-t border-slate-100"><td className="px-5 py-4 font-mono text-slate-500">#ACT-{activity.id}</td><td className="px-5 py-4"><p className="font-semibold">{productMap.get(activity.product_id)?.name ?? `Product #${activity.product_id}`}</p><p className="mt-1 text-xs text-slate-500">{productMap.get(activity.product_id)?.sku ?? ""}</p></td><td className="px-5 py-4">{warehouseMap.get(activity.warehouse_id)?.name ?? `Warehouse #${activity.warehouse_id}`}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${activity.movement_type === "IN" ? "bg-emerald-50 text-emerald-700" : activity.movement_type === "OUT" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>Stock {activity.movement_type}</span></td><td className="px-5 py-4 font-bold">{activity.movement_type === "OUT" ? "−" : "+"}{activity.quantity}</td><td className="px-5 py-4 text-slate-500">{new Date(activity.date).toLocaleString()}</td></tr>)}</tbody>
            </table></div>}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4"><p className="text-sm text-slate-500">Page {activities?.current_page ?? page} of {activities?.total_pages ?? 0}</p><div className="flex gap-2"><button type="button" onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} disabled={loading || page <= 1} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Previous</button><button type="button" onClick={() => { setLoading(true); setPage((current) => current + 1); }} disabled={loading || page >= (activities?.total_pages ?? 0)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Next</button></div></div>
        </section>

        <RoleGate roles={["admin"]} fallback={<p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Recording stock movements requires an Admin account.</p>}><section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold">Record stock movement</h2><p className="mt-1 text-sm text-slate-500">Choose a category and a specific product. Stock IN increases its warehouse quantity; Stock OUT decreases it and is rejected if there is not enough stock.</p>
          {(products.length === 0 || categories.length === 0 || warehouses.length === 0) && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Add at least one category, product, and warehouse before recording a movement.</p>}
          <form onSubmit={createMovement} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
            <div><label htmlFor="activity-category" className="mb-1.5 block text-sm font-medium">Category *</label><select id="activity-category" required value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setProductId(""); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            <div><label htmlFor="activity-product" className="mb-1.5 block text-sm font-medium">Product *</label><select id="activity-product" required value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!categoryId} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100"><option value="" disabled>{categoryId ? "Select a product" : "Choose a category first"}</option>{categoryProducts.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select>{categoryId && categoryProducts.length === 0 && <p className="mt-1 text-xs text-amber-700">No products in this category yet.</p>}</div>
            <div><label htmlFor="activity-warehouse" className="mb-1.5 block text-sm font-medium">Warehouse *</label><select id="activity-warehouse" required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select a warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
            <div><label htmlFor="activity-movement" className="mb-1.5 block text-sm font-medium">Movement *</label><select id="activity-movement" value={movementType} onChange={(event) => setMovementType(event.target.value as "IN" | "OUT")} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="IN">Stock IN</option><option value="OUT">Stock OUT</option></select></div>
            <div><label htmlFor="activity-quantity" className="mb-1.5 block text-sm font-medium">Quantity *</label><input id="activity-quantity" required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 25" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
            <div><label htmlFor="activity-date" className="mb-1.5 block text-sm font-medium">Movement date (optional)</label><input id="activity-date" type="datetime-local" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
            <div className="sm:col-span-2 xl:col-span-6"><button type="submit" disabled={saving || !categoryId || !productId || !warehouseId || !quantity || products.length === 0 || categories.length === 0 || warehouses.length === 0} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving movement…" : "Save stock movement"}</button><p className="mt-2 text-xs text-slate-500">Recording stock movements requires an Admin account. After saving, check the updated quantity in Stock Management.</p></div>
          </form>
        </section></RoleGate>
      </div>
    </main>
  );
}
