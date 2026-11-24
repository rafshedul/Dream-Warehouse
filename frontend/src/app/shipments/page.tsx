"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api";

type Contact = { id: number; name: string };
type Order = { id: number; contact_id: number; total_amount: number | string };
type Warehouse = { id: number; name: string };
type Shipment = { id: number; sales_order_id: number; warehouse_id: number; contact_id: number; tracking_number: string; date: string; status: string };
function errorText(error: unknown) { const message = error instanceof Error ? error.message : "Something went wrong."; return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message; }
const statuses = ["pending", "packed", "shipped", "in_transit", "delivered", "cancelled"];

export default function ShipmentsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [orderId, setOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [contactId, setContactId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [statusDraft, setStatusDraft] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const contactMap = useMemo(() => new Map(contacts.map((item) => [item.id, item.name])), [contacts]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((item) => [item.id, item.name])), [warehouses]);
  const visible = shipments.filter((item) => `${item.id} ${item.tracking_number} ${item.status} ${contactMap.get(item.contact_id) ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([apiFetch<Contact[]>("/contacts/"), apiFetch<Order[]>("/sales-orders/"), apiFetch<Warehouse[]>("/warehouses/"), apiFetch<Shipment[]>("/shipments/")] as const);
    const messages: string[] = [];
    const read = <T,>(index: number, label: string): T | undefined => { const result = results[index]; if (result.status === "fulfilled") return result.value as T; messages.push(`${label}: ${errorText(result.reason)}`); return undefined; };
    return { contacts: read<Contact[]>(0, "Contacts"), orders: read<Order[]>(1, "Sales orders"), warehouses: read<Warehouse[]>(2, "Warehouses"), shipments: read<Shipment[]>(3, "Shipments"), messages };
  }, []);
  useEffect(() => { let active = true; loadData().then((data) => { if (!active) return; setContacts(data.contacts ?? []); setOrders(data.orders ?? []); setWarehouses(data.warehouses ?? []); setShipments(data.shipments ?? []); setErrors(data.messages); setLoading(false); }); return () => { active = false; }; }, [loadData, refreshKey]);

  async function createShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError(""); setSuccess("");
    try { const created = await apiFetch<Shipment>("/shipments/", { method: "POST", body: JSON.stringify({ sales_order_id: Number(orderId), warehouse_id: Number(warehouseId), contact_id: Number(contactId), tracking_number: trackingNumber.trim(), status }) }); setShipments((current) => [...current, created]); setSuccess(`Shipment #${created.id} created.`); setOrderId(""); setWarehouseId(""); setContactId(""); setTrackingNumber(""); setStatus("pending"); }
    catch (cause) { setFormError(errorText(cause)); } finally { setSaving(false); }
  }

  async function saveStatus(shipment: Shipment) {
    const nextStatus = statusDraft[shipment.id] ?? shipment.status;
    if (nextStatus === shipment.status) return;
    setUpdatingId(shipment.id); setFormError(""); setSuccess("");
    try { const result = await apiFetch<{ shipment_id: number; status: string }>(`/shipments/${shipment.id}/status?status=${encodeURIComponent(nextStatus)}`, { method: "PATCH" }); setShipments((current) => current.map((item) => item.id === shipment.id ? { ...item, status: result.status } : item)); setStatusDraft((current) => ({ ...current, [shipment.id]: result.status })); setSuccess(`Shipment #${shipment.id} status updated to ${result.status}.`); }
    catch (cause) { setFormError(errorText(cause)); } finally { setUpdatingId(null); }
  }

  return <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8"><div className="mx-auto max-w-7xl space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div><h1 className="mt-2 text-2xl font-bold">Shipments</h1><p className="mt-1 text-sm text-slate-500">Track deliveries and update shipment status.</p></div><button onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">{loading ? "Loading…" : "↻ Refresh"}</button></header>
    {errors.length > 0 && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Some shipment data could not be loaded</p><ul className="mt-1 list-inside list-disc">{errors.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-2">Shipment list and status require Admin, Manager, or Staff. Creating shipments requires Admin.</p></section>}{formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}{formError.includes("403") && " — Creating shipments requires Admin permission."}</p>}{success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">Shipment register</h2><p className="mt-1 text-sm text-slate-500">{shipments.length} shipments</p></div><input aria-label="Search shipments" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tracking, contact, or status…" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>{loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading shipments…</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No shipments found.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Shipment</th><th className="px-5 py-3">Tracking</th><th className="px-5 py-3">Sales order</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Warehouse</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Update</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">#SHP-{item.id}</td><td className="px-5 py-4 font-mono">{item.tracking_number}</td><td className="px-5 py-4">#SO-{item.sales_order_id}</td><td className="px-5 py-4">{contactMap.get(item.contact_id) ?? `Contact #${item.contact_id}`}</td><td className="px-5 py-4">{warehouseMap.get(item.warehouse_id) ?? `Warehouse #${item.warehouse_id}`}</td><td className="px-5 py-4 text-slate-500">{new Date(item.date).toLocaleDateString()}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{item.status}</span></td><td className="px-5 py-4"><div className="flex gap-2"><select aria-label={`New status for shipment ${item.id}`} value={statusDraft[item.id] ?? item.status} onChange={(event) => setStatusDraft((current) => ({ ...current, [item.id]: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select><button type="button" onClick={() => void saveStatus(item)} disabled={updatingId === item.id || (statusDraft[item.id] ?? item.status) === item.status} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:opacity-40">{updatingId === item.id ? "Saving" : "Save"}</button></div></td></tr>)}</tbody></table></div>}</section>
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="font-bold">Create shipment</h2><form onSubmit={createShipment} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div><label htmlFor="shipment-order" className="mb-1.5 block text-sm font-medium">Sales order *</label><select id="shipment-order" required value={orderId} onChange={(event) => { const id = event.target.value; setOrderId(id); const order = orders.find((item) => item.id === Number(id)); if (order) setContactId(String(order.contact_id)); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select order</option>{orders.map((item) => <option key={item.id} value={item.id}>#SO-{item.id}</option>)}</select></div><div><label htmlFor="shipment-contact" className="mb-1.5 block text-sm font-medium">Contact *</label><select id="shipment-contact" required value={contactId} onChange={(event) => setContactId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select contact</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label htmlFor="shipment-warehouse" className="mb-1.5 block text-sm font-medium">Warehouse *</label><select id="shipment-warehouse" required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select warehouse</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label htmlFor="shipment-tracking" className="mb-1.5 block text-sm font-medium">Tracking number *</label><input id="shipment-tracking" required maxLength={100} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Tracking code" /></div><div><label htmlFor="shipment-status" className="mb-1.5 block text-sm font-medium">Initial status</label><select id="shipment-status" value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><div className="flex items-end"><button type="submit" disabled={saving || !orderId || !warehouseId || !contactId || !trackingNumber.trim()} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : "Create shipment"}</button></div></form><p className="mt-3 text-xs text-slate-500">Admin only to create shipments. Status changes are allowed for Admin, Manager, or Staff.</p></section>
  </div></main>;
}
