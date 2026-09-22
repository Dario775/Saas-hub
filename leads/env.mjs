// env.mjs — Carga minimalista de .env (mismo directorio) si existe.
import fs from "fs";
import path from "path";

export function loadEnv() {
  try {
    const p = path.join(path.dirname(new URL(import.meta.url).pathname), ".env");
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_.]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch { /* sin .env no pasa nada */ }
}
