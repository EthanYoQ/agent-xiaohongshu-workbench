import path from "node:path";
import { pathToFileURL } from "node:url";

const rawUrl = process.argv[2];
if (!rawUrl) {
  process.stderr.write("Usage: node scripts/probe-xhs-media.mjs <signed-note-url>\n");
  process.exit(2);
}

const noteId = rawUrl.match(/\/(?:explore|note|search_result|discovery\/item)\/([a-f0-9]+)/i)?.[1];
if (!noteId || !/^https?:\/\//i.test(rawUrl)) {
  process.stderr.write("A full Xiaohongshu note URL is required.\n");
  process.exit(2);
}

const packageRoot = process.env.OPENCLI_PACKAGE_ROOT || path.join(
  process.env.APPDATA || "",
  "npm",
  "node_modules",
  "@jackwener",
  "opencli",
);
const pageModuleUrl = pathToFileURL(path.join(packageRoot, "dist", "src", "browser", "page.js")).href;
const downloadModuleUrl = pathToFileURL(path.join(packageRoot, "clis", "xiaohongshu", "download.js")).href;
const timeoutMs = Number(process.env.XHS_MEDIA_PROBE_TIMEOUT_MS || 30000);

let page;
let target;
try {
  const [{ Page }, { buildDownloadExtractJs }] = await Promise.all([
    import(pageModuleUrl),
    import(downloadModuleUrl),
  ]);
  page = new Page(`xhs-media-probe-${process.pid}`, 20, undefined, "background", "adapter", "ephemeral");
  const probe = async () => {
    await page.goto(rawUrl, { settleMs: 1400 });
    target = page.getActivePage();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return page.evaluate(buildDownloadExtractJs(noteId));
  };
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`media probe timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  const data = await Promise.race([probe(), timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
  if (!data || !Array.isArray(data.media)) throw new Error("media probe returned malformed data");
  if (data.securityBlock) throw new Error("Xiaohongshu blocked the note detail page");
  const mediaTypes = data.media.map((item) => item.type).filter(Boolean);
  const imageCount = mediaTypes.filter((type) => type === "image").length;
  const hasVideo = mediaTypes.includes("video");
  const mediaKind = hasVideo ? (imageCount ? "mixed" : "video") : imageCount ? "graphic" : "unknown";
  process.stdout.write(`${JSON.stringify({
    noteId: data.noteId || noteId,
    title: data.title || "",
    author: data.author || "",
    mediaKind,
    hasVideo,
    imageCount,
    mediaTypes,
    pageUrl: data.pageUrl || rawUrl,
  })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  if (page && target) {
    await Promise.race([
      page.closeTab(target).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1800)),
    ]);
  }
}
