import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import "server-only";
import { withFileLock } from "./json-store";

/** Serialize all settings writers so one provider cannot erase another's key. */
export async function saveEnvironment(changes: Record<string, string>) {
  const file = path.join(process.cwd(), ".env.local");
  await withFileLock(file, async () => {
    let content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    for (const [name, value] of Object.entries(changes)) {
      if (
        !/^[A-Z][A-Z0-9_]*$/.test(name) ||
        /[\r\n\0]/.test(value) ||
        value.length > 2000
      )
        throw new Error("Configuración inválida.");
      const line = `${name}=${JSON.stringify(value)}`;
      const matcher = new RegExp(`^${name}=.*$`, "m");
      content = matcher.test(content)
        ? content.replace(matcher, () => line)
        : `${content}\n${line}\n`;
    }
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, content, { mode: 0o600 });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    Object.assign(process.env, changes);
  });
}
