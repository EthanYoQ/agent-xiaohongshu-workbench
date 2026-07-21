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

export function resetProductionAfterBrandChange(state, message = "品牌角色已更新，等待重新拆解") {
  resetProductionAfterTopic(state, message);
}

export function setGenerationImageCount(state, value) {
  const imageCount = Number(value);
  if (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > 6) {
    throw new Error("配图数量必须是 1 到 6 的整数");
  }
  const previous = Number(state.generationSettings?.imageCount || 4);
  state.generationSettings = { ...(state.generationSettings || {}), imageCount };
  if (previous !== imageCount && state.draft) {
    state.draft = null;
    state.copyVersions = emptyCopyVersions();
    state.humanization = null;
    state.assets = [];
    state.review = null;
    state.publish = { status: "not_started", noteId: null, url: null, message: "配图数量已修改，请重新生成文稿" };
  }
  return state.generationSettings;
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
  const snapshot = job.payload?.storySnapshot;
  const topic = snapshot?.topic || state.research?.topics?.find((item) => item.id === state.selectedTopicId) || null;
  const direction = snapshot?.visualDirection || state.breakdown?.visualDirections?.find((item) => item.id === state.selectedVisualDirectionId) || null;
  const draft = snapshot?.draft || state.draft;
  const entry = {
    id: `story-${job.id}`,
    sequence: state.storyline.entries.length + 1,
    publishedAt: new Date().toISOString(),
    noteId: result.noteId || null,
    url: result.url || null,
    positioningSnapshot: snapshot?.positioning || state.positioning,
    topic: topic ? { id: topic.id, title: topic.title, angle: topic.angle, reason: topic.reason } : null,
    draft: draft ? {
      title: draft.title,
      body: draft.body,
      tags: draft.tags || [],
      imageCount: draft.imageCount ?? state.assets?.length ?? 0,
    } : null,
    visualDirection: direction ? { id: direction.id, name: direction.name } : null,
    publishEvidence: result.evidence || "",
    sourceJobId: job.id,
  };
  state.storyline.entries.push(entry);
  state.storyline.updatedAt = entry.publishedAt;
  return entry;
}

export function archiveManuallyPublishedStoryline(state) {
  if (!state.storyline) state.storyline = emptyStoryline();
  const sourceOutputId = state.outputExportId || null;
  const duplicate = sourceOutputId
    ? state.storyline.entries.find((entry) => entry.sourceOutputId === sourceOutputId)
    : null;
  if (duplicate) return duplicate;
  const topic = state.research?.topics?.find((item) => item.id === state.selectedTopicId) || null;
  const direction = state.breakdown?.visualDirections?.find((item) => item.id === state.selectedVisualDirectionId) || null;
  const draft = state.draft || null;
  const publishedAt = new Date().toISOString();
  const entry = {
    id: `story-manual-${sourceOutputId || Date.now()}`,
    sequence: state.storyline.entries.length + 1,
    publishedAt,
    noteId: null,
    url: null,
    positioningSnapshot: state.positioning,
    topic: topic ? { id: topic.id, title: topic.title, angle: topic.angle, reason: topic.reason } : null,
    draft: draft ? {
      title: draft.title,
      body: draft.body,
      tags: draft.tags || [],
      imageCount: draft.imageCount ?? state.assets?.length ?? 0,
    } : null,
    visualDirection: direction ? { id: direction.id, name: direction.name } : null,
    publishEvidence: "用户在工作台中手动标记为已发布，仅用于梳理账号故事线",
    source: "manual_published_mark",
    sourceOutputId,
  };
  state.storyline.entries.push(entry);
  state.storyline.updatedAt = publishedAt;
  return entry;
}

export function mergeVerifiedStorylineEntries(state, job, result) {
  if (!state.storyline) state.storyline = emptyStoryline();
  const notes = Array.isArray(result?.notes) ? result.notes : [];
  const ordered = [...notes].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt);
    const rightTime = Date.parse(right.publishedAt);
    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
    if (!Number.isFinite(leftTime)) return 1;
    if (!Number.isFinite(rightTime)) return -1;
    return leftTime - rightTime;
  });
  let imported = 0;
  for (const [index, note] of ordered.entries()) {
    if (note.mediaKind !== "graphic" || !Number.isInteger(note.imageCount) || note.imageCount < 1 || (!note.noteId && !note.url)) continue;
    const duplicate = state.storyline.entries.some((entry) => (
      (note.noteId && entry.noteId === note.noteId) || (note.url && entry.url === note.url)
    ));
    if (duplicate) continue;
    const parsedAt = Date.parse(note.publishedAt);
    const publishedAt = Number.isFinite(parsedAt) ? new Date(parsedAt).toISOString() : new Date().toISOString();
    state.storyline.entries.push({
      id: `story-sync-${job.id}-${index + 1}`,
      sequence: state.storyline.entries.length + 1,
      publishedAt,
      noteId: note.noteId || null,
      url: note.url || null,
      positioningSnapshot: state.positioning,
      topic: { id: null, title: trimmed(note.title, 80), angle: "已发布笔记同步", reason: "从小红书创作后台核验补录" },
      draft: { title: trimmed(note.title, 80), body: "", tags: (note.tags || []).map((tag) => trimmed(String(tag).replace(/^#/, ""), 24)).filter(Boolean).slice(0, 10), imageCount: note.imageCount },
      visualDirection: null,
      publishEvidence: note.evidence,
      sourceJobId: job.id,
      source: "creator_history_sync",
    });
    imported += 1;
  }
  if (imported > 0) {
    state.storyline.entries.sort((left, right) => Date.parse(left.publishedAt) - Date.parse(right.publishedAt));
    state.storyline.entries.forEach((entry, index) => { entry.sequence = index + 1; });
    state.storyline.updatedAt = state.storyline.entries.at(-1)?.publishedAt || null;
  }
  return imported;
}
