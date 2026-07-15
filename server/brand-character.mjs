import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;
export const AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function saveUploadedAvatar({ root, buffer, contentType }) {
  if (!AVATAR_MIME_TYPES.has(String(contentType || "").toLowerCase())) {
    throw new Error("头像仅支持 PNG、JPG 或 WebP 图片");
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("没有收到头像图片");
  if (buffer.length > AVATAR_MAX_BYTES) throw new Error("头像图片不能超过 10MB");

  let metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: 36_000_000 }).metadata();
  } catch {
    throw new Error("头像文件不是可读取的图片，或图片尺寸过大");
  }
  if (!metadata.width || !metadata.height || metadata.width < 256 || metadata.height < 256) {
    throw new Error("头像图片的宽和高都不能小于 256px");
  }
  if (!["png", "jpeg", "webp"].includes(metadata.format)) throw new Error("头像图片格式与文件内容不一致");

  const avatarsDir = path.join(root, "public", "brand", "avatars");
  await fs.mkdir(avatarsDir, { recursive: true });
  const fileName = `avatar-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
  const absolutePath = path.join(avatarsDir, fileName);
  await sharp(buffer, { limitInputPixels: 36_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(absolutePath);
  const output = await sharp(absolutePath).metadata();
  return {
    url: `/brand/avatars/${fileName}`,
    absolutePath,
    width: output.width,
    height: output.height,
    contentType: "image/png",
  };
}
