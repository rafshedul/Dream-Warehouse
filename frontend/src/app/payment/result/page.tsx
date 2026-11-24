"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { useCart } from "../../../components/cart-provider";

type OrderState = { order_number: string; payment_status: string; order_status: string };

function Result() {
  const params = useSearchParams();
  const orderId = params.get("order_id");
  const hinted = params.get("status") || "pending";
  const { clear } = useCart();
  const [order, setOrder] = useState<OrderState | null>(null);
  const [checked, setChecked] = useState(!orderId);

  // The URL only hints at the outcome; the order itself is the source of truth.
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    apiFetch<OrderState>(`/storefront/orders/${orderId}`)
      .then((result) => { if (active) setOrder(result); })
      .catch(() => undefined)
      .finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, [orderId]);

  const paid = order ? order.payment_status === "paid" : false;
  useEffect(() => { if (paid) clear(); }, [paid, clear]);

  const refund = order?.order_status === "refund_required";
  const status = order ? (paid ? "success" : order.payment_status) : hinted;
  const title = !checked ? "Checking your payment…" : refund ? "Payment received — order needs attention" : paid ? "Payment received" : status === "cancelled" ? "Payment cancelled" : status === "failed" || status === "expired" ? "Payment was not completed" : "We could not confirm your payment yet";
  const message = !checked ? "One moment while we confirm with the payment provider."
    : refund ? "Your payment arrived after the items sold out. We will refund you; please contact support with your order number."
    : paid ? "Your payment was verified. Your order is being prepared, and its invoice will be emailed if mail delivery is configured."
    : status === "cancelled" || status === "failed" || status === "expired" ? "Nothing was charged for this order. Your cart is still saved, so you can try again."
    : order ? "Your payment is still being confirmed. Check My Orders in a minute; if it stays pending the order is cancelled automatically and the stock released."
    : "Sign in and open My Orders to see the latest status of your order.";

  return <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-5"><section className="w-full max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm"><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${paid && !refund ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{paid && !refund ? "✓" : "!"}</div><h1 className="mt-4 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>{(order?.order_number || orderId) && <p className="mt-3 text-xs text-slate-500">Order {order?.order_number ?? `#${orderId}`}</p>}<div className="mt-6 flex justify-center gap-3"><Link href="/my-orders" className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white">My Orders</Link><Link href="/products" className="rounded-lg border px-5 py-2.5 text-sm font-semibold">Continue shopping</Link></div></section></main>;
}

export default function PaymentResultPage() {
  return <Suspense fallback={null}><Result /></Suspense>;
}
