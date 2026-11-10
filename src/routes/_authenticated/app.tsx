import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/creadores-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Stock y ventas — Creadores de Fantasías" },
      {
        name: "description",
        content:
          "Registrá stock, cargá las ventas del día y mirá lo recaudado, compartido entre todos tus aparatos.",
      },
      { property: "og:title", content: "Control de Mercadería — Creadores de Fantasías" },
      {
        property: "og:description",
        content: "Stock, ventas diarias y acumulado en planillas, compartido entre celulares y compu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryApp,
});

type Product = { codigo: string; nombre: string; cantidad: number; precio: number };
type Sale = { id: string; fecha: string; codigo: string; nombre: string; cantidad: number; precio: number };

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const money = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const fmtDate = (f: string) => f.split("-").reverse().join("/");

const PAGE = 1000;

async function fetchAll<T extends Record<string, unknown>>(
  table: "products" | "sales",
  order: { column: string; ascending: boolean }[],
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select("*");
    for (const o of order) query = query.order(o.column, { ascending: o.ascending });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// One-time upgrade: bring in whatever was saved on this device before the app
// started sharing data between phones.
async function migrateFromThisDevice(
  hadCloudProducts: boolean,
  hadCloudSales: boolean,
): Promise<boolean> {
  if (localStorage.getItem("cm-shared-migrated") === "1") return false;
  localStorage.setItem("cm-shared-migrated", "1");
  if (hadCloudProducts || hadCloudSales) return false;

  let localProducts: Product[] = [];
  let localSales: Sale[] = [];
  try {
    localProducts = JSON.parse(localStorage.getItem("cm-products") || "[]") as Product[];
    localSales = JSON.parse(localStorage.getItem("cm-sales") || "[]") as Sale[];
  } catch {
    return false;
  }
  if (localProducts.length === 0 && localSales.length === 0) return false;

  if (localProducts.length > 0) {
    const { error } = await supabase.from("products").upsert(
      localProducts.map((p) => ({
        codigo: String(p.codigo),
        nombre: String(p.nombre),
        cantidad: Number(p.cantidad) || 0,
        precio: Number(p.precio) || 0,
      })),
    );
    if (error) return false;
  }
  if (localSales.length > 0) {
    const { error } = await supabase.from("sales").insert(
      localSales.map((s) => ({
        fecha: s.fecha,
        codigo: String(s.codigo),
        nombre: String(s.nombre),
        cantidad: Number(s.cantidad) || 0,
        precio: Number(s.precio) || 0,
      })),
    );
    if (error) return false;
  }
  localStorage.removeItem("cm-products");
  localStorage.removeItem("cm-sales");
  return true;
}

function InventoryApp() {
  const [view, setView] = useState<"home" | "stock" | "ventas">("home");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const loadTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        fetchAll<Product>("products", [{ column: "codigo", ascending: true }]),
        fetchAll<Sale>("sales", [
          { column: "fecha", ascending: true },
          { column: "created_at", ascending: true },
        ]),
      ]);
      setProducts(p.map((r) => ({ ...r, cantidad: Number(r.cantidad), precio: Number(r.precio) })));
      setSales(
        s.map((r) => ({ ...r, cantidad: Number(r.cantidad), precio: Number(r.precio) })),
      );
      setStatus("ready");
      setError("");
      const moved = await migrateFromThisDevice(p.length > 0, s.length > 0);
      if (moved) {
        const [p2, s2] = await Promise.all([
          fetchAll<Product>("products", [{ column: "codigo", ascending: true }]),
          fetchAll<Sale>("sales", [
            { column: "fecha", ascending: true },
            { column: "created_at", ascending: true },
          ]),
        ]);
        setProducts(p2.map((r) => ({ ...r, cantidad: Number(r.cantidad), precio: Number(r.precio) })));
        setSales(s2.map((r) => ({ ...r, cantidad: Number(r.cantidad), precio: Number(r.precio) })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron leer los datos.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep every phone in sync: reload when another device changes the data.
  useEffect(() => {
    const scheduleLoad = () => {
      window.clearTimeout(loadTimer.current);
      loadTimer.current = window.setTimeout(() => void load(), 250);
    };
    const channel = supabase
      .channel(`inventory-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, scheduleLoad)
      .subscribe();
    return () => {
      window.clearTimeout(loadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const nav = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-2 text-lg font-bold"
          >
            <img
              src={logo.url}
              alt="Creadores de Fantasías"
              className="h-12 w-12 rounded-full border-2 border-header-cell"
            />
            Control de Mercadería
          </button>
          <div className="flex items-center gap-2">
            {view !== "home" && (
              <button
                onClick={() => setView("home")}
                className="rounded border border-primary-foreground/40 px-3 py-1 text-sm"
              >
                ← Carpetas
              </button>
            )}
            <button
              onClick={signOut}
              className="rounded border border-primary-foreground/40 px-3 py-1 text-sm"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {status === "loading" && (
          <p className="py-16 text-center text-muted-foreground">Cargando tus datos…</p>
        )}

        {status === "error" && (
          <div className="rounded-lg border border-destructive/40 bg-card p-4 text-center">
            <p className="font-semibold text-destructive">No se pudieron leer los datos</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <button className={btn} onClick={load}>
              Reintentar
            </button>
          </div>
        )}

        {status === "ready" && view === "home" && (
          <>
            <img
              src={logo.url}
              alt="Creadores de Fantasías — Decoración navideña artesanal"
              className="mx-auto mb-6 w-56 rounded-full"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Folder
                title="Stock de productos"
                icon="📦"
                sub={`${products.length} productos`}
                onClick={() => setView("stock")}
              />
              <Folder
                title="Productos vendidos"
                icon="🧾"
                sub={`${new Set(sales.map((s) => s.fecha)).size} días registrados`}
                onClick={() => setView("ventas")}
              />
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Estos datos se comparten entre todos los celulares y la compu donde entres con tu cuenta.
            </p>
          </>
        )}

        {status === "ready" && view === "stock" && (
          <StockView products={products} reload={load} />
        )}
        {status === "ready" && view === "ventas" && (
          <SalesView products={products} sales={sales} reload={load} />
        )}
      </main>
    </div>
  );
}

function Folder({
  title,
  icon,
  sub,
  onClick,
}: {
  title: string;
  icon: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative rounded-lg border border-grid bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="absolute -top-3 left-4 h-4 w-20 rounded-t-md bg-accent" />
      <div className="text-5xl">{icon}</div>
      <div className="mt-3 text-xl font-bold">{title}</div>
      <div className="text-sm text-muted-foreground">{sub}</div>
    </button>
  );
}

const input =
  "w-full rounded border border-grid bg-card px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const btn = "rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
const btn2 =
  "rounded border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary";

function Sheet({
  head,
  rows,
  foot,
}: {
  head: string[];
  rows: ReactNode[][];
  foot?: ReactNode[];
}) {
  return (
    <div className="overflow-x-auto rounded border border-grid bg-card">
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr>
            <th className="w-8 border border-grid bg-header-cell px-1" />
            {head.map((h) => (
              <th
                key={h}
                className="border border-grid bg-header-cell px-2 py-1.5 text-left font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={head.length + 1}
                className="border border-grid px-2 py-4 text-center text-muted-foreground"
              >
                Sin datos
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="even:bg-muted">
              <td className="border border-grid bg-header-cell px-1 text-center text-xs text-muted-foreground">
                {i + 1}
              </td>
              {r.map((c, j) => (
                <td key={j} className="border border-grid px-2 py-1.5 whitespace-nowrap">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="bg-secondary font-bold">
              <td className="border border-grid" />
              {foot.map((c, j) => (
                <td key={j} className="border border-grid px-2 py-1.5 whitespace-nowrap">
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function StockView({ products, reload }: { products: Product[]; reload: () => Promise<void> }) {
  const [f, setF] = useState({ codigo: "", nombre: "", cantidad: "", precio: "" });
  const [add, setAdd] = useState({ codigo: "", cantidad: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const codigo = f.codigo.trim();
    const nombre = f.nombre.trim();
    if (!codigo || !nombre) return setMsg("Completá código y nombre.");
    if (products.some((p) => p.codigo === codigo))
      return setMsg("Ese código ya existe. Usá 'Agregar stock'.");
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      codigo,
      nombre,
      cantidad: Number(f.cantidad) || 0,
      precio: Number(f.precio) || 0,
    });
    setBusy(false);
    if (error) return setMsg("No se pudo guardar: " + error.message);
    setF({ codigo: "", nombre: "", cantidad: "", precio: "" });
    setMsg("Producto agregado ✔");
    await reload();
  };

  const restock = async () => {
    const n = Number(add.cantidad);
    if (!add.codigo || !n) return setMsg("Elegí producto y cantidad.");
    const p = products.find((x) => x.codigo === add.codigo);
    if (!p) return setMsg("Elegí producto y cantidad.");
    setBusy(true);
    const { error } = await supabase
      .from("products")
      .update({ cantidad: p.cantidad + n })
      .eq("codigo", add.codigo);
    setBusy(false);
    if (error) return setMsg("No se pudo actualizar: " + error.message);
    setAdd({ codigo: "", cantidad: "" });
    setMsg("Stock actualizado ✔");
    await reload();
  };

  const remove = async (c: string) => {
    if (!confirm("¿Eliminar producto? Las ventas ya cargadas se mantienen en el histórico.")) return;
    setBusy(true);
    const { error } = await supabase.from("products").delete().eq("codigo", c);
    setBusy(false);
    if (error) return setMsg("No se pudo eliminar: " + error.message);
    setMsg("Producto eliminado");
    await reload();
  };

  const editPrice = async (c: string) => {
    const v = prompt("Nuevo precio:");
    if (v === null || v.trim() === "" || isNaN(Number(v))) return;
    setBusy(true);
    const { error } = await supabase.from("products").update({ precio: Number(v) }).eq("codigo", c);
    setBusy(false);
    if (error) return setMsg("No se pudo cambiar el precio: " + error.message);
    setMsg("Precio actualizado ✔");
    await reload();
  };

  const download = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Código", "Producto", "Cantidad", "Precio"],
        ...products.map((p) => [p.codigo, p.nombre, p.cantidad, p.precio]),
      ]),
      "Stock",
    );
    XLSX.writeFile(wb, "stock.xlsx");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📦 Stock de productos</h1>

      <section className="rounded-lg border border-grid bg-card p-4">
        <h2 className="mb-3 font-semibold">Nuevo producto</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            className={input}
            placeholder="Código"
            value={f.codigo}
            onChange={(e) => setF({ ...f, codigo: e.target.value })}
          />
          <input
            className={input}
            placeholder="Nombre"
            value={f.nombre}
            onChange={(e) => setF({ ...f, nombre: e.target.value })}
          />
          <input
            className={input}
            type="number"
            placeholder="Cantidad"
            value={f.cantidad}
            onChange={(e) => setF({ ...f, cantidad: e.target.value })}
          />
          <input
            className={input}
            type="number"
            placeholder="Precio"
            value={f.precio}
            onChange={(e) => setF({ ...f, precio: e.target.value })}
          />
          <button className={btn} onClick={create} disabled={busy}>
            Agregar
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-grid bg-card p-4">
        <h2 className="mb-3 font-semibold">Agregar stock nuevo</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            className={`${input} col-span-2 sm:col-span-1`}
            value={add.codigo}
            onChange={(e) => setAdd({ ...add, codigo: e.target.value })}
          >
            <option value="">Producto…</option>
            {products.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </select>
          <input
            className={input}
            type="number"
            placeholder="Cantidad"
            value={add.cantidad}
            onChange={(e) => setAdd({ ...add, cantidad: e.target.value })}
          />
          <button className={btn} onClick={restock} disabled={busy}>
            Sumar
          </button>
        </div>
      </section>

      {msg && <p className="text-sm text-primary">{msg}</p>}

      <div className="flex justify-end">
        <button className={btn2} onClick={download}>
          ⬇ Descargar Excel
        </button>
      </div>

      <Sheet
        head={["Código", "Producto", "Cantidad", "Precio", ""]}
        rows={products.map((p) => [
          p.codigo,
          p.nombre,
          <span className={p.cantidad <= 0 ? "font-bold text-destructive" : ""}>{p.cantidad}</span>,
          <button className="underline decoration-dotted" onClick={() => editPrice(p.codigo)}>
            {money(p.precio)}
          </button>,
          <button className="text-destructive" onClick={() => remove(p.codigo)}>
            ✕
          </button>,
        ])}
        foot={["", "Total unidades", products.reduce((a, p) => a + p.cantidad, 0), "", ""]}
      />
    </div>
  );
}

function SalesView({
  products,
  sales,
  reload,
}: {
  products: Product[];
  sales: Sale[];
  reload: () => Promise<void>;
}) {
  const [fecha, setFecha] = useState(today());
  const [codigo, setCodigo] = useState("");
  const [cant, setCant] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const addSale = async () => {
    const n = Number(cant);
    if (!codigo || !n || n <= 0) return setMsg("Elegí producto y cantidad.");
    setBusy(true);
    const { error } = await supabase.rpc("register_sale", {
      p_codigo: codigo,
      p_fecha: fecha,
      p_cantidad: n,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setCant("");
    setMsg("Venta cargada ✔ (stock descontado)");
    await reload();
  };

  const undo = async (s: Sale) => {
    if (!confirm("¿Anular venta? El stock se devuelve.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("undo_sale", { p_id: s.id });
    setBusy(false);
    if (error) return setMsg("No se pudo anular: " + error.message);
    setMsg("Venta anulada, el stock volvió.");
    await reload();
  };

  const daily = useMemo(() => {
    const m = new Map<string, { codigo: string; nombre: string; cantidad: number; precio: number; total: number }>();
    sales
      .filter((s) => s.fecha === fecha)
      .forEach((s) => {
        const r = m.get(s.codigo) ?? {
          codigo: s.codigo,
          nombre: s.nombre,
          cantidad: 0,
          precio: s.precio,
          total: 0,
        };
        r.cantidad += s.cantidad;
        r.total += s.cantidad * s.precio;
        m.set(s.codigo, r);
      });
    return [...m.values()];
  }, [sales, fecha]);
  const dayTotal = daily.reduce((a, r) => a + r.total, 0);
  const dayQty = daily.reduce((a, r) => a + r.cantidad, 0);

  const acc = useMemo(() => {
    const m = new Map<string, { fecha: string; cantidad: number; total: number }>();
    sales.forEach((s) => {
      const r = m.get(s.fecha) ?? { fecha: s.fecha, cantidad: 0, total: 0 };
      r.cantidad += s.cantidad;
      r.total += s.cantidad * s.precio;
      m.set(s.fecha, r);
    });
    return [...m.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [sales]);
  let running = 0;
  const accRows = acc.map((r) => ({ ...r, acumulado: (running += r.total) }));
  const grandQty = acc.reduce((a, r) => a + r.cantidad, 0);

  const daySales = sales.filter((s) => s.fecha === fecha);

  const download = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Producto", "Código", "Cantidad", "Precio", "Subtotal"],
        ...daily.map((r) => [r.nombre, r.codigo, r.cantidad, r.precio, r.total]),
        ["TOTAL", "", dayQty, "", dayTotal],
      ]),
      `Día ${fmtDate(fecha).replaceAll("/", "-")}`,
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Código", "Producto", "Cantidad en stock", "Precio"],
        ...products.map((p) => [p.codigo, p.nombre, p.cantidad, p.precio]),
      ]),
      "Stock",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Fecha", "Cantidad de productos", "Total recaudado", "Acumulado"],
        ...accRows.map((r) => [fmtDate(r.fecha), r.cantidad, r.total, r.acumulado]),
        ["TOTAL", grandQty, running, ""],
      ]),
      "Acumulado",
    );
    XLSX.writeFile(wb, `ventas_${fecha}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🧾 Productos vendidos</h1>

      <section className="rounded-lg border border-grid bg-card p-4">
        <h2 className="mb-3 font-semibold">Cargar venta</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            className={input}
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <select className={input} value={codigo} onChange={(e) => setCodigo(e.target.value)}>
            <option value="">Producto…</option>
            {products.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.codigo} — {p.nombre} ({p.cantidad})
              </option>
            ))}
          </select>
          <input
            className={input}
            type="number"
            placeholder="Cantidad vendida"
            value={cant}
            onChange={(e) => setCant(e.target.value)}
          />
          <button className={btn} onClick={addSale} disabled={busy}>
            Cargar
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
        {products.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Primero agregá productos en la carpeta de stock.
          </p>
        )}
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
        <button className={btn2} onClick={download}>
          ⬇ Excel
        </button>
      </div>
      <Sheet
        head={["Producto", "Código", "Cantidad", "Precio", "Subtotal"]}
        rows={daily.map((r) => [r.nombre, r.codigo, r.cantidad, money(r.precio), money(r.total)])}
        foot={["TOTAL", "", dayQty, "", money(dayTotal)]}
      />

      {daySales.length > 0 && (
        <details className="rounded border border-grid bg-card p-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            Ventas cargadas el {fmtDate(fecha)} ({daySales.length}) — anular
          </summary>
          <ul className="mt-2 space-y-1">
            {daySales.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>
                  {s.nombre} × {s.cantidad}
                </span>
                <button className="text-destructive" onClick={() => undo(s)}>
                  Anular
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <h2 className="text-lg font-semibold">Productos en stock</h2>
      <Sheet
        head={["Código", "Producto", "Cantidad", "Precio"]}
        rows={products.map((p) => [p.codigo, p.nombre, p.cantidad, money(p.precio)])}
      />

      <h2 className="text-lg font-semibold">Acumulado (todos los días)</h2>
      <Sheet
        head={["Fecha", "Cant. productos", "Total recaudado", "Acumulado"]}
        rows={accRows.map((r) => [fmtDate(r.fecha), r.cantidad, money(r.total), money(r.acumulado)])}
        foot={["TOTAL", grandQty, money(running), ""]}
      />
    </div>
  );
}
