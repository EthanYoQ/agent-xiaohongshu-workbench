import assert from "node:assert/strict";
import test from "node:test";
import { assembleArkContent, assembleArkContentFromDraft, buildArkDraftTextRequest, buildArkImageQaRequest, buildArkImageRequest, buildArkPageCandidatePrompt, buildArkPagePlanRequest, buildArkTextRequest, classifyArkImageForStudio, composeArkPageImagePrompt, decodeArkImage, deriveArkVisualActionContract, extractArkImageQa, extractArkPagePlan, extractArkPlan, extractArkTextDraft, inspectImageBytes, isThreeByFourImage, textQualityRetryGuidance } from "../src/ark-provider-core.mjs";
import { buildGenerationContract, createProfileV2 } from "../src/profile-v2.mjs";

function input() { return { topic: "书院筹备中的三种进入路径", pillar: "academy", goal: "save", profile_contract: buildGenerationContract(createProfileV2()) }; }
function planValue() { return {
  content_type: "knowledge_card",
  titles: ["一座书院为什么有三种入口", "我在书院筹备里看见三种生活", "传统文化怎样重新进入日常"],
  selected_title: "一座书院为什么有三种入口",
  body: "参与书院筹备后，我才意识到，传统文化不是把几个古老名词摆在一起，而是让不同的人找到可以进入日常的一扇门。\n\n对青少年来说，入口可能是身体训练、专注和礼仪；对成年人来说，可能是动作、呼吸与休息节奏；对旅行者来说，则可能从一件器物、一次仪式或一段故事开始。\n\n这三条路径属于同一座书院的筹备构想，不是三个互不相关的项目。课程内容、开放时间、价格与到访方式都还没有确定。\n\n真正难的不是把构想写得漂亮，而是逐步回答谁来教、怎样持续运行、参与者能获得什么，以及哪些部分最终会被现实修改。\n\n我会继续记录哪些想法被保留，哪些会被现实修正。现在先把这张筹备地图留给你，也欢迎告诉我你最想从哪一条路径进入。",
  tags: ["书院", "武术", "禅修", "养生", "文旅"],
  pages: [
    { page_role: "hook", eyebrow: "书院筹备手记", title: "一座书院为什么有三种入口", body: "我站在尚未完成的木门前，才明白传统文化不是一个抽象名词，而是不同人走进日常的三条路径。", visual_action: "小师妹右手推开半掩的书院木门并迈上石阶", image_prompt: "清晨的山林书院门前，小师妹从石阶走上前，右手推开半掩的旧木门，身体微微前倾，视线望向门内，广角中景，自然晨光，人物放在画面右下方，上方保留安静天空与屋檐。" },
    { page_role: "judgment", eyebrow: "同一构想的三条线", title: "不同的人，从不同入口开始", body: "青少年武术教育｜从身体、专注与礼仪开始\n成人禅修养生｜从动作、呼吸与节奏开始\n文旅体验｜从器物、仪式与故事开始\n三条路径属于同一座书院的筹备构想，目前课程、价格、开放时间与到访方式都尚待核验。", visual_action: "小师妹一手压住筹备册，另一手指向三件代表不同路径的器物", image_prompt: "书院木桌旁，小师妹翻阅一本摊开的筹备册，左手压住页面，右手依次指向三枚代表武术、呼吸练习和文化体验的小器物，低头专注阅读，俯拍与侧面结合的中景，柔和窗光，人物在画面右侧。" },
  ],
  facts: ["筹备中"], risks: ["不得写成已经招生"],
}; }

test("Ark text request binds Profile v2 and requires the typed function", () => {
  const request = buildArkTextRequest(input(), "doubao-text-endpoint");
  assert.equal(request.model, "doubao-text-endpoint"); assert.equal(request.store, false); assert.equal(request.tools[0].name, "return_xiaoshimei_plan");
  assert.equal(request.tools[0].strict, true); assert.deepEqual(request.thinking, { type: "disabled" }); assert.equal(request.max_output_tokens, 8192);
  assert.deepEqual(request.tool_choice, { type: "function", name: "return_xiaoshimei_plan" });
  assert.match(request.input[0].content, /不得要求图片模型生成标题/); assert.match(request.input[0].content, /generation-profile-contract.v2/);
  assert.match(request.tools[0].parameters.properties.pages.items.properties.body.description, /绝不能写镜头/);
});

test("non-academy prompts scope out academy-only Profile boundaries", () => {
  const request = buildArkTextRequest({ ...input(), topic: "刷屏后眼睛发紧的日常休息", pillar: "wellness" }, "doubao-text-endpoint");
  assert.doesNotMatch(request.input[0].content, /未核验面积|未核验地点|官方关系/);
  assert.doesNotMatch(request.input[0].content, /小师妹参与书院筹备|山林.*书院.*练功场/);
  assert.match(request.input[0].content, /养生内容只能写日常舒缓/);
});

