import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import sharp from "sharp";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = "com.mesy.xiaoshimei.openai-api";
const DEFAULT_CONFIG = Object.freeze({
  baseUrl: "https://api.openai.com/v1",
  textModel: "gpt-5.4-mini",
  imageModel: "gpt-image-2",
  imageQuality: "low",
});

let cachedProxyUrl = null;
let cachedProxyAgent = null;

async function systemProxyUrl() {
  const envProxy = String(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || "").trim();
  if (envProxy) return envProxy;
  if (process.platform !== "darwin") return "";
  try {
    const { stdout } = await execFileAsync("/usr/sbin/scutil", ["--proxy"], { timeout: 5000 });
    const enabled = /HTTPSEnable\s*:\s*1/.test(stdout);
    const host = stdout.match(/HTTPSProxy\s*:\s*(\S+)/)?.[1];
    const port = stdout.match(/HTTPSPort\s*:\s*(\d+)/)?.[1];
    return enabled && host && port ? `http://${host}:${port}` : "";
  } catch {
    return "";
  }
}

async function proxyAgent() {
  const url = await systemProxyUrl();
  if (!url) return null;
  if (!cachedProxyAgent || cachedProxyUrl !== url) {
    cachedProxyAgent = new ProxyAgent(url);
    cachedProxyUrl = url;
  }
  return cachedProxyAgent;
}

function friendlyOpenAiError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "billing_hard_limit_reached" || code === "insufficient_quota" || /billing hard limit|quota/i.test(message)) {
    const next = new Error("OpenAI API 账单额度已用尽。请在 OpenAI Platform 的 Billing 中添加余额或提高预算后再试。");
    next.code = "AI_BILLING_LIMIT";
    next.status = error?.status || 402;
    return next;
  }
  if (error?.status === 401) {
    const next = new Error("OpenAI API Key 无效或已失效，请重新保存可用的 API Key。");
    next.code = "AI_KEY_INVALID";
    next.status = 401;
    return next;
  }
  if (/timed out|fetch failed|connection/i.test(message)) {
    const next = new Error("无法连接 OpenAI API。后端已尝试使用 macOS 系统代理，请确认代理当前可用。");
    next.code = "AI_NETWORK_ERROR";
    next.status = 502;
    return next;
  }
  return error;
}

function cleanText(value, max = 3000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function parseJsonObject(raw) {
  const text = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("TEXT_PLAN_INVALID_JSON");
}

export function normalizeQuickPlan(value, count) {
  if (!value || typeof value !== "object") throw new TypeError("QUICK_PLAN_INVALID");
  const requested = Math.max(1, Math.min(6, Number(count) || 4));
  const title = cleanText(value.title, 40);
  const body = cleanText(value.body, 5000);
  const tags = Array.isArray(value.tags) ? value.tags.map((item) => cleanText(item, 24)).filter(Boolean).slice(0, 5) : [];
  const cards = Array.isArray(value.cards) ? value.cards.slice(0, requested).map((card, index) => ({
    kicker: cleanText(card?.kicker || (index === 0 ? "小师妹" : `第 ${index + 1} 页`), 24),
    headline: cleanText(card?.headline || card?.title, 48),
    body: cleanText(card?.body || card?.content, 160),
    imagePrompt: cleanText(card?.imagePrompt || card?.image_prompt, 900),
  })) : [];
  if (!title || body.length < 80 || tags.length < 3 || cards.length !== requested) throw new TypeError("QUICK_PLAN_INCOMPLETE");
  if (cards.some((card) => !card.headline || !card.body || !card.imagePrompt)) throw new TypeError("QUICK_PLAN_CARD_INCOMPLETE");
  return { title, body, tags, cards };
}

async function readKeychainKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  if (process.platform !== "darwin") return "";
  try {
    const { stdout } = await execFileAsync("security", ["find-generic-password", "-a", os.userInfo().username, "-s", KEYCHAIN_SERVICE, "-w"], { timeout: 5000 });
    return stdout.trim();
  } catch { return ""; }
}

export async function storeOpenAiKey(value) {
  const key = cleanText(value, 500);
  if (!key) throw new TypeError("API_KEY_REQUIRED");
  if (process.platform !== "darwin") throw new Error("KEYCHAIN_UNSUPPORTED");
  await execFileAsync("security", ["add-generic-password", "-a", os.userInfo().username, "-s", KEYCHAIN_SERVICE, "-w", key, "-U"], { timeout: 8000 });
  return true;
}

