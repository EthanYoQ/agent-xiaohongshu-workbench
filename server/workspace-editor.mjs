function trimmed(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function emptyCopyVersions() {
  return { raw: null, humanized: null };
}

export function emptyStoryline() {
  return { entries: [], updatedAt: null };
}

export function resetProductionAfterTopic(state, message = "选题已更新，等待重新拆解") {
  state.breakdown = null;
  state.selectedVisualDirectionId = null;
  state.draft = null;
  state.copyVersions = emptyCopyVersions();
  state.humanization = null;
  state.assets = [];
  state.review = null;
  state.publish = { status: "not_started", noteId: null, url: null, message };
}

export function selectTopic(state, topicId) {
  const topic = state.research?.topics?.find((item) => item.id === topicId);
  if (!topic) throw new Error("选题不存在，请重新运行热点研究");
  if (state.selectedTopicId !== topicId) resetProductionAfterTopic(state, "已切换选题，等待重新拆解");
  state.selectedTopicId = topicId;
  return topic;
}

export function editTopic(state, topicId, input) {
  const index = state.research?.topics?.findIndex((item) => item.id === topicId) ?? -1;
  if (index < 0) throw new Error("选题不存在，请重新运行热点研究");
  const current = state.research.topics[index];
  const next = {
    ...current,
    title: trimmed(input.title, 80),
    angle: trimmed(input.angle, 400),
    reason: trimmed(input.reason, 400),
    editedAt: new Date().toISOString(),
    editedBy: "user",
  };
  if (!next.title || !next.angle || !next.reason) throw new Error("选题标题、切入角度和推荐理由都不能为空");
  const changed = next.title !== current.title || next.angle !== current.angle || next.reason !== current.reason;
  state.research.topics[index] = next;
  state.selectedTopicId = topicId;
  if (changed) resetProductionAfterTopic(state);
  state.selectedTopicId = topicId;
  return next;
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[，,\n]/);
  const tags = [...new Set(source.map((item) => trimmed(String(item).replace(/^#/, ""), 24)).filter(Boolean))].slice(0, 10);
  if (tags.length < 1) throw new Error("至少保留 1 个标签");
  return tags;
}

export function normalizeDraftEdit(current, input, mode) {
  if (!current) throw new Error(mode === "raw" ? "当前没有原始文稿" : "当前没有去 AI 味文稿");
  const title = trimmed(input.title, 80);
  const body = trimmed(input.body, 6000);
  if (!title || !body) throw new Error("文稿标题和正文不能为空");
  if (!Array.isArray(input.imageCards) || input.imageCards.length !== current.imageCards?.length) {
    throw new Error("手动编辑不能改变配图卡片数量");
  }
  const imageCards = input.imageCards.map((card, index) => {
    const previous = current.imageCards[index];
    const next = {
      kicker: trimmed(card.kicker, 40),
      headline: trimmed(card.headline, 100),
      body: trimmed(card.body, 500),
      characterAction: previous.characterAction,
    };
    if (!next.kicker || !next.headline || !next.body) throw new Error(`第 ${index + 1} 张卡片文案不能为空`);
    return next;
  });
  return {
    ...current,
    title,
    body,
    tags: normalizeTags(input.tags),
    imageCards,
    mode,
    editedAt: new Date().toISOString(),
    editedBy: "user",
  };
}

export function applyDraftEdit(state, version, input) {
  if (!state.copyVersions) state.copyVersions = emptyCopyVersions();
  const current = state.copyVersions[version] || (state.draft?.mode === version ? state.draft : null);
  const edited = normalizeDraftEdit(current, input, version);
  state.copyVersions[version] = edited;
  if (version === "raw") {
    state.copyVersions.humanized = null;
    state.draft = edited;
    state.humanization = { status: "pending", skill: "humanized-chinese-writing-polisher", updatedAt: new Date().toISOString() };
    state.publish = { status: "not_started", noteId: null, url: null, message: "原始文稿已修改，请重新执行去 AI 味" };
  } else {
    state.draft = edited;
    state.humanization = { ...(state.humanization || {}), status: "completed", skill: "humanized-chinese-writing-polisher", manuallyEditedAt: edited.editedAt, updatedAt: edited.editedAt };
    state.publish = { status: "not_started", noteId: null, url: null, message: "去 AI 味终稿已修改，请重新生成配图" };
  }
  state.assets = [];
  state.review = null;
  return edited;
}

export function storylineContext(entries = [], limit = 12) {
  return entries.slice(-limit).map((entry) => ({
    sequence: entry.sequence,
    publishedAt: entry.publishedAt,
    topicTitle: entry.topic?.title,
    angle: entry.topic?.angle,
    toneFit: entry.topic?.reason,
    copyTitle: entry.draft?.title,
    tags: entry.draft?.tags || [],
    noteId: entry.noteId,
  }));
}

export function archivePublishedStoryline(state, job, result) {
  if (result?.status !== "published" || (!result.noteId && !result.url)) return null;
  if (!state.storyline) state.storyline = emptyStoryline();
  const duplicate = state.storyline.entries.find((entry) => (
    (result.noteId && entry.noteId === result.noteId) || (result.url && entry.url === result.url)
  ));
  if (duplicate) return duplicate;
  const topic = state.research?.topics?.find((item) => item.id === state.selectedTopicId) || null;
  const direction = state.breakdown?.visualDirections?.find((item) => item.id === state.selectedVisualDirectionId) || null;
  const entry = {
    id: `story-${job.id}`,
    sequence: state.storyline.entries.length + 1,
    publishedAt: new Date().toISOString(),
    noteId: result.noteId || null,
    url: result.url || null,
    positioningSnapshot: state.positioning,
    topic: topic ? { id: topic.id, title: topic.title, angle: topic.angle, reason: topic.reason } : null,
    draft: state.draft ? {
      title: state.draft.title,
      body: state.draft.body,
      tags: state.draft.tags || [],
      imageCount: state.assets?.length || 0,
    } : null,
    visualDirection: direction ? { id: direction.id, name: direction.name } : null,
    publishEvidence: result.evidence || "",
    sourceJobId: job.id,
  };
  state.storyline.entries.push(entry);
  state.storyline.updatedAt = entry.publishedAt;
  return entry;
}
