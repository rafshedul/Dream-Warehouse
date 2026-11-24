"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type OrderItem = { id: number; product_name: string; sku: string; category_name: string; quantity: number; unit_price: number; total_price: number };
type Order = { id: number; order_number: string; created_at: string; total_amount: number; shipping_fee: number; payment_method: string | null; payment_status: string; order_status: string; shipping_address: string | null; shipping_phone: string | null; tracking_number: string | null; invoice_number: string | null; items: OrderItem[] };
const money = (amount: number) => `৳ ${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => { setLoading(true); setError(""); apiFetch<Order[]>("/storefront/orders").then(setOrders).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load orders.")).finally(() => setLoading(false)); }, []);
  const [cancelling, setCancelling] = useState<number | null>(null);
  async function cancelOrder(order: Order) {
    if (!window.confirm(`Cancel ${order.order_number}? Reserved items will be released.`)) return;
    setCancelling(order.id); setError("");
    try { const updated = await apiFetch<Order>(`/storefront/orders/${order.id}/cancel`, { method: "POST" }); setOrders((current) => current.map((item) => item.id === order.id ? updated : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel this order."); }
    finally { setCancelling(null); }
  }
  useEffect(() => {
    let active = true;
    apiFetch<Order[]>("/storefront/orders").then((result) => { if (active) setOrders(result); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load orders."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen bg-slate-50 p-5 text-slate-800 md:p-8"><div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-6 shadow-sm"><div><p className="text-sm font-semibold text-violet-700">Customer account</p><h1 className="mt-1 text-2xl font-bold">My Orders</h1><p className="mt-1 text-sm text-slate-500">Payment, delivery, tracking and invoice details for your purchases.</p></div><button onClick={refresh} className="rounded-lg border px-4 py-2 text-sm font-semibold">↻ Refresh</button></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}{loading && <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Loading orders…</p>}
    {!loading && !orders.length && <section className="rounded-2xl border bg-white p-10 text-center"><h2 className="font-semibold">No online orders yet</h2><Link href="/products" className="mt-3 inline-block text-sm font-semibold text-violet-700">Browse products</Link></section>}
    <div className="space-y-4">{orders.map((order) => <article key={order.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><header className="flex flex-wrap items-center justify-between gap-4 border-b bg-slate-50 p-5"><div><h2 className="font-bold">{order.order_number}</h2><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</p></div><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">Order: {order.order_status.replaceAll("_", " ")}</span><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">Payment: {order.payment_status}</span>{order.order_status === "processing" && order.payment_status !== "paid" && <button type="button" disabled={cancelling === order.id} onClick={() => void cancelOrder(order)} className="rounded-full border border-red-200 bg-white px-3 py-1 text-red-700 disabled:opacity-50">{cancelling === order.id ? "Cancelling…" : "Cancel order"}</button>}</div></header><div className="grid gap-5 p-5 md:grid-cols-[1fr_270px]"><div className="space-y-3">{order.items.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-3 border-b pb-3 text-sm last:border-0"><div><strong>{item.product_name}</strong><p className="mt-1 text-xs text-slate-500">{item.sku} · {item.category_name} · Qty {item.quantity}</p></div><span>{money(item.total_price)}</span></div>)}<div className="text-sm"><span className="font-medium">Ship to: </span>{order.shipping_address || "—"}<span className="ml-2 text-slate-500">· {order.shipping_phone}</span></div>{order.tracking_number && <p className="text-sm"><strong>Tracking number:</strong> {order.tracking_number}</p>}</div><aside className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-sm"><span>Delivery</span><span>{money(order.shipping_fee)}</span></div><div className="mt-3 flex justify-between border-t pt-3"><strong>Total</strong><strong>{money(order.total_amount)}</strong></div>{order.invoice_number && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><strong>{order.invoice_number}</strong><p className="mt-1 text-xs text-emerald-800">Payment received. Invoice sent to your account email when configured.</p><Link href={`/my-orders/${order.id}/invoice`} className="mt-2 inline-block rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">View / print invoice</Link></div>}</aside></div></article>)}</div>
  </div></main>;
}
