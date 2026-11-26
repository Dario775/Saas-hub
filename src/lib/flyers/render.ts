import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const RENDER_TIMEOUT_MS = 60_000;
/** Tiempo virtual para que carguen las fuentes y se ajusten los textos. */
const VIRTUAL_TIME_MS = 9_000;
export const OUTPUT_SCALE = 2;

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export function findBrowser(candidates: readonly string[] = CANDIDATES): string | null {
  const configured = process.env.CHROME_PATH;
  return [...(configured ? [configured] : []), ...candidates].find((file) => fs.existsSync(file)) || null;
}

function browserArgs(directory: string, width: number, height: number, scale: number): string[] {
  return [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--disable-extensions",
    "--allow-file-access-from-files",
    `--user-data-dir=${path.join(directory, "perfil")}`,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${scale}`,
    `--virtual-time-budget=${VIRTUAL_TIME_MS}`,
  ];
}

function requireBrowser(): string {
  const browser = findBrowser();
  if (!browser)
    throw new Error("No encontramos Chrome ni Edge para generar el flyer. Indicá la ruta con CHROME_PATH en .env.local.");
  return browser;
}

function cleanUp(directory: string): void {
  try {
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  } catch {
    // Windows puede demorar en soltar el perfil temporal.
  }
}

/** Devuelve el HTML ya procesado por el navegador (después de fuentes y scripts). */
export async function dumpRenderedDom(html: string, width: number, height: number): Promise<string> {
  const browser = requireBrowser();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hub-flyer-"));
  const page = path.join(directory, "flyer.html");
  try {
    fs.writeFileSync(page, html, "utf8");
    const { stdout } = await run(browser, [...browserArgs(directory, width, height, 1), "--dump-dom", pathToFileURL(page).href], {
      timeout: RENDER_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } finally {
    cleanUp(directory);
  }
}

/** Convierte el HTML del flyer en un PNG, con un perfil temporal y sin sesión. */
export async function renderHtml(html: string, width: number, height: number, scale = OUTPUT_SCALE): Promise<Buffer> {
  const browser = requireBrowser();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hub-flyer-"));
  const page = path.join(directory, "flyer.html");
  const output = path.join(directory, `${randomUUID()}.png`);
  try {
    fs.writeFileSync(page, html, "utf8");
    await run(
      browser,
      [...browserArgs(directory, width, height, scale), `--screenshot=${output}`, pathToFileURL(page).href],
      { timeout: RENDER_TIMEOUT_MS, windowsHide: true },
    );
    if (!fs.existsSync(output)) throw new Error("El navegador no generó la imagen.");
    return fs.readFileSync(output);
  } finally {
    cleanUp(directory);
  }
}
