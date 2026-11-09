import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import logo from "@/assets/creadores-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control de Mercadería — Stock y Ventas" },
      { name: "description", content: "Registrá stock, cargá ventas diarias y mirá lo recaudado en planillas tipo Excel." },
      { property: "og:title", content: "Control de Mercadería" },
      { property: "og:description", content: "Stock, ventas diarias y acumulado en planillas tipo Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Product = { codigo: string; nombre: string; cantidad: number; precio: number };
type Sale = { id: string; fecha: string; codigo: string; nombre: string; cantidad: number; precio: number };

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const money = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const fmtDate = (f: string) => f.split("-").reverse().join("/");

function useStored<T>(key: string, init: T) {
  const [v, setV] = useState<T>(init);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (raw) setV(JSON.parse(raw));
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready) localStorage.setItem(key, JSON.stringify(v));
  }, [key, v, ready]);
  return [v, setV] as const;
}

async function exportXlsx(name: string, sheets: Record<string, (string | number)[][]>) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const [n, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n);
  XLSX.writeFile(wb, name);
}

function Index() {
  const [view, setView] = useState<"home" | "stock" | "ventas">("home");
  const [products, setProducts] = useStored<Product[]>("cm-products", []);
  const [sales, setSales] = useStored<Sale[]>("cm-sales", []);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={() => setView("home")} className="flex items-center gap-2 text-lg font-bold">
            <img src={logo.url} alt="Creadores de Fantasías" className="h-12 w-12 rounded-full border-2 border-header-cell" />
            Control de Mercadería
          </button>
          {view !== "home" && (
            <button onClick={() => setView("home")} className="rounded border border-primary-foreground/40 px-3 py-1 text-sm">
              ← Carpetas
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {view === "home" && (
          <>
          <img src={logo.url} alt="Creadores de Fantasías — Decoración navideña artesanal" className="mx-auto mb-6 w-56" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Folder title="Stock de productos" icon="📦" sub={`${products.length} productos`} onClick={() => setView("stock")} />
            <Folder title="Productos vendidos" icon="🧾" sub={`${new Set(sales.map((s) => s.fecha)).size} días registrados`} onClick={() => setView("ventas")} />
          </div>
          </>
        )}
        {view === "stock" && <StockView products={products} setProducts={setProducts} />}
        {view === "ventas" && <SalesView products={products} setProducts={setProducts} sales={sales} setSales={setSales} />}
      </main>
    </div>
  );
}

function Folder({ title, icon, sub, onClick }: { title: string; icon: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group relative rounded-lg border border-grid bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className="absolute -top-3 left-4 h-4 w-20 rounded-t-md bg-accent" />
      <div className="text-5xl">{icon}</div>
      <div className="mt-3 text-xl font-bold">{title}</div>
      <div className="text-sm text-muted-foreground">{sub}</div>
    </button>
  );
}

const input = "w-full rounded border border-grid bg-card px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const btn = "rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90";
const btn2 = "rounded border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary";

function Sheet({ head, rows, foot }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  return (
    <div className="overflow-x-auto rounded border border-grid bg-card">
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr>
            <th className="w-8 border border-grid bg-header-cell px-1" />
            {head.map((h) => (
              <th key={h} className="border border-grid bg-header-cell px-2 py-1.5 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={head.length + 1} className="border border-grid px-2 py-4 text-center text-muted-foreground">Sin datos</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="even:bg-muted">
              <td className="border border-grid bg-header-cell px-1 text-center text-xs text-muted-foreground">{i + 1}</td>
              {r.map((c, j) => <td key={j} className="border border-grid px-2 py-1.5 whitespace-nowrap">{c}</td>)}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="bg-secondary font-bold">
              <td className="border border-grid" />
              {foot.map((c, j) => <td key={j} className="border border-grid px-2 py-1.5 whitespace-nowrap">{c}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function StockView({ products, setProducts }: { products: Product[]; setProducts: (p: Product[]) => void }) {
  const [f, setF] = useState({ codigo: "", nombre: "", cantidad: "", precio: "" });
  const [add, setAdd] = useState({ codigo: "", cantidad: "" });
  const [msg, setMsg] = useState("");

  const create = () => {
    if (!f.codigo || !f.nombre) return setMsg("Completá código y nombre.");
    if (products.some((p) => p.codigo === f.codigo)) return setMsg("Ese código ya existe. Usá 'Agregar stock'.");
    setProducts([...products, { codigo: f.codigo.trim(), nombre: f.nombre.trim(), cantidad: Number(f.cantidad) || 0, precio: Number(f.precio) || 0 }]);
    setF({ codigo: "", nombre: "", cantidad: "", precio: "" });
    setMsg("Producto agregado ✔");
  };
  const restock = () => {
    const n = Number(add.cantidad);
    if (!add.codigo || !n) return setMsg("Elegí producto y cantidad.");
    setProducts(products.map((p) => (p.codigo === add.codigo ? { ...p, cantidad: p.cantidad + n } : p)));
    setAdd({ codigo: "", cantidad: "" });
    setMsg("Stock actualizado ✔");
  };
  const remove = (c: string) => confirm("¿Eliminar producto?") && setProducts(products.filter((p) => p.codigo !== c));
  const editPrice = (c: string) => {
    const v = prompt("Nuevo precio:");
    if (v && !isNaN(Number(v))) setProducts(products.map((p) => (p.codigo === c ? { ...p, precio: Number(v) } : p)));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📦 Stock de productos</h1>
      <section className="rounded-lg border border-grid bg-card p-4">
        <h2 className="mb-3 font-semibold">Nuevo producto</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input className={input} placeholder="Código" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
          <input className={input} placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <input className={input} type="number" placeholder="Cantidad" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} />
          <input className={input} type="number" placeholder="Precio" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
          <button className={btn} onClick={create}>Agregar</button>
        </div>
      </section>
      <section className="rounded-lg border border-grid bg-card p-4">
        <h2 className="mb-3 font-semibold">Agregar stock nuevo</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select className={`${input} col-span-2 sm:col-span-1`} value={add.codigo} onChange={(e) => setAdd({ ...add, codigo: e.target.value })}>
            <option value="">Producto…</option>
            {products.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre}</option>)}
          </select>
          <input className={input} type="number" placeholder="Cantidad" value={add.cantidad} onChange={(e) => setAdd({ ...add, cantidad: e.target.value })} />
          <button className={btn} onClick={restock}>Sumar</button>
        </div>
      </section>
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <div className="flex justify-end">
        <button className={btn2} onClick={() => exportXlsx("stock.xlsx", { Stock: [["Código", "Producto", "Cantidad", "Precio"], ...products.map((p) => [p.codigo, p.nombre, p.cantidad, p.precio])] })}>
          ⬇ Descargar Excel
        </button>
      </div>
      <Sheet
        head={["Código", "Producto", "Cantidad", "Precio", ""]}
        rows={products.map((p) => [
          p.codigo, p.nombre,
          <span className={p.cantidad <= 0 ? "font-bold text-destructive" : ""}>{p.cantidad}</span>,
          <button className="underline decoration-dotted" onClick={() => editPrice(p.codigo)}>{money(p.precio)}</button>,
          <button className="text-destructive" onClick={() => remove(p.codigo)}>✕</button>,
        ])}
        foot={["", "Total unidades", products.reduce((a, p) => a + p.cantidad, 0), "", ""]}
      />
    </div>
  );
}

function SalesView({ products, setProducts, sales, setSales }: { products: Product[]; setProducts: (p: Product[]) => void; sales: Sale[]; setSales: (s: Sale[]) => void }) {
  const [fecha, setFecha] = useState(today());
  const [codigo, setCodigo] = useState("");
  const [cant, setCant] = useState("");
  const [msg, setMsg] = useState("");

  const addSale = () => {
    const p = products.find((x) => x.codigo === codigo);
    const n = Number(cant);
    if (!p || !n || n < 0) return setMsg("Elegí producto y cantidad.");
    if (n > p.cantidad) return setMsg(`Stock insuficiente: quedan ${p.cantidad}.`);
    setProducts(products.map((x) => (x.codigo === codigo ? { ...x, cantidad: x.cantidad - n } : x)));
    setSales([...sales, { id: crypto.randomUUID(), fecha, codigo, nombre: p.nombre, cantidad: n, precio: p.precio }]);
    setCant("");
    setMsg("Venta cargada ✔ (stock descontado)");
  };
  const undo = (s: Sale) => {
    if (!confirm("¿Anular venta? El stock se devuelve.")) return;
    setSales(sales.filter((x) => x.id !== s.id));
    setProducts(products.map((x) => (x.codigo === s.codigo ? { ...x, cantidad: x.cantidad + s.cantidad } : x)));
  };

  const daily = useMemo(() => {
    const m = new Map<string, { codigo: string; nombre: string; cantidad: number; precio: number; total: number }>();
    sales.filter((s) => s.fecha === fecha).forEach((s) => {
      const r = m.get(s.codigo) ?? { codigo: s.codigo, nombre: s.nombre, cantidad: 0, precio: s.precio, total: 0 };
      r.cantidad += s.cantidad; r.total += s.cantidad * s.precio; m.set(s.codigo, r);
    });
    return [...m.values()];
  }, [sales, fecha]);
  const dayTotal = daily.reduce((a, r) => a + r.total, 0);
  const dayQty = daily.reduce((a, r) => a + r.cantidad, 0);

  const acc = useMemo(() => {
    const m = new Map<string, { fecha: string; cantidad: number; total: number }>();
    sales.forEach((s) => {
      const r = m.get(s.fecha) ?? { fecha: s.fecha, cantidad: 0, total: 0 };
      r.cantidad += s.cantidad; r.total += s.cantidad * s.precio; m.set(s.fecha, r);
    });
    return [...m.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [sales]);
  let running = 0;
  const accRows = acc.map((r) => ({ ...r, acumulado: (running += r.total) }));
  const grandQty = acc.reduce((a, r) => a + r.cantidad, 0);

  const daySales = sales.filter((s) => s.fecha === fecha);

  const download = () =>
    exportXlsx(`ventas_${fecha}.xlsx`, {
      [`Día ${fmtDate(fecha).replaceAll("/", "-")}`]: [["Producto", "Código", "Cantidad", "Precio", "Subtotal"], ...daily.map((r) => [r.nombre, r.codigo, r.cantidad, r.precio, r.total]), ["TOTAL", "", dayQty, "", dayTotal]],
      Stock: [["Código", "Producto", "Cantidad en stock", "Precio"], ...products.map((p) => [p.codigo, p.nombre, p.cantidad, p.precio])],
      Acumulado: [["Fecha", "Cantidad de productos", "Total recaudado", "Acumulado"], ...accRows.map((r) => [fmtDate(r.fecha), r.cantidad, r.total, r.acumulado]), ["TOTAL", grandQty, running, ""]],
    });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🧾 Productos vendidos</h1>
      <section className="rounded-lg border border-grid bg-card p-4">
        <h2 className="mb-3 font-semibold">Cargar venta</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input className={input} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <select className={input} value={codigo} onChange={(e) => setCodigo(e.target.value)}>
            <option value="">Producto…</option>
            {products.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre} ({p.cantidad})</option>)}
          </select>
          <input className={input} type="number" placeholder="Cantidad vendida" value={cant} onChange={(e) => setCant(e.target.value)} />
          <button className={btn} onClick={addSale}>Cargar</button>
        </div>
        {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
        {products.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Primero agregá productos en la carpeta de stock.</p>}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-primary p-4 text-primary-foreground">
          <div className="text-xs opacity-80">Recaudado el {fmtDate(fecha)}</div>
          <div className="text-2xl font-bold">{money(dayTotal)}</div>
        </div>
        <div className="rounded-lg bg-accent p-4 text-accent-foreground">
          <div className="text-xs opacity-80">Unidades vendidas</div>
          <div className="text-2xl font-bold">{dayQty}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Informe del día {fmtDate(fecha)}</h2>
        <button className={btn2} onClick={download}>⬇ Excel</button>
      </div>
      <Sheet
        head={["Producto", "Código", "Cantidad", "Precio", "Subtotal"]}
        rows={daily.map((r) => [r.nombre, r.codigo, r.cantidad, money(r.precio), money(r.total)])}
        foot={["TOTAL", "", dayQty, "", money(dayTotal)]}
      />

      {daySales.length > 0 && (
        <details className="rounded border border-grid bg-card p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Ventas cargadas hoy ({daySales.length}) — anular</summary>
          <ul className="mt-2 space-y-1">
            {daySales.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.nombre} × {s.cantidad}</span>
                <button className="text-destructive" onClick={() => undo(s)}>Anular</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <h2 className="text-lg font-semibold">Productos en stock</h2>
      <Sheet head={["Código", "Producto", "Cantidad", "Precio"]} rows={products.map((p) => [p.codigo, p.nombre, p.cantidad, money(p.precio)])} />

      <h2 className="text-lg font-semibold">Acumulado (todos los días)</h2>
      <Sheet
        head={["Fecha", "Cant. productos", "Total recaudado", "Acumulado"]}
        rows={accRows.map((r) => [fmtDate(r.fecha), r.cantidad, money(r.total), money(r.acumulado)])}
        foot={["TOTAL", grandQty, money(running), ""]}
      />
    </div>
  );
}
