import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList,isIP } from "node:net";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6)
    return globalIPv6.check(address, "ipv6") && !blocked.check(address, "ipv6");
  return false;
}

/** Pins the validated address to the socket, including every redirect. */
export async function fetchPublic(
  urlString: string,
  maxBytes = 2_000_000,
  redirects = 3,
): Promise<{ body: Buffer; contentType: string; finalUrl?: string }> {
  const url = new URL(urlString);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("Ingresá una URL pública HTTP o HTTPS.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicAddress(item.address))
  )
    throw new Error("No se permiten direcciones de red privadas o locales.");
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(
      url,
      {
        family: address.family,
        lookup: (_host, _options, callback) =>
          callback(null, address.address, address.family),
        headers: { "User-Agent": "SaaSHub/1.0", "Accept-Encoding": "identity" },
      },
      (response) => {
        if (
          [301, 302, 303, 307, 308].includes(response.statusCode || 0) &&
          response.headers.location
        ) {
          response.resume();
          clearTimeout(timer);
          if (!redirects) {
            reject(new Error("La URL redirige demasiadas veces."));
            return;
          }
          fetchPublic(
            new URL(response.headers.location, url).href,
            maxBytes,
            redirects - 1,
          ).then(resolve, reject);
          return;
        }
        if (!response.statusCode || response.statusCode >= 400) {
          response.resume();
          clearTimeout(timer);
          reject(
            new Error(
              `El sitio respondió con un error (${response.statusCode}).`,
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(
              new Error("El archivo supera el tamaño permitido."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          clearTimeout(timer);
          resolve({
            body: Buffer.concat(chunks),
            contentType:
              response.headers["content-type"] || "application/octet-stream",
            finalUrl: url.href,
          });
        });
      },
    );
    const timer = setTimeout(
      () =>
        request.destroy(new Error("El sitio tardó demasiado en responder.")),
      15_000,
    );
    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
