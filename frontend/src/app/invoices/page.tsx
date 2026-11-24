"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api";

type Contact = { id: number; name: string; phone: string; address: string };
type Product = { id: number; category_id: number; name: string; sku: string };
type ProductPage = { total_pages: number; products: Product[] };
type Category = { id: number; name: string };
type Order = { id: number; contact_id: number; total_amount: number | string; created_at: string };
type OrderItem = { id: number; sales_order_id: number; product_id: number; quantity: number; unit_price: number | string; total_price: number | string };
type Transaction = { id: number; contact_id: number; sales_order_id: number; amount: number | string; status: string; date: string };
type Invoice = { id: number; user_id: number; sales_order_id: number; transaction_id: number };

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

function money(value: number | string) {
  return `৳ ${Number(value).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getProducts() {
  const first = await apiFetch<ProductPage>("/products/?page=1&limit=100");
  const rest = await Promise.all(Array.from({ length: Math.max(first.total_pages - 1, 0) }, (_, i) => apiFetch<ProductPage>(`/products/?page=${i + 2}&limit=100`)));
  return [...first.products, ...rest.flatMap((page) => page.products)];
}

export default function InvoicesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [orderId, setOrderId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const contactMap = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);
  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  const selectedOrder = selectedInvoice ? orders.find((order) => order.id === selectedInvoice.sales_order_id) : undefined;
  const selectedContact = selectedOrder ? contactMap.get(selectedOrder.contact_id) : undefined;
  const invoiceItems = selectedInvoice ? items.filter((item) => item.sales_order_id === selectedInvoice.sales_order_id) : [];
  const invoiceTransactions = selectedInvoice ? transactions.filter((item) => item.sales_order_id === selectedInvoice.sales_order_id) : [];
  const unbilledOrders = orders.filter((order) => !invoices.some((invoice) => invoice.sales_order_id === order.id) && transactions.some((transaction) => transaction.sales_order_id === order.id));
  const matchedTransactions = transactions.filter((item) => item.sales_order_id === Number(orderId));

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      apiFetch<Contact[]>("/contacts/"), getProducts(), apiFetch<Category[]>("/categories/"),
      apiFetch<Order[]>("/sales-orders/"), apiFetch<OrderItem[]>("/sales-order-items/"),
      apiFetch<Transaction[]>("/transactions/"), apiFetch<Invoice[]>("/invoices/"),
    ] as const);
    const messages: string[] = [];
    const read = <T,>(index: number, label: string): T | undefined => {
      const result = results[index];
      if (result.status === "fulfilled") return result.value as T;
      messages.push(`${label}: ${errorText(result.reason)}`);
      return undefined;
    };
    return {
      contacts: read<Contact[]>(0, "Contacts"), products: read<Product[]>(1, "Products"), categories: read<Category[]>(2, "Categories"),
      orders: read<Order[]>(3, "Sales orders"), items: read<OrderItem[]>(4, "Sales order items"),
      transactions: read<Transaction[]>(5, "Transactions"), invoices: read<Invoice[]>(6, "Invoices"), errors: messages,
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadData().then((data) => {
      if (!active) return;
      setContacts(data.contacts ?? []); setProducts(data.products ?? []); setCategories(data.categories ?? []);
      setOrders(data.orders ?? []); setItems(data.items ?? []); setTransactions(data.transactions ?? []);
      setInvoices(data.invoices ?? []); setErrors(data.errors); setLoading(false);
    });
    return () => { active = false; };
  }, [loadData, refreshKey]);

  async function createInvoiceForExistingTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError(""); setSuccess("");
    try {
      const invoice = await apiFetch<Invoice>("/invoices/", { method: "POST", body: JSON.stringify({ sales_order_id: Number(orderId), transaction_id: Number(transactionId) }) });
      setInvoices((current) => [invoice, ...current]); setSelectedInvoiceId(invoice.id);
      setSuccess(`Invoice INV-${String(invoice.id).padStart(6, "0")} created for existing order #${invoice.sales_order_id}.`);
      setOrderId(""); setTransactionId("");
    } catch (cause) { setFormError(errorText(cause)); } finally { setSaving(false); }
  }

  function emailInvoice(invoice: Invoice) {
    const order = orders.find((item) => item.id === invoice.sales_order_id);
    if (!order) return;
    const contact = contactMap.get(order.contact_id);
    const invoiceLines = items.filter((item) => item.sales_order_id === order.id);
    const paymentLines = transactions.filter((item) => item.sales_order_id === order.id);
    const recipient = window.prompt(`Email address for ${contact?.name ?? "the customer"}:`);
    if (!recipient?.trim()) return;
    const lineSummary = invoiceLines.map((item) => {
      const product = productMap.get(item.product_id);
      return `${categoryMap.get(product?.category_id ?? 0) ?? "Uncategorized"} / ${product?.name ?? `Product #${item.product_id}`} · Qty ${item.quantity} · ${money(item.unit_price)} each · ${money(item.total_price)}`;
    }).join("\n");
    const paymentSummary = paymentLines.map((item) => `#TRX-${item.id}: ${money(item.amount)} (${item.status})`).join("\n") || "No payment recorded";
    const body = [
      `Invoice INV-${String(invoice.id).padStart(6, "0")}`,
      `Sales order: #SO-${order.id}`,
      `Customer: ${contact?.name ?? "—"}`,
      `Phone: ${contact?.phone ?? "—"}`,
      "",
      "Items:", lineSummary || "No item lines",
      "", `Invoice total: ${money(order.total_amount)}`,
      `Paid (Paid/Completed transactions): ${money(paymentLines.filter((item) => ["paid", "completed"].includes(item.status.toLowerCase())).reduce((sum, item) => sum + Number(item.amount), 0))}`,
      `Outstanding: ${money(Math.max(Number(order.total_amount) - paymentLines.filter((item) => ["paid", "completed"].includes(item.status.toLowerCase())).reduce((sum, item) => sum + Number(item.amount), 0), 0))}`,
      "", "Payment history:", paymentSummary,
      "", "Please find the invoice details above. You can attach the printed invoice PDF if needed.",
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(`Invoice INV-${String(invoice.id).padStart(6, "0")}`)}&body=${encodeURIComponent(body)}`;
  }

  function printInvoice(invoiceId: number) {
    setSelectedInvoiceId(invoiceId);
    window.setTimeout(() => window.print(), 150);
  }

  return <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8"><div className="no-print mx-auto max-w-7xl space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div><h1 className="mt-2 text-2xl font-bold">Invoices</h1><p className="mt-1 text-sm text-slate-500">A sales invoice is created automatically when a transaction is recorded.</p></div><button onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">{loading ? "Loading…" : "↻ Refresh"}</button></header>
    {errors.length > 0 && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Some invoice details could not be loaded</p><ul className="mt-1 list-inside list-disc">{errors.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-2">Invoice register is available to Admin and Manager.</p></section>}
    {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}{formError.includes("403") && " — Only an Admin can record transactions or generate a legacy invoice."}</p>}{success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Invoice register</h2><p className="mt-1 text-sm text-slate-500">{invoices.length} invoices · select print or email to share one</p></div>{loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading invoice data…</p> : invoices.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No invoices yet. Record a transaction to create the first invoice automatically.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Sales order</th><th className="px-5 py-3">Invoice total</th><th className="px-5 py-3">Payment status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody>{invoices.map((invoice) => {
      const order = orders.find((item) => item.id === invoice.sales_order_id);
      const contact = order ? contactMap.get(order.contact_id) : undefined;
      const paymentRows = transactions.filter((item) => item.sales_order_id === invoice.sales_order_id);
      const primaryPayment = transactions.find((item) => item.id === invoice.transaction_id);
      const paidForOrder = paymentRows.filter((item) => ["paid", "completed"].includes(item.status.toLowerCase())).reduce((sum, item) => sum + Number(item.amount), 0);
      const paymentStatus = paidForOrder >= Number(order?.total_amount ?? 0) && paidForOrder > 0 ? "Paid" : paidForOrder > 0 ? "Partially paid" : primaryPayment?.status ?? "Pending";
      const issuedAt = primaryPayment?.date ?? order?.created_at;
      return <tr key={invoice.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">INV-{String(invoice.id).padStart(6, "0")}</td><td className="px-5 py-4">{contact?.name ?? `Contact #${order?.contact_id ?? "—"}`}</td><td className="px-5 py-4 text-slate-500">{issuedAt ? new Date(issuedAt).toLocaleDateString() : "—"}</td><td className="px-5 py-4">#SO-{invoice.sales_order_id}</td><td className="px-5 py-4 font-semibold">{money(order?.total_amount ?? 0)}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{paymentStatus}</span></td><td className="px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => setSelectedInvoiceId(invoice.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">View</button><button type="button" onClick={() => printInvoice(invoice.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">Print</button><button type="button" onClick={() => emailInvoice(invoice)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">Email</button></div></td></tr>;
    })}</tbody></table></div>}</section>

    {selectedInvoice && selectedOrder && <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Invoice INV-{String(selectedInvoice.id).padStart(6, "0")}</h2><p className="mt-1 text-sm text-slate-500">Full sales order and payment detail</p></div><div className="flex gap-2"><button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Print invoice</button><button type="button" onClick={() => emailInvoice(selectedInvoice)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">Email invoice</button><button type="button" onClick={() => setSelectedInvoiceId(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Close</button></div></div><InvoiceDocument invoice={selectedInvoice} order={selectedOrder} contact={selectedContact} items={invoiceItems} transactions={invoiceTransactions} products={productMap} categories={categoryMap} /></section>}

    {unbilledOrders.length > 0 && <details className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><summary className="cursor-pointer font-bold">Generate invoice for an older transaction</summary><p className="mt-2 text-sm text-slate-500">Use this only for transactions created before automatic invoice generation was enabled.</p><form onSubmit={createInvoiceForExistingTransaction} className="mt-5 grid gap-4 sm:grid-cols-2"><div><label htmlFor="legacy-invoice-order" className="mb-1.5 block text-sm font-medium">Sales order *</label><select id="legacy-invoice-order" required value={orderId} onChange={(event) => { setOrderId(event.target.value); setTransactionId(""); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select order</option>{unbilledOrders.map((item) => <option key={item.id} value={item.id}>#SO-{item.id} · {money(item.total_amount)}</option>)}</select></div><div><label htmlFor="legacy-invoice-transaction" className="mb-1.5 block text-sm font-medium">Matching transaction *</label><select id="legacy-invoice-transaction" required value={transactionId} onChange={(event) => setTransactionId(event.target.value)} disabled={!orderId} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>{orderId ? "Select transaction" : "Select a sales order first"}</option>{matchedTransactions.map((item) => <option key={item.id} value={item.id}>#TRX-{item.id} · {money(item.amount)} · {item.status}</option>)}</select></div><div className="sm:col-span-2"><button type="submit" disabled={saving || !orderId || !transactionId} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? "Creating…" : "Generate missing invoice"}</button></div></form></details>}
  </div>

  {selectedInvoice && selectedOrder && <div id="printable-invoice" className="hidden"><InvoiceDocument invoice={selectedInvoice} order={selectedOrder} contact={selectedContact} items={invoiceItems} transactions={invoiceTransactions} products={productMap} categories={categoryMap} /></div>}
  <style jsx global>{`@media print { @page { margin: 15mm; } body * { visibility: hidden !important; } #printable-invoice, #printable-invoice * { visibility: visible !important; } #printable-invoice { display: block !important; position: absolute; inset: 0; width: 100%; } }`}</style>
  </main>;
}

function InvoiceDocument({
  invoice, order, contact, items, transactions, products, categories,
}: {
  invoice: Invoice;
  order: Order;
  contact?: Contact;
  items: OrderItem[];
  transactions: Transaction[];
  products: Map<number, Product>;
  categories: Map<number, string>;
}) {
  const paid = transactions.filter((item) => ["paid", "completed"].includes(item.status.toLowerCase())).reduce((sum, item) => sum + Number(item.amount), 0);
  return <article className="mx-auto max-w-4xl bg-white p-8 text-slate-900 print:max-w-none print:p-0">
    <div className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-slate-800 pb-6"><div><p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Dream Warehouse & Inventory ERP</p><h1 className="mt-3 text-3xl font-bold">Sales Invoice</h1><p className="mt-2 text-slate-600">INV-{String(invoice.id).padStart(6, "0")}</p></div><div className="text-right text-sm"><p><strong>Sales order:</strong> #SO-{order.id}</p><p className="mt-1"><strong>Invoice date:</strong> {new Date(transactions.find((item) => item.id === invoice.transaction_id)?.date ?? order.created_at).toLocaleDateString()}</p></div></div>
    <div className="grid gap-5 py-6 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</p><p className="mt-2 font-bold">{contact?.name ?? "Customer"}</p><p className="mt-1 text-sm">{contact?.phone ?? "—"}</p><p className="mt-1 text-sm">{contact?.address ?? "—"}</p></div><div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment summary</p><p className="mt-2 text-sm">Payment records: {transactions.length}</p><p className="mt-1 text-sm">Paid: {money(paid)}</p><p className="mt-1 text-sm">Outstanding: {money(Math.max(Number(order.total_amount) - paid, 0))}</p></div></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-sm"><thead><tr className="border-y border-slate-300 text-xs uppercase text-slate-500"><th className="py-3 pr-3">Category</th><th className="py-3 pr-3">Product</th><th className="py-3 pr-3 text-right">Qty</th><th className="py-3 pr-3 text-right">Unit price</th><th className="py-3 text-right">Amount</th></tr></thead><tbody>{items.map((item) => { const product = products.get(item.product_id); return <tr key={item.id} className="border-b border-slate-200"><td className="py-3 pr-3">{categories.get(product?.category_id ?? 0) ?? "—"}</td><td className="py-3 pr-3"><p className="font-semibold">{product?.name ?? `Product #${item.product_id}`}</p><p className="text-xs text-slate-500">{product?.sku ?? ""}</p></td><td className="py-3 pr-3 text-right">{item.quantity}</td><td className="py-3 pr-3 text-right">{money(item.unit_price)}</td><td className="py-3 text-right font-semibold">{money(item.total_price)}</td></tr>; })}</tbody></table></div>
    <div className="ml-auto mt-6 max-w-sm space-y-2 border-t border-slate-300 pt-4 text-sm"><div className="flex justify-between text-lg font-bold"><span>Invoice total</span><span>{money(order.total_amount)}</span></div><div className="flex justify-between"><span>Paid</span><span>{money(paid)}</span></div><div className="flex justify-between font-semibold"><span>Due</span><span>{money(Math.max(Number(order.total_amount) - paid, 0))}</span></div></div>
    <div className="mt-8 border-t border-slate-200 pt-4"><p className="text-sm font-semibold">Payment transactions</p>{transactions.length ? <ul className="mt-2 space-y-1 text-xs text-slate-600">{transactions.map((item) => <li key={item.id}>#TRX-{item.id} · {new Date(item.date).toLocaleDateString()} · {money(item.amount)} · {item.status}</li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No payment records.</p>}</div>
    <p className="mt-8 text-center text-xs text-slate-500">Thank you for your business.</p>
  </article>;
}
