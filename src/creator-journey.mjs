const STEPS = [
  { step: 1, label: "原文", target: "creator-source" },
  { step: 2, label: "文字", target: "creator-text" },
  { step: 3, label: "配图", target: "creator-images" },
  { step: 4, label: "排版", target: "creator-design" },
  { step: 5, label: "发布包", target: "creator-publish" },
];

export function deriveCreatorJourney({ topic, textDraft, textConfirmed, hasConfirmedContent = false, generatedImageCount = 0, requiredImageCount = 0, layoutIssueCount = 0, exportState = "IDLE" }) {
  const hasTopic = Boolean(String(topic || "").trim());
  const hasTextDraft = Boolean(textDraft || hasConfirmedContent);
  const hasConfirmedText = Boolean((textDraft && textConfirmed) || hasConfirmedContent);
  const required = Math.max(0, Number(requiredImageCount) || 0);
  const generated = Math.max(0, Number(generatedImageCount) || 0);
  const imageSetComplete = Boolean(hasTextDraft && hasConfirmedText && required > 0 && generated >= required);
  let currentStep = 1;
  let nextAction = hasTopic ? "生成文字草稿" : "先写清原文或选题";
  if (hasTextDraft) { currentStep = 2; nextAction = "修改标题、正文与标签，然后确认文字"; }
  if (hasTextDraft && hasConfirmedText) { currentStep = 3; nextAction = required > 0 ? `生成与当前文字一致的配图（${Math.min(generated, required)}/${required}）` : "生成与当前文字一致的配图"; }
  if (imageSetComplete) { currentStep = 4; nextAction = layoutIssueCount ? `处理 ${layoutIssueCount} 处排版问题` : "检查排版与每页图文关系"; }
  if (imageSetComplete && layoutIssueCount === 0) { currentStep = 5; nextAction = "检查发布文案，然后下载发布包"; }
  if (exportState === "COMPLETE") { currentStep = 5; nextAction = "发布包已生成；发布后回资产库补现实反馈"; }

  const steps = STEPS.map((item) => ({ ...item, state: item.step < currentStep ? "done" : item.step === currentStep ? "current" : "pending" }));
  if (!hasTextDraft) steps[1].target = "creator-source";
  if (!hasConfirmedText) steps[2].target = hasTextDraft ? "creator-text" : "creator-source";
  return { currentStep, nextAction, steps };
}
