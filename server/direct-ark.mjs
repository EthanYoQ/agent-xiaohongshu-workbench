import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PROVIDER = "http://127.0.0.1:4175";
const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PROFILE_PATH = path.join(STUDIO_ROOT, "config", "generation-contract-v2.example.json");

function clean(value, max = 6000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

async function providerPost(route, body) {
  const response = await fetch(`${PROVIDER}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.code || data.error || `ARK_HTTP_${response.status}`);
    error.code = data.code || "ARK_PROVIDER_FAILED";
    error.details = data.details || null;
    throw error;
  }
  return data;
}
async function providerHealth() {
  const response = await fetch(`${PROVIDER}/health`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`ARK_HEALTH_${response.status}`);
  return data;
}

async function profileContract(profilePath) {
  try {
    return JSON.parse(await fs.readFile(profilePath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return JSON.parse(await fs.readFile(DEFAULT_PROFILE_PATH, "utf8"));
  }
}

function textEnvelope(topic, profile) {
  return {
    schema: "xiaoshimei.text-draft-request.v1",
    input: {
      topic: clean(topic),
      text_requirements: "",
      pillar: "identity",
      goal: "让读者看懂、愿意收藏并能实践",
      profile_contract: profile,
      prompt_context: {},
    },
  };
}

function imageEnvelope(draft, imageCount) {
  return {
    schema: "xiaoshimei.image-generation-request.v1",
    input: { draft, image_count: imageCount, resume_run_id: null, reference_images: [], reference_note: "" },
  };
}
function wrap(value, maxUnits) {
  const chars = [...clean(value, 2000)];
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

function resolveProviderScene(src, generatedRoot) {
  const prefix = "/generated/";
  if (!String(src || "").startsWith(prefix)) throw new Error("ARK_SCENE_PATH_INVALID");
  const relative = String(src).slice(prefix.length);
  const absolute = path.resolve(generatedRoot, relative);
  const allowed = `${path.resolve(generatedRoot)}${path.sep}`;
  if (!absolute.startsWith(allowed)) throw new Error("ARK_SCENE_PATH_OUTSIDE_ROOT");
  return absolute;
}

function mapArkError(error) {
  const raw = String(error?.message || error);
  if (/quota|balance|insufficient|arrears|欠费|余额/i.test(raw)) return { message: "火山方舟余额或配额不足，请充值后重试。", code: "ARK_BILLING_LIMIT" };
  if (/NETWORK|fetch|timeout|Abort/i.test(raw)) return { message: "火山方舟连接失败，请稍后重试。", code: "ARK_NETWORK" };
  return { message: raw, code: error?.code || "ARK_PROVIDER_FAILED" };
}
export function createDirectArk({ runtimeRoot }) {
  const generatedRoot = path.join(runtimeRoot, "public", "generated");
  const profilePath = process.env.XIAOSHIMEI_GENERATION_CONTRACT_PATH
    ? path.resolve(process.env.XIAOSHIMEI_GENERATION_CONTRACT_PATH)
    : path.join(runtimeRoot, ".data", "generation-contract-v2.json");

  async function latest() {
    try {
      const names = (await fs.readdir(generatedRoot)).filter((name) => name.startsWith("ark-direct-")).sort().reverse();
      for (const name of names) {
        try {
          const value = JSON.parse(await fs.readFile(path.join(generatedRoot, name, "receipt.json"), "utf8"));
          if (value?.schema === "xiaoshimei.direct-create.v2" && value?.plan && Array.isArray(value?.assets)) return value;
        } catch {}
      }
    } catch {}
    return null;
  }

  async function status() {
    try {
      const health = await providerHealth();
      return {
        configured: health.configured === true,
        provider: "volcengine-ark",
        providerLabel: "火山方舟",
        status: health.status,
        textModel: health.text_model,
        imageModel: health.image_model,
        lastSuccessAt: health.last_success_at,
      };
    } catch (error) {
      return { configured: false, provider: "volcengine-ark", providerLabel: "火山方舟", status: "OFFLINE", error: String(error?.message || error) };
    }
  }

  async function quickCreate({ topic, imageCount = 4 }) {
    const count = Math.max(1, Math.min(6, Number(imageCount) || 4));
    if (clean(topic).length < 8) throw Object.assign(new TypeError("先写至少 8 个字的选题或原始素材。"), { code: "TOPIC_TOO_SHORT" });
    try {
      const profile = await profileContract(profilePath);
      const draft = await providerPost("/text-draft", textEnvelope(topic, profile));
      const content = await providerPost("/generate-images", imageEnvelope(draft, count));
      const id = `ark-direct-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
      const dir = path.join(generatedRoot, id);
      await fs.mkdir(dir, { recursive: true });
      const assets = [];
      const cards = (content.pages || []).slice(0, count).map((page, index) => ({
        kicker: clean(page.eyebrow || (index === 0 ? "小师妹" : `第 ${index + 1} 页`), 24),
        headline: clean(page.title, 48),
        body: clean(page.body, 180),
        sceneSrc: page.image_style?.src,
      }));
      if (cards.length !== count || cards.some((card) => !card.headline || !card.body || !card.sceneSrc)) throw new Error("ARK_CONTENT_INCOMPLETE");

      for (let index = 0; index < cards.length; index += 1) {
        const legacyScene = resolveProviderScene(cards[index].sceneSrc, generatedRoot);
        const scenePath = path.join(dir, `scene-${index + 1}.png`);
        const cardPath = path.join(dir, `card-${index + 1}.png`);
        await sharp(legacyScene).png().toFile(scenePath);
        await renderCard(scenePath, cards[index], index, cardPath);
        assets.push({
          id: `${id}-${index + 1}`,
          url: `/generated/${id}/card-${index + 1}.png`,
          sceneUrl: `/generated/${id}/scene-${index + 1}.png`,
          absolutePath: cardPath,
          width: 1080,
          height: 1440,
        });
      }

      const plan = {
        title: content.selectedTitle || draft.selected_title,
        body: content.body || draft.body,
        tags: content.tags || draft.tags || [],
        cards,
      };
      const receipt = {
        schema: "xiaoshimei.direct-create.v2",
        provider: "volcengine-ark",
        id,
        createdAt: new Date().toISOString(),
        upstream: { draftId: draft.draft_id, generation: content.generation || null },
        plan,
        assets,
      };
      await fs.writeFile(path.join(dir, "receipt.json"), JSON.stringify(receipt, null, 2), "utf8");
      return receipt;
    } catch (error) {
      const mapped = mapArkError(error);
      throw Object.assign(new Error(mapped.message), { code: mapped.code, cause: error });
    }
  }

  async function testImage(prompt = "") {
    try {
      const probe = await providerPost("/image-probe", { prompt: clean(prompt) });
      const id = `ark-probe-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
      const dir = path.join(generatedRoot, id);
      const target = path.join(dir, "scene.png");
      await fs.mkdir(dir, { recursive: true });
      await sharp(resolveProviderScene(probe.src, generatedRoot)).png().toFile(target);
      await fs.writeFile(path.join(dir, "receipt.json"), JSON.stringify({
        schema: "xiaoshimei.direct-image-probe.v1", id, createdAt: new Date().toISOString(), provider: "volcengine-ark", upstream: probe,
      }, null, 2), "utf8");
      return { id, url: `/generated/${id}/scene.png`, absolutePath: target, provider: "volcengine-ark", upstreamRunId: probe.run_id };
    } catch (error) {
      const mapped = mapArkError(error);
      throw Object.assign(new Error(mapped.message), { code: mapped.code, cause: error });
    }
  }

  return { status, latest, testImage, quickCreate };
}
