import { buildGenerationRequest, buildImageGenerationRequest, buildPageCandidateRequest, buildTextDraftRequest, parsePageCandidateResponse, parseTextDraftResponse } from "./provider-contract.mjs";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const CLOUD_SETTINGS_KEY = "xiaoshimei-studio.byok-provider.v1";
const CLOUD_KEY = "xiaoshimei-studio.byok-api-key.v1";
const CLOUD_DEFAULTS = Object.freeze({
  provider: "volcengine-ark",
  provider_label: "火山方舟",
  base_url: "https://ark.cn-beijing.volces.com/api/v3",
  text_model: "doubao-seed-2-0-lite-260428",
  image_model: "doubao-seedream-5-0-lite-260128",
  key_store: "当前标签页 sessionStorage",
});

export function createLocalHttpProvider({ endpoint, fetchImpl = globalThis.fetch, timeoutMs = 300000 } = {}) {
  let url;
  try { url = new URL(endpoint, globalThis.location?.origin); }
  catch { throw new TypeError("provider endpoint must be a valid URL"); }
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new TypeError("provider endpoint must use HTTP or HTTPS");
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
  if (!isLoopback && (url.protocol !== "https:" || url.origin !== globalThis.location?.origin || !url.pathname.startsWith("/api/provider/"))) throw new TypeError("provider endpoint must use loopback HTTP or the same HTTPS origin");
  if (typeof fetchImpl !== "function") throw new TypeError("provider fetch implementation is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new TypeError("provider timeout is invalid");

  const cloudSettings = () => {
    if (isLoopback) return null;
    let stored = {};
    try { stored = JSON.parse(globalThis.sessionStorage?.getItem(CLOUD_SETTINGS_KEY) || "{}"); } catch { stored = {}; }
    const apiKey = globalThis.sessionStorage?.getItem(CLOUD_KEY) || "";
    return { ...CLOUD_DEFAULTS, ...stored, configured: apiKey.trim().length >= 8 };
  };

  const post = async (target, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const settings = cloudSettings();
      const apiKey = settings ? globalThis.sessionStorage?.getItem(CLOUD_KEY) || "" : "";
      const response = await fetchImpl(target, { method: "POST", headers: { "content-type": "application/json", ...(settings ? { authorization: `Bearer ${apiKey}`, "x-xiaoshimei-text-model": settings.text_model, "x-xiaoshimei-image-model": settings.image_model } : {}) }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json();
      if (!response?.ok) {
        const providerCode = String(payload?.code || payload?.error || `HTTP_${response?.status || "UNKNOWN"}`);
        const error = new Error(`provider request failed: ${providerCode}`);
        error.providerCode = providerCode;
        error.providerStage = typeof payload?.stage === "string" ? payload.stage : null;
        error.failureId = typeof payload?.failure_id === "string" ? payload.failure_id : null;
        error.httpStatus = response?.status || null;
        error.providerDetails = payload?.details && typeof payload.details === "object" ? structuredClone(payload.details) : null;
        throw error;
      }
      return payload;
    } finally { clearTimeout(timer); }
  };
  const candidateUrl = new URL(url);
  candidateUrl.pathname = candidateUrl.pathname.replace(/\/generate\/?$/, "/page-candidates");
  const textDraftUrl = new URL(url);
  textDraftUrl.pathname = textDraftUrl.pathname.replace(/\/generate\/?$/, "/text-draft");
  const imageGenerationUrl = new URL(url);
  imageGenerationUrl.pathname = imageGenerationUrl.pathname.replace(/\/generate\/?$/, "/generate-images");
  const healthUrl = new URL(url);
  healthUrl.pathname = isLoopback ? "/health" : url.pathname.replace(/\/generate\/?$/, "/health");
  const configUrl = new URL(url);
  configUrl.pathname = isLoopback ? "/config" : url.pathname.replace(/\/generate\/?$/, "/config");

  return {
    id: `${isLoopback ? "local-http" : "same-origin-byok"}:${url.host}`,
    async checkHealth() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetchImpl(healthUrl, { method: "GET", signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response?.ok) throw new Error(`provider health failed: HTTP_${response?.status || "UNKNOWN"}`);
        return isLoopback ? payload : { ...payload, ...cloudSettings() };
      } finally { clearTimeout(timer); }
    },
    async getSettings() {
      if (!isLoopback) return cloudSettings();
      const response = await fetchImpl(configUrl, { method: "GET", cache: "no-store" });
      const payload = await response.json();
      if (!response?.ok) throw new Error(`provider config failed: HTTP_${response?.status || "UNKNOWN"}`);
      return payload;
    },
    async updateSettings(input) {
      if (!isLoopback) {
        if (input?.provider !== "volcengine-ark") throw new TypeError("公网体验当前只开放火山方舟");
        const textModel = String(input?.text_model || "").trim();
        const imageModel = String(input?.image_model || "").trim();
        if (!/^[A-Za-z0-9_.:-]{3,120}$/.test(textModel) || !/^[A-Za-z0-9_.:-]{3,120}$/.test(imageModel)) throw new TypeError("请填写有效的文字与图片模型 ID");
        const next = { ...CLOUD_DEFAULTS, provider_label: String(input?.label || "火山方舟").trim().slice(0, 40) || "火山方舟", text_model: textModel, image_model: imageModel };
        globalThis.sessionStorage?.setItem(CLOUD_SETTINGS_KEY, JSON.stringify(next));
        const key = String(input?.api_key || "").trim();
        if (key) globalThis.sessionStorage?.setItem(CLOUD_KEY, key);
        return cloudSettings();
      }
      return post(configUrl, input);
    },
    async generate(input) {
      return post(url, buildGenerationRequest(input));
    },
    async generateTextDraft(input) {
      return parseTextDraftResponse(await post(textDraftUrl, buildTextDraftRequest(input)));
    },
    async generateImages(input) {
      return post(imageGenerationUrl, buildImageGenerationRequest(input));
    },
    async generatePageCandidates(input) {
      return parsePageCandidateResponse(await post(candidateUrl, buildPageCandidateRequest(input)));
    },
  };
}
