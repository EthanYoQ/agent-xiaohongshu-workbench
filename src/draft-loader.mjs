import { parseContentPackage } from "./content-engine.mjs";

export function resolveLocalDraftUrl(value, origin) {
  if (typeof value !== "string" || !value.trim()) return null;
  const base = new URL(origin);
  const resolved = new URL(value, base);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith("/generated/")) {
    throw new TypeError("draft URL must be a same-origin generated artifact");
  }
  return resolved.href;
}

export async function loadLocalDraft(value, { origin, fetcher = fetch } = {}) {
  const url = resolveLocalDraftUrl(value, origin);
  if (!url) return null;
  const response = await fetcher(url, { cache: "no-store" });
  if (!response.ok) throw new TypeError(`draft artifact returned HTTP ${response.status}`);
  return parseContentPackage(await response.text());
}
