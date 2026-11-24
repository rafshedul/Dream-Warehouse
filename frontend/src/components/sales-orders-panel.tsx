"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

type Row = {
  id: number;
  order_number: string;
  source: "online" | "internal";
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  shipping_fee: number;
  payment_method: string | null;
  payment_status: string;
  order_status: string;
  item_count: number;
};
type SearchResult = { orders: Row[]; total: number; page: number; limit: number; total_pages: number; counts: Record<string, number> };
type Detail = {
  id: number;
  order_number: string;
  source: "online" | "internal";
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_address: string | null;
  shipping_phone: string | null;
  delivery_note: string | null;
  total_amount: number;
  shipping_fee: number;
  payment_method: string | null;
  payment_status: string;
  order_status: string;
  fulfillment_warehouse_name: string | null;
  items: { id: number; product_name: string; sku: string; category_name: string | null; quantity: number; unit_price: number; total_price: number }[];
  shipment: { id: number; tracking_number: string; status: string; date: string; warehouse_name: string | null } | null;
  invoice_number: string | null;
};

const TABS: { key: string; label: string; hint: string }[] = [
  { key: "all", label: "All", hint: "Every sales order" },
  { key: "online", label: "Online", hint: "Placed by customers in the store" },
  { key: "unpaid", label: "Unpaid", hint: "Waiting for online payment, or cash on delivery still to collect" },
  { key: "to_ship", label: "To ship", hint: "Paid online or cash on delivery, not shipped yet" },
  { key: "shipped", label: "Shipped", hint: "On the way to the customer" },
  { key: "delivered", label: "Delivered", hint: "Completed orders" },
  { key: "cancelled", label: "Cancelled", hint: "Cancelled or expired orders" },
  { key: "refund", label: "Needs refund", hint: "Paid, but the stock sold out before the payment arrived" },
];

const money = (amount: number) => `৳ ${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (value: string | null) => (value ? value.replaceAll("_", " ") : "—");
const when = (iso: string) => new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).toLocaleString();

const PAYMENT_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-900",
  due: "bg-amber-100 text-amber-900",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-slate-200 text-slate-700",
  expired: "bg-slate-200 text-slate-700",
  untracked: "bg-slate-100 text-slate-600",
};
const ORDER_TONE: Record<string, string> = {
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700",
  refund_required: "bg-red-100 text-red-800",
};

function Badge({ tone, children }: { tone: string | undefined; children: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone ?? "bg-slate-100 text-slate-700"}`}>{children}</span>;
}

