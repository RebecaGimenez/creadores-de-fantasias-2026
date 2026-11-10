import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logo from "@/assets/creadores-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Control de Mercadería de Creadores de Fantasías" },
      {
        name: "description",
        content:
          "Entrá a tu control de mercadería: stock, ventas del día y lo recaudado, compartidos entre el celular y la compu.",
      },
      { property: "og:title", content: "Control de Mercadería — Creadores de Fantasías" },
      {
        property: "og:description",
        content: "Stock, ventas diarias y lo recaudado, compartidos entre todos tus aparatos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignIn,
});

const input =
  "w-full rounded border border-grid bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const btn =
  "rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";

function SignIn() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const isRecovery = new URLSearchParams(window.location.search).get("recovery") === "1";
    setRecovery(isRecovery);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isRecovery) nav({ to: "/app" });
    });
  }, [nav]);

  const withGoogle = async () => {
    setMsg("");
    setNotice("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMsg("No se pudo entrar con Google. Probá con tu correo y contraseña.");
      return;
    }
    if (result.redirected) return;
    nav({ to: "/app" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setNotice("");

    if (recovery) {
      const { error } = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (error) return setMsg("No se pudo cambiar la contraseña: " + error.message);
      return nav({ to: "/app" });
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) return setMsg(error.message);
      if (data.session) return nav({ to: "/app" });
      return setNotice(
        "Te mandamos un correo para confirmar tu cuenta. Abrí el link y después entrá desde acá.",
      );
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg("Correo o contraseña incorrectos.");
    return nav({ to: "/app" });
  };

  const forgot = async () => {
    if (!email) return setMsg("Escribí tu correo arriba y después tocá 'Olvidé mi contraseña'.");
    setBusy(true);
    setMsg("");
    setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?recovery=1`,
    });
    setBusy(false);
    if (error) return setMsg("No se pudo enviar el correo: " + error.message);
    setNotice("Revisá tu correo: te mandamos un link para elegir una contraseña nueva.");
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 text-lg font-bold">
          <img
            src={logo.url}
            alt="Creadores de Fantasías"
            className="h-12 w-12 rounded-full border-2 border-header-cell"
          />
          Control de Mercadería
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <img
          src={logo.url}
          alt="Creadores de Fantasías — Decoración navideña artesanal"
          className="mx-auto mb-6 w-48 rounded-full"
        />

        <div className="rounded-lg border border-grid bg-card p-5 shadow-sm">
          <h1 className="text-xl font-bold">
            {recovery ? "Elegí una contraseña nueva" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {recovery
              ? "Escribí la contraseña nueva y entrás directo a tus planillas."
              : "Entrá con la misma cuenta en cada celular y en la compu: vas a ver siempre los mismos datos."}
          </p>

          {!recovery && (
            <button
              type="button"
              onClick={withGoogle}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center rounded disabled:opacity-50"
              style={{
                background: "#FFFFFF",
                border: "1px solid #747775",
                color: "#1F1F1F",
                padding: "12px",
                gap: "10px",
                fontSize: "14px",
                lineHeight: "20px",
                fontWeight: 500,
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width={18}
                height={18}
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>
          )}

          {!recovery && (
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-grid" />
              o con tu correo
              <span className="h-px flex-1 bg-grid" />
            </div>
          )}

          <form onSubmit={submit} className="space-y-2">
            {!recovery && (
              <input
                className={input}
                type="email"
                placeholder="Correo"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            <input
              className={input}
              type="password"
              placeholder={recovery ? "Contraseña nueva" : "Contraseña"}
              autoComplete={recovery ? "new-password" : mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className={`${btn} w-full`} disabled={busy}>
              {recovery
                ? "Guardar y entrar"
                : mode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </button>
          </form>

          {!recovery && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                className="text-primary underline decoration-dotted"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setMsg("");
                  setNotice("");
                }}
              >
                {mode === "login" ? "No tengo cuenta, crear una" : "Ya tengo cuenta, entrar"}
              </button>
              <button className="text-muted-foreground underline decoration-dotted" onClick={forgot}>
                Olvidé mi contraseña
              </button>
            </div>
          )}

          {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
          {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Tus productos y ventas quedan guardados en la nube, no en el aparato.
        </p>
      </main>
    </div>
  );
}
