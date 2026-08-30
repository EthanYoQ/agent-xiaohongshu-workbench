import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";
import { detectUniformEdgeInsets, exactThreeByFourCrop } from "../src/mother-sheet-trim.mjs";
import { inspectMotherSheetTilePixels, inspectMotherSheetTileStats } from "../src/mother-sheet-tile-quality.mjs";

const root = new URL("..", import.meta.url).pathname;
const runId = String(process.argv[2] || "").trim();
if (!/^images-[A-Za-z0-9-]+$/.test(runId)) throw new Error("usage: node scripts/reslice-existing-mother-sheet.mjs <images-run-id>");

const runDir = join(root, "public", "generated", "ark", runId);
const sourceReceiptPath = join(root, "artifacts", "provider-runs", `${runId}.json`);
const sourceReceipt = JSON.parse(await readFile(sourceReceiptPath, "utf8"));
const repairId = `reslice-${runId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const repairDir = join(root, "artifacts", "provider-runs", "repairs", repairId);
const backupDir = join(repairDir, "before");
await mkdir(backupDir, { recursive: true });

function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

const repairs = [];
for (const sheet of sourceReceipt.mother_sheets || []) {
  const units = Array.isArray(sheet.tiles) ? sheet.tiles : [];
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const target = join(runDir, basename(unit.file));
    const before = await readFile(target);
    const quality = inspectMotherSheetTileStats(await sharp(before).stats());
    if (!quality.hasVisibleSubject) throw new Error(`MOTHER_SHEET_UNIT_MISSING:${unit.unit_id}`);
    const raw = await sharp(before).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let edgeInsets = detectUniformEdgeInsets({ data: raw.data, width: raw.info.width, height: raw.info.height, channels: raw.info.channels }, { maxRatio: .06 });
    let tileBytes; let edgeGate;
    for (let pass = 0; pass < 3; pass += 1) {
      const exactRegion = exactThreeByFourCrop(raw.info.width, raw.info.height, edgeInsets);
      tileBytes = await sharp(before).extract(exactRegion).resize(1080, 1440, { fit: "fill" }).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toBuffer();
      const finalRaw = await sharp(tileBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      edgeGate = inspectMotherSheetTilePixels({ data: finalRaw.data, width: finalRaw.info.width, height: finalRaw.info.height, channels: finalRaw.info.channels });
      if (edgeGate.hasCleanEdges) break;
      const extraX = Math.max(2, Math.round(raw.info.width * .02));
      const extraY = Math.max(2, Math.round(raw.info.height * .02));
      edgeInsets = { ...edgeInsets };
      edgeGate.contaminatedSides.forEach((side) => { edgeInsets[side] += side === "left" || side === "right" ? extraX : extraY; });
    }
    if (!edgeGate.hasCleanEdges) throw new Error(`MOTHER_SHEET_UNIT_EDGE_CONTAMINATION:${unit.unit_id}:${edgeGate.contaminatedSides.join("+") || "aspect"}`);
    await copyFile(target, join(backupDir, basename(unit.file)));
    await writeFile(target, tileBytes);
    unit.sha256 = digest(tileBytes);
    unit.size_bytes = tileBytes.length;
    unit.width = 1080;
    unit.height = 1440;
    unit.preferred_aspect = "3:4";
    unit.fit_policy = "cover";
    unit.edge_trim = edgeInsets;
    unit.edge_gate = edgeGate;
    repairs.push({
      unit_id: unit.unit_id,
      file: unit.file,
      old_sha256: digest(before),
      new_sha256: digest(tileBytes),
      source_slot: unit.mother_sheet_slot || index + 1,
      presence_gate: quality,
      edge_trim: edgeInsets,
      edge_gate: edgeGate,
      width: 1080,
      height: 1440,
    });
  }
}

for (const asset of sourceReceipt.illustration_assets || []) {
  const repair = repairs.find((item) => item.unit_id === asset.unit_id);
  if (!repair) continue;
  Object.assign(asset, { sha256: repair.new_sha256, width: 1080, height: 1440, preferred_aspect: "3:4", fit_policy: "cover", edge_trim: repair.edge_trim, edge_gate: repair.edge_gate });
}
await copyFile(sourceReceiptPath, join(backupDir, basename(sourceReceiptPath)));
await writeFile(sourceReceiptPath, `${JSON.stringify(sourceReceipt, null, 2)}\n`, "utf8");

const receipt = {
  schema: "xiaoshimei.mother-sheet-reslice-repair.v1",
  repair_id: repairId,
  source_run_id: runId,
  source_receipt: sourceReceiptPath,
  created_at: new Date().toISOString(),
  rule: "preserve each bound illustration identity; remove shallow separators; centre-crop and normalize to exact 1080x1440; fail closed on contaminated edge pixels",
  rollback_dir: backupDir,
  repairs,
};
const receiptPath = join(repairDir, "receipt.json");
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ receiptPath, repairId, repaired: repairs.length, slots: repairs.map((item) => item.source_slot) }, null, 2));