test("Ark plan extraction fails closed on free text, malformed JSON and missing fields", () => {
  const valid = extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: JSON.stringify(planValue()) }] }, input());
  assert.equal(valid.pages.length, 2);
  assert.throws(() => extractArkPlan({ output: [{ type: "message", content: "自由文本" }] }), /required function/);
  assert.throws(() => extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: "{" }] }), /valid JSON/);
  assert.throws(() => extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: JSON.stringify({ ...planValue(), tags: ["少"] }) }] }), /invalid length/);
});

test("Ark extraction narrowly repairs the observed image_prompt marker and rejects other malformed JSON", () => {
  const raw = JSON.stringify(planValue()).replaceAll('"image_prompt":"', '"image_prompt" string="true">');
  const repaired = extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: raw }] }, input());
  assert.equal(repaired.pages.length, 2);
  const oneMarker = raw.replace('"image_prompt" string="true">', '"image_prompt":"');
  assert.throws(() => extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: oneMarker }] }, input()), /not valid JSON/);
});

test("page-plan parser removes only the observed Ark trailing tool marker", () => {
  const raw = `${JSON.stringify({ pages: planValue().pages })}\n</function>\n</seed:tool_call>`;
  assert.equal(extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: raw }] }, 2, input()).length, 2);
  const missingRootBrace = `${JSON.stringify({ pages: planValue().pages }).slice(0, -1)}\n</function>\n</seed:tool_call>`;
  assert.equal(extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: missingRootBrace }] }, 2, input()).length, 2);
  assert.throws(() => extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: `${JSON.stringify({ pages: planValue().pages })} unexpected` }] }, 2, input()), /valid JSON/);
});

test("page-plan parser narrowly repairs Ark extra page-array closures and bounded role aliases", () => {
  const pages = structuredClone(planValue().pages);
  pages[0].panels = [
    { title: "先关窗", body: "睡前先把卧室窗户慢慢关好。", visual_action: "小师妹抬手合上木窗" },
    { title: "再盖薄被", body: "把透气薄被轻轻盖住肩腹位置。", visual_action: "小师妹把薄被铺到床上" },
  ];
  pages[1].page_role = "reason";
  pages[1].panels = [];
  const valid = JSON.stringify({ pages });
  const malformed = valid.replace(']}]},{"page_role":"reason"', ']}]},{"page_role":"reason"').replace('}]},{"page_role":"reason"', '}]}], {"page_role":"reason"');
  const parsed = extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: malformed }] }, 2, input());
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].pageRole, "judgment");
});

test("page-plan parser repairs only surplus root braces and the observed experience role alias", () => {
  const pages = structuredClone(planValue().pages);
  pages[1].page_role = "experience";
  pages[1].panels = [];
  const raw = `${JSON.stringify({ pages })}}`;
  const parsed = extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: raw }] }, 2, input());
  assert.equal(parsed[1].pageRole, "example");
  assert.throws(() => extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: `${JSON.stringify({ pages })} unexpected` }] }, 2, input()), /valid JSON/);
});

test("Ark extraction only escapes raw control characters inside JSON strings", () => {
  const raw = JSON.stringify(planValue()).replaceAll("\\n", "\n");
  const repaired = extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: raw }] }, input());
  assert.match(repaired.pages[1].body, /\n/);
});

test("Ark quality gate stops short copy, cheap hooks and generic portraits before image generation", () => {
  const response = (value) => ({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: JSON.stringify(value) }] });
  assert.throws(() => extractArkPlan(response({ ...planValue(), body: "太短了" }), input()), /TEXT_QUALITY_GATE_FAILED:body:too_short/);
  assert.throws(() => extractArkPlan(response({ ...planValue(), selected_title: "晨起三分钟搞定眼睛疲劳", titles: ["晨起三分钟搞定眼睛疲劳", ...planValue().titles.slice(1)] }), input()), /cheap_or_unverifiable_hook/);
  const generic = structuredClone(planValue()); generic.pages[0].image_prompt = "清晨的东方房间里，小师妹坐在窗边双手交握，面带微笑看向镜头，旁边放着一只茶杯，温暖自然光，治愈系动画电影质感，竖幅中景构图，上方和左上方保留宽阔干净的标题空间。";
  assert.throws(() => extractArkPlan(response(generic), input()), /action_not_visually_demonstrated/);
});

test("wellness plans require a visible procedure, safety boundary and topic-linked eye action", () => {
  const wellnessInput = { ...input(), topic: "工作太久眼睛发紧，如何日常舒缓？", pillar: "wellness" };
  const value = structuredClone(planValue());
  assert.throws(() => extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: JSON.stringify(value) }] }, wellnessInput), /eye_care_action_not_visible/);
});

