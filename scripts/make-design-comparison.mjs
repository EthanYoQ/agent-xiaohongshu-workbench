import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const referencePath = path.join(root, "design", "reference", "split-canvas.png");
const prototypePath = path.join(root, "design", "audit-avatar-brand", "01-avatar-flow.png");
const outputPath = path.join(root, "design", "audit-avatar-brand", "02-reference-comparison.png");

const frame = { width: 1280, height: 720 };
const reference = await sharp(referencePath).resize(frame.width, frame.height, { fit: "cover", position: "top" }).png().toBuffer();
const prototype = await sharp(prototypePath).resize(frame.width, frame.height, { fit: "cover", position: "top" }).png().toBuffer();

await sharp({
  create: { width: frame.width * 2, height: frame.height + 60, channels: 4, background: "#ffffff" },
})
  .composite([
    { input: reference, left: 0, top: 60 },
    { input: prototype, left: frame.width, top: 60 },
    { input: Buffer.from(`<svg width="${frame.width * 2}" height="60"><rect width="${frame.width * 2}" height="60" fill="#202523"/><text x="32" y="39" font-family="Arial" font-size="24" fill="#fff">REFERENCE</text><text x="${frame.width + 32}" y="39" font-family="Arial" font-size="24" fill="#fff">PROTOTYPE</text></svg>`), left: 0, top: 0 },
  ])
  .png()
  .toFile(outputPath);

process.stdout.write(`${outputPath}\n`);
