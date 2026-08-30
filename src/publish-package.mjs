import JSZip from "jszip";
import { buildManifest, publishCopy } from "./content-engine.mjs";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function inspectPng(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new TypeError("rendered page is not a PNG");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== "IHDR") throw new TypeError("PNG IHDR is missing");
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export async function buildPublishZip(content, pngPages, options = {}) {
  if (!Array.isArray(pngPages) || pngPages.length !== content.visible_pages) throw new TypeError("all visible pages must be rendered before ZIP creation");
  const zip = new JSZip();
  const createdAt = options.createdAt || new Date().toISOString();
  const entryDate = new Date(createdAt);
  if (Number.isNaN(entryDate.getTime())) throw new TypeError("ZIP createdAt is invalid");
  const portableContent = structuredClone(content);
  delete portableContent.id;
  delete portableContent.saved_at;
  delete portableContent.reality_feedback;
  const names = [];
  pngPages.forEach((page, index) => {
    const dimensions = inspectPng(page);
    if (dimensions.width !== 1080 || dimensions.height !== 1440) throw new TypeError(`page ${index + 1} must be 1080x1440 PNG`);
    const name = `${String(index + 1).padStart(2, "0")}.png`;
    names.push(name);
    zip.file(name, page, { date: entryDate });
  });
  zip.file("publish-copy.txt", publishCopy(content), { date: entryDate });
  zip.file("content.json", JSON.stringify(portableContent, null, 2), { date: entryDate });
  zip.file("manifest.json", JSON.stringify(buildManifest(portableContent, names, createdAt), null, 2), { date: entryDate });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
}