test("wellness page plans accept concrete natural-language hand and eye actions", () => {
  const pages = [
    { page_role: "hook", eyebrow: "盯屏后眼紧舒缓技巧", title: "先让视线离开手机屏幕", body: "长时间对着屏幕后眼部容易发紧，与其继续盯着，不如先放下手机，把视线移到窗外远处。", visual_action: "小师妹把手机放到桌面一侧并望向窗外远处", image_prompt: "小师妹侧坐在明亮的居家书桌前，刚把手机放到桌面一侧，双手自然抬起往双眼方向移动，肩膀放松，视线离开桌面完全望向窗外远景，桌面留大片空白，中景构图，不出现任何文字。" },
    { page_role: "method", eyebrow: "温掌轻覆眼眶外侧", title: "双手分开轻覆不要按压", body: "先洗净双手摘掉隐形，摩擦双掌到温热，轻覆眼眶外侧不压眼球，三十秒后移开并望向远处。", visual_action: "小师妹闭眼并把分开的双手轻覆在眼眶外侧", image_prompt: "小师妹坐在窗边座椅上，闭着双眼，把刚摩擦温热的双手分开并轻轻凹陷着覆在闭着的眼睛外侧，没有触碰按压眼球，窗边有柔和自然光，近景聚焦手部动作，周围留适当留白，画面无任何文字元素。" },
  ];
  assert.equal(extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: JSON.stringify({ pages }) }] }, 2, { topic: "刷手机后眼睛发紧", pillar: "wellness", goal: "save" }).length, 2);
});

test("eye-care page plans allow preparation pages without forcing an eye into every frame", () => {
  const pages = [
    { page_role: "hook", eyebrow: "先暂停刷屏", title: "先把手机放到桌面一边", body: "长时间刷手机后眼眶发紧，先停下来，把手机屏幕朝下平放在桌面上，让视线离开屏幕。", visual_action: "小师妹把手机屏幕朝下平放在木桌上", image_prompt: "竖幅三比四中景，小师妹坐在木质书桌旁，右手把手机屏幕朝下平放在桌面上，视线离开屏幕看向窗边，米杏暖光，左侧留出干净区域，不出现任何文字水印或边框。" },
    { page_role: "method", eyebrow: "清洁双手", title: "洗手并摘下隐形眼镜", body: "先把双手冲洗干净；平时佩戴隐形眼镜的话，将镜片摘下妥善放进镜盒，再开始后面的动作。", visual_action: "小师妹站在洗手池前用流动清水冲洗双手", image_prompt: "竖幅三比四中近景，小师妹站在米白色洗手池前，用流动清水认真冲洗双手，手指自然展开，洗手台只有皂盒和镜盒，暖调窗光，左上方留白，不出现文字水印。" },
    { page_role: "method", eyebrow: "温掌轻覆", title: "双掌分开轻覆眼眶外侧", body: "摩擦掌心到温热，闭眼后让双掌彼此分开，轻轻搭在眼眶外侧，全程不按压眼球。", visual_action: "小师妹闭眼并把分开的双掌轻搭在眼眶外侧", image_prompt: "竖幅三比四中景，小师妹闭着双眼，把摩擦温热后的双掌彼此分开并轻搭在眼眶外侧，双手和眼周关系清楚，人物位于右侧，柔和自然光，画面无文字。" },
    { page_role: "closing", eyebrow: "远眺收尾", title: "移开双手再望向远处", body: "约三十秒后缓慢移开双手，站到窗边望向远处；若疼痛、红肿、畏光或视力变化，立即停止并咨询医生。", visual_action: "小师妹站在窗边望向远处的树木", image_prompt: "竖幅三比四中景，小师妹站在木窗边，双手自然垂在身侧，眼睛望向窗外远处的树木，身体放松，低饱和暖光，左侧留白，不出现文字、水印或第二个人。" },
  ];
  assert.equal(extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: JSON.stringify({ pages }) }] }, 4, { topic: "刷手机后眼睛发紧", pillar: "wellness", goal: "save" }).length, 4);
  const request = buildArkPagePlanRequest({ selected_title: "刷手机后先让眼睛休息", body: "正文".repeat(140), tags: ["护眼"], source_input: "眼睛发紧", prompt_context: {} }, 4, "doubao-text");
  assert.equal(request.tools[0].parameters.properties.pages.items.properties.body.minLength, 35);
  assert.match(request.input[0].content, /35–160个汉字/);
});

test("page planning receives the selected production mode before any image call", () => {
  const draft = { selected_title: "处暑后如何调整日常作息", body: "正文".repeat(140), tags: ["处暑养生"], source_input: "处暑作息", prompt_context: {} };
  const infographic = buildArkPagePlanRequest(draft, 3, "doubao-text", "", "infographic");
  assert.match(infographic.input[0].content, /成品模式：infographic/);
  assert.match(infographic.input[0].content, /2–4个彼此分隔/);
  assert.match(infographic.input[0].content, /原生文字层/);
  const narrative = buildArkPagePlanRequest(draft, 3, "doubao-text", "", "narrative");
  assert.match(narrative.input[0].content, /成品模式：narrative/);
  assert.match(narrative.input[0].content, /不做多格拼贴/);
  const smart = buildArkPagePlanRequest(draft, 3, "doubao-text", "", "smart");
  assert.match(smart.input[0].content, /原生文字承担主体/);
  assert.match(smart.input[0].content, /小幅插画穿插在右侧或外侧/);
  assert.match(smart.input[0].content, /插画背景默认纯白并延伸到3:4成品边缘/);
  assert.match(smart.input[0].content, /整组页面当成完整作品构思/);
  assert.ok(smart.tools[0].parameters.properties.pages.items.required.includes("design_program"));
  assert.deepEqual(smart.tools[0].parameters.properties.pages.items.properties.design_program.properties.composition.enum, ["cover-focus", "editorial-flow", "feature-lead", "quiet-coda"]);
});

