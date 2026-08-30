import { normalizeLayerState } from "./layer-model.mjs";
import { compositionModeForPage, normalizeBackgroundStyle } from "./design-presets.mjs";
import { IMAGE_FRAME_MIN, IMAGE_SCALE_MAX, IMAGE_SCALE_MIN } from "./canvas-image.mjs";
import { normalizeContentStrategy, normalizeHighlightPhrases, normalizeShotRole, normalizeXhsPageRole } from "./content-strategy.mjs";
import { normalizeRealityFeedback } from "./reality-feedback.mjs";
import { normalizeProductionMode } from "./production-mode.mjs";
import { INFO_PANEL_SURFACE_COLOR, normalizeInfoPanels } from "./infographic-panels.mjs";
import { materializeEditablePanelLayouts, normalizeLayoutIr, normalizeLayoutRecipe } from "./smart-layout.mjs";
import { normalizeHtmlState } from "./html-layout.mjs";

// Reference authority: Desktop/ref. Body emphasis uses the darker reference
// orange; the cover renderer promotes it to the brighter display orange.
export const DEFAULT_ACCENT_COLOR = "#e6773d";

const PILLARS = {
  wellness: {
    label: "古法养生",
    eyebrow: "今天就能做",
    color: DEFAULT_ACCENT_COLOR,
    soft: "#ffffff",
    tag: "古法养生",
  },
  academy: {
    label: "书院成长",
    eyebrow: "书院筹备手记",
    color: DEFAULT_ACCENT_COLOR,
    soft: "#f1ded8",
    tag: "书院成长",
  },
  daoism: {
    label: "道家出海",
    eyebrow: "讲给世界听",
    color: DEFAULT_ACCENT_COLOR,
    soft: "#dcebf0",
    tag: "道家文化",
  },
  identity: {
    label: "账号成长",
    eyebrow: "把小师妹做成长期账号",
    color: DEFAULT_ACCENT_COLOR,
    soft: "#efe4d8",
    tag: "账号成长",
  },
  relationships: {
    label: "人性关系",
    eyebrow: "把没说透的关系讲清楚",
    color: DEFAULT_ACCENT_COLOR,
    soft: "#f2e4df",
    tag: "人性关系",
  },
  growth: {
    label: "成长观察",
    eyebrow: "把复杂的成长讲明白",
    color: DEFAULT_ACCENT_COLOR,
    soft: "#ebe9df",
    tag: "成长思考",
  },
  culture: {
    label: "东方生活",
    eyebrow: "传统进入今天的生活",
    color: DEFAULT_ACCENT_COLOR,
    soft: "#eee7d8",
    tag: "东方生活",
  },
};

const GOALS = {
  save: { label: "收藏", closing: "先收好，今晚就试一次。" },
  consult: { label: "咨询", closing: "如果你也卡在这里，把具体场景告诉我。" },
  visit: { label: "到访", closing: "想来现场体验，可以从一次真实课程开始。" },
};

const RISK_WORDS = ["治愈", "根治", "保证", "稳赚", "百分百", "立刻见效", "改命"];
const CONTENT_PACKAGE_SCHEMA = "xiaoshimei.content-package.v1";
const VISUAL_VERDICT_SCHEMA = "xiaoshimei.visual-verdict.v1";
const LAYOUTS = new Set(["cover", "statement", "split", "split-reverse", "list", "warning", "closing", "scene"]);
const VISUALS = new Set(["character", "none"]);
const STAGES = new Set(["PROBE_READY", "LOCAL_DRAFT", "FULL_DRAFT"]);
const SCALE_PERMISSIONS = new Set(["UNVERIFIED"]);
const REVIEW_SOURCES = new Set(["NONE", "USER", "RECEIPT_ATTACHED", "INDEPENDENT_EVIDENCE"]);
export const TEXT_FONT_FAMILIES = Object.freeze(["songti", "heiti", "kaiti", "fangsong", "yuanti", "pingfang"]);
const TEXT_FONT_FAMILY_SET = new Set(TEXT_FONT_FAMILIES);
const AUTHORIZED_PRODUCER_ADMISSIONS = new WeakMap();
const TRUSTED_PRODUCER_BINDINGS = Object.freeze([{
  episode_id: "XSM-260813-ACADEMY-01",
  task_hash: "b06f7f1de44a6483a50773386df6d49bd893c6f360927452cc64166a271bb937",
  input_hash: "cbb58f1b84f9938b2f4e73a3d6049a8690f3d8576306ad346727066c70cfea37",
  content_fingerprint_sha256: "d8022d0613446b4778b3edc24db9f528642e31093ca002ab20cabe46b19daf99",
  producer_artifact_sha256: "e5d24cba088056648e2e10e9a232a5113cd02a4f890125d01369e50e18c5bf31",
  producer_artifact_size: 7151,
  authority_verdict_sha256: "1ae41ebef8ec4effb5add28094cb00f34f3901b033bd58f59d81d1fee0705f3e",
  evaluator_input_sha256: "b1bdd3785b0f186332436a60739fc6073af763f8f20bc2f2d7ae4289b5ea4362",
}]);
const TRUSTED_EXPANSION_BINDINGS = Object.freeze([{
  expansion_id: "XSM-260813-ACADEMY-01-profile-v2-only-set-01",
  expansion_artifact_sha256: "35575ed9a87bb5c32edaeabcfbf5e015933892a57ee0e17e7d27f1b036c41887",
  expansion_artifact_size: 23936,
  handoff_sha256: "94d77dca777767a6a661d2c11ad43b25d9fb792ba9bb7427990a6e0fe60995b7",
  handoff_size: 3262,
  input_hash: "26802ee6df8434b86e930c5379dc68f9501e82c9090004582b645238aa6e0314",
  source_probe_fingerprint_sha256: "d8022d0613446b4778b3edc24db9f528642e31093ca002ab20cabe46b19daf99",
  content_fingerprint_sha256: "5c7c168437d628334205455c4abb26b0512d3c08928aa49b2c81d9509a5e7c28",
  page_count: 6,
}]);

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[。！？!?]+$/, "")
    .trim();
}

function shortTopic(value) {
  const cleaned = cleanText(value) || "忙碌之后，怎样把自己收回来";
  const first = cleaned.split(/[。；;！!？?]/)[0];
  return first.length > 28 ? `${first.slice(0, 27)}…` : first;
}

function titleSet(topic, pillar) {
  const base = shortTopic(topic);
  if (pillar === "academy") {
    return [
      `${base}，书院真正要解决什么？`,
      `一座仍在筹备的书院，先回答三个问题`,
      `我们为什么要把学习与日常生活放在一起`,
    ];
  }
  if (pillar === "daoism") {
    return [
      `${base}：别先把它当成神秘学`,
      `外国人问起${base}，我会这样解释`,
      `把道家文化讲清楚，比“翻译成英文”更难`,
    ];
  }
  if (pillar === "relationships") {
    return [
      `${base}，真正难受的可能不是表面这件事`,
      `很多关系变累，往往从这个细节开始`,
      `把这层窗户纸说透，你会更好判断`,
    ];
  }
  if (pillar === "growth") {
    return [
      `${base}，先别急着给自己下结论`,
      `真正拉开差距的，可能不是更努力`,
      `成长里最容易被忽略的一层`,
    ];
  }
  if (pillar === "culture") {
    return [
      `${base}，先把两种逻辑分开看`,
      `传统生活方式，差别藏在动作和秩序里`,
      `别急着比较高低，先看它们各自在解决什么`,
    ];
  }
  if (pillar === "identity") {
    return [
      `${base}，我想先把这件事做稳`,
      `小师妹为什么先从图文开始`,
      `先固定人物 IP，再慢慢长出内容`,
    ];
  }
  const firstClause = base.split(/[，,：:]/)[0] || base;
  const coverTopic = firstClause.length > 18 ? `${firstClause.slice(0, 18)}…` : firstClause;
  return [
    `${coverTopic}，先别硬扛`,
    `我从外企带走的一个恢复方法`,
    `真正消耗你的，可能不是忙`,
  ];
}

