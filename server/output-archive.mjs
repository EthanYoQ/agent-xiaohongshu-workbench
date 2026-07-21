import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { safeFolderSegment } from "./account-workspace.mjs";

function shanghaiDateParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minute: `${parts.hour}${parts.minute}` };
}

function markdownEscape(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toMarkdown({ account, workspace, exportId, generatedAt, imageFiles }) {
  const topic = workspace.research?.topics?.find((item) => item.id === workspace.selectedTopicId) || null;
  const direction = workspace.breakdown?.visualDirections?.find((item) => item.id === workspace.selectedVisualDirectionId) || null;
  const draft = workspace.draft || {};
  const tags = (draft.tags || []).map((tag) => `#${tag}`).join(" ");
  const cards = (draft.imageCards || []).map((card, index) => [
    `### ${String(index + 1).padStart(2, "0")} / ${card.headline || "内容卡"}`,
    card.kicker || "",
    card.body || "",
    "",
  ].filter(Boolean).join("\n")).join("\n");
  return `---
export_id: "${markdownEscape(exportId)}"
account: "${markdownEscape(account.name)}"
generated_at: "${generatedAt}"
status: "content_ready"
topic: "${markdownEscape(topic?.title || "未命名选题")}"
visual_direction: "${markdownEscape(direction?.name || "未选择视觉方向")}"
images: ${imageFiles.length}
---

# ${draft.title || "未命名文稿"}

${draft.body || ""}

## 标签

${tags || "未设置"}

## 账号定位

${workspace.positioning || "未填写"}

## 选题方向

${topic?.title || "未选择"}

${topic?.angle || ""}

## 配图文案

${cards || "未生成"}
`;
}

export async function archiveContentOutput({ root, account, workspace, jobId }) {
  if (!workspace?.draft || workspace.draft.mode !== "humanized" || !Array.isArray(workspace.assets) || workspace.assets.length === 0) {
    throw new Error("只有生成最终文稿与配图后才能写入本地 output 目录");
  }
  const generatedAt = new Date().toISOString();
  const { day, minute } = shanghaiDateParts();
  const topic = workspace.research?.topics?.find((item) => item.id === workspace.selectedTopicId) || null;
  const folderSlug = account.output?.folderSlug || safeFolderSegment(account.name, "content-account");
  const topicSlug = safeFolderSegment(topic?.title || workspace.draft.title, "content");
  const exportId = `export-${crypto.randomUUID().slice(0, 8)}`;
  const folderName = `${minute}-${topicSlug}-${String(jobId || exportId).slice(-8)}`;
  const relativePath = path.posix.join("output", folderSlug, day, folderName);
  const destination = path.join(root, ...relativePath.split("/"));
  await fs.mkdir(destination, { recursive: true });

  const imageFiles = [];
  for (const [index, asset] of workspace.assets.entries()) {
    const extension = path.extname(String(asset.absolutePath || "")) || ".png";
    const fileName = `${String(index + 1).padStart(2, "0")}${extension.toLowerCase()}`;
    const target = path.join(destination, fileName);
    await fs.copyFile(asset.absolutePath, target);
    imageFiles.push(fileName);
  }

  const markdown = toMarkdown({ account, workspace, exportId, generatedAt, imageFiles });
  const manifest = {
    version: 1,
    id: exportId,
    accountId: account.id,
    accountName: account.name,
    generatedAt,
    status: "content_ready",
    topicId: workspace.selectedTopicId || null,
    title: workspace.draft.title,
    relativePath,
    files: { copy: "note.md", images: imageFiles },
  };
  await fs.writeFile(path.join(destination, "note.md"), markdown, "utf8");
  await fs.writeFile(path.join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const entry = {
    id: exportId,
    relativePath,
    generatedAt,
    status: "content_ready",
    title: workspace.draft.title,
    imageCount: imageFiles.length,
  };
  account.output ||= { folderSlug, latest: null, entries: [] };
  account.output.folderSlug ||= folderSlug;
  account.output.entries = [...(account.output.entries || []), entry].slice(-30);
  account.output.latest = entry;
  workspace.outputExportId = entry.id;
  return entry;
}

export function updateArchivedOutputStatus(account, exportId, status) {
  if (!account?.output || !exportId) return null;
  const entry = account.output.entries?.find((candidate) => candidate.id === exportId) || null;
  if (!entry) return null;
  entry.status = status;
  entry.updatedAt = new Date().toISOString();
  if (account.output.latest?.id === entry.id) account.output.latest = { ...account.output.latest, status, updatedAt: entry.updatedAt };
  return entry;
}
