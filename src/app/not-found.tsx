import Link from "next/link";
export default function NotFound() {
  return <main className="min-h-screen grid place-items-center bg-slate-950 px-6 text-slate-100"><div className="max-w-md space-y-5"><p className="text-emerald-300">SaaS Hub</p><h1 className="text-2xl font-semibold">Esta página no está disponible</h1><p className="text-slate-400">El enlace puede haber cambiado o la demo ya no está activa.</p><Link href="/" className="inline-block rounded-lg bg-emerald-300 text-slate-950 px-5 py-3 font-semibold">Volver al inicio</Link></div></main>;
}