test("Ark image request carries identity reference and forbids baked-in text", () => {
  const request = buildArkImageRequest({ model: "seedream-image-endpoint", prompt: "小师妹在山林书院练功", referenceImageDataUrl: "data:image/png;base64,AAAA" });
  assert.equal(request.model, "seedream-image-endpoint"); assert.equal(request.response_format, "b64_json"); assert.equal(request.sequential_image_generation, "disabled");
  assert.equal(request.size, "1728x2304"); assert.equal("stream" in request, false);
  assert.match(request.prompt, /禁止任何文字/); assert.deepEqual(request.image, ["data:image/png;base64,AAAA"]);
});

test("Ark image request keeps identity first and accepts bounded action references", () => {
  const request = buildArkImageRequest({ model: "seedream-image-endpoint", prompt: "小师妹练拳", referenceImageDataUrl: "data:image/png;base64,IDENTITY", actionReferenceImageDataUrls: ["data:image/png;base64,ACTION"], actionReferenceNote: "参考弓步和出拳方向" });
  assert.deepEqual(request.image, ["data:image/png;base64,IDENTITY", "data:image/png;base64,ACTION"]);
  assert.match(request.prompt, /只用于理解动作/);
  assert.match(request.prompt, /参考弓步和出拳方向/);
});

test("page image prompt composes typed visual context without shrinking the image into a sticker", () => {
  const prompt = composeArkPageImagePrompt(planValue().pages[0], { values: { composition_layout: "人物和动作占画面三分之二，左侧留白", color_and_light: "米杏暖光" } }, { contentType: "knowledge_card", styleLock: input().profile_contract.style_lock });
  assert.match(prompt, /本页唯一可见动作/);
  assert.match(prompt, /人物和动作占画面三分之二/);
  assert.match(prompt, /不是角落贴纸/);
  assert.match(prompt, /整篇内容类型：knowledge_card/);
  assert.match(prompt, /本页信息职责：hook/);
  assert.match(prompt, /整组风格锁/);
});

test("page candidates preserve page semantics and force both sides of a comparison into frame", () => {
  const base = {
    page_index: 0,
    source_input: "中国茶艺和日本茶艺的差异",
    title: "中日茶艺日常体验到底差在哪",
    body: "中国茶艺重茶汤与冲泡节奏，日本茶道更强调程序与空间秩序。",
    layout: "scene",
    content_type: "knowledge_card",
    page_role: "comparison",
    visual_action: "小师妹用双手分别比较两组茶具",
    image_prompt: "中日两组器物同框",
    prompt_context: {},
  };
  const prompt = buildArkPageCandidatePrompt(base, 0);
  assert.match(prompt, /这是比较型页面/);
  assert.match(prompt, /两方/);
  assert.match(prompt, /中式.*盖碗|紫砂壶/);
  assert.match(prompt, /日式.*抹茶碗.*茶筅/);
  assert.match(prompt, /左右对照/);
  assert.match(prompt, /不写任何中日文字标签/);
  const second = buildArkPageCandidatePrompt(base, 1);
  assert.match(second, /前景双组/);
  assert.notEqual(prompt, second);
});

test("assembled generated pages keep visual action and image prompt for later page regeneration", () => {
  const draft = {
    schema: "xiaoshimei.text-draft-response.v1", draft_id: "draft-semantic", created_at: new Date().toISOString(), source_input: "中日茶艺差异", content_type: "knowledge_card",
    text_requirements: "", prompt_context: {}, pillar: "culture", goal: "save", titles: ["中日茶艺差异怎么理解", "中日茶艺的日常差异", "两种茶艺的实践重点"], selected_title: "中日茶艺差异怎么理解",
    body: "中国茶艺和日本茶艺在器物、程序和关注点上有不同。这里做日常文化比较，不判断高低。".repeat(5), tags: ["中日茶艺", "茶文化", "东方生活", "泡茶", "文化比较"], recommended_image_count: 1, facts: [], risks: [],
    style_lock: buildGenerationContract(createProfileV2()).style_lock,
  };
  const pages = [{ pageRole: "comparison", eyebrow: "一眼看懂", title: "两套茶具，两种秩序", body: "中式盖碗与日式茶筅同框比较，器物和动作各有重点。", visualAction: "小师妹双手分别指向两组茶具", imagePrompt: "中式盖碗与日式抹茶碗茶筅同框" }];
  const content = assembleArkContentFromDraft(draft, pages, ["/generated/demo.jpg"], { imageModel: "seedream" });
  assert.equal(content.pages[0].page_role, "comparison");
  assert.equal(content.pages[0].visual_action, pages[0].visualAction);
  assert.equal(content.pages[0].image_prompt, pages[0].imagePrompt);
  assert.equal(content.generation.production_mode, "smart");
});