function SourceBadge({ source }: { source: string }) {
  return <Badge tone={source === "online" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600"}>{source}</Badge>;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

export default function SalesOrdersPanel({ refreshKey }: { refreshKey: number }) {
  const [view, setView] = useState("all");
  const [source, setSource] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: SearchResult; error?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ id: number; data?: Detail; error?: string } | null>(null);

  const key = [view, source, paymentStatus, q, page, refreshKey, reload].join("|");
  const loading = result?.key !== key;
  const data = result?.data;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ view, page: String(page), limit: "15" });
    if (source) params.set("source", source);
    if (paymentStatus) params.set("payment_status", paymentStatus);
    if (q) params.set("q", q);
    apiFetch<SearchResult>(`/sales-orders/search?${params}`)
      .then((response) => { if (active) setResult({ key, data: response }); })
      .catch((cause) => { if (active) setResult({ key, error: errorMessage(cause) }); });
    return () => { active = false; };
  }, [key, view, source, paymentStatus, q, page]);

  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    apiFetch<Detail>(`/sales-orders/${selectedId}/detail`)
      .then((response) => { if (active) setDetail({ id: selectedId, data: response }); })
      .catch((cause) => { if (active) setDetail({ id: selectedId, error: errorMessage(cause) }); });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => { active = false; window.removeEventListener("keydown", onKey); };
  }, [selectedId]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQ(searchInput.trim());
    setPage(1);
  }

  function chooseView(next: string) {
    setView(next);
    setPage(1);
  }

  const detailLoading = selectedId !== null && detail?.id !== selectedId;
  const detailData = detail?.id === selectedId ? detail?.data : undefined;
  const detailError = detail?.id === selectedId ? detail?.error : undefined;
  const filtered = Boolean(q || source || paymentStatus || view !== "all");

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="space-y-4 border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Sales orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading && !data ? "Loading…" : data ? `${data.total} matching order${data.total === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setReload((n) => n + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">↻ Refresh</button>
        </div>

        <div role="tablist" aria-label="Order views" className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const count = data?.counts[tab.key];
            const urgent = tab.key === "refund" && (count ?? 0) > 0;
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.hint}
                onClick={() => chooseView(tab.key)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${active ? "border-violet-700 bg-violet-700 text-white" : urgent ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {tab.label}
                {count !== undefined && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Search sales orders"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Order no. (SO-000012), customer, phone or tracking…"
            className="min-w-64 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select aria-label="Filter by source" value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">All sources</option>
            <option value="online">Online store</option>
            <option value="internal">Internal</option>
          </select>
          <select aria-label="Filter by payment status" value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">Any payment</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="due">Due (cash on delivery)</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
          <button type="submit" className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Search</button>
          {filtered && (
            <button
              type="button"
              onClick={() => { setView("all"); setSource(""); setPaymentStatus(""); setSearchInput(""); setQ(""); setPage(1); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              Clear filters
            </button>
          )}
        </form>
      </div>

      {result?.error && !loading && <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{result.error}</p>}

      {data && (
        data.orders.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{filtered ? "No orders match these filters." : "No sales orders yet."}</p>
        ) : (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Placed</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Order status</th>
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-semibold">{order.order_number}</td>
                    <td className="px-5 py-3.5"><SourceBadge source={order.source} /></td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{order.customer_name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{order.customer_phone ?? ""}</div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{new Date(order.created_at.endsWith("Z") ? order.created_at : `${order.created_at}Z`).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">{order.item_count}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium">{money(order.total_amount)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={PAYMENT_TONE[order.payment_status]}>{label(order.payment_status)}</Badge>
                      {order.payment_method && <div className="mt-1 text-xs uppercase text-slate-500">{order.payment_method === "sslcommerz" ? "Online" : order.payment_method}</div>}
                    </td>
                    <td className="px-5 py-3.5"><Badge tone={ORDER_TONE[order.order_status]}>{label(order.order_status)}</Badge></td>
                    <td className="px-5 py-3.5 text-right">
                      <button type="button" onClick={() => setSelectedId(order.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-white">Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">← Previous</button>
          <span className="text-slate-500">Page {data.page} of {data.total_pages}</span>
          <button type="button" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Next →</button>
        </div>
      )}

      {selectedId !== null && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={() => setSelectedId(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Order details"
            onClick={(event) => event.stopPropagation()}
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{detailData?.order_number ?? "Order details"}</h3>
                {detailData && <p className="mt-1 text-xs text-slate-500">Placed {when(detailData.created_at)}</p>}
              </div>
              <button type="button" aria-label="Close details" onClick={() => setSelectedId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Close</button>
            </div>

            {detailLoading && <p role="status" className="mt-8 text-center text-sm text-slate-500">Loading order…</p>}
            {detailError && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{detailError}</p>}

            {detailData && (
              <div className="mt-5 space-y-6 text-sm">
                <div className="flex flex-wrap gap-2">
                  <SourceBadge source={detailData.source} />
                  <Badge tone={ORDER_TONE[detailData.order_status]}>{`Order: ${label(detailData.order_status)}`}</Badge>
                  <Badge tone={PAYMENT_TONE[detailData.payment_status]}>{`Payment: ${label(detailData.payment_status)}`}</Badge>
                  {detailData.payment_method && <Badge tone="bg-slate-100 text-slate-700">{detailData.payment_method === "sslcommerz" ? "Online payment" : "Cash on delivery"}</Badge>}
                </div>

                {detailData.order_status === "refund_required" && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
                    The customer paid, but the items sold out before the payment arrived. Refund this order.
                  </p>
                )}

                <section>
                  <h4 className="mb-2 font-semibold">Customer &amp; delivery</h4>
                  <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 rounded-xl bg-slate-50 p-4">
                    <dt className="text-slate-500">Name</dt><dd className="font-medium">{detailData.customer_name ?? "—"}</dd>
                    <dt className="text-slate-500">Email</dt><dd>{detailData.customer_email ?? "—"}</dd>
                    <dt className="text-slate-500">Phone</dt><dd>{detailData.shipping_phone ?? detailData.customer_phone ?? "—"}</dd>
                    <dt className="text-slate-500">Address</dt><dd className="whitespace-pre-wrap">{detailData.shipping_address ?? "—"}</dd>
                    {detailData.delivery_note && (<><dt className="text-slate-500">Note</dt><dd className="whitespace-pre-wrap">{detailData.delivery_note}</dd></>)}
                    <dt className="text-slate-500">Ships from</dt><dd>{detailData.fulfillment_warehouse_name ?? "—"}</dd>
                  </dl>
                </section>

                <section>
                  <h4 className="mb-2 font-semibold">Items to pack</h4>
                  {detailData.items.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-slate-500">No item lines were saved for this order.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2 text-right">Line total</th></tr>
                        </thead>
                        <tbody>
                          {detailData.items.map((item) => (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td className="px-3 py-2"><div className="font-medium">{item.product_name}</div><div className="text-xs text-slate-500">{item.sku}{item.category_name ? ` · ${item.category_name}` : ""} · {money(item.unit_price)} each</div></td>
                              <td className="px-3 py-2 font-semibold">{item.quantity}</td>
                              <td className="px-3 py-2 text-right">{money(item.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="mt-3 space-y-1 text-right">
                    <p className="text-slate-500">Items {money(detailData.total_amount - detailData.shipping_fee)}</p>
                    <p className="text-slate-500">Delivery {money(detailData.shipping_fee)}</p>
                    <p className="text-base font-bold">Total {money(detailData.total_amount)}</p>
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 font-semibold">Shipment &amp; invoice</h4>
                  <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                    {detailData.shipment ? (
                      <p><span className="text-slate-500">Tracking:</span> <strong>{detailData.shipment.tracking_number}</strong> · {label(detailData.shipment.status)}{detailData.shipment.warehouse_name ? ` · from ${detailData.shipment.warehouse_name}` : ""}</p>
                    ) : (
                      <p className="text-slate-600">No shipment yet. <Link href="/shipments" className="font-semibold text-violet-700 underline">Open Shipments</Link> to create one.</p>
                    )}
                    <p><span className="text-slate-500">Invoice:</span> {detailData.invoice_number ? <strong>{detailData.invoice_number}</strong> : "not issued"}</p>
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
