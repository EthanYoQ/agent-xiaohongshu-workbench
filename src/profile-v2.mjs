import { buildXiaoshimeiStyleLock } from "./content-strategy.mjs";

export const PROFILE_SCHEMA = "xiaoshimei.profile.v2";
export const BENCHMARK_CLASSES = Object.freeze([
  "REALISTIC_PEER",
  "ASPIRATIONAL_REFERENCE",
  "SINGLE_POST_MECHANISM",
]);
export const BENCHMARK_CLASS_LABELS = Object.freeze({
  REALISTIC_PEER: "现实同级对标",
  ASPIRATIONAL_REFERENCE: "审美参照",
  SINGLE_POST_MECHANISM: "单篇机制样本",
});
export const PROFILE_FIELDS = Object.freeze([
  ["account_owner", "账号主体"],
  ["account_goal", "账号目标"],
  ["fixed_character_ip", "固定人物 IP"],
  ["media_constraint", "媒介约束"],
  ["story_thesis", "长期故事主线"],
  ["visual_atmosphere", "视觉氛围"],
]);

const CLASS_SET = new Set(BENCHMARK_CLASSES);
const STATUS_SET = new Set(["CONFIRMED", "CANDIDATE", "EVIDENCE_PENDING", "EXCLUDED"]);

function string(value, path, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) throw new TypeError(`${path} must be a non-empty string`);
  return value.trim();
}

function strings(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  return value.map((item, index) => string(item, `${path}[${index}]`));
}

function optionalString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePersona(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    role: optionalString(source.role, "聪明敏锐的个人IP，不装专家、不端着说教"),
    intelligence: optionalString(source.intelligence, "聪明、敏锐、会观察人和关系里的细节"),
    edge: optionalString(source.edge, "有判断、有一点锋芒，但不攻击普通观众"),
    kindness: optionalString(source.kindness, "本质善良，戳破窗户纸但不给人贴标签"),
    voice: optionalString(source.voice, "自然、清楚、有判断，少鸡汤、少权威腔、少营销号套话"),
  };
}

function normalizePortfolio(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const active = Array.isArray(source.active_pillars) ? source.active_pillars.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const experiments = Array.isArray(source.experiments) ? source.experiments.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return {
    active_pillars: active.length ? active : ["人性与关系", "东方生活", "传统文化", "古法养生"],
    experiments: experiments.length ? experiments : ["茶文化", "手作生活", "账号成长"],
  };
}

function benchmark(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`benchmark_pool[${index}] must be an object`);
  if (!CLASS_SET.has(value.class)) throw new TypeError(`benchmark_pool[${index}].class is not supported`);
  if (!STATUS_SET.has(value.status)) throw new TypeError(`benchmark_pool[${index}].status is not supported`);
  return {
    class: value.class,
    account: string(value.account, `benchmark_pool[${index}].account`),
    evidence: strings(value.evidence, `benchmark_pool[${index}].evidence`),
    transferable_mechanism: strings(value.transferable_mechanism, `benchmark_pool[${index}].transferable_mechanism`),
    exclusions: strings(value.exclusions, `benchmark_pool[${index}].exclusions`),
    status: value.status,
  };
}

