"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../components/auth-provider";
import { useCart } from "../../components/cart-provider";

type Validation = { fulfillable: boolean; items: { product_id: number; exists: boolean; name: string | null; unit_price: number | null; available: number }[] };
const money = (amount: number) => `৳ ${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function QuantityInput({ name, value, max, onCommit }: { name: string; value: number; max: number; onCommit: (quantity: number) => void }) {
  // Keep what the user is typing; only commit valid whole numbers so clearing the box never deletes the item.
  const [draft, setDraft] = useState<string | null>(null);
  return <input aria-label={`Quantity for ${name}`} type="number" inputMode="numeric" min="1" max={max} step="1" value={draft ?? String(value)}
    onChange={(event) => { setDraft(event.target.value); const next = Number(event.target.value); if (Number.isInteger(next) && next >= 1) onCommit(Math.min(next, max)); }}
    onBlur={() => setDraft(null)} className="w-24 rounded-lg border px-3 py-2" />;
}

export default function CartPage() {
  const { user } = useAuth();
  const { items, setQuantity, remove, update } = useCart();
  const [validation, setValidation] = useState<Validation | null>(null);
  const [checkError, setCheckError] = useState("");
  const signature = items.map((item) => `${item.id}:${item.quantity}`).join(",");

  useEffect(() => {
    if (!signature) return;
    let active = true;
    const timer = window.setTimeout(() => {
      apiFetch<Validation>("/storefront/cart/validate", { method: "POST", body: JSON.stringify({ items: items.map(({ id, quantity }) => ({ product_id: id, quantity })) }) })
        .then((result) => {
          if (!active) return;
          setValidation(result); setCheckError("");
          result.items.forEach((line) => { if (line.exists && line.unit_price !== null) update(line.product_id, { unit_price: line.unit_price, name: line.name ?? undefined }); });
        })
        .catch((cause) => { if (active) setCheckError(cause instanceof Error ? cause.message : "Could not refresh prices and stock."); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const info = useMemo(() => new Map((validation?.items ?? []).map((line) => [line.product_id, line])), [validation]);
  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const problems = items.filter((item) => { const line = info.get(item.id); return line && (!line.exists || line.available < item.quantity); });
  const blocked = problems.length > 0 || (validation !== null && !validation.fulfillable);

  if (user && user.role !== "user") return <main className="min-h-screen bg-slate-50 p-5 md:p-8"><section className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold">The online cart is for customer accounts</h1><p className="mt-2 text-sm text-slate-600">You are signed in as {user.role}. Customer orders appear on the Sales page; to buy as a customer, sign in with a customer account.</p><Link href="/sales" className="mt-5 inline-flex rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white">View sales orders</Link></section></main>;
  return <main className="min-h-screen bg-slate-50 p-5 text-slate-800 md:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-violet-700">Online store</p><h1 className="mt-1 text-2xl font-bold">Your cart</h1><p className="mt-1 text-sm text-slate-500">Prices and stock are refreshed from the server and rechecked again at checkout.</p></header>
    {checkError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{checkError}</p>}
    {!items.length ? <section className="rounded-2xl border bg-white p-10 text-center"><h2 className="text-lg font-semibold">Your cart is empty</h2><p className="mt-2 text-sm text-slate-500">Browse the public product catalog and add what you need.</p><Link href="/products" className="mt-5 inline-flex rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white">Browse products</Link></section> : <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="divide-y">{items.map((item) => { const line = info.get(item.id); const gone = line && !line.exists; const short = line && line.exists && line.available < item.quantity; return <article key={item.id} className="flex flex-wrap items-center gap-4 p-5"><div className="min-w-48 flex-1"><h2 className="font-semibold">{item.name}</h2><p className="mt-1 font-mono text-xs text-slate-500">{item.sku}</p>{gone && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">This product is no longer available. Remove it to continue.</p>}{short && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{line.available === 0 ? "Out of stock." : `Only ${line.available} in stock.`}{line.available > 0 && <button type="button" onClick={() => setQuantity(item.id, line.available)} className="ml-2 underline">Use {line.available}</button>}</p>}</div><p className="text-sm">{money(item.unit_price)} each</p><label className="flex items-center gap-2 text-sm">Qty <QuantityInput name={item.name} value={item.quantity} max={5000} onCommit={(quantity) => setQuantity(item.id, quantity)} /></label><strong className="w-32 text-right">{money(item.unit_price * item.quantity)}</strong><button type="button" onClick={() => remove(item.id)} className="rounded-lg border px-3 py-2 text-sm text-red-700">Remove</button></article>; })}</div>
      {validation && !validation.fulfillable && problems.length === 0 && <p role="alert" className="border-t bg-amber-50 p-4 text-sm text-amber-900">These items are in stock but not all in one warehouse, so they can&apos;t be shipped as a single order. Try ordering fewer items or splitting this order.</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-slate-50 p-5"><div><p className="text-sm text-slate-500">Items total</p><p className="text-xl font-bold">{money(total)}</p><p className="mt-1 text-xs text-slate-500">Delivery charge is confirmed during checkout.</p></div><div className="flex gap-2"><Link href="/products" className="rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold">Continue shopping</Link>{blocked ? <span aria-disabled="true" className="cursor-not-allowed rounded-lg bg-slate-300 px-5 py-2.5 text-sm font-semibold text-white">Checkout</span> : <Link href="/checkout" className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white">Checkout</Link>}</div></div>
    </section>}
  </div></main>;
}
