"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import { useAuth, type UserRole } from "../components/auth-provider";

type Product = {
  id: number;
  name: string;
  sku: string;
  unit_price: number | string;
  reorder_level: number;
};

type ProductPage = { total_products: number; total_pages: number; products: Product[] };
type Stock = { id: number; product_id: number; quantity: number };
type SalesOrder = { id: number; total_amount: number | string; created_at: string };
type PurchaseOrder = { id: number; total_amount: number | string; date: string };
type PurchaseOrderItem = { id: number; purchase_order_id: number; product_id: number; quantity: number; unit_price: number | string; created_at: string };
type SalesOrderItem = { id: number; sales_order_id: number; product_id: number; quantity: number; unit_price: number | string; total_price: number | string };
type DatedRecord = { id: number; created_at: string };
type Shipment = { id: number; date: string; status: string };
type Invoice = { id: number };
type Transaction = {
  id: number;
  amount: number | string;
  date: string;
  status: string;
};
type StockActivity = {
  id: number;
  product_id: number;
  quantity: number;
  date: string;
  movement_type: string;
};
type ActivityPage = { total_pages?: number; activities?: StockActivity[] };
type DashboardPeriod = "last_7" | "last_15" | "last_30" | "last_50" | "last_6_months" | "last_year";
type DateBucket = { label: string; start: Date; end: Date; amount: number; purchaseAmount?: number };
type DateRange = { start: Date; end: Date; buckets: DateBucket[]; label: string };
type DashboardData = {
  products: Product[];
  totalProducts: number;
  stocks: Stock[];
  orders: SalesOrder[];
  transactions: Transaction[];
  stockActivities: StockActivity[];
  purchases: PurchaseOrder[];
  purchaseItems: PurchaseOrderItem[];
  salesItems: SalesOrderItem[];
  customers: DatedRecord[];
  suppliers: DatedRecord[];
  shipments: Shipment[];
  invoices: Invoice[];
};
type RecentActivity = {
  id: string;
  name: string;
  type: string;
  amount: string;
  status: string;
  date: string;
};

const emptyData: DashboardData = {
  products: [],
  totalProducts: 0,
  stocks: [],
  orders: [],
  transactions: [],
  stockActivities: [],
  purchases: [],
  purchaseItems: [],
  salesItems: [],
  customers: [],
  suppliers: [],
  shipments: [],
  invoices: [],
};

const menu = [
  ["▦", "Dashboard"],
  ["📦", "Products"],
  ["▤", "Categories"],
  ["♙", "Suppliers"],
  ["♧", "Customers"],
  ["🛒", "Purchase"],
  ["🧾", "Sales"],
  ["▣", "Warehouses"],
  ["▥", "Stock Management"],
  ["⇄", "Stock Activities"],
  ["🚚", "Shipments"],
  ["💳", "Transactions"],
  ["▧", "Invoices"],
  ["▤", "Reports"],
  ["♙", "User List"],
];

const menuRoles: Record<string, UserRole[]> = {
  Suppliers: ["admin", "manager"],
  Customers: ["admin", "manager", "staff"],
  Purchase: ["admin", "manager"],
  Sales: ["admin", "manager", "staff"],
  Warehouses: ["admin", "manager", "staff"],
  "Stock Management": ["admin", "manager", "staff"],
  "Stock Activities": ["admin", "manager", "staff"],
  Shipments: ["admin", "manager", "staff"],
  Transactions: ["admin", "manager"],
  Invoices: ["admin", "manager"],
  Reports: ["admin", "manager", "staff"],
  "User List": ["admin"],
};

const money = (amount: number) =>
  `৳ ${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(amount)}`;

const periodOptions: { value: DashboardPeriod; label: string }[] = [
  { value: "last_7", label: "Last 7 days" },
  { value: "last_15", label: "Last 15 days" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_50", label: "Last 50 days" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "last_year", label: "Last 1 year" },
];

function getDateRange(period: DashboardPeriod, now: Date): DateRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const dayCounts: Partial<Record<DashboardPeriod, number>> = { last_7: 7, last_15: 15, last_30: 30, last_50: 50 };
  const dayCount = dayCounts[period];
  let unit: "day" | "month" = "day";
  let label: string;
  if (dayCount) {
    start.setDate(start.getDate() - (dayCount - 1));
    label = `Last ${dayCount} days`;
  } else if (period === "last_6_months") {
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() - 6);
    start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
    unit = "month";
    label = "Last 6 months";
  } else {
    const day = start.getDate();
    start.setDate(1);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
    unit = "month";
    label = "Last 1 year";
  }

  const buckets: DateBucket[] = [];
  for (let cursor = new Date(start); cursor < end; ) {
    const next = new Date(cursor);
    if (unit === "day") next.setDate(next.getDate() + 1);
    else next.setMonth(next.getMonth() + 1);
    const bucketEnd = next < end ? next : new Date(end);
    let bucketLabel: string;
    if (unit === "day") bucketLabel = cursor.toLocaleDateString("en", { day: "numeric", month: "short" });
    else bucketLabel = cursor.toLocaleDateString("en", { month: "short" });
    buckets.push({ label: bucketLabel, start: new Date(cursor), end: bucketEnd, amount: 0 });
    cursor = bucketEnd;
  }
  return { start, end, buckets, label };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load this data";
}

