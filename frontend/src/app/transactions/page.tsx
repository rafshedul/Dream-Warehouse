"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "../../lib/api";

type Contact = { id: number; name: string; phone: string };
type Order = { id: number; contact_id: number; total_amount: number | string; created_at: string };
type Transaction = { id: number; contact_id: number; sales_order_id: number; amount: number | string; date: string; status: string; invoice_id?: number; invoice_number?: string; invoice_created?: boolean };
function errorText(error: unknown) { const message = error instanceof Error ? error.message : "Something went wrong."; return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message; }

export default function TransactionsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [orderId, setOrderId] = useState("");
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const contactMap = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);
  const visible = transactions.filter((item) => `${item.id} ${item.sales_order_id} ${item.status} ${contactMap.get(item.contact_id)?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([apiFetch<Contact[]>("/contacts/"), apiFetch<Order[]>("/sales-orders/"), apiFetch<Transaction[]>("/transactions/")] as const);
    const messages: string[] = [];
    const read = <T,>(index: number, label: string): T | undefined => { const result = results[index]; if (result.status === "fulfilled") return result.value as T; messages.push(`${label}: ${errorText(result.reason)}`); return undefined; };
    return { contacts: read<Contact[]>(0, "Contacts"), orders: read<Order[]>(1, "Sales orders"), transactions: read<Transaction[]>(2, "Transactions"), messages };
  }, []);
  useEffect(() => { let active = true; loadData().then((data) => { if (!active) return; setContacts(data.contacts ?? []); setOrders(data.orders ?? []); setTransactions(data.transactions ?? []); setErrors(data.messages); setLoading(false); }); return () => { active = false; }; }, [loadData, refreshKey]);

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError(""); setSuccess("");
    try {
      const created = await apiFetch<Transaction>("/transactions/", { method: "POST", body: JSON.stringify({ contact_id: Number(contactId), sales_order_id: Number(orderId), amount: Number(amount), status }) });
      setTransactions((current) => [...current, created]); setSuccess(`Transaction #${created.id} recorded. Invoice ${created.invoice_number ?? `#${created.invoice_id}`} ${created.invoice_created ? "created automatically" : "already exists for this order"}.`); setAmount(""); setOrderId(""); setContactId(""); setStatus("pending");
    } catch (cause) { setFormError(errorText(cause)); } finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8"><div className="mx-auto max-w-7xl space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div><h1 className="mt-2 text-2xl font-bold">Transactions</h1><p className="mt-1 text-sm text-slate-500">Review and record payments linked to sales orders.</p></div><button onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">{loading ? "Loading…" : "↻ Refresh"}</button></header>
    {errors.length > 0 && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Some transaction data could not be loaded</p><ul className="mt-1 list-inside list-disc">{errors.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-2">Viewing transactions requires Admin or Manager. Creating one requires Admin.</p></section>}{formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}{formError.includes("403") && " — Only an Admin can record transactions."}</p>}{success && <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span>{success}</span><Link href="/invoices" className="font-semibold underline">Open Invoices</Link></p>}
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">Transaction history</h2><p className="mt-1 text-sm text-slate-500">{transactions.length} transactions</p></div><input aria-label="Search transactions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transaction, order, or contact…" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>{loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading transactions…</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No transactions found.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Transaction</th><th className="px-5 py-3">Sales order</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">#TRX-{item.id}</td><td className="px-5 py-4">#SO-{item.sales_order_id}</td><td className="px-5 py-4">{contactMap.get(item.contact_id)?.name ?? `Contact #${item.contact_id}`}</td><td className="px-5 py-4 text-slate-500">{new Date(item.date).toLocaleDateString()}</td><td className="px-5 py-4 font-semibold">৳ {Number(item.amount).toFixed(2)}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status.toLowerCase() === "paid" || item.status.toLowerCase() === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></td></tr>)}</tbody></table></div>}</section>
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="font-bold">Record transaction</h2><p className="mt-1 text-sm text-slate-500">Select a sales order to fill its customer contact and suggested total.</p><form onSubmit={createTransaction} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end"><div><label htmlFor="transaction-order" className="mb-1.5 block text-sm font-medium">Sales order *</label><select id="transaction-order" required value={orderId} onChange={(event) => { const id = event.target.value; setOrderId(id); const order = orders.find((item) => item.id === Number(id)); if (order) { setContactId(String(order.contact_id)); setAmount(String(order.total_amount)); } }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select order</option>{orders.map((item) => <option key={item.id} value={item.id}>#SO-{item.id} · ৳ {Number(item.total_amount).toFixed(2)}</option>)}</select></div><div><label htmlFor="transaction-contact" className="mb-1.5 block text-sm font-medium">Customer contact *</label><select id="transaction-contact" required value={contactId} onChange={(event) => setContactId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select contact</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>)}</select></div><div><label htmlFor="transaction-amount" className="mb-1.5 block text-sm font-medium">Amount (৳) *</label><input id="transaction-amount" required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></div><div><label htmlFor="transaction-status" className="mb-1.5 block text-sm font-medium">Status *</label><select id="transaction-status" value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="pending">Pending</option><option value="paid">Paid</option><option value="completed">Completed</option><option value="failed">Failed</option></select></div><div className="sm:col-span-2 xl:col-span-4"><button type="submit" disabled={saving || !orderId || !contactId} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Create transaction"}</button><p className="mt-2 text-xs text-slate-500">Admin only. Transaction date defaults to the current server time.</p></div></form></section>
  </div></main>;
}