function bodyFor({ topic, pillar, goal }) {
  const base = shortTopic(topic);
  const close = GOALS[goal]?.closing || GOALS.save.closing;
  if (pillar === "academy") {
    return `很多人听到“书院”，先想到的是一个已经完成的空间。\n\n但真正需要先回答的是：谁会来、为什么来、离开时能带走什么。\n\n${base}，不是一句口号。它需要场地、内容、老师与每天可重复的行动共同回答；没有证据的部分仍然保持未知。\n\n${close}`;
  }
  if (pillar === "daoism") {
    return `向不同文化背景的人解释传统文化时，难点不是把中文逐字换成英文。\n\n${base}需要先交代它从哪里来、在什么语境里使用，也要分清历史事实、民间信仰和个人理解。\n\n神秘感可以吸引人，但边界与诚实才会留下信任。\n\n${close}`;
  }
  if (pillar === "relationships") {
    return `很多关系里的消耗，不是因为谁一定坏，而是两个人对同一件事的期待、边界和表达方式根本不在一条线上。\n\n${base}时，我更想先把“发生了什么”与“我们脑子里替对方补了什么”分开。很多冲突，真正升级的瞬间不是事件本身，而是解释开始失控。\n\n这不是教你操控别人，也不是给谁下诊断。只是帮你多看见一层，判断这段关系到底值得沟通、调整，还是应该离远一点。\n\n${close}`;
  }
  if (pillar === "growth") {
    return `成长最容易制造一种错觉：只要我再自律一点、再拼一点，就能把所有问题压过去。\n\n${base}时，不妨先区分能力问题、环境问题和节奏问题。三种问题用同一种“更努力”去解决，最后往往只剩疲惫。\n\n真正有效的改变通常没那么戏剧化，它更像是看清一个变量、改一个动作、再观察现实反馈。\n\n${close}`;
  }
  if (pillar === "culture") {
    return `很多传统文化主题一上来就容易讲成“谁更高级”。但真正有意思的地方，往往是不同文化为什么长出了不同的动作、器物和秩序。\n\n${base}时，我会先把各自的目的、流程和生活语境拆开，再看哪些差异是表面形式，哪些差异背后代表的是完全不同的价值取向。\n\n不急着站队，也不把复杂文化压成一句结论。先把差别讲清楚，再决定你更喜欢哪一种。\n\n${close}`;
  }
  if (pillar === "identity") {
    return `一开始没有稳定的视频拍摄条件，并不等于账号只能停在原地。\n\n${base}时，我更想先用图文把人物、语气和视觉气质做稳定。固定人物 IP 不是把自己锁死，而是让每一次出现都能被认出来。\n\n其他国风元素可以继续试，但它们只负责丰富场景，不能替代小师妹这个长期主角。参考喜欢的动画电影气质，也不等于直接使用任何已有版权角色。\n\n${close}`;
  }
  return `忙起来时，人很容易把疲惫理解成“再坚持一下”。但很多时候身体不是需要更用力，而是需要从同一个姿势和注意点里退出来。\n\n${base}时，先做一个最小动作：离开屏幕，脚掌踩实，呼气比吸气稍长。不要追求立刻放松，只观察肩、眼和下颌有没有松一点。\n\n这不是治疗，也不能替代就医。它只是帮你重新听见身体。\n\n${close}`;
}

function pagesFor({ topic, pillar, selectedTitle }) {
  const meta = PILLARS[pillar] || PILLARS.wellness;
  const base = shortTopic(topic);
  const shared = {
    accent: meta.color,
    soft: "#ffffff",
    background_style: { kind: "solid", color: "#ffffff", color2: "#ffffff", angle: 145, opacity: 1, imageSrc: "", focalX: 50, focalY: 50, scale: 100 },
  };
  if (pillar === "academy") {
    return [
      { ...shared, layout: "cover", eyebrow: meta.eyebrow, title: selectedTitle, body: "学习对象 · 内容路径 · 现实边界", visual: "character" },
      { ...shared, layout: "statement", eyebrow: "先回答一个问题", title: "我们要建的，不只是练功的地方", body: "它要让传统文化重新成为一种可体验、可重复的生活。", visual: "none" },
      { ...shared, layout: "split", eyebrow: "对孩子", title: "身体先有秩序", body: "力量、专注、礼仪与真实的同伴关系。", visual: "character" },
      { ...shared, layout: "split-reverse", eyebrow: "对成年人", title: "不是逃离生活", body: "是在呼吸、动作与安静里，重新拿回自己的节奏。", visual: "character" },
      { ...shared, layout: "list", eyebrow: "书院的三条线", title: "学习 · 实践 · 文化", body: "不同年龄的人，可以从不同动作进入同一套长期学习。", visual: "none" },
      { ...shared, layout: "warning", eyebrow: "我们不会做", title: "只剩表演的传统文化", body: "没有长期课程、真实老师与日常实践，再漂亮的场地也只是布景。", visual: "none" },
      { ...shared, layout: "closing", eyebrow: "仍在筹备", title: "让现实继续修改这张地图", body: "记录被保留的想法，也记录被现实推翻的部分。", visual: "character" },
    ];
  }
  if (pillar === "daoism") {
    return [
      { ...shared, layout: "cover", eyebrow: meta.eyebrow, title: selectedTitle, body: "英文讲述 · 文化语境 · 清楚边界", visual: "character" },
      { ...shared, layout: "statement", eyebrow: "第一步", title: "先说它是什么，再说它像什么", body: "类比能帮助理解，但类比不是定义。", visual: "none" },
      { ...shared, layout: "split", eyebrow: "事实层", title: "出处、年代与文本", body: "能查证的部分，用来源说话。", visual: "character" },
      { ...shared, layout: "split-reverse", eyebrow: "实践层", title: "谁在用，怎样用", body: "不同门派、地区与时代，不能揉成一个答案。", visual: "character" },
      { ...shared, layout: "list", eyebrow: "表达三分法", title: "事实 · 解释 · 信仰", body: "分开讲，观众才知道哪部分可以验证。", visual: "none" },
      { ...shared, layout: "warning", eyebrow: "边界", title: "神秘感不能代替准确", body: "不保证结果，不冒充权威，不把个人体验写成普遍事实。", visual: "none" },
      { ...shared, layout: "closing", eyebrow: "TAOISM IN ENGLISH", title: "让人听懂，也让文化保持原样", body: "下一期，从一个具体概念开始。", visual: "character" },
    ];
  }
  if (pillar === "identity") {
    return [
      { ...shared, layout: "cover", eyebrow: meta.eyebrow, title: selectedTitle, body: "先让人物、语气和视觉被认出来", visual: "character" },
      { ...shared, layout: "statement", eyebrow: "现实条件", title: "没有稳定视频条件，也能先开始", body: `${base}\n先用图文把账号的第一步走稳。`, visual: "none" },
      { ...shared, layout: "split", eyebrow: "先固定什么", title: "人物 IP 保持连续", body: "每次出现都像同一个小师妹，而不是每篇换一个主角。", visual: "character" },
      { ...shared, layout: "split-reverse", eyebrow: "可以变化什么", title: "国风元素服务于内容", body: "场景、器物和色彩可以变化，但不抢走人物辨识度。", visual: "character" },
      { ...shared, layout: "list", eyebrow: "视觉原则", title: "温柔 · 电影感 · 有生活气", body: "参考的是气质与节奏，不直接使用已有版权角色。", visual: "none" },
      { ...shared, layout: "warning", eyebrow: "不急着证明", title: "先别把每条内容都做成大制作", body: "先验证人物是否被记住，再逐步增加视频与复杂场景。", visual: "none" },
      { ...shared, layout: "closing", eyebrow: "小师妹的第一阶段", title: "先从稳定的一页图文开始", body: "把人物做熟，把表达做真，再决定下一步。", visual: "character" },
    ];
  }
  return [
    { ...shared, layout: "cover", eyebrow: meta.eyebrow, title: selectedTitle, body: `${base}\n一个不硬撑的恢复方法`, visual: "character" },
    { ...shared, layout: "statement", eyebrow: "你可能不是不够努力", title: "是身体一直没收到“可以停了”", body: "同一个姿势、同一个焦点、同一种紧张，持续太久都会消耗。", visual: "none" },
    { ...shared, layout: "split", eyebrow: "第 1 步", title: "先离开屏幕", body: "看向远处，让眼睛从持续近距离聚焦里退出来。", visual: "character" },
    { ...shared, layout: "split-reverse", eyebrow: "第 2 步", title: "脚掌踩实", body: "不急着挺胸。先感觉重量重新回到脚底。", visual: "character" },
    { ...shared, layout: "list", eyebrow: "第 3 步", title: "呼气稍微长一点", body: "做 3 轮就够。肩、眼、下颌，松一点就是有效反馈。", visual: "none" },
    { ...shared, layout: "warning", eyebrow: "别做错", title: "这不是治疗，也不是忍痛练习", body: "持续不适、疼痛或视力异常，请及时寻求专业帮助。", visual: "none" },
    { ...shared, layout: "closing", eyebrow: "今晚试一次", title: "先把自己从屏幕里领回来", body: "收藏这组动作，忙到发紧时再打开。", visual: "character" },
  ];
}

