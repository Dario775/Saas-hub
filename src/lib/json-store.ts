import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Missing data is empty; damaged data must never silently overwrite a database. */
export function readJson<T>(filename: string, fallback: T): T {
  try {
    return JSON.parse(
      fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, ""),
    ) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw new Error(
      `No se pudo leer ${path.basename(filename)}. Conservamos el archivo para su recuperación.`,
      { cause: error },
    );
  }
}

/** Atomic replacement prevents truncated JSON after an interrupted write. */
export function writeJson<T>(filename: string, data: T): void {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(data, null, 2), "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

/** Serializes a transaction across requests and Node processes on the same disk. */
export async function withFileLock<T>(
  filename: string,
  action: () => Promise<T>,
): Promise<T> {
  const lock = `${filename}.lockdir`;
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      fs.writeFileSync(path.join(lock, "owner"), String(process.pid));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const owner = Number(fs.readFileSync(path.join(lock, "owner"), "utf8"));
        if (owner > 0) {
          try {
            process.kill(owner, 0);
          } catch (probe) {
            if ((probe as NodeJS.ErrnoException).code === "ESRCH") {
              fs.unlinkSync(path.join(lock, "owner"));
              fs.rmdirSync(lock);
              continue;
            }
          }
        }
      } catch {
        /* A concurrent owner may still be creating or releasing its lock. */
      }
      if (Date.now() > deadline)
        throw new Error(
          "Hay otra operación en curso. Volvé a intentarlo en unos segundos.",
        );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  try {
    return await action();
  } finally {
    fs.unlinkSync(path.join(lock, "owner"));
    fs.rmdirSync(lock);
  }
}
