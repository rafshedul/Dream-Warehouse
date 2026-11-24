"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import SalesOrdersPanel from "../../components/sales-orders-panel";

type Contact = { id: number; name: string; phone: string };
type Product = { id: number; name: string; sku: string; unit_price: number | string };
type ProductPage = { total_pages: number; products: Product[] };
type Order = { id: number; contact_id: number; total_amount: number | string; created_at: string };
type OrderItem = { id: number; sales_order_id: number; product_id: number; quantity: number; unit_price: number | string; total_price: number | string };
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

export default function SalesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [contactId, setContactId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([newLine(1)]);
  const [nextLineKey, setNextLineKey] = useState(2);

  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);
  const grandTotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      apiFetch<Contact[]>("/contacts/"), getProducts(), apiFetch<OrderItem[]>("/sales-order-items/"),
    ] as const);
    const errs: string[] = [];
    const read = <T,>(index: number, label: string): T | undefined => {
      const result = results[index];
      if (result.status === "fulfilled") return result.value as T;
      errs.push(`${label}: ${errorText(result.reason)}`);
      return undefined;
    };
    return { contacts: read<Contact[]>(0, "Customer contacts"), products: read<Product[]>(1, "Products"), items: read<OrderItem[]>(2, "Sales order items"), errors: errs };
  }, []);

  useEffect(() => {
    let active = true;
    loadData().then((data) => {
      if (!active) return;
      setContacts(data.contacts ?? []); setProducts(data.products ?? []); setItems(data.items ?? []); setErrors(data.errors); setLoading(false);
    });
    return () => { active = false; };
  }, [loadData, refreshKey]);

  function updateLine(key: number, field: "productId" | "quantity" | "unitPrice", value: string) {
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

  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError(""); setSuccess("");
    if (!lines.length || lines.some((line) => !line.productId || Number(line.quantity) <= 0 || Number(line.unitPrice) < 0)) {
      setFormError("Select a product and enter a valid quantity and unit price for every item line."); setSaving(false); return;
    }
    try {
      const created = await apiFetch<Order>("/sales-orders/with-items", {
        method: "POST",
        body: JSON.stringify({ contact_id: Number(contactId), items: lines.map((line) => ({ product_id: Number(line.productId), quantity: Number(line.quantity), unit_price: Number(line.unitPrice) })) }),
      });
      setSuccess(`Sales order #${created.id}, ${lines.length} item line${lines.length === 1 ? "" : "s"}, and total ৳ ${Number(created.total_amount).toFixed(2)} saved together.`);
      setContactId(""); setLines([newLine(nextLineKey)]); setNextLineKey((key) => key + 1);
      setRefreshKey((key) => key + 1);
    } catch (cause) { setFormError(errorText(cause)); } finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8"><div className="mx-auto max-w-7xl space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div><h1 className="mt-2 text-2xl font-bold">Sales Orders</h1><p className="mt-1 text-sm text-slate-500">Choose a customer, add product lines, and save the whole sale once.</p></div><button onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">{loading ? "Loading…" : "↻ Refresh"}</button></header>
    {errors.length > 0 && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Some sales data could not be loaded</p><ul className="mt-1 list-inside list-disc">{errors.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-2">Sales order creation requires Admin, Manager, or Staff access.</p></section>}
    {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p>}{success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="font-bold">Add sales order item</h2><p className="mt-1 text-sm text-slate-500">Customer, all products and the total are saved together with one click.</p>
      <form onSubmit={saveSale} className="mt-5 space-y-5">
        <div className="max-w-xl"><label htmlFor="sales-contact" className="mb-1.5 block text-sm font-medium">Customer contact *</label><select id="sales-contact" required value={contactId} onChange={(event) => setContactId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select customer contact</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>)}</select>{contacts.length === 0 && !loading && <p className="mt-1 text-xs text-amber-700">Create a customer contact before recording a sale.</p>}</div>
        <div className="space-y-3">{lines.map((line, index) => <div key={line.key} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto] md:items-end">
          <div><label htmlFor={`sales-product-${line.key}`} className="mb-1.5 block text-sm font-medium">Product {index + 1} *</label><select id={`sales-product-${line.key}`} required value={line.productId} onChange={(event) => selectProduct(line.key, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}</select></div>
          <div><label htmlFor={`sales-quantity-${line.key}`} className="mb-1.5 block text-sm font-medium">Quantity *</label><input id={`sales-quantity-${line.key}`} required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" /></div>
          <div><label htmlFor={`sales-price-${line.key}`} className="mb-1.5 block text-sm font-medium">Unit price *</label><input id={`sales-price-${line.key}`} required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, "unitPrice", event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" /></div>
          <div className="text-sm"><span className="block text-slate-500">Line total</span><strong className="mt-2 block">৳ {((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}</strong></div>
          <button type="button" aria-label={`Remove product ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-40">Remove</button>
        </div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4"><button type="button" onClick={addLine} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium">+ Add product</button><div className="flex items-center gap-5"><p className="text-sm text-slate-500">Order total <strong className="ml-2 text-lg text-slate-900">৳ {grandTotal.toFixed(2)}</strong></p><button type="submit" disabled={saving || !contactId || contacts.length === 0 || products.length === 0} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving sale…" : "Add sales order item"}</button></div></div>
        <p className="text-xs text-slate-500">Admin, Manager, or Staff can save a sale. Stock is not reduced automatically; record the stock movement separately.</p>
      </form>
    </section>

    <SalesOrdersPanel refreshKey={refreshKey} />

    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Sales order items</h2><p className="mt-1 text-sm text-slate-500">{items.length} line items</p></div>{items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No order items yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Product</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Unit price</th><th className="px-5 py-3">Line total</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-4">#SO-{item.sales_order_id}</td><td className="px-5 py-4">{productMap.get(item.product_id)?.name ?? `Product #${item.product_id}`}</td><td className="px-5 py-4">{item.quantity}</td><td className="px-5 py-4">৳ {Number(item.unit_price).toFixed(2)}</td><td className="px-5 py-4 font-semibold">৳ {Number(item.total_price).toFixed(2)}</td></tr>)}</tbody></table></div>}</section>
  </div></main>;
}
