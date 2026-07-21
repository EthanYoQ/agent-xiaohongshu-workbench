import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "build", "icon.ico");
const iconDir = path.join(root, "build", "icon-sources");
const sizes = [16, 32, 48, 64, 128, 256];

await fs.mkdir(iconDir, { recursive: true });
const iconSources = await Promise.all(sizes.map(async (size) => {
  const target = path.join(iconDir, `icon-${size}.png`);
  await sharp(path.join(root, "public", "project-logo.png"))
    .resize(size, size, { fit: "contain", background: { r: 255, g: 248, b: 234, alpha: 1 } })
    .png()
    .toFile(target);
  return target;
}));
await fs.writeFile(output, await pngToIco(iconSources));
await fs.rm(iconDir, { recursive: true, force: true });