test("knowledge infographic mode binds distinct native text boxes to matching illustrations", () => {
  const draft = {
    schema: "xiaoshimei.text-draft-response.v1", draft_id: "draft-mode", created_at: new Date().toISOString(), source_input: "处暑作息", content_type: "method_checklist",
    text_requirements: "", prompt_context: {}, pillar: "wellness", goal: "save", titles: ["处暑作息怎么调更稳妥", "处暑后先做三件小事", "初秋作息与饮食调整"], selected_title: "处暑后先做三件小事",
    body: "处暑以后先把入睡时间逐步提前，再把冰饮收一收，最后用温水和清润食材承接初秋变化。".repeat(5), tags: ["处暑养生", "初秋作息", "温水习惯", "居家养护", "日常清单"], recommended_image_count: 1, facts: [], risks: [],
  };
  const pages = [
    { pageRole: "hook", eyebrow: "处暑后的三件事", title: "先把日常节奏接回来", body: "处暑以后不用一下改变很多，先从作息、喝水和减少冰饮三个日常动作开始调整。", visualAction: "小师妹站在桌边指向闹钟水杯和冰饮", imagePrompt: "竖幅三比四场景，小师妹站在生活桌边，依次指向闹钟、温水杯和一杯待收起的冰饮，动作清楚，暖色自然光，上方保留标题空间，不出现任何文字水印。", panels: [] },
    { pageRole: "method", eyebrow: "三步调整", title: "照着顺序慢慢做", body: "第一步提前入睡；第二步分次喝温水；第三步把冰饮逐渐收一收，用三个清楚动作承接初秋变化。", visualAction: "小师妹依次调整闹钟捧起温水并移开冰饮", imagePrompt: "信息分镜合同：三幅彼此分隔的生活分镜，按从左到右再从上到下阅读；第一格小师妹调整床头闹钟，第二格双手捧起温水，第三格把冰饮移到桌面远处；同一人物同一服装，画面无文字水印。", panels: [
      { title: "先调作息", body: "把入睡时间逐步往前提。", visualAction: "小师妹调整床头闹钟" },
      { title: "再喝温水", body: "分次慢慢喝够温水。", visualAction: "小师妹双手捧起温水杯" },
      { title: "最后收冰饮", body: "把冷饮暂时移出日常。", visualAction: "小师妹把冰饮移到远处" },
    ] },
  ];
  const content = assembleArkContentFromDraft(draft, pages, ["/generated/cover.jpg", "/generated/method.jpg"], { imageModel: "seedream" }, "infographic");
  assert.equal(content.pages[1].layout, "list");
  assert.equal(content.pages[1].composition_mode, "infographic");
  assert.deepEqual(content.pages[1].info_panels.map((panel) => panel.title), ["先调作息", "再喝温水", "最后收冰饮"]);
  assert.equal(content.pages[1].layer_state.visible.body, false);
  assert.equal(content.pages[1].info_panels[0].text_style.backgroundOpacity, 0.9);
  assert.equal(content.generation.production_mode, "infographic");
});

test("multimodal image QA rejects a wrong visible action before Studio admission", () => {
  const request = buildArkImageQaRequest({ model: "doubao-text", referenceImageDataUrl: "data:image/png;base64,AAAA", candidateImageDataUrl: "data:image/jpeg;base64,BBBB", expectedAction: "双手轻覆闭着的双眼，不按压眼球", pageTitle: "给眼睛一个短暂停顿" });
  assert.equal(request.tools[0].name, "return_xiaoshimei_image_qa");
  assert.equal(request.input[0].content.filter((item) => item.type === "input_image").length, 2);
  const revise = { decision: "REVISE", observed_action: "人物在胸前合掌", identity_ok: true, action_ok: false, hands_ok: true, no_text_or_watermark: true, composition_ok: true, violations: ["合掌替代了覆眼动作"], revision_instruction: "双手必须分开并轻覆闭着的双眼，不能在胸前合掌" };
  const parsed = extractArkImageQa({ output: [{ type: "function_call", name: "return_xiaoshimei_image_qa", arguments: JSON.stringify(revise) }] });
  assert.equal(parsed.decision, "REVISE");
  const forgedKeep = { ...revise, decision: "KEEP", violations: [] };
  assert.equal(extractArkImageQa({ output: [{ type: "function_call", name: "return_xiaoshimei_image_qa", arguments: JSON.stringify(forgedKeep) }] }).decision, "REVISE");
  const compositionOnly = { ...revise, action_ok: true, composition_ok: false, violations: ["画面上方留白面积不足"], revision_instruction: "增加顶部留白" };
  assert.equal(extractArkImageQa({ output: [{ type: "function_call", name: "return_xiaoshimei_image_qa", arguments: JSON.stringify(compositionOnly) }] }).decision, "KEEP");
});