function normalizeLineage(value, path = "lineage") {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  const required = ["episode_id", "task_hash", "input_hash"];
  const lineage = Object.fromEntries(required.map((key) => [key, requireString(value[key], `${path}.${key}`)]));
  if (!/^[a-f0-9]{64}$/.test(lineage.task_hash) || !/^[a-f0-9]{64}$/.test(lineage.input_hash)) {
    throw new TypeError(`${path} hashes must be sha256`);
  }
  return lineage;
}

function normalizeReview(value, path = "review") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return {
    source: requireEnum(value.source, REVIEW_SOURCES, `${path}.source`),
    decision: requireString(value.decision, `${path}.decision`),
    reviewed_at: value.reviewed_at == null ? null : requireString(value.reviewed_at, `${path}.reviewed_at`),
    authority_effect: value.authority_effect == null
      ? "EVIDENCE_ONLY"
      : requireEnum(value.authority_effect, new Set(["EVIDENCE_ONLY"]), `${path}.authority_effect`),
  };
}

function emptyReview(decision = "PENDING") {
  return { source: "NONE", decision, reviewed_at: null, authority_effect: "EVIDENCE_ONLY" };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256Bytes(bytes) {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Text(value) {
  return sha256Bytes(new TextEncoder().encode(value));
}

function visualFingerprintPayload(contentPackage, evaluatedPageCount) {
  const pages = contentPackage.pages.slice(0, evaluatedPageCount).map((page) => {
    const defaultBrandStyle = normalizeObjectStyles().brand;
    const defaultPageNumberStyle = normalizeObjectStyles().page_number;
    const defaultLayers = normalizeLayerState();
    const hasOnlyLegacyDefaults = page.brand === "小师妹 · 东方生活实践"
      && canonicalJson(page.object_styles?.brand) === canonicalJson(defaultBrandStyle)
      && canonicalJson(page.object_styles?.page_number) === canonicalJson(defaultPageNumberStyle)
      && canonicalJson(page.layer_state) === canonicalJson(defaultLayers);
    if (!hasOnlyLegacyDefaults) return page;
    const { brand: _brand, layer_state: _layerState, object_styles: objectStyles, ...legacyPage } = page;
    const { brand: _brandStyle, page_number: _pageNumberStyle, ...legacyObjectStyles } = objectStyles;
    const defaultStyles = normalizeObjectStyles();
    const fingerprintStyles = Object.fromEntries(Object.entries(legacyObjectStyles).map(([key, style]) => {
      if (style.fontFamily !== defaultStyles[key]?.fontFamily) return [key, style];
      const { fontFamily: _defaultFontFamily, ...legacyStyle } = style;
      return [key, legacyStyle];
    }));
    // Frozen Profile-v2 expansion artifacts predate the explicit fit field.
    // Keep their admitted fingerprint stable while modern drafts retain fit as
    // an editable, hash-bound property.
    if (contentPackage.origin?.expansion_id && legacyPage.image_style?.fit === "contain") {
      const { fit: _legacyFit, ...legacyImageStyle } = legacyPage.image_style;
      return { ...legacyPage, image_style: legacyImageStyle, object_styles: fingerprintStyles };
    }
    return { ...legacyPage, object_styles: fingerprintStyles };
  });
  return {
    profile: contentPackage.profile,
    source_input: contentPackage.source_input,
    pillar: contentPackage.pillar,
    goal: contentPackage.goal,
    titles: contentPackage.titles,
    selectedTitle: contentPackage.selectedTitle,
    body: contentPackage.body,
    tags: contentPackage.tags,
    pages,
    facts: contentPackage.facts,
    risks: contentPackage.risks,
    lineage: contentPackage.lineage,
  };
}

export async function visualContentSha256(contentPackage, evaluatedPageCount = 2) {
  if (!Number.isInteger(evaluatedPageCount) || evaluatedPageCount < 1 || evaluatedPageCount > contentPackage.pages.length) {
    throw new TypeError("evaluated page count is not supported");
  }
  const bytes = new TextEncoder().encode(canonicalJson(visualFingerprintPayload(contentPackage, evaluatedPageCount)));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function invalidateVisualReview(contentPackage) {
  if (!new Set(["RECEIPT_ATTACHED", "INDEPENDENT_EVIDENCE"]).has(contentPackage.review?.source)) return contentPackage;
  return { ...contentPackage, review: emptyReview("CONTENT_CHANGED_AFTER_REVIEW") };
}

export function generateContentPackage(input = {}) {
  const pillar = PILLARS[input.pillar] ? input.pillar : "wellness";
  const goal = GOALS[input.goal] ? input.goal : "save";
  const topic = cleanText(input.topic);
  const titles = titleSet(topic, pillar);
  const selectedTitle = titles[0];
  const risks = RISK_WORDS.filter((word) => topic.includes(word));
  const meta = PILLARS[pillar];
  return {
    schema_version: CONTENT_PACKAGE_SCHEMA,
    created_at: new Date().toISOString(),
    profile: "xiaoshimei.v1",
    source_input: topic,
    pillar,
    goal,
    titles,
    selectedTitle,
    body: bodyFor({ topic, pillar, goal }),
    tags: [meta.tag, "传统文化", "东方生活方式", "女性成长", goal === "visit" ? "线下体验" : "自我照顾"],
    pages: pagesFor({ topic, pillar, selectedTitle }).map(normalizePage),
    facts: [],
    risks,
    stage: "PROBE_READY",
    scale_permission: "UNVERIFIED",
    visible_pages: 2,
    lineage: normalizeLineage(input.lineage),
    review: emptyReview(),
    generation: { mode: "DEMO_TEMPLATE", provider: null, notice: "演示模板，不是 AI 生成" },
  };
}

function requireString(value, path) {
  if (typeof value !== "string") {
    throw new TypeError(`${path} must be a string`);
  }
  return value;
}

function requireStringList(value, path, expectedLength) {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new TypeError(`${path} must contain ${expectedLength} items`);
  }
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function requireEnum(value, allowed, path) {
  if (!allowed.has(value)) {
    throw new TypeError(`${path} is not supported`);
  }
  return value;
}

function normalizeTextStyle(value = {}, path = "text_style", { minWidth = 20 } = {}) {
  const number = (key, fallback, low, high) => {
    const result = Number(value[key] ?? fallback);
    if (!Number.isFinite(result) || result < low || result > high) throw new TypeError(`${path}.${key} is outside the editor contract`);
    return result;
  };
  const align = value.align ?? "left";
  if (!["left", "center", "right"].includes(align)) throw new TypeError(`${path}.align is not supported`);
  const color = value.color ?? "#17211e";
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) throw new TypeError(`${path}.color is invalid`);
  const fontFamily = value.fontFamily ?? "heiti";
  if (!TEXT_FONT_FAMILY_SET.has(fontFamily)) throw new TypeError(`${path}.fontFamily is not supported`);
  const backgroundColor = value.backgroundColor;
  if (backgroundColor != null && (typeof backgroundColor !== "string" || !/^#[0-9a-f]{6}$/i.test(backgroundColor))) throw new TypeError(`${path}.backgroundColor is invalid`);
  const backgroundOpacity = value.backgroundOpacity;
  if (backgroundOpacity != null && (!Number.isFinite(Number(backgroundOpacity)) || Number(backgroundOpacity) < 0 || Number(backgroundOpacity) > 1)) throw new TypeError(`${path}.backgroundOpacity is invalid`);
  const backgroundRadius = value.backgroundRadius;
  if (backgroundRadius != null && (!Number.isFinite(Number(backgroundRadius)) || Number(backgroundRadius) < 0 || Number(backgroundRadius) > 60)) throw new TypeError(`${path}.backgroundRadius is invalid`);
  return {
    x: number("x", 8, 0, 80),
    // The editor exposes 0–90 so users can safely move short cover captions
    // below the action zone. Export-time geometry remains the final overflow
    // gate for objects whose rendered height would cross the canvas edge.
    y: number("y", 8, 0, 96),
    width: number("width", 76, minWidth, 92),
    fontSize: number("fontSize", 72, 16, 132),
    fontWeight: number("fontWeight", 700, 400, 900),
    lineHeight: number("lineHeight", 1.14, 0.9, 2),
    fontFamily,
    align,
    color,
    ...(backgroundColor != null ? { backgroundColor } : {}),
    ...(backgroundOpacity != null ? { backgroundOpacity: Number(backgroundOpacity) } : {}),
    ...(backgroundRadius != null ? { backgroundRadius: Number(backgroundRadius) } : {}),
  };
}

function normalizeObjectStyles(value = {}, path = "object_styles") {
  return {
    eyebrow: normalizeTextStyle({ x: 8, y: 7, width: 45, fontSize: 28, fontWeight: 700, lineHeight: 1.1, fontFamily: "heiti", color: "#ffffff", ...(value.eyebrow || {}) }, `${path}.eyebrow`),
    title: normalizeTextStyle({ x: 8, y: 14, width: 76, fontSize: 72, fontWeight: 800, lineHeight: 1.1, fontFamily: "songti", color: "#17211e", ...(value.title || {}) }, `${path}.title`),
    body: normalizeTextStyle({ x: 8, y: 42, width: 66, fontSize: 34, fontWeight: 400, lineHeight: 1.56, fontFamily: "heiti", color: "#394843", ...(value.body || {}) }, `${path}.body`),
    brand: normalizeTextStyle({ x: 6.5, y: 92, width: 45, fontSize: 22, fontWeight: 600, lineHeight: 1.1, fontFamily: "heiti", color: "#1f5948", ...(value.brand || {}) }, `${path}.brand`),
    page_number: normalizeTextStyle({ x: 73, y: 92, width: 20, fontSize: 22, fontWeight: 600, lineHeight: 1.1, fontFamily: "heiti", align: "right", color: "#68736f", ...(value.page_number || {}) }, `${path}.page_number`, { minWidth: 10 }),
  };
}

function normalizeImageStyle(value = {}, path = "image_style", { defaultScale = 108 } = {}) {
  const focalX = Number(value.focalX ?? 58);
  const focalY = Number(value.focalY ?? 50);
  const allowLetterbox = value.allowLetterbox === true;
  const preferredAspect = value.preferred_aspect == null ? null : String(value.preferred_aspect).trim();
  if (preferredAspect != null && preferredAspect !== "3:4") throw new TypeError(`${path}.preferred_aspect is invalid`);
  if (![focalX, focalY].every((item) => Number.isFinite(item) && item >= 0 && item <= 100)) throw new TypeError(`${path} focal point is invalid`);
  const frame = value.frame;
  const rotation = Number(value.rotation);
  const opacity = Number(value.opacity);
  const normalizedFrame = frame && typeof frame === "object" && !Array.isArray(frame)
    ? Object.fromEntries([["x", 0, 92], ["y", 0, 92], ["width", IMAGE_FRAME_MIN, 100], ["height", IMAGE_FRAME_MIN, 100]].map(([key, low, high]) => {
      const number = Number(frame[key]);
      if (!Number.isFinite(number) || number < low || number > high) throw new TypeError(`${path}.frame.${key} is invalid`);
      return [key, number];
    }))
    : null;
  const crop = value.crop && typeof value.crop === "object" && !Array.isArray(value.crop)
    ? Object.fromEntries([["x", 0, 0], ["y", 0, 0], ["width", 0.05, 1], ["height", 0.05, 1]].map(([key, low, fallback]) => {
      const number = Number(value.crop[key] ?? fallback);
      if (!Number.isFinite(number) || number < low || number > 1) throw new TypeError(`${path}.crop.${key} is invalid`);
      return [key, number];
    }))
    : null;
  if (crop && (crop.x + crop.width > 1.000001 || crop.y + crop.height > 1.000001)) throw new TypeError(`${path}.crop exceeds the source image`);
  return {
    src: typeof value.src === "string" && value.src ? value.src : "/assets/xiaoshimei-character.png",
    focalX,
    focalY,
    // A page image is a masked object by default. Upgrade legacy 100%
    // contain images to a small bleed; explicit "完整显示" keeps its
    // letterbox behavior through the opt-in allowLetterbox marker.
    scale: (() => {
      const requested = Number(value.scale);
      const hasRequestedScale = Number.isFinite(requested) && requested >= IMAGE_SCALE_MIN && requested <= IMAGE_SCALE_MAX;
      // 108% was the previous global default. On the cover, migrate that
      // legacy default back to 100% so the portrait source stays sharper.
      if (!allowLetterbox && defaultScale === 100 && (!hasRequestedScale || requested === 108)) return 100;
      return hasRequestedScale ? (allowLetterbox ? requested : Math.max(defaultScale, requested)) : (allowLetterbox ? 100 : defaultScale);
    })(),
    ...(value.rotation != null && Number.isFinite(rotation) && rotation >= -180 && rotation <= 180 ? { rotation } : {}),
    ...(value.opacity != null && Number.isFinite(opacity) && opacity >= 0.1 && opacity <= 1 ? { opacity } : {}),
    fit: allowLetterbox ? "contain" : "cover",
    ...(preferredAspect ? { preferred_aspect: preferredAspect } : {}),
    ...(allowLetterbox ? { allowLetterbox: true } : {}),
    ...(normalizedFrame ? { frame: normalizedFrame } : {}),
    ...(crop ? { crop } : {}),
  };
}

function normalizeEditorState(value, path = "editor_state") {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path} must be an object`);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new TypeError(`${path} must be JSON serializable`);
  }
}

function normalizePage(page, index) {
  if (!page || typeof page !== "object" || Array.isArray(page)) {
    throw new TypeError(`pages[${index}] must be an object`);
  }
  let backgroundStyle = normalizeBackgroundStyle(page.background_style, page.soft);
  const templateId = typeof page.template_id === "string" && page.template_id.trim() ? page.template_id.trim() : null;
  const compositionMode = compositionModeForPage(page);
  const pageRole = page.page_role == null ? null : normalizeXhsPageRole(page.page_role, `pages[${index}].page_role`);
  const shotRole = normalizeShotRole(page.shot_role, `pages[${index}].shot_role`, null);
  const highlightPhrases = normalizeHighlightPhrases(page.highlight_phrases, `${page.title || ""}\n${page.body || ""}`, `pages[${index}].highlight_phrases`);
  const visualAction = typeof page.visual_action === "string" && page.visual_action.trim() ? page.visual_action.trim().slice(0, 400) : null;
  const imagePrompt = typeof page.image_prompt === "string" && page.image_prompt.trim() ? page.image_prompt.trim().slice(0, 1800) : null;
  // Preserve the admitted legacy composition exactly. Only assets that carry
  // the new 3:4 transport contract opt out of the historical 108% bleed.
  const defaultImageScale = page.image_style?.preferred_aspect === "3:4"
    ? 100
    : page.layout === "scene" ? 100 : 108;
  const normalizedImageStyle = normalizeImageStyle(page.image_style, `pages[${index}].image_style`, { defaultScale: defaultImageScale });
  const coverFrameMigration = page.layout === "scene" && normalizedImageStyle.frame && normalizedImageStyle.frame.width >= 70
    ? { x: 28, y: 4, width: 64, height: 50 }
    : normalizedImageStyle.frame;
  const imageStyle = { ...normalizedImageStyle, ...(coverFrameMigration ? { frame: coverFrameMigration } : {}) };
  let infoPanels = normalizeInfoPanels(page.info_panels, imageStyle.src, `pages[${index}].info_panels`);
  const usesMotherSheetTiles = infoPanels.length > 0 && infoPanels.every((panel) => /\/generated\/ark\/[^/]+\/sheet-\d+-unit-\d+\.png$/i.test(panel.image_style.src));
  const usesLegacyPanelSurface = usesMotherSheetTiles && infoPanels.every((panel) => panel.text_style.backgroundColor.toLowerCase() === "#fffaf1" && panel.text_style.backgroundOpacity === 0.9);
  if (usesLegacyPanelSurface) {
    infoPanels = infoPanels.map((panel) => ({
      ...panel,
      text_style: { ...panel.text_style, backgroundColor: INFO_PANEL_SURFACE_COLOR, backgroundOpacity: 0.94, backgroundRadius: 12 },
    }));
    if (!backgroundStyle || String(backgroundStyle.color).toLowerCase() === String(page.soft).toLowerCase()) {
      backgroundStyle = { ...(backgroundStyle || {}), kind: "solid", color: INFO_PANEL_SURFACE_COLOR, color2: "#ffffff", angle: 145, opacity: 1, imageSrc: "", focalX: 50, focalY: 50, scale: 100 };
    }
  }
  const layoutRecipe = normalizeLayoutRecipe(page.layout_recipe, null);
  const layoutIr = normalizeLayoutIr(page.layout_ir, infoPanels.map((panel) => panel.id), infoPanels);
  const editorState = normalizeEditorState(page.editor_state, `pages[${index}].editor_state`);
  const editorMode = page.editor_mode == null ? null : requireEnum(page.editor_mode, new Set(["html", "fabric"]), `pages[${index}].editor_mode`);
  const htmlState = page.html_state == null ? null : normalizeHtmlState(page.html_state, { ...page, info_panels: infoPanels }, index);
  let objectStyles = normalizeObjectStyles(page.object_styles, `pages[${index}].object_styles`);
  if (!page.object_styles?.brand?.color && String(page.accent).toLowerCase() === DEFAULT_ACCENT_COLOR) {
    objectStyles = { ...objectStyles, brand: { ...objectStyles.brand, color: DEFAULT_ACCENT_COLOR } };
  }
  if (usesLegacyPanelSurface) {
    const titleLength = String(page.title || "").replace(/\s/g, "").length;
    objectStyles = {
      ...objectStyles,
      eyebrow: { ...objectStyles.eyebrow, x: 7, y: 4.5, width: 48, fontSize: 24, color: "#78533c" },
      title: { ...objectStyles.title, x: 7, y: 8.5, width: 86, fontSize: titleLength > 18 ? 54 : 60, lineHeight: 1.08 },
      brand: { ...objectStyles.brand, x: 7, y: 94, width: 42 },
      page_number: { ...objectStyles.page_number, x: 82, y: 94, width: 11, align: "right" },
    };
  }
  return {
    accent: requireString(page.accent, `pages[${index}].accent`),
    soft: usesLegacyPanelSurface ? INFO_PANEL_SURFACE_COLOR : requireString(page.soft, `pages[${index}].soft`),
    layout: requireEnum(page.layout, LAYOUTS, `pages[${index}].layout`),
    eyebrow: requireString(page.eyebrow, `pages[${index}].eyebrow`),
    title: requireString(page.title, `pages[${index}].title`),
    body: requireString(page.body, `pages[${index}].body`),
    brand: typeof page.brand === "string" && page.brand.trim() ? page.brand : "小师妹 · 东方生活实践",
    visual: requireEnum(page.visual, VISUALS, `pages[${index}].visual`),
    object_styles: objectStyles,
    image_style: imageStyle,
    ...(infoPanels.length ? { info_panels: infoPanels } : {}),
    ...(layoutRecipe ? { layout_recipe: layoutRecipe } : {}),
    ...(layoutIr ? { layout_ir: layoutIr } : {}),
    ...(editorState ? { editor_state: editorState } : {}),
    ...(editorMode ? { editor_mode: editorMode } : {}),
    ...(htmlState ? { html_state: htmlState } : {}),
    layer_state: normalizeLayerState(page.layer_state),
    ...(pageRole ? { page_role: pageRole } : {}),
    ...(shotRole ? { shot_role: shotRole } : {}),
    ...(highlightPhrases.length ? { highlight_phrases: highlightPhrases } : {}),
    ...(visualAction ? { visual_action: visualAction } : {}),
    ...(imagePrompt ? { image_prompt: imagePrompt } : {}),
    ...(backgroundStyle ? { background_style: backgroundStyle } : {}),
    ...(templateId ? { template_id: templateId } : {}),
    ...(compositionMode !== "manual" || page.composition_mode === "manual" ? { composition_mode: compositionMode } : {}),
  };
}

export function parseContentPackage(serialized) {
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new TypeError("content package is not valid JSON");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("content package must be an object");
  }
  if (value.schema_version !== CONTENT_PACKAGE_SCHEMA) {
    throw new TypeError("content package schema is not supported");
  }
  if (!Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 8) {
    throw new TypeError("pages must contain 1 to 8 items");
  }

  const pillar = requireEnum(value.pillar, new Set(Object.keys(PILLARS)), "pillar");
  const goal = requireEnum(value.goal, new Set(Object.keys(GOALS)), "goal");
  const titles = requireStringList(value.titles, "titles", 3);
  const selectedTitle = requireString(value.selectedTitle, "selectedTitle");
  if (!titles.includes(selectedTitle)) {
    throw new TypeError("selectedTitle must match a title candidate");
  }

  const stage = requireEnum(value.stage, STAGES, "stage");
  const legacyLocalExpansion = value.scale_permission === "ALLOWED";
  const legacyIndependentClaim = value.scale_permission === "INDEPENDENT_KEEP";
  const scalePermission = legacyLocalExpansion || legacyIndependentClaim
    ? "UNVERIFIED"
    : requireEnum(value.scale_permission, SCALE_PERMISSIONS, "scale_permission");
  const expectedVisiblePages = stage === "PROBE_READY"
    ? Math.min(2, value.pages.length)
    : stage === "LOCAL_DRAFT"
      ? Number(value.visible_pages)
      : value.pages.length;
  if (!Number.isInteger(expectedVisiblePages) || expectedVisiblePages < 1 || expectedVisiblePages > value.pages.length) {
    throw new TypeError("visible_pages is outside the local editor contract");
  }
  if (value.visible_pages !== expectedVisiblePages) {
    throw new TypeError(`visible_pages must be ${expectedVisiblePages}`);
  }
  const lineage = normalizeLineage(value.lineage);
  const importedReview = value.review == null
    ? {
      source: legacyLocalExpansion ? "USER" : "NONE",
      decision: legacyLocalExpansion ? "LEGACY_LOCAL_EXPANSION" : legacyIndependentClaim ? "LEGACY_UNVERIFIED_KEEP_CLAIM" : "PENDING",
      reviewed_at: null,
      authority_effect: "EVIDENCE_ONLY",
    }
    : normalizeReview(value.review);
  const review = new Set(["RECEIPT_ATTACHED", "INDEPENDENT_EVIDENCE"]).has(importedReview.source)
    ? emptyReview("IMPORTED_EVIDENCE_REQUIRES_REATTACH")
    : importedReview;

  const contentPackage = {
    schema_version: CONTENT_PACKAGE_SCHEMA,
    created_at: requireString(value.created_at, "created_at"),
    profile: requireString(value.profile, "profile"),
    source_input: requireString(value.source_input, "source_input"),
    pillar,
    goal,
    titles,
    selectedTitle,
    body: requireString(value.body, "body"),
    tags: requireStringList(value.tags, "tags", 5),
    pages: materializeEditablePanelLayouts(value.pages.map(normalizePage)),
    facts: Array.isArray(value.facts) ? structuredClone(value.facts) : [],
    risks: Array.isArray(value.risks) ? structuredClone(value.risks) : [],
    stage,
    scale_permission: scalePermission,
    visible_pages: expectedVisiblePages,
    lineage,
    review,
    generation: value.generation && typeof value.generation === "object"
      ? {
        mode: requireEnum(value.generation.mode, new Set(["DEMO_TEMPLATE", "PROVIDER"]), "generation.mode"),
        provider: value.generation.provider == null ? null : requireString(value.generation.provider, "generation.provider"),
        ...(value.generation.production_mode == null ? {} : { production_mode: normalizeProductionMode(value.generation.production_mode, "generation.production_mode") }),
        notice: requireString(value.generation.notice, "generation.notice"),
      }
      : { mode: "DEMO_TEMPLATE", provider: null, notice: "演示模板，不是 AI 生成" },
  };

  if (value.content_strategy != null) contentPackage.content_strategy = normalizeContentStrategy(value.content_strategy);
  if (value.reality_feedback != null) contentPackage.reality_feedback = normalizeRealityFeedback(value.reality_feedback);
  if (typeof value.id === "string") contentPackage.id = value.id;
  if (typeof value.saved_at === "string") contentPackage.saved_at = value.saved_at;
  if (value.origin && typeof value.origin === "object" && !Array.isArray(value.origin)) {
    contentPackage.origin = {
      contract: requireString(value.origin.contract, "origin.contract"),
      source_probe_fingerprint_sha256: requireString(value.origin.source_probe_fingerprint_sha256, "origin.source_probe_fingerprint_sha256"),
      producer_artifact_sha256: requireString(value.origin.producer_artifact_sha256, "origin.producer_artifact_sha256"),
      authority_scope: requireString(value.origin.authority_scope, "origin.authority_scope"),
      ...(value.origin.expansion_id == null ? {} : {
        expansion_id: requireString(value.origin.expansion_id, "origin.expansion_id"),
        expansion_artifact_sha256: requireString(value.origin.expansion_artifact_sha256, "origin.expansion_artifact_sha256"),
        expansion_input_hash: requireString(value.origin.expansion_input_hash, "origin.expansion_input_hash"),
        expansion_content_fingerprint_sha256: requireString(value.origin.expansion_content_fingerprint_sha256, "origin.expansion_content_fingerprint_sha256"),
      }),
    };
  }
  return contentPackage;
}

export function expandProbe(contentPackage) {
  throw new Error("WAIT_INDEPENDENT_VERDICT: local workbench cannot expand to 4–8 pages");
}

export function inspectImportContract(value) {
  let packageValue;
  try { packageValue = typeof value === "string" ? JSON.parse(value) : value; }
  catch { return { status: "REJECTED", contract: "UNKNOWN", code: "INVALID_JSON" }; }
  if (!packageValue || typeof packageValue !== "object" || Array.isArray(packageValue)) {
    return { status: "REJECTED", contract: "UNKNOWN", code: "PACKAGE_NOT_OBJECT" };
  }
  if (packageValue.schema_version !== CONTENT_PACKAGE_SCHEMA) {
    return { status: "REJECTED", contract: "UNKNOWN", code: "SCHEMA_UNSUPPORTED" };
  }
  if (!Array.isArray(packageValue.pages)) {
    return { status: "REJECTED", contract: "UNKNOWN", code: "PAGES_MISSING" };
  }
  const producerShape = packageValue.pages.length === 2 && packageValue.pages.every((page) => page && typeof page.visible_text === "object" && typeof page.editable_design === "object");
  if (producerShape) {
    const lineage = packageValue.lineage;
    if (!lineage || typeof lineage.episode_id !== "string" || !/^[a-f0-9]{64}$/.test(lineage.task_hash || "") || !/^[a-f0-9]{64}$/.test(lineage.input_hash || "")) {
      return { status: "REJECTED", contract: "PRODUCER_TWO_PAGE", code: "PRODUCER_LINEAGE_INVALID", page_count: 2 };
    }
    return {
      status: "WAIT_INDEPENDENT_VERDICT",
      contract: "PRODUCER_TWO_PAGE",
      code: "WAIT_INDEPENDENT_VERDICT",
      page_count: 2,
      lineage,
    };
  }
  if (packageValue.pages.length === 7 && packageValue.pages.every((page) => typeof page.title === "string")) {
    return { status: "READY", contract: "LEGACY_SEVEN_PAGE", code: "LEGACY_COMPATIBLE", page_count: 7 };
  }
  const localDraftShape = packageValue.pages.length >= 1
    && packageValue.pages.length <= 8
    && packageValue.pages.every((page) => page
      && typeof page.title === "string"
      && typeof page.body === "string"
      && page.object_styles && typeof page.object_styles === "object"
      && page.image_style && typeof page.image_style === "object");
  if (localDraftShape) {
    try { parseContentPackage(JSON.stringify(packageValue)); }
    catch { return { status: "REJECTED", contract: "LOCAL_EDITABLE_DRAFT", code: "LOCAL_DRAFT_INVALID", page_count: packageValue.pages.length }; }
    return { status: "READY", contract: "LOCAL_EDITABLE_DRAFT", code: "LOCAL_DRAFT_COMPATIBLE", page_count: packageValue.pages.length };
  }
  return { status: "REJECTED", contract: "UNKNOWN", code: "PAGE_CONTRACT_UNSUPPORTED", page_count: packageValue.pages.length };
}

export function importLocalEditableDraft(serialized) {
  const inspection = inspectImportContract(serialized);
  if (inspection.contract !== "LOCAL_EDITABLE_DRAFT" && inspection.contract !== "LEGACY_SEVEN_PAGE") {
    throw new TypeError("local editable draft contract is required");
  }
  const parsed = parseContentPackage(serialized);
  return {
    ...parsed,
    stage: "LOCAL_DRAFT",
    scale_permission: "UNVERIFIED",
    visible_pages: parsed.pages.length,
    review: emptyReview("IMPORTED_LOCAL_DRAFT_REQUIRES_REVIEW"),
    generation: {
      ...parsed.generation,
      notice: "本地可编辑草稿已回载；历史血缘保留，但不携带实时 admission 或发布权限",
    },
  };
}

function sameArtifactRef(left, right) {
  return left && right
    && typeof left.path === "string" && left.path === right.path
    && /^[a-f0-9]{64}$/.test(left.sha256 || "") && left.sha256 === right.sha256
    && Number.isInteger(left.size_bytes) && left.size_bytes > 0 && left.size_bytes === right.size_bytes;
}

function producerPageToLocal(page, index, assets) {
  const visible = page.visible_text;
  const cover = index === 0;
  const body = cover
    ? [visible.promise, visible.three_lines, visible.boundary].filter(Boolean).join("\n\n")
    : [visible.subtitle, visible.youth, visible.adult, visible.culture, visible.shared_outcome, visible.boundary, visible.known, visible.unknown].filter(Boolean).join("\n\n");
  return normalizePage({
    accent: cover ? "#a65343" : "#66715e",
    soft: cover ? "#f5f0e6" : "#ece9dd",
    layout: cover ? "cover" : "list",
    eyebrow: visible.eyebrow || (cover ? "书院筹备构想" : "最关键的一页"),
    title: visible.title,
    body,
    visual: cover ? "character" : "none",
    object_styles: cover ? undefined : {
      title: { x: 7, y: 10, width: 84, fontSize: 62, fontWeight: 800, lineHeight: 1.16, color: "#2b302a" },
      body: { x: 7, y: 32, width: 84, fontSize: 30, fontWeight: 400, lineHeight: 1.48, color: "#3e493c" },
    },
    image_style: { src: cover ? assets.cover : assets.inner, focalX: 50, focalY: 50, scale: 100 },
  }, index);
}

export async function admitProducerWithVerdict(serialized, verdictSerialized, evaluatorInputSerialized, assets = {}) {
  const inspection = inspectImportContract(serialized);
  if (inspection.contract !== "PRODUCER_TWO_PAGE") throw new TypeError("Producer two-page contract is required");
  if (typeof verdictSerialized !== "string" || typeof evaluatorInputSerialized !== "string") throw new TypeError("raw authority files are required");
  const producer = JSON.parse(serialized);
  const verdict = JSON.parse(verdictSerialized);
  const evaluatorInput = JSON.parse(evaluatorInputSerialized);
  const verdictSha = await sha256Text(verdictSerialized);
  const evaluatorInputSha = await sha256Text(evaluatorInputSerialized);
  const artifact = verdict?.evaluated_artifact_ref;
  const inputArtifact = evaluatorInput?.evaluated_artifact_ref;
  const packageRef = evaluatorInput?.content_package_ref;
  const bytes = new TextEncoder().encode(serialized);
  const actualSha = await sha256Text(serialized);
  const lineage = normalizeLineage(producer.lineage, "producer.lineage");
  const trusted = TRUSTED_PRODUCER_BINDINGS.find((binding) => binding.authority_verdict_sha256 === verdictSha && binding.evaluator_input_sha256 === evaluatorInputSha);
  if (
    !trusted
    ||
    verdict?.schema !== VISUAL_VERDICT_SCHEMA
    || verdict.decision !== "KEEP"
    || verdict.evaluator_id !== "independent-xiaoshimei-evaluator"
    || verdict.evaluated_page_count !== 2
    || evaluatorInput?.schema !== "xiaoshimei.visual-evaluator-input.v1"
    || evaluatorInput.evaluated_page_count !== 2
    || !sameArtifactRef(artifact, inputArtifact)
    || !sameArtifactRef(artifact, packageRef)
    || artifact.sha256 !== actualSha
    || artifact.size_bytes !== bytes.byteLength
    || verdict.content_fingerprint_sha256 !== evaluatorInput.content_fingerprint_sha256
    || !/^[a-f0-9]{64}$/.test(verdict.content_fingerprint_sha256 || "")
    || verdict.episode_id !== lineage.episode_id
    || verdict.task_hash !== lineage.task_hash
    || verdict.input_hash !== lineage.input_hash
    || evaluatorInput.episode_id !== lineage.episode_id
    || evaluatorInput.task_hash !== lineage.task_hash
    || evaluatorInput.input_hash !== lineage.input_hash
    || trusted.episode_id !== lineage.episode_id
    || trusted.task_hash !== lineage.task_hash
    || trusted.input_hash !== lineage.input_hash
    || trusted.content_fingerprint_sha256 !== verdict.content_fingerprint_sha256
    || trusted.producer_artifact_sha256 !== actualSha
    || trusted.producer_artifact_size !== bytes.byteLength
  ) throw new TypeError("authoritative KEEP does not match the Producer artifact");

  const titles = requireStringList(producer.titles, "producer.titles", 3);
  const selectedTitle = requireString(producer.selectedTitle, "producer.selectedTitle");
  if (!titles.includes(selectedTitle)) throw new TypeError("producer.selectedTitle must match a title candidate");
  const pages = producer.pages.map((page, index) => producerPageToLocal(page, index, {
    cover: assets.cover || "/imported/XSM-260813-ACADEMY-01/cover.png",
    inner: assets.inner || "/imported/XSM-260813-ACADEMY-01/hardest-inner.png",
  }));
  const content = {
    schema_version: CONTENT_PACKAGE_SCHEMA,
    created_at: requireString(producer.created_at, "producer.created_at"),
    profile: requireString(producer.profile, "producer.profile"),
    source_input: requireString(producer.source_input, "producer.source_input"),
    pillar: "academy",
    goal: "save",
    titles,
    selectedTitle,
    body: requireString(producer.body, "producer.body"),
    tags: requireStringList(producer.tags, "producer.tags", 5),
    pages,
    facts: structuredClone(producer.facts || []),
    risks: structuredClone(producer.risks || []),
    stage: "PROBE_READY",
    scale_permission: "UNVERIFIED",
    visible_pages: 2,
    lineage,
    review: { source: "INDEPENDENT_EVIDENCE", decision: "KEEP", reviewed_at: verdict.reviewed_at, authority_effect: "EVIDENCE_ONLY" },
    generation: { mode: "PROVIDER", provider: "mia-4-producer", notice: "已绑定任务根 IndependentEvaluation 的独立 KEEP" },
    origin: {
      contract: "PRODUCER_TWO_PAGE",
      source_probe_fingerprint_sha256: verdict.content_fingerprint_sha256,
      producer_artifact_sha256: actualSha,
      authority_scope: "ONE_4_TO_8_PAGE_EXPANSION",
    },
  };
  const admission = { content, verdict: structuredClone(verdict), evaluatorInput: structuredClone(evaluatorInput) };
  AUTHORIZED_PRODUCER_ADMISSIONS.set(admission, { consumed: false });
  return admission;
}

export async function admitSingleExpansion(admission, expansionSerialized, handoffSerialized) {
  const authorityState = AUTHORIZED_PRODUCER_ADMISSIONS.get(admission);
  if (!authorityState || authorityState.consumed) throw new TypeError("expansion requires an unused live authoritative Producer admission");
  if (typeof expansionSerialized !== "string" || typeof handoffSerialized !== "string") throw new TypeError("raw expansion and handoff files are required");
  const expansionBytes = new TextEncoder().encode(expansionSerialized);
  const handoffBytes = new TextEncoder().encode(handoffSerialized);
  const expansionSha = await sha256Text(expansionSerialized);
  const handoffSha = await sha256Text(handoffSerialized);
  const trusted = TRUSTED_EXPANSION_BINDINGS.find((binding) => binding.expansion_artifact_sha256 === expansionSha && binding.handoff_sha256 === handoffSha);
  const value = JSON.parse(expansionSerialized);
  const handoff = JSON.parse(handoffSerialized);
  if (!trusted || !value || value.schema !== "xiaoshimei.expansion-package.v2" || value.source_probe_fingerprint_sha256 !== admission.verdict.content_fingerprint_sha256) {
    throw new TypeError("expansion package is not bound to the kept two-page probe");
  }
  if (
    expansionBytes.byteLength !== trusted.expansion_artifact_size
    || handoffBytes.byteLength !== trusted.handoff_size
    || value.expansion_id !== trusted.expansion_id
    || value.input_hash !== trusted.input_hash
    || value.content_fingerprint_sha256 !== trusted.content_fingerprint_sha256
    || value.page_count !== trusted.page_count
    || handoff.schema !== "xiaoshimei.expansion-handoff.v1"
    || handoff.state !== "READY_FOR_MIA6_IMPORT_AND_MIA9_INDEPENDENT_EVALUATION"
    || handoff.page_count !== trusted.page_count
    || handoff.input_hash !== trusted.input_hash
    || handoff.source_probe_fingerprint_sha256 !== trusted.source_probe_fingerprint_sha256
    || handoff.content_fingerprint_sha256 !== trusted.content_fingerprint_sha256
    || handoff.artifact_ref?.sha256 !== trusted.expansion_artifact_sha256
    || handoff.artifact_ref?.size_bytes !== trusted.expansion_artifact_size
  ) throw new TypeError("expansion handoff does not match the trusted frozen artifact");
  if (!Array.isArray(value.pages) || value.pages.length !== trusted.page_count) throw new TypeError("expansion must contain the frozen page count");
  const pages = value.pages.map(normalizePage);
  const createdAt = requireString(value.created_at, "expansion.created_at");
  const expansionId = requireString(value.expansion_id, "expansion.expansion_id");
  const expanded = {
    ...admission.content,
    created_at: createdAt,
    pages,
    visible_pages: pages.length,
    stage: "FULL_DRAFT",
    review: emptyReview("NEW_EXPANSION_REQUIRES_INDEPENDENT_REVIEW"),
    origin: {
      ...admission.content.origin,
      expansion_id: expansionId,
      expansion_artifact_sha256: expansionSha,
      expansion_input_hash: trusted.input_hash,
      expansion_content_fingerprint_sha256: trusted.content_fingerprint_sha256,
      authority_scope: "SINGLE_EXPANSION_CONSUMED",
    },
  };
  if (await visualContentSha256(expanded, pages.length) !== trusted.content_fingerprint_sha256) {
    throw new TypeError("expansion content fingerprint does not match normalized Studio content");
  }
  authorityState.consumed = true;
  return expanded;
}

export async function generateWithProvider(input, provider = null) {
  if (!provider) {
    const generation = { mode: "DEMO_TEMPLATE", provider: null, notice: "演示模板，不是 AI 生成" };
    return { ...generation, content: { ...generateContentPackage(input), generation } };
  }
  if (typeof provider.generate !== "function") throw new TypeError("provider.generate must be a function");
  const raw = await provider.generate(structuredClone(input));
  const generation = { mode: "PROVIDER", provider: String(provider.id || "unknown"), notice: "Provider 返回已通过内容 schema" };
  return { ...generation, content: { ...parseContentPackage(JSON.stringify(raw)), generation } };
}

export function reorderPage(contentPackage, from, to) {
  if (![from, to].every(Number.isInteger) || from < 0 || to < 0 || from >= contentPackage.visible_pages || to >= contentPackage.visible_pages) throw new RangeError("page index is invalid");
  const pages = [...contentPackage.pages];
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page);
  return invalidateVisualReview({ ...contentPackage, pages, stage: "LOCAL_DRAFT", visible_pages: contentPackage.visible_pages });
}

export function duplicatePage(contentPackage, index) {
  if (!Number.isInteger(index) || index < 0 || index >= contentPackage.visible_pages || contentPackage.visible_pages >= 8) throw new RangeError("page cannot be duplicated");
  const pages = contentPackage.pages.slice(0, contentPackage.visible_pages);
  pages.splice(index + 1, 0, structuredClone(pages[index]));
  return invalidateVisualReview({ ...contentPackage, pages, stage: "LOCAL_DRAFT", visible_pages: contentPackage.visible_pages + 1 });
}

export function deletePage(contentPackage, index) {
  if (!Number.isInteger(index) || index < 0 || index >= contentPackage.visible_pages || contentPackage.visible_pages <= 1) throw new RangeError("page cannot be deleted");
  const pages = contentPackage.pages.filter((_, pageIndex) => pageIndex !== index);
  return invalidateVisualReview({ ...contentPackage, pages, stage: "LOCAL_DRAFT", visible_pages: contentPackage.visible_pages - 1 });
}

export function publishCopy(contentPackage) {
  return `${contentPackage.selectedTitle}\n\n${contentPackage.body}\n\n${contentPackage.tags.map((tag) => `#${tag}`).join(" ")}`;
}

export function buildManifest(contentPackage, imageNames, createdAt = new Date().toISOString()) {
  return {
    schema: "xiaoshimei.publish-package.v1",
    created_at: createdAt,
    state: "local_beta",
    generation_mode: contentPackage.generation?.mode || "DEMO_TEMPLATE",
    page_count: imageNames.length,
    dimensions: { width: 1080, height: 1440, ratio: "3:4" },
    files: [...imageNames, "publish-copy.txt", "content.json", "manifest.json"],
    publication_authority: "HUMAN_CONFIRMATION_REQUIRED",
  };
}

export async function attachIndependentVerdict(contentPackage, verdict) {
  const lineage = normalizeLineage(contentPackage.lineage);
  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict) || verdict.schema !== VISUAL_VERDICT_SCHEMA) {
    throw new TypeError("visual verdict schema is not supported");
  }
  const evaluatedPageCount = verdict.evaluated_page_count;
  const artifactRef = verdict.evaluated_artifact_ref;
  const expectedFingerprint = await visualContentSha256(contentPackage, evaluatedPageCount);
  if (
    lineage == null
    || verdict.decision !== "KEEP"
    || verdict.episode_id !== lineage.episode_id
    || verdict.task_hash !== lineage.task_hash
    || verdict.input_hash !== lineage.input_hash
    || verdict.content_fingerprint_sha256 !== expectedFingerprint
    || evaluatedPageCount !== 2
    || !artifactRef
    || typeof artifactRef.path !== "string"
    || !/^[a-f0-9]{64}$/.test(artifactRef.sha256)
    || !Number.isInteger(artifactRef.size_bytes)
    || artifactRef.size_bytes < 1
    || typeof verdict.evaluator_id !== "string"
    || !verdict.evaluator_id
    || typeof verdict.reviewed_at !== "string"
  ) {
    throw new TypeError("visual verdict does not match content lineage");
  }
  return {
    ...contentPackage,
    scale_permission: "UNVERIFIED",
    review: {
      source: "RECEIPT_ATTACHED",
      decision: "KEEP",
      reviewed_at: verdict.reviewed_at,
      authority_effect: "EVIDENCE_ONLY",
    },
  };
}

export const PROFILE = {
  name: "小师妹",
  background: "九年澳洲求学、六年外企与奢侈品经历，转入传统文化与养生领域",
  pillars: PILLARS,
};
