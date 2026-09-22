"use client";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("No se pudo cargar la vista", error.digest || error.name); }, [error]);
  return <main className="min-h-screen grid place-items-center bg-slate-950 px-6 text-slate-100"><div className="max-w-md space-y-5"><p className="text-emerald-300 text-sm">SaaS Hub</p><h1 className="text-2xl font-semibold">No pudimos cargar esta vista</h1><p className="text-slate-400">Volvé a intentarlo. Si el problema continúa, recargá el panel para restablecer la conexión.</p><button className="rounded-lg bg-emerald-300 text-slate-950 px-5 py-3 font-semibold" onClick={reset}>Volver a intentar</button></div></main>;
}
