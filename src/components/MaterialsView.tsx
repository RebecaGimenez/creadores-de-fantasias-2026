import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Material = { id: string; nombre: string; unidad: string; cantidad: number; minimo: number; costo: number };

const input =
  "w-full rounded border border-grid bg-card px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const btn = "rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
const money = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

export function MaterialsView({ onCount }: { onCount?: (n: number) => void }) {
  const [items, setItems] = useState<Material[]>([]);
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ nombre: "", unidad: "unidades", cantidad: "", minimo: "", costo: "" });
  const [delta, setDelta] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("materials").select("*").order("nombre");
    if (error) return setMsg(error.message);
    const list = (data ?? []).map((m) => ({
      ...m,
      cantidad: Number(m.cantidad),
      minimo: Number(m.minimo),
      costo: Number(m.costo),
    }));
    setItems(list);
    onCount?.(list.length);
  }, [onCount]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!f.nombre.trim()) return setMsg("Escribí el nombre del material.");
    const { error } = await supabase.from("materials").insert({
      nombre: f.nombre.trim(),
      unidad: f.unidad.trim() || "unidades",
      cantidad: Number(f.cantidad) || 0,
      minimo: Number(f.minimo) || 0,
      costo: Number(f.costo) || 0,
    });
    if (error) return setMsg(error.message);
    setF({ nombre: "", unidad: "unidades", cantidad: "", minimo: "", costo: "" });
    setMsg("Material agregado ✔");
    load();
  };

  const adjust = async (m: Material, sign: 1 | -1) => {
    const n = Number(delta[m.id]);
    if (!n || n <= 0) return setMsg("Escribí una cantidad mayor a 0.");
    const nueva = Math.max(0, m.cantidad + sign * n);
    const { error } = await supabase
      .from("materials")
      .update({ cantidad: nueva, updated_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) return setMsg(error.message);
    setDelta((d) => ({ ...d, [m.id]: "" }));
    setMsg(sign > 0 ? `Sumaste ${n} ${m.unidad} de ${m.nombre} ✔` : `Usaste ${n} ${m.unidad} de ${m.nombre} ✔`);
    load();
  };

  const remove = async (m: Material) => {
    if (!confirm(`¿Eliminar "${m.nombre}"?`)) return;
    const { error } = await supabase.from("materials").delete().eq("id", m.id);
    if (error) return setMsg(error.message);
    load();
  };

  const total = items.reduce((s, m) => s + m.cantidad * m.costo, 0);
  const bajos = items.filter((m) => m.minimo > 0 && m.cantidad <= m.minimo);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🧵 Materiales</h1>

      <div className="rounded-lg border border-grid bg-card p-4">
        <h2 className="mb-3 font-semibold">Agregar material nuevo</h2>
        <div className="grid gap-2 sm:grid-cols-5">
          <input className={input} placeholder="Nombre (ej: cinta roja)" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <input className={input} placeholder="Unidad (metros, unidades…)" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} />
          <input className={input} type="number" placeholder="Cantidad" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} />
          <input className={input} type="number" placeholder="Aviso si quedan menos de" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} />
          <input className={input} type="number" placeholder="Costo por unidad" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} />
        </div>
        <button className={`${btn} mt-3`} onClick={add}>Agregar</button>
        {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
      </div>

      {bajos.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-card p-3 text-sm">
          <b className="text-destructive">⚠️ Quedan pocos:</b> {bajos.map((m) => `${m.nombre} (${m.cantidad} ${m.unidad})`).join(", ")}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-grid bg-card">
        <table className="w-full border-collapse font-mono text-sm">
          <thead>
            <tr>
              {["Material", "Cantidad", "Costo", "Valor", "Sumar / usar", ""].map((h) => (
                <th key={h} className="border border-grid bg-header-cell px-2 py-1.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="border border-grid px-2 py-4 text-center text-muted-foreground">Todavía no cargaste materiales.</td></tr>
            )}
            {items.map((m) => {
              const bajo = m.minimo > 0 && m.cantidad <= m.minimo;
              return (
                <tr key={m.id}>
                  <td className="border border-grid px-2 py-1">{m.nombre}</td>
                  <td className={`border border-grid px-2 py-1 ${bajo ? "font-bold text-destructive" : ""}`}>{m.cantidad} {m.unidad}</td>
                  <td className="border border-grid px-2 py-1">{money(m.costo)}</td>
                  <td className="border border-grid px-2 py-1">{money(m.cantidad * m.costo)}</td>
                  <td className="border border-grid px-2 py-1">
                    <div className="flex items-center gap-1">
                      <input className={`${input} w-20`} type="number" value={delta[m.id] ?? ""} onChange={(e) => setDelta({ ...delta, [m.id]: e.target.value })} />
                      <button className="rounded bg-primary px-2 py-1 text-primary-foreground" onClick={() => adjust(m, 1)} title="Sumar">+</button>
                      <button className="rounded bg-accent px-2 py-1 text-accent-foreground" onClick={() => adjust(m, -1)} title="Usar">−</button>
                    </div>
                  </td>
                  <td className="border border-grid px-2 py-1">
                    <button onClick={() => remove(m)} title="Eliminar">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="border border-grid bg-header-cell px-2 py-1 font-semibold">Valor total en materiales</td>
                <td colSpan={3} className="border border-grid bg-header-cell px-2 py-1 font-semibold">{money(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