test("Studio exposes action-only deviations but rejects identity, hand, or watermark failures", () => {
  const actionOnly = { decision: "REVISE", revisionInstruction: "把手机推远", checks: { identity_ok: true, action_ok: false, hands_ok: true, no_text_or_watermark: true, composition_ok: true } };
  assert.equal(classifyArkImageForStudio(actionOnly).disposition, "EDITABLE_DRAFT_WITH_WARNING");
  const hardFailure = { ...actionOnly, checks: { ...actionOnly.checks, hands_ok: false } };
  assert.deepEqual(classifyArkImageForStudio(hardFailure).hardFailures, ["hands_ok"]);
});

test("visual QA compares semantic core actions instead of incidental shot details", () => {
  const screen = deriveArkVisualActionContract({ title: "先停止刷屏", body: "把手机屏幕朝下扣在桌上", imagePrompt: "小师妹坐在桌前把手机扣在木桌上，视线望向窗外，中景暖光" });
  assert.match(screen, /停止刷屏/); assert.match(screen, /正反面.*不是硬条件/);
  const eyes = deriveArkVisualActionContract({ title: "双掌轻覆眼眶", body: "双手分开轻覆闭眼外侧", imagePrompt: "小师妹闭眼轻覆眼眶外侧" });
  assert.match(eyes, /双手彼此分开/); assert.match(eyes, /不能合十/);
});

test("Ark image bytes are typed before their local extension is assigned", () => {
  const png = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(1536, 16); png.writeUInt32BE(2048, 20);
  assert.deepEqual(inspectImageBytes(png), { extension: "png", mime: "image/png", width: 1536, height: 2048 });
  const jpeg = Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x0b,0x08,0x08,0x00,0x06,0x00,0x03,0x01,0x11,0x00,0xff,0xd9]);
  assert.deepEqual(inspectImageBytes(jpeg), { extension: "jpg", mime: "image/jpeg", width: 1536, height: 2048 });
  assert.throws(() => inspectImageBytes(Buffer.from("not-an-image")), /FORMAT_UNSUPPORTED/);
});

test("Ark image aspect gate accepts vertical 3:4 and rejects horizontal 4:3", () => {
  assert.equal(isThreeByFourImage({ width: 1728, height: 2304 }), true);
  assert.equal(isThreeByFourImage({ width: 2304, height: 1728 }), false);
  assert.equal(isThreeByFourImage({ width: 1080, height: 1440 }), true);
});

test("Ark image decoding and assembled two-page probe remain inside Studio schema", () => {
  assert.equal(decodeArkImage({ data: [{ b64_json: "AAAA", size: "1536x2048" }] }).kind, "base64"); assert.throws(() => decodeArkImage({ data: [] }), /no image/);
  const plan = extractArkPlan({ output: [{ type: "function_call", name: "return_xiaoshimei_plan", arguments: JSON.stringify(planValue()) }] }, input());
  const content = assembleArkContent(input(), plan, ["/generated/01.png", "/generated/02.png"], { textModel: "doubao", imageModel: "seedream" });
  assert.equal(content.visible_pages, 2); assert.equal(content.pages[1].visual, "character"); assert.equal(content.review.decision, "ARK_PROBE_REQUIRES_REVIEW");
  assert.equal(content.pages[0].layout, "scene");
  assert.equal(content.scale_permission, "UNVERIFIED"); assert.equal(content.generation.provider, "volcengine-ark");
});

test("text retry guidance repairs the failure class without echoing the rejected phrase", () => {
  const procedure = textQualityRetryGuidance(new Error("TEXT_QUALITY_GATE_FAILED:wellness:missing_procedure"));
  assert.match(procedure, /至少3个可操作步骤/);
  assert.match(procedure, /先、接着、然后、最后/);
  const hook = textQualityRetryGuidance(new Error("TEXT_QUALITY_GATE_FAILED:titles:cheap_or_unverifiable_hook:不用复杂工具"));
  assert.match(hook, /具体对象|真实场景|可见动作|明确判断/);
  assert.doesNotMatch(hook, /不用复杂工具/);
  const request = buildArkDraftTextRequest({ ...input(), pillar: "wellness", topic: "工作太久眼睛发紧，如何用3分钟离屏恢复状态", text_requirements: "" }, "doubao-text");
  assert.doesNotMatch(request.input[0].content, /不用复杂工具/);
  assert.match(request.input[0].content, /至少3个顺序动作/);
});

