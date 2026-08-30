export const PROMPT_CONTEXT_SCHEMA = "xiaoshimei.prompt-context.v1";
export const PROMPT_MEMORY_SCHEMA = "xiaoshimei.prompt-memory.v1";

export const TEXT_CONTEXT_FIELDS = [
  {
    id: "audience_situation", label: "谁在什么场景下看", helper: "具体到人、时刻和困扰，避免只写“年轻人”。",
    placeholder: "例如：久坐盯屏的上班族，下班前眼睛发紧但不想做复杂练习",
    defaultValue: "面向对东方生活方式感兴趣、但没有专业知识的普通用户；从一个真实日常场景进入。",
  },
  {
    id: "reader_value", label: "读者看完得到什么", helper: "只写一个主要价值，决定内容取舍。",
    placeholder: "例如：看完能安全完成一组2分钟离屏休息动作",
    defaultValue: "给出能看懂、能照做、值得收藏的具体方法；不以玄学或夸张承诺换点击。",
  },
  {
    id: "content_angle", label: "核心角度与承诺", helper: "说明这篇从哪个切口讲，以及绝不承诺什么。",
    placeholder: "例如：从“先暂停而不是继续硬撑”切入，不承诺治疗效果",
    defaultValue: "用具体困扰、真实动作或生活反差切入；标题承诺必须被正文完整兑现。",
  },
  {
    id: "voice_style", label: "口吻与人物声音", helper: "像谁在对谁说，允许和禁用哪些表达。",
    placeholder: "例如：像小师妹分享自己的练习，温和、克制、生活化，不装专家",
    defaultValue: "小师妹第一人称或贴近生活的分享口吻；温和、克制、清楚，不卖弄古籍，不端着说教。",
  },
  {
    id: "structure_length", label: "结构与篇幅", helper: "规定段落功能和大致字数，不把格式猜测留给模型。",
    placeholder: "例如：350到500字，6个短段落，依次写困扰、做法、细节、边界、提醒和收束",
    defaultValue: "正文350到550字，分成5到8个短段落，依次写真实场景、核心方法、执行细节、解释边界、风险提醒和自然收束。",
  },
  {
    id: "facts_and_boundaries", label: "事实、未知与安全边界", helper: "把必须保留、不能编造和需要提醒的内容写在一起。",
    placeholder: "例如：不按压眼球；疼痛、红肿、畏光或视力变化时停止并就医",
    defaultValue: "只使用原始资料和账号档案中可确认的信息；未知写未知。养生只表述日常舒缓，不替代诊断或治疗。",
  },
  {
    id: "keywords_and_examples", label: "关键词、搜索词与参考表达", helper: "提供想覆盖的词或一句好例子；没有可以留空。",
    placeholder: "例如：盯屏休息、眼周放松、远眺；参考表达：给一直盯着屏幕的眼睛一个暂停",
    defaultValue: "优先使用用户会自然搜索的具体困扰、动作和场景词；标签与正文语义一致。",
  },
  {
    id: "tag_strategy", label: "小红书标签策略", helper: "直接规定5个标签如何分层；生成后仍可逐个修改。",
    placeholder: "例如：核心问题2个＋具体动作1个＋人群场景1个＋账号栏目1个；拒绝宽泛凑数词",
    defaultValue: "5个标签分层覆盖核心主题、具体问题或场景、可执行动作或方法、目标人群、账号栏目或人物IP（仅在确实相关时）。优先使用读者会搜索的2到10字具体词；拒绝个人账号分享、日常分享、干货分享、生活记录、自我提升等宽泛凑数词，不把标题整句改写成标签。",
  },
  {
    id: "avoid_text", label: "文字明确避用", helper: "负面约束只管文字，不与图片禁用项混在一起。",
    placeholder: "例如：0成本、几分钟搞定、亲测、治愈、闭眼照做、赶紧码住",
    defaultValue: "避免0成本、几分钟搞定、必看、亲测、治愈、根治、万能、赶紧码住、翻古籍挖到等廉价或不可核验套话。",
  },
];

