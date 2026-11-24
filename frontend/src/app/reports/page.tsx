"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";

type Period = "daily" | "weekly" | "monthly";
type StockReport = {
  report_type: string;
  report_date?: string;
  start_date?: string;
  end_date?: string;
  month?: string;
  total_activities: number;
  total_in: number;
  total_out: number;
  total_adjustment: number;
  net_movement: number;
};
function errorText(error: unknown) { const message = error instanceof Error ? error.message : "Something went wrong."; return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message; }

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [report, setReport] = useState<StockReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<StockReport>(`/stock-activities/reports/${period}`)
      .then((data) => { if (active) { setReport(data); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, refreshKey]);

  const rangeLabel = report?.report_date ?? report?.month ?? (report?.start_date && report?.end_date ? `${report.start_date} – ${report.end_date}` : "");

  return <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8"><div className="mx-auto max-w-6xl space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div><h1 className="mt-2 text-2xl font-bold">Stock Reports</h1><p className="mt-1 text-sm text-slate-500">Review stock movement totals for a selected period.</p></div><div className="flex gap-2"><select aria-label="Report period" value={period} onChange={(event) => { setLoading(true); setReport(null); setError(""); setPeriod(event.target.value as Period); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="daily">Today</option><option value="weekly">Last 7 days</option><option value="monthly">This month</option></select><button type="button" onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50">{loading ? "Loading…" : "↻ Refresh"}</button></div></header>
    {error && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Could not load report</p><p className="mt-1">{error}</p><p className="mt-2">Stock reports require a signed-in Admin, Manager, or Staff account.</p></section>}
    {loading ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">Loading {period} report…</p> : report && <>
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-wide text-blue-700">{period} stock report</p><h2 className="mt-2 text-xl font-bold">{rangeLabel}</h2><p className="mt-1 text-sm text-slate-500">Movement totals returned by the stock activity report API.</p></section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
        { label: "Activities", value: report.total_activities, tone: "text-slate-900" },
        { label: "Stock IN", value: report.total_in, tone: "text-emerald-700" },
        { label: "Stock OUT", value: report.total_out, tone: "text-amber-700" },
        { label: "Adjustments", value: report.total_adjustment, tone: "text-blue-700" },
        { label: "Net movement", value: report.net_movement, tone: report.net_movement >= 0 ? "text-emerald-700" : "text-red-700" },
      ].map((item) => <article key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{item.label}</p><p className={`mt-3 text-2xl font-bold ${item.tone}`}>{item.value.toLocaleString()}</p></article>)}</section>
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h3 className="font-bold">Movement breakdown</h3><div className="mt-5 space-y-4">{[{ label: "IN", value: report.total_in, color: "bg-emerald-500" }, { label: "OUT", value: report.total_out, color: "bg-amber-500" }, { label: "Adjustment", value: report.total_adjustment, color: "bg-blue-500" }].map((item) => { const max = Math.max(report.total_in, report.total_out, report.total_adjustment, 1); return <div key={item.label}><div className="mb-1 flex justify-between text-sm"><span>{item.label}</span><span className="font-semibold">{item.value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.value ? Math.max((item.value / max) * 100, 3) : 0}%` }} /></div></div>; })}</div></section>
      <details className="rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">Show raw API response</summary><pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(report, null, 2)}</pre></details>
    </>}
  </div></main>;
}
