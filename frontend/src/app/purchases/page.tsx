"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { API_BASE_URL, apiFetch, ApiError } from "../../lib/api";

type Supplier = { id: number; company_name: string };
type Category = { id: number; name: string };
type Product = { id: number; category_id: number; name: string; sku: string; unit_price: number | string };
type ProductPage = { total_pages: number; products: Product[] };
type PurchaseOrder = { id: number; supplier_id: number; total_amount: number | string; date: string; created_at: string };
type PurchaseItem = { id: number; purchase_order_id: number; product_id: number; quantity: number; unit_price: number | string; created_at: string };
type SupplierInvoice = { id: number; supplier_id: number; purchase_order_id: number; invoice_number: string | null; invoice_date: string; amount: number | string; file_name: string; content_type: string; created_at: string };
type DraftLine = { key: number; productId: string; quantity: string; unitPrice: string };

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

async function getProducts() {
  const first = await apiFetch<ProductPage>("/products/?page=1&limit=100");
  const rest = await Promise.all(Array.from({ length: Math.max(first.total_pages - 1, 0) }, (_, i) => apiFetch<ProductPage>(`/products/?page=${i + 2}&limit=100`)));
  return [...first.products, ...rest.flatMap((item) => item.products)];
}

const newLine = (key: number): DraftLine => ({ key, productId: "", quantity: "1", unitPrice: "" });

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([newLine(1)]);
  const [nextLineKey, setNextLineKey] = useState(2);
  const [search, setSearch] = useState("");

  const supplierMap = useMemo(() => new Map(suppliers.map((item) => [item.id, item.company_name])), [suppliers]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);
  const visibleOrders = orders.filter((item) => `${item.id} ${supplierMap.get(item.supplier_id) ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const grandTotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      apiFetch<Supplier[]>("/suppliers/"), getProducts(), apiFetch<PurchaseOrder[]>("/purchase-orders/"), apiFetch<PurchaseItem[]>("/purchase-order-items/"), apiFetch<Category[]>("/categories/"), apiFetch<SupplierInvoice[]>("/supplier-invoices/"),
    ] as const);
    const errs: string[] = [];
    const read = <T,>(index: number, label: string): T | undefined => {
      const result = results[index];
      if (result.status === "fulfilled") return result.value as T;
      errs.push(`${label}: ${errorText(result.reason)}`);
      return undefined;
    };
    return { suppliers: read<Supplier[]>(0, "Suppliers"), products: read<Product[]>(1, "Products"), orders: read<PurchaseOrder[]>(2, "Purchase orders"), items: read<PurchaseItem[]>(3, "Purchase items"), categories: read<Category[]>(4, "Categories"), invoices: read<SupplierInvoice[]>(5, "Supplier invoices"), errors: errs };
  }, []);

  useEffect(() => {
    let active = true;
    loadData().then((data) => {
      if (!active) return;
      setSuppliers(data.suppliers ?? []); setProducts(data.products ?? []); setOrders(data.orders ?? []); setItems(data.items ?? []); setCategories(data.categories ?? []); setInvoices(data.invoices ?? []); setErrors(data.errors); setLoading(false);
    });
    return () => { active = false; };
  }, [loadData, refreshKey]);

  function updateLine(key: number, field: keyof Omit<DraftLine, "key">, value: string) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  }

  function selectProduct(key: number, value: string) {
    const product = products.find((item) => item.id === Number(value));
    setLines((current) => current.map((line) => line.key === key ? { ...line, productId: value, unitPrice: product ? String(product.unit_price) : "" } : line));
  }

  function addLine() {
    setLines((current) => [...current, newLine(nextLineKey)]);
    setNextLineKey((key) => key + 1);
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setSaving(true); setFormError(""); setSuccess("");
    if (!invoiceFile) {
      setFormError("Choose the supplier's invoice file (PDF, JPG, PNG, or WEBP)."); setSaving(false); return;
    }
    if (invoiceFile.size > 15 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(invoiceFile.type)) {
      setFormError("Invoice must be a PDF, JPG, PNG, or WEBP file no larger than 15 MB."); setSaving(false); return;
    }
    if (!lines.length || lines.some((line) => !line.productId || Number(line.quantity) <= 0 || Number(line.unitPrice) < 0)) {
      setFormError("Select a product and enter a valid quantity and unit price for every item line."); setSaving(false); return;
    }
    try {
      const form = new FormData();
      form.append("purchase_data", JSON.stringify({ supplier_id: Number(supplierId), date: `${invoiceDate}T00:00:00`, invoice_date: `${invoiceDate}T00:00:00`, invoice_number: invoiceNumber.trim() || null, invoice_amount: invoiceAmount.trim() ? Number(invoiceAmount) : null, items: lines.map((line) => ({ product_id: Number(line.productId), quantity: Number(line.quantity), unit_price: Number(line.unitPrice) })) }));
      form.append("invoice_file", invoiceFile);
      const created = await apiFetch<SupplierInvoice>("/supplier-invoices/with-purchase-order", {
        method: "POST",
        body: form,
      });
      setSuccess(`Supplier invoice${created.invoice_number ? ` ${created.invoice_number}` : ` #${created.id}`} and purchase order #${created.purchase_order_id} saved. Total: ৳ ${Number(created.amount).toFixed(2)}.`);
      setSupplierId(""); setInvoiceNumber(""); setInvoiceAmount(""); setInvoiceDate(new Date().toISOString().slice(0, 10)); setInvoiceFile(null); setLines([newLine(nextLineKey)]); setNextLineKey((key) => key + 1);
      formElement.reset(); setLoading(true); setRefreshKey((key) => key + 1);
    } catch (cause) { setFormError(errorText(cause)); } finally { setSaving(false); }
  }

  async function downloadInvoice(invoice: SupplierInvoice) {
    try {
      const response = await fetch(`${API_BASE_URL}/supplier-invoices/${invoice.id}/file`, { credentials: "include" });
      if (!response.ok) throw new ApiError(`Could not download invoice file (${response.status})`, response.status);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = invoice.file_name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setFormError(errorText(cause)); }
  }

  return <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8"><div className="mx-auto max-w-7xl space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div><h1 className="mt-2 text-2xl font-bold">Purchase Orders</h1><p className="mt-1 text-sm text-slate-500">Choose a supplier, add product lines, then save the whole order once.</p></div><button onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">{loading ? "Loading…" : "↻ Refresh"}</button></header>
    {errors.length > 0 && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Some purchase data could not be loaded</p><ul className="mt-1 list-inside list-disc">{errors.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-2">Purchase APIs require an Admin or Manager account. If orders and products load but Supplier invoices says “Failed to fetch”, restart the backend and apply the latest database migration (`alembic upgrade head`).</p></section>}
    {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p>}{success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="font-bold">Record supplier purchase & invoice</h2><p className="mt-1 text-sm text-slate-500">Add the supplier, invoice document, date, and every product line. One save records all purchase details and stores the original invoice file.</p>
      <form onSubmit={createOrder} className="mt-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div><label htmlFor="purchase-supplier" className="mb-1.5 block text-sm font-medium">Supplier *</label><select id="purchase-supplier" required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.company_name}</option>)}</select>{suppliers.length === 0 && !loading && <p className="mt-1 text-xs text-amber-700">Create a supplier before creating a purchase record.</p>}</div>
          <div><label htmlFor="supplier-invoice-number" className="mb-1.5 block text-sm font-medium">Supplier invoice number</label><input id="supplier-invoice-number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} maxLength={100} placeholder="Optional invoice number" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
          <div><label htmlFor="supplier-invoice-amount" className="mb-1.5 block text-sm font-medium">Invoice amount (৳)</label><input id="supplier-invoice-amount" type="number" min="0" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} placeholder={`Default ৳ ${grandTotal.toFixed(2)}`} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><p className="mt-1 text-xs text-slate-500">Leave blank to use item total.</p></div>
          <div><label htmlFor="supplier-invoice-date" className="mb-1.5 block text-sm font-medium">Invoice date *</label><input id="supplier-invoice-date" required type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div>
        </div>
        <div className="max-w-xl"><label htmlFor="supplier-invoice-file" className="mb-1.5 block text-sm font-medium">Supplier invoice PDF or photo *</label><input id="supplier-invoice-file" required type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700" /><p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG or WEBP; up to 15 MB. The file is saved in the database.</p></div>
        <div className="space-y-3">{lines.map((line, index) => <div key={line.key} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto] md:items-end">
          <div><label htmlFor={`purchase-product-${line.key}`} className="mb-1.5 block text-sm font-medium">Product {index + 1} *</label><select id={`purchase-product-${line.key}`} required value={line.productId} onChange={(event) => selectProduct(line.key, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}</select></div>
          <div><label htmlFor={`purchase-quantity-${line.key}`} className="mb-1.5 block text-sm font-medium">Quantity *</label><input id={`purchase-quantity-${line.key}`} required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" /></div>
          <div><label htmlFor={`purchase-price-${line.key}`} className="mb-1.5 block text-sm font-medium">Unit price *</label><input id={`purchase-price-${line.key}`} required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, "unitPrice", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" /></div>
          <div className="text-sm"><span className="block text-slate-500">Line total</span><strong className="mt-2 block">৳ {((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}</strong></div>
          <button type="button" aria-label={`Remove item ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-40">Remove</button>
        </div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4"><button type="button" onClick={addLine} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium">+ Add item</button><div className="flex items-center gap-5"><p className="text-sm text-slate-500">Items total <strong className="ml-2 text-lg text-slate-900">৳ {grandTotal.toFixed(2)}</strong></p><button type="submit" disabled={saving || !supplierId || !invoiceFile || suppliers.length === 0 || products.length === 0} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving purchase & invoice…" : "Save purchase & invoice"}</button></div></div>
        <p className="text-xs text-slate-500">Admin or Manager required. Purchase order, item details, total, invoice metadata and the uploaded invoice file are saved together. Record Stock IN separately when the goods physically arrive.</p>
      </form>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">Purchase orders</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading…" : `${visibleOrders.length} of ${orders.length} orders`}</p></div><input aria-label="Search purchase orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or supplier…" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading purchase data…</p> : visibleOrders.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No purchase orders found.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Lines</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">#PO-{order.id}</td><td className="px-5 py-4">{supplierMap.get(order.supplier_id) ?? `Supplier #${order.supplier_id}`}</td><td className="px-5 py-4 text-slate-500">{new Date(order.date).toLocaleDateString()}</td><td className="px-5 py-4 font-medium">৳ {Number(order.total_amount).toFixed(2)}</td><td className="px-5 py-4">{items.filter((item) => item.purchase_order_id === order.id).length}</td></tr>)}</tbody></table></div>}</section>

    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Supplier invoices</h2><p className="mt-1 text-sm text-slate-500">{invoices.length} saved invoice documents, linked to suppliers and purchase items</p></div>{invoices.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No supplier invoices saved yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Supplier / invoice</th><th className="px-5 py-3">Invoice date</th><th className="px-5 py-3">Purchase order</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Document</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-semibold">{supplierMap.get(invoice.supplier_id) ?? `Supplier #${invoice.supplier_id}`}</p><p className="mt-1 text-xs text-slate-500">{invoice.invoice_number || `Invoice #${invoice.id}`}</p></td><td className="px-5 py-4 text-slate-500">{new Date(invoice.invoice_date).toLocaleDateString()}</td><td className="px-5 py-4">#PO-{invoice.purchase_order_id}</td><td className="px-5 py-4 font-semibold">৳ {Number(invoice.amount).toFixed(2)}</td><td className="px-5 py-4"><button type="button" onClick={() => downloadInvoice(invoice)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Download {invoice.content_type === "application/pdf" ? "PDF" : "photo"}</button><p className="mt-1 max-w-48 truncate text-xs text-slate-500">{invoice.file_name}</p></td></tr>)}</tbody></table></div>}</section>

    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Purchase order items</h2><p className="mt-1 text-sm text-slate-500">{items.length} item lines. Product category comes from the product record.</p></div>{items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No purchase items yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Product</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Unit price</th><th className="px-5 py-3">Line total</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-4">#PO-{item.purchase_order_id}</td><td className="px-5 py-4">{categoryMap.get(productMap.get(item.product_id)?.category_id ?? 0) ?? "—"}</td><td className="px-5 py-4">{productMap.get(item.product_id)?.name ?? `Product #${item.product_id}`}</td><td className="px-5 py-4">{item.quantity}</td><td className="px-5 py-4">৳ {Number(item.unit_price).toFixed(2)}</td><td className="px-5 py-4 font-semibold">৳ {(item.quantity * Number(item.unit_price)).toFixed(2)}</td></tr>)}</tbody></table></div>}</section>
  </div></main>;
}