export const IMAGE_CONTEXT_FIELDS = [
  {
    id: "subject_identity", label: "人物身份与必须保持", helper: "参考图负责身份，这里写不能漂移的特征。",
    placeholder: "例如：固定小师妹IP，黑色高发髻、红色长发带、米白盘扣上衣、红色灯笼裤",
    defaultValue: "固定小师妹人物IP：黑色高发髻、红色长发带、米白盘扣上衣、红色灯笼裤、米白布鞋；保持同一年龄感与脸部特征。",
  },
  {
    id: "visible_action", label: "动作与表情原则", helper: "动作必须能被一张静态图肉眼验证。",
    placeholder: "例如：每页一个明确动作，手、眼睛、身体和器物关系完整可见",
    defaultValue: "每页只设一个肉眼可见的核心动作；手、眼睛、身体与器物关系清楚，表情自然，动作直接证明本页信息。",
  },
  {
    id: "environment_props", label: "环境与关键器物", helper: "只列与动作有因果关系的场景和道具。",
    placeholder: "例如：安静木质卧室、晨光、木桌、手机、毛巾；不出现无关茶具",
    defaultValue: "东方生活化的真实室内或自然空间；器物少而准确，环境服务动作，不堆装饰。",
  },
  {
    id: "art_direction", label: "画风、质感与媒介", helper: "描述媒介和气质，不直接模仿在世艺术家。",
    placeholder: "例如：原创治愈系动画电影质感，细腻手绘背景，人物线条干净",
    defaultValue: "保持小师妹原创东方手绘身份。封面可使用生活化完整场景；知识内页改用线条干净、道具少、背景简化的小幅扁平插画，便于和原生文字自然穿插。避免廉价3D贴图、复杂满景和素材拼贴感。",
  },
  {
    id: "color_and_light", label: "配色与光线", helper: "色彩和光线独立于画风，可单独复用。",
    placeholder: "例如：米杏、奶油白、深棕、少量朱红；柔和晨光，低饱和暖调",
    defaultValue: "米杏、奶油白、深棕与少量朱红；低饱和暖调、自然窗光、柔和阴影，肤色不过曝。",
  },
  {
    id: "composition_layout", label: "镜头、构图与排版留白", helper: "决定图片在成品里是否会被文字遮住或缩在角落。",
    placeholder: "例如：强标题封面＋单栏知识页；正文为主，小插画穿插在右侧",
    defaultValue: "采用小师妹指定参考的图文语法：封面上半部是高对比强标题和一句副标题，下半部放一幅主视觉；知识内页为单栏连续阅读，2到4个要点纵向展开，原生中文文字占页面65%到75%，对应的小幅插画穿插在右侧或外侧20%到25%。四周保留至少6%安全边距；不做等大卡片、九宫格感、大横图或四边贴边。插画本身不带文字，背景自然延伸到裁切边缘，不出现白框。",
  },
  {
    id: "continuity_reference", label: "组图连续性与参考图规则", helper: "说明跨页哪些不变、哪些允许变化。",
    placeholder: "例如：人物、服装、色温一致；每页动作、景别和器物随叙事变化",
    defaultValue: "整组保持人物、服装、画风、色温和时代环境一致；每页改变动作、景别和关键器物，形成连续叙事而非重复摆拍。",
  },
  {
    id: "avoid_visual", label: "画面明确避用", helper: "列出不希望模型画出的元素和常见失败。",
    placeholder: "例如：文字、水印、边框、UI、参考图表格、第二个人、畸形手、合十、祈祷",
    defaultValue: "避免任何文字、水印、边框、UI、参考图表格或头像残片；避免第二个人、畸形手、多余手指、合十祈祷、静态看镜头和人物缩成角落贴图。",
  },
];

