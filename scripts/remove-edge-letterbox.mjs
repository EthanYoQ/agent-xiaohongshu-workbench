import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

function isEdgeBlack(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  return alpha > 24 && red < 34 && green < 34 && blue < 34 && Math.max(red, green, blue) - Math.min(red, green, blue) < 12;
}

export async function removeEdgeLetterbox(inputPath) {
  const absolutePath = path.resolve(inputPath);
  const { data, info } = await sharp(absolutePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`Expected RGBA data for ${absolutePath}`);

  const visited = new Uint8Array(width * height);
  const queue = [];
  const enqueue = (x, y) => {
    const index = y * width + x;
    if (visited[index]) return;
    visited[index] = 1;
    if (isEdgeBlack(data, index * 4)) queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let removedPixels = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    data[index * 4 + 3] = 0;
    removedPixels += 1;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  const coverage = removedPixels / (width * height);
  if (coverage > 0.35) throw new Error(`Refusing to remove ${(coverage * 100).toFixed(1)}% of ${absolutePath}`);
  if (removedPixels > 0) {
    const tempPath = `${absolutePath}.edge-clean.png`;
    await sharp(data, { raw: { width, height, channels } }).png({ compressionLevel: 9 }).toFile(tempPath);
    await fs.rename(tempPath, absolutePath);
  }
  return { absolutePath, width, height, removedPixels, coverage };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) throw new Error("Usage: node scripts/remove-edge-letterbox.mjs <png> [...png]");
  for (const inputPath of paths) process.stdout.write(`${JSON.stringify(await removeEdgeLetterbox(inputPath))}\n`);
}
