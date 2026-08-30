import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { cleanupGeneratedGridArtifacts } from "../src/mother-sheet-artifact-cleanup.mjs";
import { detectKvTemplateLeftColumnRegions } from "../src/mother-sheet-adaptive-regions.mjs";
import { sha256Bytes } from "../src/ark-provider-core.mjs";

const root = new URL("..", import.meta.url).pathname;
const runId = String(process.argv[2] || "").trim();
if (!/^images-[0-9TZ-]+-[0-9a-f]{8}$/.test(runId)) throw new Error("RUN_ID_REQUIRED");
const runDir = join(root, "public", "generated", "ark", runId);
const checkpointPath = join(runDir, "checkpoint.json");
const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
const repaired = [];
for (let imageIndex = 0; imageIndex < (checkpoint.images || []).length; imageIndex += 1) {
  const image = checkpoint.images[imageIndex];
  const job = checkpoint.pages?.[imageIndex];
  const sourceBytes = await readFile(join(runDir, image.file));
  const sourceRaw = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const adaptiveLeftColumn = job?.template === "kv-focus-2x2"
    ? detectKvTemplateLeftColumnRegions({ data: sourceRaw.data, width: sourceRaw.info.width, height: sourceRaw.info.height, channels: sourceRaw.info.channels })
    : null;
  for (let tileIndex = 0; tileIndex < (image.tiles || []).length; tileIndex += 1) {
    const tile = image.tiles[tileIndex];
    const path = join(runDir, tile.file);
    const adaptiveRegion = tileIndex === 1 || tileIndex === 2 ? adaptiveLeftColumn?.regions?.[tileIndex - 1] : null;
    const bytes = adaptiveRegion
      ? await sharp(sourceBytes).extract(adaptiveRegion).resize(1080, 1440, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toBuffer()
      : await readFile(path);
    const raw = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cleaned = cleanupGeneratedGridArtifacts(
      { data: raw.data, width: raw.info.width, height: raw.info.height, channels: raw.info.channels },
      { kv: tile.mother_sheet_region_role === "kv-2x2-3:4", previousActions: tile.artifact_cleanup },
    );
    if (!cleaned.actions.length && !adaptiveRegion) continue;
    const output = await sharp(cleaned.data, { raw: { width: cleaned.width, height: cleaned.height, channels: cleaned.channels } }).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path, output);
    tile.sha256 = sha256Bytes(output);
    tile.size_bytes = output.length;
    tile.artifact_cleanup = cleaned.actions;
    tile.adaptive_region = adaptiveRegion ? { ...adaptiveRegion, strategy: "detected-left-column-contain" } : tile.adaptive_region || null;
    repaired.push({ file: tile.file, actions: cleaned.actions, adaptive_region: tile.adaptive_region });
  }
  image.slice_pipeline_version = "white-background-v4";
}
await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
const receiptPath = join(root, "artifacts", "provider-runs", `${runId}.json`);
try {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  receipt.mother_sheets = checkpoint.images;
  receipt.illustration_assets = checkpoint.images.flatMap((image) => image.tiles || []);
  receipt.postprocess_repair = { applied: true, repaired };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
} catch {}
console.log(JSON.stringify({ run_id: runId, repaired }, null, 2));