export const ALL_PROMPT_FIELDS = [
  { id: "source_topic", label: "原始文本或选题", defaultValue: "" },
  { id: "text_requirements", label: "本次自由补充要求", defaultValue: "" },
  ...TEXT_CONTEXT_FIELDS,
  ...IMAGE_CONTEXT_FIELDS,
];

const FIELD_IDS = new Set(ALL_PROMPT_FIELDS.map((field) => field.id));
const CONTEXT_FIELD_IDS = new Set([...TEXT_CONTEXT_FIELDS, ...IMAGE_CONTEXT_FIELDS].map((field) => field.id));
const MAX_VALUE_LENGTH = 4000;
const MAX_HISTORY_PER_FIELD = 20;

function cleanValue(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_VALUE_LENGTH) : "";
}

export function defaultPromptValues() {
  return Object.fromEntries(ALL_PROMPT_FIELDS.map((field) => [field.id, cleanValue(field.defaultValue)]));
}

export function normalizePromptContext(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const values = source.values && typeof source.values === "object" && !Array.isArray(source.values) ? source.values : source;
  return {
    schema: PROMPT_CONTEXT_SCHEMA,
    values: Object.fromEntries([...CONTEXT_FIELD_IDS].map((id) => [id, cleanValue(values[id])])),
  };
}

export function createPromptMemory() {
  return { schema: PROMPT_MEMORY_SCHEMA, defaults: defaultPromptValues(), histories: Object.fromEntries([...FIELD_IDS].map((id) => [id, []])) };
}

export function parsePromptMemory(serialized) {
  let value;
  try { value = typeof serialized === "string" ? JSON.parse(serialized) : serialized; }
  catch { return createPromptMemory(); }
  const base = createPromptMemory();
  if (!value || typeof value !== "object" || value.schema !== PROMPT_MEMORY_SCHEMA) return base;
  for (const id of FIELD_IDS) {
    const defaultValue = cleanValue(value.defaults?.[id]);
    if (defaultValue) base.defaults[id] = defaultValue;
    const seen = new Set();
    base.histories[id] = (Array.isArray(value.histories?.[id]) ? value.histories[id] : [])
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({ id: cleanValue(entry.id), value: cleanValue(entry.value), saved_at: cleanValue(entry.saved_at) }))
      .filter((entry) => entry.id && entry.value && entry.saved_at && !seen.has(entry.id) && seen.add(entry.id))
      .slice(0, MAX_HISTORY_PER_FIELD);
  }
  return base;
}

function nextEntryId(idFactory) {
  if (typeof idFactory === "function") return cleanValue(idFactory());
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `prompt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function rememberPromptValues(memory, values, { now = new Date().toISOString(), idFactory } = {}) {
  const next = parsePromptMemory(memory);
  for (const [id, rawValue] of Object.entries(values || {})) {
    if (!FIELD_IDS.has(id)) continue;
    const value = cleanValue(rawValue);
    if (!value) continue;
    next.defaults[id] = value;
    const prior = next.histories[id].filter((entry) => entry.value !== value);
    next.histories[id] = [{ id: nextEntryId(idFactory), value, saved_at: cleanValue(now) }, ...prior].slice(0, MAX_HISTORY_PER_FIELD);
  }
  return next;
}

export function deletePromptHistory(memory, fieldId, entryId) {
  const next = parsePromptMemory(memory);
  if (!FIELD_IDS.has(fieldId)) return next;
  const removed = next.histories[fieldId].find((entry) => entry.id === entryId);
  next.histories[fieldId] = next.histories[fieldId].filter((entry) => entry.id !== entryId);
  if (removed && next.defaults[fieldId] === removed.value) {
    next.defaults[fieldId] = next.histories[fieldId][0]?.value || defaultPromptValues()[fieldId];
  }
  return next;
}

export function promptContextForProvider(values) {
  return normalizePromptContext({ values });
}

export function promptContextLines(context, fieldDefinitions) {
  const normalized = normalizePromptContext(context);
  return fieldDefinitions
    .map((field) => [field.label, normalized.values[field.id]])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}：${value}`);
}
