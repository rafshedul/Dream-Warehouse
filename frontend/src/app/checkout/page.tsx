"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../components/auth-provider";
import { useCart } from "../../components/cart-provider";

type CheckoutResult = { sales_order_id: number; order_number: string; amount: number; payment_method: string; payment_status: string; order_status: string; payment_url: string | null };
const money = (amount: number) => `৳ ${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CheckoutPage() {
  const { user } = useAuth();
  const cart = useCart();
  const router = useRouter();
  const [address, setAddress] = useState(user?.profile?.address ?? "");
  const [phone, setPhone] = useState(user?.profile?.phone ?? "");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<"sslcommerz" | "cod">("sslcommerz");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const subtotal = useMemo(() => cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), [cart.items]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSubmitting(true);
    try {
      const result = await apiFetch<CheckoutResult>("/storefront/checkout", { method: "POST", body: JSON.stringify({ items: cart.items.map(({ id, quantity }) => ({ product_id: id, quantity })), shipping_address: address, shipping_phone: phone, shipping_email: user?.email, delivery_note: note || null, payment_method: method }) });
      if (result.payment_url) { window.location.assign(result.payment_url); return; }
      cart.clear(); router.push(`/my-orders?placed=${result.sales_order_id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not place the order."); }
    finally { setSubmitting(false); }
  }

  if (!cart.items.length) return <main className="min-h-screen bg-slate-50 p-6"><section className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-bold">Your cart is empty</h1><Link className="mt-4 inline-block text-violet-700 underline" href="/products">Browse products</Link></section></main>;
  return <main className="min-h-screen bg-slate-50 p-5 text-slate-800 md:p-8"><div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_360px]"><section className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-violet-700">Delivery details</p><h1 className="mt-1 text-2xl font-bold">Checkout</h1><p className="mt-1 text-sm text-slate-500">Order will be shipped to the address you provide.</p>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    <form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="delivery-address" className="mb-1.5 block text-sm font-medium">Full delivery address *</label><textarea id="delivery-address" required minLength={8} maxLength={1000} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, road, upazila, district (e.g. Bhola)" className="w-full rounded-lg border px-3 py-2.5 text-sm" /></div><div><label htmlFor="delivery-phone" className="mb-1.5 block text-sm font-medium">Recipient phone *</label><input id="delivery-phone" required minLength={6} maxLength={50} value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm" /></div><div><label htmlFor="delivery-note" className="mb-1.5 block text-sm font-medium">Delivery note</label><textarea id="delivery-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional instructions" className="w-full rounded-lg border px-3 py-2.5 text-sm" /></div>
      <fieldset><legend className="mb-2 text-sm font-semibold">Payment method</legend><label className="flex cursor-pointer gap-3 rounded-xl border p-4"><input type="radio" name="payment" checked={method === "sslcommerz"} onChange={() => setMethod("sslcommerz")} /><span><strong className="block text-sm">Online payment</strong><span className="text-xs text-slate-500">SSLCommerz hosted secure checkout</span></span></label><label className="mt-2 flex cursor-pointer gap-3 rounded-xl border p-4"><input type="radio" name="payment" checked={method === "cod"} onChange={() => setMethod("cod")} /><span><strong className="block text-sm">Cash on delivery</strong><span className="text-xs text-slate-500">Pay when the parcel arrives</span></span></label></fieldset>
      <div className="flex flex-wrap gap-3"><button disabled={submitting} className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Placing order…" : method === "sslcommerz" ? "Continue to payment" : "Place order"}</button><Link href="/cart" className="rounded-lg border px-5 py-3 text-sm font-semibold">Back to cart</Link></div>
    </form></section><aside className="h-fit rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-bold">Order summary</h2><div className="mt-4 space-y-3">{cart.items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.name} × {item.quantity}</span><span>{money(item.unit_price * item.quantity)}</span></div>)}</div><div className="mt-4 border-t pt-4"><div className="flex justify-between text-sm"><span>Items total</span><span>{money(subtotal)}</span></div><div className="mt-2 flex justify-between text-sm text-slate-500"><span>Delivery</span><span>Set by warehouse</span></div><p className="mt-3 text-xs text-slate-500">Final price and available stock are verified when you place the order.</p></div></aside></div></main>;
}
