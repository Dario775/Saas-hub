"use client";
import { useState,type FormEvent } from "react";
export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos conectar con el panel."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#0c111b] text-slate-100 grid place-items-center p-6"><form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 space-y-6"><div><p className="text-emerald-300 text-sm font-semibold">saashub</p><h1 className="text-2xl font-semibold mt-4">Bienvenido a tu espacio</h1><p className="text-slate-400 mt-3 text-sm">Ingresá para continuar con tu operación.</p></div><div><label htmlFor="password" className="block text-sm mb-2">Contraseña</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-950 p-3 focus:outline-emerald-300" /></div>{error && <p role="alert" className="text-red-300 text-sm">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-emerald-300 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Ingresando…" : "Ingresar"}</button></form></main>;
}
