"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "../../lib/api";
import { RoleGate, useAuth } from "../../components/auth-provider";
import { useCart } from "../../components/cart-provider";

type Category = { id: number; name: string };
type Product = {
  id: number;
  category_id: number;
  sku: string;
  name: string;
  description: string | null;
  unit_price: number | string;
  reorder_level: number;
  created_at: string | null;
};
type ProductPage = {
  total_products: number;
  total_pages: number;
  current_page: number;
  limit: number;
  products: Product[];
};

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

export default function ProductsPage() {
  const cart = useCart();
  const { user } = useAuth();
  const canShop = !user || user.role === "user"; // staff accounts manage orders; they don't buy
  const [cartMessage, setCartMessage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [products, setProducts] = useState<ProductPage | null>(null);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [description, setDescription] = useState("");

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category_id", categoryFilter);
    return `/products/?${params.toString()}`;
  }, [categoryFilter, page, pageSize, search]);

  const fetchProducts = useCallback(
    () => apiFetch<ProductPage>(requestUrl),
    [requestUrl],
  );

  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((response) => {
        if (active) {
          setProducts(response);
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
  }, [fetchProducts, refreshKey]);

  useEffect(() => {
    let active = true;
    apiFetch<Category[]>("/categories/")
      .then((items) => {
        if (active) {
          setCategories(items);
          if (items.length > 0) setCategoryId((current) => current || String(items[0].id));
        }
      })
      .catch((cause: unknown) => {
        if (active) setCategoryError(errorText(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setListError("");
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeCategoryFilter(value: string) {
    setLoading(true);
    setListError("");
    setPage(1);
    setCategoryFilter(value);
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setSaving(true);

    try {
      const created = await apiFetch<Product>("/products/", {
        method: "POST",
        body: JSON.stringify({
          category_id: Number(categoryId),
          sku: sku.trim(),
          name: name.trim(),
          description: description.trim() || null,
          unit_price: Number(unitPrice),
          reorder_level: Number(reorderLevel),
        }),
      });
      setSuccess(`Product “${created.name}” was created.`);
      setName("");
      setSku("");
      setUnitPrice("");
      setReorderLevel("10");
      setDescription("");
      setSearch("");
      setSearchInput("");
      setCategoryFilter("");
      setPage(1);
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setFormError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function refreshProducts() {
    setLoading(true);
    setListError("");
    setRefreshKey((key) => key + 1);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div>
            
            <h1 className="mt-2 text-2xl font-bold">Products</h1>
            <p className="mt-1 text-sm text-slate-500">Browse, search, and add products in your inventory.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/categories" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Manage categories</Link>
            <button type="button" onClick={refreshProducts} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
        </header>

        {listError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Could not load products</p><p className="mt-1">{listError}</p>
        </section>}
        {categoryError && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Could not load the category list for the product form: {categoryError}
        </section>}
        {formError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Could not create product</p><p className="mt-1">{formError}</p>
          {formError.includes("403") && <p className="mt-2">Creating products requires an Admin or Manager account.</p>}
        </section>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
        {cartMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{cartMessage}</p>}

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div><h2 className="font-bold">Product list</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading products…" : `${products?.total_products ?? 0} products found`}</p></div>
            <form onSubmit={submitSearch} className="flex w-full flex-wrap gap-2 sm:w-auto">
              <label className="sr-only" htmlFor="product-search">Search products</label>
              <input id="product-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search product or category…" className="min-w-52 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Search</button>
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
            <label htmlFor="category-filter" className="text-sm font-medium text-slate-600">Category</label>
            <select id="category-filter" value={categoryFilter} onChange={(event) => changeCategoryFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <label htmlFor="page-size" className="ml-auto text-sm text-slate-500">Rows</label>
            <select id="page-size" value={pageSize} onChange={(event) => { setLoading(true); setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
              {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>

          {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading products from the API…</p> :
            products?.products.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="px-5 py-3">Product</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Unit price</th><th className="px-5 py-3">Reorder level</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Order</th>
              </tr></thead>
              <tbody>{products.products.map((product) => <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="px-5 py-4"><p className="font-semibold">{product.name}</p>{product.description && <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{product.description}</p>}</td>
                <td className="px-5 py-4 font-mono text-slate-600">{product.sku}</td><td className="px-5 py-4">{categoryNames.get(product.category_id) ?? `Category #${product.category_id}`}</td>
                <td className="px-5 py-4 font-medium">৳ {Number(product.unit_price).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="px-5 py-4">{product.reorder_level}</td>
                <td className="px-5 py-4 text-slate-500">{product.created_at ? new Date(product.created_at).toLocaleDateString() : "—"}</td><td className="px-5 py-4">{canShop ? <button type="button" onClick={() => { cart.add({ id: product.id, name: product.name, sku: product.sku, unit_price: Number(product.unit_price) }); setCartMessage(`${product.name} added to cart.`); window.setTimeout(() => setCartMessage(""), 2500); }} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800">Add to cart</button> : <span className="text-xs text-slate-400">Customer accounts only</span>}</td>
              </tr>)}</tbody>
            </table></div> : <p className="p-10 text-center text-sm text-slate-500">{listError ? "Products could not be loaded." : "No products found. Add a product or adjust your search/filter."}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-500">Page {products?.current_page ?? page} of {products?.total_pages || 0}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} disabled={loading || page <= 1} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => { setLoading(true); setPage((current) => current + 1); }} disabled={loading || page >= (products?.total_pages ?? 0)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </div>
        </section>

        <RoleGate roles={["admin", "manager"]} fallback={<p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Creating products requires an Admin or Manager account.</p>}><section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="max-w-3xl"><h2 className="font-bold">Add product</h2><p className="mt-1 text-sm text-slate-500">Enter the required product details. New products appear in the list after they are saved.</p></div>
          {categories.length === 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Create a category first, then return here to add products.</p>}
          <form onSubmit={createProduct} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label htmlFor="product-name" className="mb-1.5 block text-sm font-medium">Product name *</label><input id="product-name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Wireless Mouse" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
            <div><label htmlFor="product-sku" className="mb-1.5 block text-sm font-medium">SKU *</label><input id="product-sku" required maxLength={100} value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. MOU-001" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
            <div><label htmlFor="product-category" className="mb-1.5 block text-sm font-medium">Category *</label><select id="product-category" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={categories.length === 0} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            <div><label htmlFor="product-price" className="mb-1.5 block text-sm font-medium">Unit price (৳) *</label><input id="product-price" required type="number" min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
            <div><label htmlFor="product-reorder" className="mb-1.5 block text-sm font-medium">Reorder level</label><input id="product-reorder" type="number" min="0" step="1" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
            <div className="sm:col-span-2 lg:col-span-1"><label htmlFor="product-description" className="mb-1.5 block text-sm font-medium">Description</label><textarea id="product-description" rows={1} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional product details" className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
            <div className="sm:col-span-2 lg:col-span-3"><button type="submit" disabled={saving || categories.length === 0 || !categoryId} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving product…" : "Create product"}</button><p className="mt-2 text-xs text-slate-500">Creating products requires an Admin or Manager account.</p></div>
          </form>
        </section></RoleGate>
      </div>
    </main>
  );
}