test("two-node flow generates editable text before any image plan", () => {
  const request = buildArkDraftTextRequest({ ...input(), text_requirements: "保留三条路径，语气生活化" }, "doubao-text");
  assert.equal(request.tools[0].name, "return_xiaoshimei_text_draft");
  assert.doesNotMatch(JSON.stringify(request.tools[0].parameters), /image_prompt/);
  assert.match(request.input[0].content, /保留三条路径/);
  assert.deepEqual(request.tools[0].parameters.properties.content_type.enum, ["knowledge_card", "material_notes", "method_checklist", "case_breakdown", "product_seeding", "emotional_resonance"]);
  const value = { ...planValue(), recommended_image_count: 3 };
  delete value.pages;
  const draft = extractArkTextDraft({ output: [{ type: "function_call", name: "return_xiaoshimei_text_draft", arguments: JSON.stringify(value) }] }, input());
  assert.equal(draft.contentType, "knowledge_card");
  assert.equal(draft.recommendedImageCount, 3);
  assert.equal(draft.tags.length, 5);
});

test("identity copy accepts the common Chinese tag 人物IP without admitting English category tags", () => {
  const value = { ...planValue(), recommended_image_count: 1, tags: ["小师妹", "人物IP", "图文起步", "视觉连续性", "国风元素"] };
  delete value.pages;
  const response = (draft) => ({ output: [{ type: "function_call", name: "return_xiaoshimei_text_draft", arguments: JSON.stringify(draft) }] });
  assert.equal(extractArkTextDraft(response(value), { ...input(), pillar: "identity" }).tags[1], "人物IP");
  assert.throws(() => extractArkTextDraft(response({ ...value, tags: ["小师妹", "CreatorIP", "图文起步", "视觉连续性", "国风元素"] }), { ...input(), pillar: "identity" }), /tags:non_chinese_copy/);
});

test("tag quality rejects duplicate and generic filler labels", () => {
  const value = { ...planValue(), recommended_image_count: 1, tags: ["小师妹", "人物IP", "图文起步", "视觉连续性", "个人账号分享"] };
  delete value.pages;
  const response = (draft) => ({ output: [{ type: "function_call", name: "return_xiaoshimei_text_draft", arguments: JSON.stringify(draft) }] });
  assert.throws(() => extractArkTextDraft(response(value), { ...input(), pillar: "identity" }), /tags:generic_filler/);
  assert.throws(() => extractArkTextDraft(response({ ...value, tags: ["小师妹", "小师妹", "图文起步", "视觉连续性", "国风元素"] }), { ...input(), pillar: "identity" }), /tags:duplicate/);
});

test("wellness safety gate accepts natural stop-and-consult wording", () => {
  const body = "盯着屏幕太久后，我会先给眼睛留一段真正离开近距离焦点的时间。\n\n第1步，放下手机并洗净双手，再反复揉搓掌心，让手心自然变暖。\n\n第2步，闭眼后把掌心轻轻覆在眼眶周围，不向下按压眼球，只停留十几秒。\n\n第3步，慢慢移开双手，睁眼眺望窗外较远的树木或屋檐，让视线从近处抽离。\n\n这只是一种日常休息方式，不是治疗方法，也不追求所谓立刻见效。每个人的感受不同，可以缩短时间或直接跳过不舒服的动作。\n\n如果出现刺痛或酸涩加重，请及时停下来找专业人士咨询，不要硬撑。平时持续疼痛或出现视力异常，也应尽快寻求专业医护人员的帮助。";
  const titles = ["盯屏幕太久先给眼睛一个暂停", "眼睛发紧时我会按顺序做这几步", "放下手机后这样让视线慢慢休息"];
  const value = { content_type: "method_checklist", titles, selected_title: titles[0], recommended_image_count: 4, body, tags: ["眼部放松", "屏幕休息", "日常养生", "生活方式", "轻缓练习"], facts: [], risks: ["不适时停下并咨询专业人士"] };
  delete value.pages;
  const draft = extractArkTextDraft({ output: [{ type: "function_call", name: "return_xiaoshimei_text_draft", arguments: JSON.stringify(value) }] }, { ...input(), pillar: "wellness", topic: "眼睛发紧的日常舒缓步骤" });
  assert.equal(draft.recommendedImageCount, 4);
});

test("text draft deterministically formats complete sentences into readable paragraphs", () => {
  const titles = ["盯屏幕太久先给眼睛一个暂停", "眼睛发紧时我会按顺序做这几步", "放下手机后这样让视线慢慢休息"];
  const body = "盯屏幕后眼周容易发紧。第一步先放下手机。第二步洗净双手。第三步揉搓掌心。闭眼轻覆眼眶但不按压眼球。之后眺望远处。这里只是日常休息方式。如果刺痛或酸涩加重就停下来咨询专业人士。".repeat(3);
  const value = { content_type: "method_checklist", titles, selected_title: titles[0], recommended_image_count: 4, body, tags: ["眼部放松", "屏幕休息", "日常养生", "生活方式", "轻缓练习"], facts: [], risks: [] };
  const draft = extractArkTextDraft({ output: [{ type: "function_call", name: "return_xiaoshimei_text_draft", arguments: JSON.stringify(value) }] }, { ...input(), pillar: "wellness", topic: "眼睛发紧的日常舒缓步骤" });
  assert.ok((draft.body.match(/\n\n/g) || []).length >= 3);
});

