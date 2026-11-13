import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Member = { email: string; estado: string };
const input =
  "w-full rounded border border-grid bg-card px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const btn = "rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";

export function TeamView() {
  const [list, setList] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_team");
    if (error) return setMsg(error.message);
    setList((data ?? []) as Member[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!email.trim()) return setMsg("Escribí un email.");
    const { data, error } = await supabase.rpc("add_team_member", { _email: email });
    if (error) return setMsg(error.message);
    setMsg(data === "activo" ? "Listo, ya tiene acceso ✔" : "Invitación guardada: tendrá acceso apenas cree su cuenta con ese email ✔");
    setEmail("");
    load();
  };

  const remove = async (m: Member) => {
    if (!confirm(`¿Quitar el acceso de ${m.email}?`)) return;
    const { error } = await supabase.rpc("remove_team_member", { _email: m.email });
    if (error) return setMsg(error.message);
    setMsg(`Se quitó a ${m.email}`);
    load();
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">👥 Equipo</h2>
      <p className="text-sm text-muted-foreground">Las personas de esta lista pueden ver y cargar stock, ventas y materiales.</p>
      <div className="flex flex-col gap-2 rounded-lg border border-grid bg-card p-4 sm:flex-row">
        <input className={input} type="email" placeholder="email@ejemplo.com" value={email}
          onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className={btn} onClick={add}>Agregar</button>
      </div>
      {msg && <p className="text-sm font-medium text-primary">{msg}</p>}
      <ul className="divide-y divide-grid rounded-lg border border-grid bg-card">
        {list.map((m) => (
          <li key={m.email} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="break-all">{m.email}</span>
            <span className="flex items-center gap-2">
              <span className={m.estado === "activo" ? "text-primary" : "text-muted-foreground"}>
                {m.estado === "activo" ? "Activo" : "Pendiente"}
              </span>
              <button onClick={() => remove(m)} className="rounded border border-destructive/40 px-2 py-1 text-destructive">Quitar</button>
            </span>
          </li>
        ))}
        {list.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Sin integrantes.</li>}
      </ul>
    </section>
  );
}