export function createDirectAi({ runtimeRoot }) {
  const configPath = path.join(runtimeRoot, ".data", "direct-ai.json");
  const generatedRoot = path.join(runtimeRoot, "public", "generated");

  async function readConfig() {
    try {
      const stored = JSON.parse(await fs.readFile(configPath, "utf8"));
      return { ...DEFAULT_CONFIG, ...stored, baseUrl: DEFAULT_CONFIG.baseUrl };
    } catch { return { ...DEFAULT_CONFIG }; }
  }

  async function writeConfig(patch = {}) {
    const current = await readConfig();
    const next = {
      ...current,
      textModel: cleanText(patch.textModel ?? current.textModel, 80) || DEFAULT_CONFIG.textModel,
      imageModel: cleanText(patch.imageModel ?? current.imageModel, 80) || DEFAULT_CONFIG.imageModel,
      imageQuality: ["low", "medium", "high", "auto"].includes(patch.imageQuality) ? patch.imageQuality : current.imageQuality,
      baseUrl: DEFAULT_CONFIG.baseUrl,
    };
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  async function client() {
    const apiKey = await readKeychainKey();
    if (!apiKey) {
      const error = new Error("还没有配置 OpenAI API Key");
      error.code = "AI_KEY_MISSING";
      throw error;
    }
    const dispatcher = await proxyAgent();
    return new OpenAI({
      apiKey,
      baseURL: DEFAULT_CONFIG.baseUrl,
      timeout: 180_000,
      maxRetries: 1,
      ...(dispatcher ? { fetch: undiciFetch, fetchOptions: { dispatcher } } : {}),
    });
  }

  async function status() {
    const config = await readConfig();
    const proxyUrl = await systemProxyUrl();
    return {
      configured: Boolean(await readKeychainKey()),
      keyStore: process.platform === "darwin" ? "macOS Keychain" : "environment",
      networkRoute: proxyUrl ? "system-proxy" : "direct",
      ...config,
    };
  }

  async function generatePlan(topic, count) {
    const c = await client();
    const config = await readConfig();
    const prompt = `你是小红书图文主编。围绕下面素材，生成一套可直接进入设计器的原创图文方案。\n\n素材：${cleanText(topic, 6000)}\n\n严格要求：\n- 正好 ${count} 张卡片。\n- 第一张承担封面钩子，其余每张只讲一个核心点。\n- 正文自然、克制、像真人，不编造亲历、数据、疗效或权威背书。\n- imagePrompt 只描述画面，不包含任何可见文字、logo、水印；统一为高级中文生活方式杂志摄影/插画风，竖版构图，给标题留安全区。\n- 只返回 JSON，不要 Markdown。\n\nJSON：{"title":"发布标题","body":"完整发布正文","tags":["标签1","标签2","标签3","标签4","标签5"],"cards":[{"kicker":"短眉题","headline":"本页标题","body":"本页短正文","imagePrompt":"无文字画面描述"}]}`;
    try {
      const response = await c.responses.create({ model: config.textModel, input: prompt });
      return normalizeQuickPlan(parseJsonObject(response.output_text), count);
    } catch (error) {
      throw friendlyOpenAiError(error);
    }
  }

  async function generateScene(prompt, outputPath, { quality } = {}) {
    const c = await client();
    const config = await readConfig();
    const request = {
      model: config.imageModel,
      prompt: `${cleanText(prompt, 1400)}。竖版 3:4，画面内绝对不要出现文字、字母、数字、logo、水印、UI。视觉干净，主体明确，保留可排文字的负空间。`,
      n: 1,
      size: "1008x1344",
      quality: quality || config.imageQuality,
      output_format: "png",
      background: "opaque",
    };
    let response;
    try {
      response = await c.images.generate(request);
    } catch (error) {
      if ((String(error?.message || "").includes("size") || Number(error?.status) === 400) && !["billing_hard_limit_reached", "insufficient_quota"].includes(String(error?.code || ""))) {
        try {
          response = await c.images.generate({ ...request, size: "1024x1536" });
        } catch (fallbackError) {
          throw friendlyOpenAiError(fallbackError);
        }
      } else {
        throw friendlyOpenAiError(error);
      }
    }
    const b64 = response?.data?.[0]?.b64_json;
    if (!b64) throw new Error("IMAGE_BYTES_MISSING");
    const bytes = Buffer.from(b64, "base64");
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("IMAGE_DECODE_FAILED");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes);
    return { width: metadata.width, height: metadata.height, outputPath };
  }

  function wrap(value, maxUnits) {
    const chars = [...cleanText(value, 2000)];
    const lines = [];
    let line = "";
    let units = 0;
    for (const char of chars) {
      const size = /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
      if (units + size > maxUnits && line) { lines.push(line); line = char; units = size; }
      else { line += char; units += size; }
    }
    if (line) lines.push(line);
    return lines;
  }

  function esc(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function textLines(lines, x, y, size, gap, weight = 700, color = "#333333") {
    return lines.map((line, index) => `<text x="${x}" y="${y + index * gap}" font-family="PingFang SC,Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(line)}</text>`).join("");
  }

  async function renderCard(scenePath, card, index, targetPath) {
    const bg = await sharp(scenePath).resize(1080, 1440, { fit: "cover", position: "attention" }).png().toBuffer();
    const headline = wrap(card.headline, index === 0 ? 11 : 14).slice(0, 3);
    const body = wrap(card.body, 23).slice(0, 4);
    const panelHeight = index === 0 ? 620 : 560;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440">
      <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5EDE4" stop-opacity="0.97"/><stop offset="0.76" stop-color="#F5EDE4" stop-opacity="0.86"/><stop offset="1" stop-color="#F5EDE4" stop-opacity="0"/></linearGradient></defs>
      <rect width="1080" height="${panelHeight}" fill="url(#fade)"/>
      <rect x="72" y="74" width="12" height="54" rx="6" fill="#CC8800"/>
      <text x="108" y="114" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="28" font-weight="700" fill="#CC8800">${esc(card.kicker)}</text>
      ${textLines(headline, 72, 224, index === 0 ? 78 : 66, index === 0 ? 98 : 84, 800)}
      ${textLines(body, 76, index === 0 ? 520 : 470, 32, 50, 500, "#474747")}
      <text x="1008" y="1360" text-anchor="end" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#FFFFFF" opacity="0.88">${String(index + 1).padStart(2, "0")}</text>
    </svg>`;
    await sharp(bg).composite([{ input: Buffer.from(svg) }]).png({ compressionLevel: 9 }).toFile(targetPath);
  }

  async function testImage(prompt = "") {
    const id = `probe-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    const dir = path.join(generatedRoot, id);
    const scenePath = path.join(dir, "scene.png");
    await generateScene(prompt || "清晨的东方庭院，一杯热茶放在木桌上，柔和自然光，安静克制的生活方式摄影", scenePath, { quality: "low" });
    return { id, url: `/generated/${id}/scene.png`, absolutePath: scenePath };
  }

  async function quickCreate({ topic, imageCount = 4 }) {
    const count = Math.max(1, Math.min(6, Number(imageCount) || 4));
    if (cleanText(topic, 6000).length < 8) throw new TypeError("TOPIC_TOO_SHORT");
    const plan = await generatePlan(topic, count);
    const id = `direct-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    const dir = path.join(generatedRoot, id);
    await fs.mkdir(dir, { recursive: true });
    const assets = [];
    for (let index = 0; index < plan.cards.length; index += 1) {
      const scenePath = path.join(dir, `scene-${index + 1}.png`);
      const cardPath = path.join(dir, `card-${index + 1}.png`);
      await generateScene(plan.cards[index].imagePrompt, scenePath);
      await renderCard(scenePath, plan.cards[index], index, cardPath);
      assets.push({ id: `${id}-${index + 1}`, url: `/generated/${id}/card-${index + 1}.png`, sceneUrl: `/generated/${id}/scene-${index + 1}.png`, absolutePath: cardPath, width: 1080, height: 1440 });
    }
    const receipt = { schema: "xiaoshimei.direct-create.v1", id, createdAt: new Date().toISOString(), plan, assets };
    await fs.writeFile(path.join(dir, "receipt.json"), JSON.stringify(receipt, null, 2), "utf8");
    return receipt;
  }

  return { status, writeConfig, storeOpenAiKey, testImage, quickCreate };
}
