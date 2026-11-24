import Link from "next/link";

const apps = [
  { icon: "▦", name: "Products", color: "bg-violet-100 text-violet-700", href: "/products" },
  { icon: "◈", name: "Categories", color: "bg-amber-100 text-amber-700", href: "/categories" },
  { icon: "⇄", name: "Stock", color: "bg-emerald-100 text-emerald-700", href: "/stocks" },
  { icon: "♧", name: "Customers", color: "bg-sky-100 text-sky-700", href: "/customers" },
  { icon: "♙", name: "Suppliers", color: "bg-rose-100 text-rose-700", href: "/suppliers" },
  { icon: "🛒", name: "Purchases", color: "bg-orange-100 text-orange-700", href: "/purchases" },
  { icon: "↗", name: "Sales", color: "bg-indigo-100 text-indigo-700", href: "/sales" },
  { icon: "▤", name: "Reports", color: "bg-teal-100 text-teal-700", href: "/reports" },
];

const workflows = [
  { number: "01", title: "Keep products organized", text: "Build a clear catalog with categories, pricing, and reorder levels.", icon: "▦", tone: "bg-violet-100 text-violet-700" },
  { number: "02", title: "Know what is in stock", text: "Track quantities across warehouses and review every stock movement.", icon: "⇄", tone: "bg-emerald-100 text-emerald-700" },
  { number: "03", title: "Follow every order", text: "Connect suppliers, purchases, customers, sales, and deliveries.", icon: "↗", tone: "bg-orange-100 text-orange-700" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Dream Warehouse home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-700 text-xl text-white shadow-lg shadow-violet-200">▦</span>
          <span className="text-xl font-bold tracking-tight">Dream Warehouse</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#apps" className="transition hover:text-violet-700">Apps</a>
          <a href="#workflow" className="transition hover:text-violet-700">How it works</a>
          <a href="#about" className="transition hover:text-violet-700">About</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex">Sign in</Link>
          <Link href="/register" className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-800 sm:inline-flex">Register</Link>
          <Link href="/products" className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition hover:bg-violet-800">Open Inventory <span aria-hidden="true">↗</span></Link>
          <Link href="/dashboard" aria-label="Open Dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-800"><span aria-hidden="true">▦</span><span>Dashboard</span></Link>
        </div>
      </header>

      <section className="relative isolate px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:px-10 lg:pb-28 lg:pt-20">
        <div className="absolute inset-x-0 top-0 -z-10 h-[670px] bg-[radial-gradient(ellipse_at_50%_0%,#ede9fe_0%,#faf8ff_42%,#ffffff_78%)]" />
        <div className="absolute right-[8%] top-24 -z-10 h-56 w-56 rounded-full bg-fuchsia-200/30 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-violet-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Inventory, connected
            </div>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.05] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[4.4rem]">Global reach, <span className="text-violet-700">local touch.</span></h1>
            <p className="mt-6 text-sm font-semibold tracking-wide text-violet-700">Your whole business, in sync.</p>
            <p className="mt-3 max-w-xl text-lg leading-8 text-slate-600">Bring products, stock, purchases, sales, and customers together in one clear workspace.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/products" className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800">Explore Inventory <span aria-hidden="true">→</span></Link>
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-800">View workspace</Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm text-slate-500"><span className="flex -space-x-2"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-100 text-xs">📦</span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-xs">✓</span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-amber-100 text-xs">↗</span></span><span>One connected flow, from product to delivery</span></div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px] lg:mr-0">
            <div className="absolute -left-7 top-14 h-24 w-24 rounded-3xl bg-amber-200/70 blur-2xl" />
            <div className="absolute -right-5 bottom-8 h-32 w-32 rounded-full bg-violet-300/60 blur-3xl" />
            <div className="relative rounded-[1.6rem] border border-white/90 bg-white/90 p-3 shadow-[0_30px_100px_-35px_rgba(76,29,149,0.35)] backdrop-blur">
              <div className="overflow-hidden rounded-[1.15rem] border border-slate-200/80 bg-[#fbfbfd]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                  <Link href="/dashboard" aria-label="Open Dashboard" className="group flex items-center gap-3 rounded-lg"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-700 text-white transition group-hover:bg-violet-800">▦</span><span><span className="block text-sm font-bold group-hover:text-violet-800">Dashboard Overview</span><span className="block text-xs text-slate-500">Open your workspace</span></span></Link>
                  <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Live view</span>
                </div>
                <div className="grid grid-cols-3 gap-3 p-4 sm:p-5">
                  {[{ label: "Products", value: "Catalog", icon: "▦", color: "text-violet-700", bg: "bg-violet-50" }, { label: "Stock", value: "By warehouse", icon: "⇄", color: "text-emerald-700", bg: "bg-emerald-50" }, { label: "Orders", value: "Purchase & sales", icon: "↗", color: "text-orange-700", bg: "bg-orange-50" }].map((item) => <div key={item.label} className="rounded-xl border border-slate-200/80 bg-white p-3.5"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>{item.icon}</div><p className="text-[11px] text-slate-500">{item.label}</p><p className="mt-1 text-sm font-semibold leading-snug text-slate-800">{item.value}</p></div>)}
                </div>
                <div className="mx-4 mb-4 rounded-xl border border-slate-200/80 bg-white p-4 sm:mx-5 sm:mb-5">
                  <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-bold">A connected operation</p><p className="mt-1 text-xs text-slate-500">Move from incoming stock to fulfilled orders</p></div><span className="text-xs font-medium text-violet-700">See all apps →</span></div>
                  <div className="flex items-center gap-2 sm:gap-3"><div className="flex flex-1 items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-3 text-xs font-semibold text-violet-800 sm:px-3"><span>📦</span><span>Product</span></div><span className="text-slate-300">→</span><div className="flex flex-1 items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-3 text-xs font-semibold text-emerald-800 sm:px-3"><span>▤</span><span>Stock</span></div><span className="text-slate-300">→</span><div className="flex flex-1 items-center gap-2 rounded-lg bg-orange-50 px-2.5 py-3 text-xs font-semibold text-orange-800 sm:px-3"><span>🛒</span><span>Order</span></div></div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-7 hidden items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-xl sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">✓</span><div><p className="text-xs font-bold">One source of truth</p><p className="text-[11px] text-slate-500">Your teams stay on the same page</p></div></div>
          </div>
        </div>
      </section>

      <section id="apps" className="scroll-mt-8 border-y border-slate-100 bg-[#fcfbff] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">One workspace, the tools you need</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Every part of inventory, connected.</h2><p className="mt-4 text-base leading-7 text-slate-600">Open the tools your team uses every day. Your data stays connected across the workflow.</p></div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">{apps.map((app) => <Link key={app.name} href={app.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/70 sm:p-5"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${app.color}`}>{app.icon}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{app.name}</span><span className="mt-0.5 block text-xs text-slate-500">Open app <span className="opacity-0 transition group-hover:opacity-100">↗</span></span></span></Link>)}</div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-8 px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="max-w-lg"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Simple, connected workflows</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">From first item to final order.</h2><p className="mt-5 leading-7 text-slate-600">Keep the essentials close at hand and move through everyday inventory work with fewer disconnected steps.</p><Link href="/dashboard" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900">Open your workspace <span aria-hidden="true">→</span></Link></div>
          <div className="divide-y divide-slate-200">{workflows.map((step) => <article key={step.number} className="flex gap-4 py-5 first:pt-0 last:pb-0 sm:gap-5"><span className="pt-1 text-xs font-bold tracking-widest text-slate-400">{step.number}</span><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${step.tone}`}>{step.icon}</span><div><h3 className="font-semibold text-slate-900">{step.title}</h3><p className="mt-1.5 text-sm leading-6 text-slate-600">{step.text}</p></div></article>)}</div>
        </div>
      </section>

      <section id="about" className="px-5 pb-16 sm:px-8 lg:px-10 lg:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[1.75rem] bg-[#21113f] px-7 py-10 text-white sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:px-14 lg:py-14">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Dream Warehouse · ERP</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Ready to get your stock in sync?</h2><p className="mt-4 max-w-xl leading-7 text-violet-100/80">Explore the product catalog or open the workspace to see your inventory tools.</p></div>
          <div className="flex shrink-0 flex-wrap gap-3"><Link href="/products" className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-violet-900 transition hover:bg-violet-50">Explore products</Link><Link href="/dashboard" className="rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Open workspace</Link></div>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-5 py-7 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="font-bold text-slate-800">Dream Warehouse</Link><p>Your whole business, in sync.</p><Link href="/login" className="font-medium text-violet-700 hover:text-violet-900">Sign in</Link></div></footer>
    </main>
  );
}