function bucketValues<T>(buckets: DateBucket[], rows: T[], getDate: (row: T) => string, getValue: (row: T) => number) {
  const values = buckets.map(() => 0);
  rows.forEach((row) => {
    const date = new Date(getDate(row));
    const index = buckets.findIndex((bucket) => date >= bucket.start && date < bucket.end);
    if (index >= 0) values[index] += getValue(row);
  });
  return values;
}

function sparklinePath(values: number[]) {
  if (values.length < 2) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const spread = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * 64;
    const y = 18 - ((value - min) / spread) * 15;
    return `${index === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
}

function smoothLinePath(values: number[], max: number) {
  if (values.length === 0) return "";
  const points = values.map((value, index) => ({
    x: values.length === 1 ? 50 : (index / (values.length - 1)) * 100,
    y: 92 - (value / Math.max(max, 1)) * 82,
  }));
  if (points.length === 1) return `M${points[0].x - 2},${points[0].y} L${points[0].x + 2},${points[0].y}`;
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const control1 = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const control2 = { x: next.x - (afterNext.x - current.x) / 6, y: next.y - (afterNext.y - current.y) / 6 };
    path += ` C${control1.x},${control1.y} ${control2.x},${control2.y} ${next.x},${next.y}`;
  }
  return path;
}

async function fetchAllProducts() {
  const firstPage = await apiFetch<ProductPage>("/products/?page=1&limit=100");
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(firstPage.total_pages - 1, 0) }, (_, index) =>
      apiFetch<ProductPage>(`/products/?page=${index + 2}&limit=100`),
    ),
  );
  return { ...firstPage, products: [
    ...firstPage.products,
    ...remainingPages.flatMap((page) => page.products),
  ] };
}

async function fetchAllStockActivities() {
  const firstPage = await apiFetch<ActivityPage>("/stock-activities/?page=1&limit=100");
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max((firstPage.total_pages ?? 0) - 1, 0) }, (_, index) =>
      apiFetch<ActivityPage>(`/stock-activities/?page=${index + 2}&limit=100`),
    ),
  );
  return [
    ...(firstPage.activities ?? []),
    ...remainingPages.flatMap((page) => page.activities ?? []),
  ];
}

export default function Home() {
  const { user } = useAuth();
  const userRole = user?.role ?? "user";
  const [period, setPeriod] = useState<DashboardPeriod>("last_30");
  const [darkMode, setDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    const canViewTransactions = userRole === "admin" || userRole === "manager";
    const canViewBackOffice = userRole === "admin" || userRole === "manager";
    const endpoints = [
      fetchAllProducts(),
      apiFetch<Stock[]>("/stocks/"),
      apiFetch<SalesOrder[]>("/sales-orders/"),
      fetchAllStockActivities(),
      ...(canViewTransactions ? [apiFetch<Transaction[]>("/transactions/")] : []),
      apiFetch<DatedRecord[]>("/customers/"),
      apiFetch<SalesOrderItem[]>("/sales-order-items/"),
      apiFetch<Shipment[]>("/shipments/"),
      ...(canViewBackOffice ? [
        apiFetch<DatedRecord[]>("/suppliers/"),
        apiFetch<PurchaseOrder[]>("/purchase-orders/"),
        apiFetch<PurchaseOrderItem[]>("/purchase-order-items/"),
        apiFetch<Invoice[]>("/invoices/"),
      ] : []),
    ] as const;

    const results = await Promise.allSettled(endpoints);
    const messages: string[] = [];
    const read = <T,>(index: number, name: string): T | undefined => {
      const result = results[index];
      if (result.status === "fulfilled") return result.value as T;
      messages.push(`${name}: ${errorMessage(result.reason)}`);
      return undefined;
    };

    const productPage = read<ProductPage>(0, "Products");
    const stocks = read<Stock[]>(1, "Stock");
    const orders = read<SalesOrder[]>(2, "Sales orders");
    const stockActivities = read<StockActivity[]>(3, "Stock activities");
    let cursor = 4;
    const transactions = canViewTransactions ? read<Transaction[]>(cursor++, "Transactions") : [];
    const customers = read<DatedRecord[]>(cursor++, "Customers");
    const salesItems = read<SalesOrderItem[]>(cursor++, "Sales order items");
    const shipments = read<Shipment[]>(cursor++, "Shipments");
    const suppliers = canViewBackOffice ? read<DatedRecord[]>(cursor++, "Suppliers") : [];
    const purchases = canViewBackOffice ? read<PurchaseOrder[]>(cursor++, "Purchase orders") : [];
    const purchaseItems = canViewBackOffice ? read<PurchaseOrderItem[]>(cursor++, "Purchase order items") : [];
    const invoices = canViewBackOffice ? read<Invoice[]>(cursor, "Invoices") : [];

    return {
      data: {
        products: productPage?.products ?? [],
        totalProducts: productPage?.total_products ?? 0,
        stocks: stocks ?? [],
        orders: orders ?? [],
        transactions: transactions ?? [],
        stockActivities: stockActivities ?? [],
        purchases: purchases ?? [],
        purchaseItems: purchaseItems ?? [],
        salesItems: salesItems ?? [],
        customers: customers ?? [],
        suppliers: suppliers ?? [],
        shipments: shipments ?? [],
        invoices: invoices ?? [],
      } satisfies DashboardData,
      messages,
    };
  }, [userRole]);

  useEffect(() => {
    let active = true;
    fetchDashboard().then(({ data: dashboardData, messages }) => {
      if (!active) return;
      setData(dashboardData);
      setErrors(messages);
      setCurrentDate((date) => date ?? new Date());
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchDashboard, refreshKey]);

  const stockByProduct = useMemo(() => {
    const totals = new Map<number, number>();
    data.stocks.forEach((stock) => {
      totals.set(stock.product_id, (totals.get(stock.product_id) ?? 0) + stock.quantity);
    });
    return totals;
  }, [data.stocks]);

  const lowStockProducts = useMemo(
    () => data.products.filter((product) => {
      const quantity = stockByProduct.get(product.id) ?? 0;
      return quantity > 0 && quantity <= product.reorder_level;
    }),
    [data.products, stockByProduct],
  );
  const outOfStockProducts = useMemo(
    () => data.products.filter((product) => (stockByProduct.get(product.id) ?? 0) <= 0),
    [data.products, stockByProduct],
  );

  const totalStockUnits = data.stocks.reduce((sum, stock) => sum + stock.quantity, 0);

  const dateRange = useMemo(
    () => currentDate ? getDateRange(period, currentDate) : null,
    [currentDate, period],
  );
  const periodOrders = useMemo(() => dateRange ? data.orders.filter((order) => {
    const date = new Date(order.created_at);
    return date >= dateRange.start && date < dateRange.end;
  }) : [], [data.orders, dateRange]);
  const periodSalesItemRows = useMemo(() => {
    const orderIds = new Set(periodOrders.map((order) => order.id));
    return data.salesItems.filter((item) => orderIds.has(item.sales_order_id));
  }, [data.salesItems, periodOrders]);
  const periodTransactions = useMemo(() => dateRange ? data.transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return date >= dateRange.start && date < dateRange.end;
  }) : [], [data.transactions, dateRange]);
  const periodStockActivities = useMemo(() => dateRange ? data.stockActivities.filter((activity) => {
    const date = new Date(activity.date);
    return date >= dateRange.start && date < dateRange.end;
  }) : [], [data.stockActivities, dateRange]);
  const periodPurchases = useMemo(() => dateRange ? data.purchases.filter((purchase) => {
    const date = new Date(purchase.date);
    return date >= dateRange.start && date < dateRange.end;
  }) : [], [data.purchases, dateRange]);
  const periodPurchaseItemRows = useMemo(() => {
    const purchaseIds = new Set(periodPurchases.map((purchase) => purchase.id));
    return data.purchaseItems.filter((item) => purchaseIds.has(item.purchase_order_id));
  }, [data.purchaseItems, periodPurchases]);
  const periodCustomers = useMemo(() => dateRange ? data.customers.filter((customer) => {
    const date = new Date(customer.created_at);
    return date >= dateRange.start && date < dateRange.end;
  }) : [], [data.customers, dateRange]);
  const periodSuppliers = useMemo(() => dateRange ? data.suppliers.filter((supplier) => {
    const date = new Date(supplier.created_at);
    return date >= dateRange.start && date < dateRange.end;
  }) : [], [data.suppliers, dateRange]);
  const periodShipments = useMemo(() => dateRange ? data.shipments.filter((shipment) => {
    const date = new Date(shipment.date);
    return date >= dateRange.start && date < dateRange.end;
  }) : [], [data.shipments, dateRange]);
  const periodSales = periodOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const periodPurchaseAmount = periodPurchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0);
  const periodSalesUnits = periodSalesItemRows.reduce((sum, item) => sum + item.quantity, 0);
  const periodPurchaseUnits = periodPurchaseItemRows.reduce((sum, item) => sum + item.quantity, 0);
  const stockDifference = periodPurchaseUnits - periodSalesUnits;

  const topProducts = useMemo(() => {
    const names = new Map(data.products.map((product) => [product.id, product.name]));
    const totals = new Map<number, number>();
    periodSalesItemRows.forEach((item) => totals.set(item.product_id, (totals.get(item.product_id) ?? 0) + item.quantity));
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([productId, quantity]) => ({ productId, name: names.get(productId) ?? `Product #${productId}`, quantity }));
  }, [data.products, periodSalesItemRows]);

  const recentOrders = useMemo(
    () => [...periodOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [periodOrders],
  );

  const chart = useMemo(() => {
    if (!dateRange) return [];
    const buckets = dateRange.buckets.map((bucket) => ({ ...bucket, purchaseAmount: 0 }));
    data.orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const bucketIndex = buckets.findIndex((bucket) => orderDate >= bucket.start && orderDate < bucket.end);
      if (bucketIndex >= 0) {
        buckets[bucketIndex].amount += Number(order.total_amount || 0);
      }
    });
    data.purchases.forEach((purchase) => {
      const purchaseDate = new Date(purchase.date);
      const bucketIndex = buckets.findIndex((bucket) => purchaseDate >= bucket.start && purchaseDate < bucket.end);
      if (bucketIndex >= 0) {
        buckets[bucketIndex].purchaseAmount += Number(purchase.total_amount || 0);
      }
    });
    return buckets;
  }, [data.orders, data.purchases, dateRange]);
  const chartMaxValue = Math.max(...chart.flatMap((bucket) => [bucket.amount, bucket.purchaseAmount ?? 0]), 1);
  const salesCurve = smoothLinePath(chart.map((bucket) => bucket.amount), chartMaxValue);
  const purchaseCurve = smoothLinePath(chart.map((bucket) => bucket.purchaseAmount ?? 0), chartMaxValue);
  const hasChartData = chart.some((bucket) => bucket.amount > 0 || (bucket.purchaseAmount ?? 0) > 0);

  const activities = useMemo<RecentActivity[]>(() => {
    const productNames = new Map(data.products.map((product) => [product.id, product.name]));
    const stockRows = data.stockActivities.map((activity) => ({
      id: `stock-${activity.id}`,
      name: productNames.get(activity.product_id) ?? `Product #${activity.product_id}`,
      type: `Stock ${activity.movement_type}`,
      amount: `${activity.movement_type === "OUT" ? "−" : "+"}${activity.quantity}`,
      status: "Completed",
      date: activity.date,
    }));
    const transactionRows = data.transactions.map((transaction) => ({
      id: `transaction-${transaction.id}`,
      name: `Sales order #${transaction.id}`,
      type: "Transaction",
      amount: money(Number(transaction.amount)),
      status: transaction.status,
      date: transaction.date,
    }));
    return [...stockRows, ...transactionRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.products, data.stockActivities, data.transactions]);

  const notifications = [
    ...lowStockProducts.map((product) => ({
      key: `low-${product.id}`,
      text: `${product.name} is low on stock (${stockByProduct.get(product.id) ?? 0} remaining).`,
      tone: "amber",
    })),
    ...outOfStockProducts.map((product) => ({
      key: `out-${product.id}`,
      text: `${product.name} is out of stock.`,
      tone: "red",
    })),
    ...data.transactions
      .filter((transaction) => transaction.status.toLowerCase() === "pending")
      .map((transaction) => ({
        key: `pending-${transaction.id}`,
        text: `Transaction #${transaction.id} is pending.`,
        tone: "blue",
      })),
  ];

  const periodActivities = dateRange ? activities.filter((activity) => {
    const date = new Date(activity.date);
    return date >= dateRange.start && date < dateRange.end;
  }) : [];
  const visibleActivities = showAllActivities ? periodActivities : periodActivities.slice(0, 6);
  const canViewTransactions = userRole === "admin" || userRole === "manager";
  const canViewBackOffice = canViewTransactions;
  const orderById = new Map(data.orders.map((order) => [order.id, order]));
  const purchaseById = new Map(data.purchases.map((purchase) => [purchase.id, purchase]));
  const orderCountSpark = dateRange ? sparklinePath(bucketValues(dateRange.buckets, periodOrders, (order) => order.created_at, () => 1)) : "";
  const soldUnitsSpark = dateRange ? sparklinePath(bucketValues(dateRange.buckets, periodSalesItemRows, (item) => orderById.get(item.sales_order_id)?.created_at ?? "", (item) => item.quantity)) : "";
  const purchaseAmountSpark = dateRange ? sparklinePath(bucketValues(dateRange.buckets, periodPurchases, (purchase) => purchase.date, (purchase) => Number(purchase.total_amount || 0))) : "";
  const purchasedUnitsSpark = dateRange ? sparklinePath(bucketValues(dateRange.buckets, periodPurchaseItemRows, (item) => purchaseById.get(item.purchase_order_id)?.date ?? "", (item) => item.quantity)) : "";
  const stockMovementSpark = dateRange ? sparklinePath(bucketValues(dateRange.buckets, periodStockActivities, (activity) => activity.date, () => 1)) : "";
  const statCards: { title: string; value: string; change: string; icon: string; sparkline?: string }[] = [
    { title: "Total Products", value: data.totalProducts.toLocaleString(), change: "Current catalog", icon: "📦" },
    { title: "Stock Units", value: totalStockUnits.toLocaleString(), change: "Current inventory", icon: "▥" },
    { title: "Sales Revenue", value: money(periodSales), change: dateRange?.label ?? "Selected period", icon: "💰", sparkline: sparklinePath(chart.map((bucket) => bucket.amount)) },
    { title: "Sales Orders", value: periodOrders.length.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "🛒", sparkline: orderCountSpark },
    { title: "Units Sold", value: periodSalesUnits.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "📤", sparkline: soldUnitsSpark },
    ...(canViewBackOffice ? [
      { title: "Purchases", value: money(periodPurchaseAmount), change: `${periodPurchases.length.toLocaleString()} orders · ${dateRange?.label ?? "Selected period"}`, icon: "🧾", sparkline: purchaseAmountSpark },
      { title: "Units Purchased", value: periodPurchaseUnits.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "📥", sparkline: purchasedUnitsSpark },
      { title: "Purchase − Sales", value: `${stockDifference > 0 ? "+" : ""}${stockDifference.toLocaleString()} units`, change: stockDifference > 0 ? "More purchased" : stockDifference < 0 ? "More sold" : "Even", icon: "⚖️" },
    ] : []),
    { title: "New Customers", value: periodCustomers.length.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "♧" },
    { title: "Shipments", value: periodShipments.length.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "🚚" },
    { title: "Stock Movements", value: periodStockActivities.length.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "⇄", sparkline: stockMovementSpark },
    ...(canViewTransactions ? [{ title: "Transactions", value: periodTransactions.length.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "💳" }] : []),
    ...(canViewBackOffice ? [
      { title: "New Suppliers", value: periodSuppliers.length.toLocaleString(), change: dateRange?.label ?? "Selected period", icon: "♙" },
      { title: "Invoices", value: data.invoices.length.toLocaleString(), change: "All time", icon: "▧" },
    ] : []),
    { title: "Low Stock Items", value: lowStockProducts.length.toLocaleString(), change: `${outOfStockProducts.length.toLocaleString()} out of stock`, icon: "⚠️" },
  ];

  return (
    <div className={`dashboard-shell min-h-screen bg-[#f5f7fb] text-slate-800 md:flex ${darkMode ? "dashboard-dark" : ""}`}>
      <aside className="w-full bg-[#111c35] text-white md:fixed md:inset-y-0 md:left-0 md:w-64 md:overflow-y-auto">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl">📦</div>
          <div><h1 className="text-lg font-bold">Dream Warehouse</h1><p className="text-xs text-slate-400">ERP</p></div>
        </div>
        <div className="px-4 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Main Menu</p>
          <nav className="grid grid-cols-2 gap-1 md:block">
            {menu.filter(([, label]) => !user || !menuRoles[label] || menuRoles[label].includes(userRole)).map(([icon, label], index) => {
              const className = `mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${index === 0 ? "bg-blue-600 font-semibold text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`;
              const content = <><span>{icon}</span>{label}</>;
              if (label === "Dashboard") return <Link key={label} href="/dashboard" className={className}>{content}</Link>;
              if (label === "Products") return <Link key={label} href="/products" className={className}>{content}</Link>;
              if (label === "Categories") return <Link key={label} href="/categories" className={className}>{content}</Link>;
              if (label === "Suppliers") return <Link key={label} href="/suppliers" className={className}>{content}</Link>;
              if (label === "Customers") return <Link key={label} href="/customers" className={className}>{content}</Link>;
              if (label === "Warehouses") return <Link key={label} href="/warehouses" className={className}>{content}</Link>;
              if (label === "Stock Management") return <Link key={label} href="/stocks" className={className}>{content}</Link>;
              if (label === "Stock Activities") return <Link key={label} href="/stock-activities" className={className}>{content}</Link>;
              if (label === "Purchase") return <Link key={label} href="/purchases" className={className}>{content}</Link>;
              if (label === "Sales") return <Link key={label} href="/sales" className={className}>{content}</Link>;
              if (label === "Transactions") return <Link key={label} href="/transactions" className={className}>{content}</Link>;
              if (label === "Invoices") return <Link key={label} href="/invoices" className={className}>{content}</Link>;
              if (label === "Shipments") return <Link key={label} href="/shipments" className={className}>{content}</Link>;
              if (label === "Reports") return <Link key={label} href="/reports" className={className}>{content}</Link>;
              if (label === "User List") return <Link key={label} href="/users#registered-users" className={className}>{content}</Link>;
              return <a key={label} href="#" className={className}>{content}</a>;
            })}
          </nav>
          <div className="mt-5 border-t border-white/10 pt-4">
            <button type="button" onClick={() => setDarkMode((value) => !value)} aria-pressed={darkMode} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10">
              {darkMode ? "☀️ Light mode" : "🌙 Dark mode"}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 md:ml-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 md:px-8">
          <div><h2 className="text-xl font-bold">Dashboard Overview</h2><p className="mt-1 text-sm text-slate-500">Your inventory, stock, and sales summary.</p></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
              {loading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </header>

        <div id="dashboard" className="space-y-7 p-5 md:p-8">
          <div><h3 className="text-2xl font-bold">Business Overview</h3><p className="mt-1 text-sm text-slate-500">Live inventory and business performance from your ERP.</p></div>

          {errors.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Some dashboard data could not be loaded.</p>
            <p className="mt-1">Check that the API is running and you are signed in with a role allowed to view this data.</p>
            <ul className="mt-2 list-inside list-disc text-amber-800">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>}

          <div className="flex justify-end"><label className="grid gap-1 text-xs font-medium text-slate-500">Statistics period<select value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)} className="min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
          <section className="grid gap-5 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Sales Overview</h3><p className="mt-1 text-sm text-slate-500">Sales and purchase trends · {dateRange?.label ?? "selected period"}</p></div></div>
              {hasChartData ? <svg role="img" aria-label={`Sales and purchase trend line chart for ${dateRange?.label ?? "selected period"}`} viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-8 h-52 w-full overflow-visible">
                {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" vectorEffect="non-scaling-stroke"/>)}
                <path d={salesCurve} fill="none" stroke="#16a34a" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round"><title>{`Sales revenue: ${money(periodSales)}`}</title></path>
                {canViewBackOffice && <path d={purchaseCurve} fill="none" stroke="#eab308" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round"><title>{`Purchase total: ${money(periodPurchaseAmount)}`}</title></path>}
                {chart.filter((_, index) => chart.length <= 15 || index % Math.ceil(chart.length / 10) === 0).map((bucket) => {
                  const index = chart.indexOf(bucket);
                  const x = chart.length === 1 ? 50 : (index / (chart.length - 1)) * 100;
                  const salesY = 92 - (bucket.amount / chartMaxValue) * 82;
                  const purchasesY = 92 - ((bucket.purchaseAmount ?? 0) / chartMaxValue) * 82;
                  return <g key={`${bucket.label}-${index}`}><circle cx={x} cy={salesY} r="1.5" fill="#16a34a"><title>{`${bucket.label} sales: ${money(bucket.amount)}`}</title></circle>{canViewBackOffice && <circle cx={x} cy={purchasesY} r="1.5" fill="#eab308"><title>{`${bucket.label} purchases: ${money(bucket.purchaseAmount ?? 0)}`}</title></circle>}</g>;
                })}
              </svg> : <div className="mt-8 flex h-52 items-center justify-center rounded-lg bg-slate-50 px-5 text-center text-sm text-slate-500">No sales or purchases in this period. Try a wider period or check the record dates.</div>}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-green-600" />Sales · {money(periodSales)}</span>{canViewBackOffice && <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-yellow-500" />Purchases · {money(periodPurchaseAmount)}</span>}</div>
              <div className="mt-2 flex justify-between gap-2 text-xs text-slate-400"><span>{chart[0]?.label}</span><span>{chart[Math.floor(chart.length / 2)]?.label}</span><span>{chart.at(-1)?.label}</span></div>
              <p className="mt-4 text-xs text-slate-400">{loading ? "Loading sales…" : `${periodOrders.length} sales orders in ${dateRange?.label.toLowerCase() ?? "the selected period"}.`}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="font-bold">Stock Status</h3><p className="mt-1 text-sm text-slate-500">Current product availability</p>
              {(() => {
                const stockSegments = [
                  { label: "In stock", count: Math.max(data.products.length - lowStockProducts.length - outOfStockProducts.length, 0), color: "#10b981" },
                  { label: "Low stock", count: lowStockProducts.length, color: "#f59e0b" },
                  { label: "Out of stock", count: outOfStockProducts.length, color: "#ef4444" },
                ];
                const total = Math.max(data.products.length, 1);
                let offset = 0;
                return <><div className="mt-5 flex items-center justify-center"><svg viewBox="0 0 100 100" role="img" aria-label="Donut chart of current stock status" className="h-40 w-40 -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                  {stockSegments.map((segment) => { const length = (segment.count / total) * 251.3; const currentOffset = offset; offset += length; return <circle key={segment.label} cx="50" cy="50" r="40" fill="none" stroke={segment.color} strokeWidth="12" strokeDasharray={`${length} 251.3`} strokeDashoffset={-currentOffset}><title>{`${segment.label}: ${segment.count}`}</title></circle>; })}
                  <text x="50" y="48" textAnchor="middle" dominantBaseline="middle" transform="rotate(90 50 50)" className="fill-slate-800 text-[12px] font-bold">{data.products.length}</text>
                </svg></div><div className="mt-4 space-y-2">{stockSegments.map((segment) => <div key={segment.label} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />{segment.label}</span><strong>{loading ? "…" : segment.count}</strong></div>)}</div></>;
              })()}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="font-bold">Units: Purchased vs Sold</h3><p className="mt-1 text-sm text-slate-500">{dateRange?.label ?? "Selected period"}</p>
              {canViewBackOffice ? <div className="mt-7 space-y-6">{[
                { label: "Purchased", value: periodPurchaseUnits, color: "bg-emerald-500" },
                { label: "Sold", value: periodSalesUnits, color: "bg-blue-500" },
              ].map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-sm"><span>{item.label}</span><strong>{item.value.toLocaleString()} units</strong></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${Math.max(periodPurchaseUnits, periodSalesUnits) ? (item.value / Math.max(periodPurchaseUnits, periodSalesUnits)) * 100 : 0}%` }} /></div></div>)}<p className="text-sm font-semibold text-slate-600">{stockDifference > 0 ? `${stockDifference} more units purchased` : stockDifference < 0 ? `${Math.abs(stockDifference)} more units sold` : "Purchased and sold quantities are equal"}</p></div> : <p className="mt-6 text-sm text-slate-500">Purchase quantity details are available to Admin and Manager.</p>}
            </div>
          </section>

          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-bold">Statistics</h3><p className="mt-1 text-sm text-slate-500">Time-based figures for {dateRange?.label ?? "the selected period"}; product and stock totals are current.</p></div></div>
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => <div key={stat.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{stat.title}</p><span className="rounded-xl bg-blue-50 p-3 text-xl">{stat.icon}</span></div>
              <div className="mt-4 flex items-end justify-between gap-3"><div><h3 className="text-2xl font-bold">{loading ? "…" : stat.value}</h3><p className="mt-2 text-xs font-medium text-slate-500">{stat.change}</p></div>{stat.sparkline && <svg aria-label={`${stat.title} trend during ${dateRange?.label ?? "selected period"}`} role="img" viewBox="0 0 64 20" className="h-10 w-20 shrink-0 overflow-visible"><path d={stat.sparkline} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
            </div>)}
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold">Recent Orders</h3><p className="mt-1 text-sm text-slate-500">Latest orders · {dateRange?.label}</p></div><Link href="/sales" className="text-sm font-semibold text-blue-600 hover:underline">View sales</Link></div><div className="mt-4 divide-y divide-slate-100">{recentOrders.map((order) => <div key={order.id} className="flex items-center justify-between py-3 text-sm"><div><p className="font-semibold">Order #{order.id}</p><p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p></div><strong>{money(Number(order.total_amount))}</strong></div>)}{!loading && !recentOrders.length && <p className="py-5 text-sm text-slate-500">No orders in this period.</p>}</div></div>
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h3 className="font-bold">Top Products</h3><p className="mt-1 text-sm text-slate-500">By units sold · {dateRange?.label}</p><div className="mt-5 space-y-4">{topProducts.map((product) => <div key={product.productId}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{product.name}</span><strong>{product.quantity}</strong></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500 transition-all duration-700" style={{ width: `${(product.quantity / Math.max(topProducts[0]?.quantity ?? 1, 1)) * 100}%` }} /></div></div>)}{!loading && !topProducts.length && <p className="text-sm text-slate-500">No product sales in this period.</p>}</div></div>
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold">Low Stock Alerts</h3><p className="mt-1 text-sm text-slate-500">Needs attention now</p></div><Link href="/stocks" className="text-sm font-semibold text-blue-600 hover:underline">View stock</Link></div><div className="mt-4 space-y-2">{lowStockProducts.slice(0, 5).map((product) => <div key={product.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm"><span className="truncate pr-2 font-medium text-amber-900">{product.name}</span><span className="shrink-0 font-bold text-amber-800">{stockByProduct.get(product.id) ?? 0} left</span></div>)}{outOfStockProducts.slice(0, Math.max(0, 5 - lowStockProducts.slice(0, 5).length)).map((product) => <div key={product.id} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"><span className="truncate pr-2 font-medium text-red-900">{product.name}</span><span className="shrink-0 font-bold text-red-800">Out</span></div>)}{!loading && lowStockProducts.length + outOfStockProducts.length === 0 && <p className="text-sm text-slate-500">All products are above reorder level.</p>}</div></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6"><div><h3 className="font-bold">Recent Activities</h3><p className="mt-1 text-sm text-slate-500">Stock movements and transactions · {dateRange?.label ?? "selected period"}</p></div>
              <button onClick={() => setShowAllActivities(!showAllActivities)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">{showAllActivities ? "Show Less" : "View All"}</button>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
              <th className="px-6 py-4">Reference</th><th className="px-6 py-4">Description</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Quantity / Amount</th><th className="px-6 py-4">Status</th>
            </tr></thead><tbody>
              {visibleActivities.map((item) => <tr key={item.id} className="border-t border-slate-100">
                <td className="px-6 py-4 font-medium">{item.id.replace("stock-", "#STK-").replace("transaction-", "#TRX-")}</td><td className="px-6 py-4">{item.name}</td><td className="px-6 py-4 text-slate-500">{item.type}</td><td className="px-6 py-4 font-semibold">{item.amount}</td>
                <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${item.status.toLowerCase() === "completed" || item.status.toLowerCase() === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></td>
              </tr>)}
              {!loading && visibleActivities.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">No recent activities found.</td></tr>}
              {loading && <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Loading dashboard data…</td></tr>}
            </tbody></table></div>
          </section>

          <footer className="pb-3 text-center text-xs text-slate-400">Dream Warehouse. All rights reserved.</footer>
        </div>
      </main>
      <div className="fixed bottom-5 right-5 z-40">
        {showNotifications && <div className="absolute bottom-full right-0 mb-3 max-h-80 w-80 max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl">
          <p className="font-semibold">Notifications</p>
          {notifications.length ? notifications.slice(0, 12).map((notice) => <p key={notice.key} className={`mt-3 rounded-lg p-3 text-sm ${notice.tone === "amber" ? "bg-amber-50 text-amber-800" : notice.tone === "red" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>{notice.text}</p>) : <p className="mt-3 text-sm text-slate-500">No current stock or transaction alerts.</p>}
        </div>}
        <button type="button" onClick={() => setShowNotifications((value) => !value)} aria-expanded={showNotifications} aria-label="Toggle notifications" className="relative flex items-center gap-2 rounded-full bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-800">
          <span aria-hidden="true">🔔</span><span>Notifications</span><span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{notifications.length}</span>
        </button>
      </div>
    </div>
  );
}