test("soft tool-threshold filler is removed while guaranteed-relief filler still fails closed", () => {
  const titles = ["盯屏幕太久先给眼睛一个暂停", "眼睛发紧时我会按顺序做这几步", "放下手机后这样让视线慢慢休息"];
  const base = "盯屏幕后眼周容易发紧。先放下手机，接着洗净双手，之后揉搓掌心，然后闭眼轻覆眼眶但不按压眼球，最后眺望远处。如果刺痛或酸涩加重就停下来咨询专业人士。";
  const responseFor = (ending, titleList = titles) => ({ output: [{ type: "function_call", name: "return_xiaoshimei_text_draft", arguments: JSON.stringify({ content_type: "method_checklist", titles: titleList, selected_title: titleList[0], recommended_image_count: 4, body: `${base}\n\n${base}\n\n${ending}${base}\n\n${base}`, tags: ["眼部放松", "屏幕休息", "日常养生", "生活方式", "轻缓练习"], facts: [], risks: [] }) }] });
  const cleanedBody = extractArkTextDraft(responseFor("不用借助额外工具。"), { ...input(), pillar: "wellness" });
  assert.doesNotMatch(cleanedBody.body, /不用.*工具/);
  assert.ok(cleanedBody.qualityRepairs.includes("body:soft_hook_removed"));
  const toolTitle = ["不用复杂工具，盯屏幕太久先给眼睛一个暂停", ...titles.slice(1)];
  const cleanedTitle = extractArkTextDraft(responseFor("", toolTitle), { ...input(), pillar: "wellness" });
  assert.equal(cleanedTitle.titles[0], "盯屏幕太久先给眼睛一个暂停");
  assert.ok(cleanedTitle.qualityRepairs.some((item) => item.includes("soft_hook_removed")));
  assert.throws(() => extractArkTextDraft(responseFor("做完之后整个人会松下来。"), { ...input(), pillar: "wellness" }), /cheap_or_unverifiable_hook/);
});

test("confirmed text produces an exact 1-8 page plan and reloadable package", () => {
  const draft = { schema: "xiaoshimei.text-draft-response.v1", draft_id: "draft-1", created_at: new Date(0).toISOString(), source_input: input().topic, content_type: "case_breakdown", style_lock: input().profile_contract.style_lock, text_requirements: "", pillar: "academy", goal: "save", titles: planValue().titles, selected_title: planValue().selected_title, body: planValue().body, tags: planValue().tags, recommended_image_count: 3, facts: planValue().facts, risks: planValue().risks, generation: {} };
  const request = buildArkPagePlanRequest(draft, 3, "doubao-text");
  assert.equal(request.tools[0].parameters.properties.pages.minItems, 3);
  assert.match(request.input[0].content, /必须明确写“小师妹”/);
  assert.deepEqual(request.tools[0].parameters.properties.pages.items.properties.page_role.enum, ["hook", "conclusion", "judgment", "method", "pitfall", "comparison", "example", "checklist", "closing"]);
  assert.match(request.input[0].content, /整组风格锁/);
  const third = { page_role: "closing", eyebrow: "继续记录", title: "让现实修改这张地图", body: "把筹备中的每一步写下来，也把未知、变化和被推翻的想法如实保留。下一次更新时，再逐项说明哪些构想已经落地。", visual_action: "小师妹右手握笔书写，左手压住摊开的筹备册", image_prompt: "傍晚的书院木桌前，小师妹坐下书写筹备日记，右手握笔落在纸面，左手压住摊开的册页，视线低头看向文字，暖色侧光，中近景，人物位于画面右侧，上方留出干净空间。" };
  const pageValues = [...planValue().pages, third];
  const pages = extractArkPagePlan({ output: [{ type: "function_call", name: "return_xiaoshimei_page_plan", arguments: JSON.stringify({ pages: pageValues }) }] }, 3, input());
  const content = assembleArkContentFromDraft(draft, pages, ["/generated/a.jpg", "/generated/b.jpg", "/generated/c.jpg"], { textModel: "doubao", imageModel: "seedream" });
  assert.equal(content.visible_pages, 3);
  assert.equal(content.pages.length, 3);
  assert.equal(content.selectedTitle, draft.selected_title);
  assert.equal(content.stage, "LOCAL_DRAFT");
  assert.deepEqual(content.pages.map((page) => page.layout), ["scene", "split", "split"]);
  assert.ok(content.pages.every((page) => page.composition_mode === "smart"));
  assert.deepEqual(content.pages.map((page) => page.page_role), ["hook", "judgment", "closing"]);
  assert.equal(content.content_strategy.content_type, "case_breakdown");
  assert.equal(content.content_strategy.style_lock.schema, "xiaoshimei.style-lock.v1");
});