export function createProfileV2() {
  return {
    schema: PROFILE_SCHEMA,
    persona: normalizePersona(),
    content_portfolio: normalizePortfolio(),
    account_owner: "个人内容账号",
    account_goal: "使用稳定品牌主体和清楚、克制的表达，把真实生活中的复杂问题讲明白。",
    fixed_character_ip: "使用账号档案中由用户确认的唯一品牌主体；未上传时只使用项目示例角色，不借用现成影视角色。",
    media_constraint: "IMAGE_FIRST：当前不依赖稳定视频拍摄条件，先以 4–8 页图文建立叙事与视觉辨识度。",
    story_thesis: "记录真实学习、生活实践与被现实修正的成长过程，不把构想冒充成已经发生的成果。",
    visual_atmosphere: "治愈系动画电影感 × 东方生活场景；自然、温暖、留白、轻叙事，不复刻在世艺术家或具体电影角色。",
    allowed_scene_elements: ["自然环境", "真实室内", "茶席", "纸灯", "木窗", "生活器物", "真实动作"],
    benchmark_pool: [
      {
        class: "REALISTIC_PEER",
        account: "待填写的现实同级账号",
        evidence: ["新工作区默认没有账号对标；需由用户补充并核验近期样本"],
        transferable_mechanism: ["个人视角进入传统文化", "人物与场景共同推进叙事"],
        exclusions: ["未核验前不得据此确定更新频率、选题配比或增长目标"],
        status: "EVIDENCE_PENDING",
      },
      {
        class: "ASPIRATIONAL_REFERENCE",
        account: "温暖东方生活插画",
        evidence: ["项目默认视觉方向：自然光、生活场景、留白与轻叙事"],
        transferable_mechanism: ["温暖自然光", "东方生活场景", "留白与轻叙事"],
        exclusions: ["不复制具体角色、镜头、画风签名或在世艺术家风格"],
        status: "CONFIRMED",
      },
      {
        class: "SINGLE_POST_MECHANISM",
        account: "步骤型信息图文",
        evidence: ["公开默认机制：动作化封面、步骤推进、人物与器物共同承载抽象信息"],
        transferable_mechanism: ["动作化封面", "按步骤组织长图文", "人物／动作／器物承载抽象文化"],
        exclusions: ["只是单篇结构机制，不是账号策略权威", "不证明任何地点、机构、课程、价格或招生事实"],
        status: "CONFIRMED",
      },
    ],
    claim_boundaries: [
      "机构、课程、价格、招生与开业信息必须来自当前可核验来源",
      "用户尚未提供或外部未核验的信息必须标成未知",
      "不得暗示官方关系、建成实景、疗效或资格认证",
      "对标互动只能作为需求信号，不能当购买验证",
    ],
    updated_at: new Date().toISOString(),
  };
}

export function normalizeProfileV2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== PROFILE_SCHEMA) {
    throw new TypeError("profile schema is not supported");
  }
  const profile = {
    schema: PROFILE_SCHEMA,
    persona: normalizePersona(value.persona),
    content_portfolio: normalizePortfolio(value.content_portfolio),
    account_owner: string(value.account_owner, "account_owner"),
    account_goal: string(value.account_goal, "account_goal"),
    fixed_character_ip: string(value.fixed_character_ip, "fixed_character_ip"),
    media_constraint: string(value.media_constraint, "media_constraint"),
    story_thesis: string(value.story_thesis, "story_thesis"),
    visual_atmosphere: string(value.visual_atmosphere, "visual_atmosphere"),
    allowed_scene_elements: strings(value.allowed_scene_elements, "allowed_scene_elements"),
    benchmark_pool: Array.isArray(value.benchmark_pool) ? value.benchmark_pool.map(benchmark) : (() => { throw new TypeError("benchmark_pool must be an array"); })(),
    claim_boundaries: strings(value.claim_boundaries, "claim_boundaries"),
    updated_at: string(value.updated_at, "updated_at"),
  };
  for (const className of BENCHMARK_CLASSES) {
    if (!profile.benchmark_pool.some((item) => item.class === className)) throw new TypeError(`benchmark_pool is missing ${className}`);
  }
  return profile;
}

export function parseProfileV2(serialized) {
  try { return normalizeProfileV2(JSON.parse(serialized)); }
  catch (error) {
    if (error instanceof SyntaxError) throw new TypeError("profile is not valid JSON");
    throw error;
  }
}

export function buildGenerationContract(profileValue) {
  const profile = normalizeProfileV2(profileValue);
  return {
    schema: "xiaoshimei.generation-profile-contract.v2",
    identity: {
      account_owner: profile.account_owner,
      account_goal: profile.account_goal,
      fixed_character_ip: profile.fixed_character_ip,
      story_thesis: profile.story_thesis,
      persona: profile.persona,
    },
    content_portfolio: profile.content_portfolio,
    media: { constraint: profile.media_constraint, visual_atmosphere: profile.visual_atmosphere, allowed_scene_elements: profile.allowed_scene_elements },
    account_strategy_peers: profile.benchmark_pool.filter((item) => item.class === "REALISTIC_PEER" && item.status === "CONFIRMED"),
    visual_references: profile.benchmark_pool.filter((item) => item.class === "ASPIRATIONAL_REFERENCE" && item.status !== "EXCLUDED").map(({ account, transferable_mechanism, exclusions }) => ({ account, transferable_mechanism, exclusions })),
    single_post_mechanisms: profile.benchmark_pool.filter((item) => item.class === "SINGLE_POST_MECHANISM" && item.status !== "EXCLUDED").map(({ account, transferable_mechanism, exclusions }) => ({ account, transferable_mechanism, exclusions })),
    claim_boundaries: profile.claim_boundaries,
    style_lock: buildXiaoshimeiStyleLock(profile),
  };
}
