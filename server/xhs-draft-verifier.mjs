import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1_500;

function normalizeTitle(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonOutput(stdout) {
  const value = String(stdout || "").trim();
  if (!value) throw new Error("OpenCLI 没有返回草稿列表");
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("[");
    const end = value.lastIndexOf("]");
    if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
    throw new Error("OpenCLI 返回的草稿列表不是有效 JSON");
  }
}

export function findNewMatchingDraft(drafts, { baselineIds = [], expectedTitle, expectedImageCount }) {
  const baseline = new Set((baselineIds || []).map(String));
  const title = normalizeTitle(expectedTitle);
  const imageCount = Number(expectedImageCount);
  return (drafts || []).find((draft) => (
    draft?.id
    && !baseline.has(String(draft.id))
    && normalizeTitle(draft.title) === title
    && Number(draft.images) === imageCount
  )) || null;
}

export async function readImageDrafts({ root }) {
  const cliPath = path.join(root, "node_modules", "@jackwener", "opencli", "dist", "src", "main.js");
  const { stdout } = await execFileAsync(process.execPath, [
    cliPath,
    "xiaohongshu",
    "drafts",
    "--type",
    "image",
    "-f",
    "json",
    "--window",
    "background",
    "--site-session",
    "ephemeral",
  ], {
    cwd: root,
    env: {
      ...process.env,
      PATH: [path.join(root, "node_modules", ".bin"), process.env.PATH].filter(Boolean).join(path.delimiter),
    },
    timeout: 45_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  const drafts = parseJsonOutput(stdout);
  if (!Array.isArray(drafts)) throw new Error("OpenCLI 草稿列表格式异常");
  return drafts.map((draft) => ({
    id: String(draft.id || ""),
    title: normalizeTitle(draft.title),
    images: Number(draft.images || 0),
    updatedAt: String(draft.updated_at || ""),
    type: String(draft.type || "image"),
  }));
}

export async function verifyNewImageDraft({ root, baselineIds, expectedTitle, expectedImageCount, attempts = DEFAULT_ATTEMPTS, retryDelayMs = DEFAULT_RETRY_DELAY_MS }) {
  let drafts = [];
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      drafts = await readImageDrafts({ root });
      const match = findNewMatchingDraft(drafts, { baselineIds, expectedTitle, expectedImageCount });
      if (match) {
        return {
          ok: true,
          draft: match,
          observedCount: drafts.length,
          evidence: `草稿箱新增记录 ${match.id}，标题与 ${expectedImageCount} 张配图均匹配`,
        };
      }
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) await delay(retryDelayMs);
  }
  const newDrafts = drafts.filter((draft) => !(baselineIds || []).map(String).includes(String(draft.id)));
  return {
    ok: false,
    observedCount: drafts.length,
    newDrafts: newDrafts.map((draft) => ({ id: draft.id, title: draft.title, images: draft.images })),
    reason: lastError
      ? `无法读取草稿箱：${lastError}`
      : `草稿箱未出现标题“${normalizeTitle(expectedTitle)}”且配图为 ${Number(expectedImageCount)} 张的新记录`,
  };
}
