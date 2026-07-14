import { useEffect, useMemo, useState } from "react";

const TERMINAL_JOB_STATES = new Set(["completed", "failed"]);

async function api(url, options) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options?.headers || {}) }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function formatTime(value) {
  if (!value) return "尚未运行";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatElapsed(value) {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

function AnalysisCard({ index, title, block }) {
  return (
    <article className="analysis-card">
      <span>{index}</span>
      <div><strong>{title}</strong><p>{block?.summary || "等待 Agent 拆解"}</p></div>
    </article>
  );
}

function Palette({ palette }) {
  if (!palette) return null;
  return <span className="palette" aria-label="视觉配色">{[palette.paper, palette.ink, palette.primary, palette.accent, palette.soft].map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}</span>;
}

function TopicEditorCard({ topic, index, active, busy, onSelect, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: topic.title, angle: topic.angle, reason: topic.reason });

  useEffect(() => {
    setForm({ title: topic.title, angle: topic.angle, reason: topic.reason });
    setEditing(false);
  }, [topic.title, topic.angle, topic.reason]);

  async function save() {
    const saved = await onSave(topic.id, form);
    if (saved) setEditing(false);
  }

  return (
    <article className={`topic-editor ${active ? "topic-editor--active" : ""}`} data-testid={`topic-editor-${topic.id}`}>
      {editing ? (
        <div className="topic-edit-form">
          <div className="topic-edit-heading"><strong>编辑选题 {String(index + 1).padStart(2, "0")}</strong><span>保存后从新选题重新拆解</span></div>
          <label>选题标题<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={80} /></label>
          <label>切入角度<textarea value={form.angle} onChange={(event) => setForm((current) => ({ ...current, angle: event.target.value }))} maxLength={400} /></label>
          <label>推荐理由<textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={400} /></label>
          <div className="editor-actions"><span>保留原热点证据引用</span><button className="secondary-button" onClick={() => { setForm({ title: topic.title, angle: topic.angle, reason: topic.reason }); setEditing(false); }} disabled={busy}>取消</button><button className="primary-small" onClick={save} disabled={busy || !form.title.trim() || !form.angle.trim() || !form.reason.trim()}>保存并采用</button></div>
        </div>
      ) : (
        <>
          <button className="topic-select-button" onClick={() => onSelect(topic.id)} disabled={busy} aria-pressed={active}>
            <span className="topic-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="topic-main"><span className="topic-title-line"><strong>{topic.title}</strong>{topic.editedBy === "user" && <em>手动修改</em>}</span><small>{topic.angle} · {topic.reason}</small></span>
            <span className="topic-choice" aria-hidden="true" />
          </button>
          <button className="topic-edit-button" data-testid={`topic-edit-${topic.id}`} onClick={() => setEditing(true)} disabled={busy}>编辑选题</button>
        </>
      )}
    </article>
  );
}

function DraftVersionEditor({ version, label, draft, busy, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    setForm(draft ? { title: draft.title, body: draft.body, tags: (draft.tags || []).join("，"), imageCards: (draft.imageCards || []).map(({ kicker, headline, body }) => ({ kicker, headline, body })) } : null);
    setEditing(false);
  }, [draft?.title, draft?.body, draft?.editedAt, draft?.imageCards?.length]);

  if (!draft || !form) return (
    <article className="copy-version-card copy-version-card--empty" data-testid={`draft-version-${version}`}>
      <p className="eyebrow">{label}</p><h3>尚未生成</h3><p>{version === "raw" ? "完成热点拆解后生成原始文稿。" : "原始文稿确认后执行去 AI 味。"}</p>
    </article>
  );

  function resetForm() {
    setForm({ title: draft.title, body: draft.body, tags: (draft.tags || []).join("，"), imageCards: (draft.imageCards || []).map(({ kicker, headline, body }) => ({ kicker, headline, body })) });
  }

  function updateCard(index, field, value) {
    setForm((current) => ({ ...current, imageCards: current.imageCards.map((card, cardIndex) => cardIndex === index ? { ...card, [field]: value } : card) }));
  }

  async function save() {
    const saved = await onSave(version, { ...form, tags: form.tags.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean) });
    if (saved) setEditing(false);
  }

  return (
    <article className={`copy-version-card ${editing ? "copy-version-card--editing" : ""}`} data-testid={`draft-version-${version}`}>
      <div className="copy-version-heading"><div><p className="eyebrow">{label}</p><h3>{draft.title}</h3></div><StatusPill tone={version === "humanized" ? "live" : "warning"}>{draft.editedBy === "user" ? "已手动修改" : version === "humanized" ? "真人感版本" : "Agent 初稿"}</StatusPill></div>
      {editing ? (
        <div className="copy-edit-form">
          <label>标题<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={80} /></label>
          <label>正文<textarea className="copy-body-input" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} maxLength={6000} /></label>
          <label>标签<input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="用逗号分隔" /></label>
          <div className="card-copy-editors">
            <div className="card-copy-heading"><strong>逐页配图文案</strong><span>卡片数量与角色动作保持不变</span></div>
            {form.imageCards.map((card, index) => <fieldset key={index}><legend>第 {index + 1} 张</legend><label>眉题<input value={card.kicker} onChange={(event) => updateCard(index, "kicker", event.target.value)} maxLength={40} /></label><label>主标题<input value={card.headline} onChange={(event) => updateCard(index, "headline", event.target.value)} maxLength={100} /></label><label>正文<textarea value={card.body} onChange={(event) => updateCard(index, "body", event.target.value)} maxLength={500} /></label><small>角色动作：{draft.imageCards[index]?.characterAction}</small></fieldset>)}
          </div>
          <div className="edit-impact">{version === "raw" ? "保存原始文稿后，现有去 AI 味版本、配图和审稿结果会失效。" : "保存去 AI 味版本后，现有配图和审稿结果会失效。"}</div>
          <div className="editor-actions"><span>{form.body.length}/6000</span><button className="secondary-button" onClick={() => { resetForm(); setEditing(false); }} disabled={busy}>取消</button><button className="primary-small" onClick={save} disabled={busy || !form.title.trim() || !form.body.trim()}>保存本版</button></div>
        </div>
      ) : (
        <>
          <div className="copy-version-body">{draft.body.split("\n").map((line, index) => line ? <p key={`${line}-${index}`}>{line}</p> : <span className="paragraph-gap" key={`copy-gap-${index}`} />)}</div>
          <div className="tag-row">{draft.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <div className="copy-version-footer"><span>{draft.imageCards?.length || 0} 张卡片文案</span><button className="secondary-button" data-testid={`draft-edit-${version}`} onClick={() => { resetForm(); setEditing(true); }} disabled={busy}>编辑本版</button></div>
        </>
      )}
    </article>
  );
}

export function App() {
  const [workspace, setWorkspace] = useState(null);
  const [positioning, setPositioning] = useState("");
  const [job, setJob] = useState(null);
  const [toolStatus, setToolStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishMode, setPublishMode] = useState("publish_now");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [reviewInput, setReviewInput] = useState("");
  const [revisionScope, setRevisionScope] = useState("both");

  const selectedTopic = useMemo(() => workspace?.research?.topics?.find((item) => item.id === workspace.selectedTopicId), [workspace]);
  const selectedDirection = useMemo(() => workspace?.breakdown?.visualDirections?.find((item) => item.id === workspace.selectedVisualDirectionId), [workspace]);
  const busy = job && !TERMINAL_JOB_STATES.has(job.status);

  async function refreshWorkspace() {
    const next = await api("/api/workspace");
    setWorkspace(next);
    setPositioning(next.positioning || "");
    return next;
  }

  useEffect(() => {
    refreshWorkspace().catch((error) => setMessage(error.message));
    api("/api/status").then(setToolStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!job || TERMINAL_JOB_STATES.has(job.status)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const next = await api(`/api/jobs/${job.id}`);
        setJob(next);
        if (TERMINAL_JOB_STATES.has(next.status)) {
          await refreshWorkspace();
          setMessage(next.status === "completed" ? "Agent 任务已完成，工作台已更新。" : next.error || "Agent 任务失败");
        }
      } catch (error) { setMessage(error.message); }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  useEffect(() => {
    setSelectedAssetIndex(0);
    setPreviewOpen(false);
    setReviewInput("");
  }, [workspace?.assets?.[0]?.id]);

  async function startJob(endpoint, payload) {
    setMessage("");
    try {
      const next = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setJob(next);
      setMessage("任务已交给本地 Codex Agent，页面会自动同步结果。");
    } catch (error) { setMessage(error.message); }
  }

  async function savePositioning() {
    try {
      const next = await api("/api/workspace", { method: "PUT", body: JSON.stringify({ positioning }) });
      setWorkspace(next);
      setMessage("账号定位已保存。");
    } catch (error) { setMessage(error.message); }
  }

  async function selectTopic(topicId) {
    if (topicId === workspace.selectedTopicId) return true;
    try {
      const next = await api(`/api/topics/${topicId}/select`, { method: "PUT", body: "{}" });
      setWorkspace(next);
      setMessage("已切换选题，后续会从新选题重新拆解。");
      return true;
    } catch (error) { setMessage(error.message); return false; }
  }

  async function saveTopic(topicId, value) {
    try {
      const next = await api(`/api/topics/${topicId}`, { method: "PUT", body: JSON.stringify(value) });
      setWorkspace(next);
      setMessage("选题已保存并采用，原有拆解和生成结果已失效。");
      return true;
    } catch (error) { setMessage(error.message); return false; }
  }

  async function saveDraft(version, value) {
    try {
      const next = await api(`/api/drafts/${version}`, { method: "PUT", body: JSON.stringify(value) });
      setWorkspace(next);
      setMessage(version === "raw" ? "原始文稿已保存，请重新执行去 AI 味。" : "去 AI 味文稿已保存，请重新生成配图并审稿。");
      return true;
    } catch (error) { setMessage(error.message); return false; }
  }

  async function approveReview() {
    try {
      const next = await api("/api/review/approve", { method: "POST", body: JSON.stringify({ confirmation: "REVIEW_APPROVED" }) });
      setWorkspace(next);
      setReviewInput("");
      setMessage("文稿和配图已确认，可以进入发布。 ");
    } catch (error) { setMessage(error.message); }
  }

  if (!workspace) return <main className="boot-screen">正在打开本地工作台…</main>;

  const isDemo = workspace.research.mode === "demo";
  const characterReady = workspace.brandCharacter?.status === "ready" && workspace.brandCharacter?.avatar;
  const characterLocked = characterReady && workspace.brandCharacter.locked;
  const topicSignals = selectedTopic?.evidenceRefs?.map((index) => workspace.research.signals[index]).filter(Boolean) || [];
  const topicHasVerifiedGraphics = topicSignals.length > 0 && topicSignals.every((signal) => signal.mediaKind === "graphic" && signal.imageCount > 0);
  const breakdownReady = workspace.breakdown?.topicId === selectedTopic?.id && workspace.breakdown?.status === "success";
  const rawDraftReady = workspace.draft?.mode === "raw";
  const humanizedDraftReady = workspace.draft?.mode === "humanized";
  const rawDraft = workspace.copyVersions?.raw || (rawDraftReady ? workspace.draft : null);
  const humanizedDraft = workspace.copyVersions?.humanized || (humanizedDraftReady ? workspace.draft : null);
  const storylineEntries = workspace.storyline?.entries || [];
  const assetsReady = humanizedDraftReady && workspace.assets.length > 0;
  const reviewApproved = assetsReady && workspace.review?.status === "approved";
  const hasPublishableDraft = reviewApproved && workspace.publish.status !== "published";
  const selectedAsset = workspace.assets[selectedAssetIndex] || workspace.assets[0];
  const selectedCard = workspace.draft?.imageCards?.[selectedAssetIndex];
  const progressStep = ["published", "draft_saved"].includes(workspace.publish.status) ? 9 : reviewApproved ? 9 : assetsReady ? 8 : humanizedDraftReady ? 7 : rawDraftReady ? 6 : breakdownReady ? 5 : characterLocked ? (selectedTopic ? 4 : workspace.research.topics.length ? 3 : 2) : 1;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block"><span className="brand-name">AGENT 小红书工作台</span><span className="brand-subtitle">单账号图文工作流</span></div>
        <nav className="progress" aria-label="内容生产进度">
          {["账号定位", "品牌角色", "图文热点", "确认选题", "热点拆解", "生成文稿", "去 AI 味", "生成配图", "发布"].map((label, index) => (
            <div className={`progress-step ${index + 1 <= progressStep ? "progress-step--active" : ""}`} key={label}><span className="progress-number">{String(index + 1).padStart(2, "0")}</span><span>{label}</span></div>
          ))}
        </nav>
        <div className="runtime-status"><span className={`runtime-dot ${toolStatus?.codex?.installed ? "runtime-dot--live" : ""}`} /><span>{toolStatus?.codex?.installed ? "Codex Agent 已就绪" : "正在检查本地 Agent"}</span><span className="runtime-divider" /><span>{toolStatus?.opencli?.installed ? "OpenCLI 已安装" : "OpenCLI 未连接"}</span></div>
      </header>

      <main className="workspace-grid">
        <section className="left-column">
          <div className="section-heading"><div><p className="eyebrow">01 / 账号基础</p><h1>账号定位：为谁解决什么问题</h1></div><StatusPill tone={isDemo ? "warning" : "live"}>{isDemo ? "示例数据" : "Agent 证据"}</StatusPill></div>
          <div className="positioning-box">
            <label htmlFor="positioning">账号定位</label>
            <textarea id="positioning" value={positioning} onChange={(event) => setPositioning(event.target.value)} maxLength={500} />
            <div className="field-actions"><span>{positioning.length}/500</span><button className="text-button" onClick={savePositioning} disabled={busy}>保存定位</button><button className="primary-small" onClick={() => startJob("/api/jobs/research", { positioning })} disabled={busy || !positioning.trim()}>{busy && job.type === "research" ? "Agent 正在筛选图文" : storylineEntries.length ? "结合故事线扫描新热点" : "让 Agent 扫描图文热点"}</button></div>
          </div>

          <section className="character-section">
            <div className="subheading-row">
              <div><p className="eyebrow">02 / 品牌角色</p><h2>角色、穿着与长期视觉已锁定</h2></div>
              <StatusPill tone={characterLocked ? "live" : "warning"}>{characterLocked ? "品牌母版生效" : "母版未就绪"}</StatusPill>
            </div>
            <div className="character-builder">
              <div className="avatar-stage">
                {characterReady ? <img src={workspace.brandCharacter.avatar.url} alt="账号头像角色" /> : <div className="avatar-empty"><strong>头像角色</strong><span>生成后在这里确认人物与穿着</span></div>}
              </div>
              <div className="character-controls">
                <label>品牌母版</label>
                <p className="brand-description">品牌角色由你在本地描述并生成。每张配图会根据该页文案生成不同动作，同时保持已锁定的人物身份、主要穿着与绘制方式一致。</p>
                {workspace.brandCharacter?.identityLock && <p className="identity-summary"><strong>固定穿着：</strong>{workspace.brandCharacter.identityLock.outfit}</p>}
                <div className="brand-theme">
                  <div><strong>{workspace.brandVisualIdentity?.name}</strong><span>{workspace.brandVisualIdentity?.typography}</span></div>
                  <Palette palette={workspace.brandVisualIdentity?.palette} />
                </div>
                <p className="brand-rule">{workspace.brandVisualIdentity?.composition}</p>
                <div className="lock-button lock-button--active">人物、穿着、配色与右下角位置已锁定</div>
              </div>
            </div>
          </section>

          <section className="evidence-section">
            <div className="subheading-row"><div><p className="eyebrow">03 / 图文信号</p><h2>仅保留通过媒体校验的图文笔记</h2></div><span className="timestamp">{formatTime(workspace.research.updatedAt)}</span></div>
            <p className="research-summary">{workspace.research.summary}</p>
            <div className="signal-list">
              {workspace.research.signals.map((signal, index) => (
                <article className="signal-row" key={`${signal.label}-${index}`}>
                  <div className="signal-rank">{String(index + 1).padStart(2, "0")}</div>
                  <div className="signal-copy"><div className="signal-title-line"><strong>{signal.label}</strong><span>{signal.heat}</span>{signal.mediaKind === "graphic" && <em>图文 · {signal.imageCount} 图</em>}</div><p>{signal.evidence}</p>{signal.url && <a href={signal.url} target="_blank" rel="noreferrer">查看原始笔记</a>}</div>
                  <div className="heat-track" aria-label={`相对热度 ${signal.heat}`}><span style={{ width: `${signal.heat}%` }} /></div>
                </article>
              ))}
            </div>
          </section>

          <section className="topics-section">
            <div className="subheading-row"><div><p className="eyebrow">04 / 选题方向</p><h2>选题只是开始，下一步先拆热点</h2></div><span className="topic-count">{workspace.research.topics.length} 个候选</span></div>
            <div className="topic-list">
              {workspace.research.topics.map((topic, index) => <TopicEditorCard key={topic.id} topic={topic} index={index} active={topic.id === workspace.selectedTopicId} busy={busy} onSelect={selectTopic} onSave={saveTopic} />)}
            </div>
          </section>

          <section className="storyline-section" data-testid="storyline-section">
            <div className="subheading-row"><div><p className="eyebrow">长期内容资产</p><h2>账号故事线</h2></div><span className="topic-count">已发布 {storylineEntries.length} 篇</span></div>
            <div className="tone-anchor"><span>账号调性锚点</span><strong>{workspace.positioning}</strong><p>下一轮 Agent 会读取最近 12 篇已发布主题，兼顾故事线承接、相邻扩展与标题查重。</p></div>
            {storylineEntries.length === 0 ? <div className="storyline-empty"><strong>第一篇发布后，故事线会从这里开始</strong><p>只有拿到小红书笔记 ID 或 URL 的成功发布才会入档；失败或结果不明不会计入。</p></div> : <div className="storyline-list">{[...storylineEntries].reverse().map((entry) => <article className="storyline-entry" key={entry.id}><span className="story-sequence">{String(entry.sequence).padStart(2, "0")}</span><div><div className="storyline-entry-heading"><strong>{entry.topic?.title || entry.draft?.title}</strong><time>{formatTime(entry.publishedAt)}</time></div><p>{entry.topic?.angle}</p><small>{entry.topic?.reason}</small><div className="story-tags">{entry.draft?.tags?.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}</div>{entry.url && <a href={entry.url} target="_blank" rel="noreferrer">查看已发布笔记</a>}</div></article>)}</div>}
          </section>
        </section>

        <aside className="right-column">
          <div className="right-sticky">
            <div className="selected-header"><p className="eyebrow">已确认选题</p><h2>{selectedTopic?.title || "等待选择选题"}</h2><p>{selectedTopic?.reason || "先在左侧运行热点研究并选择方向。"}</p></div>

            {!breakdownReady ? (
              <section className="breakdown-empty">
                <div><p className="eyebrow">05 / 热点拆解</p><h3>先理解为什么它有效，再生成原创内容</h3><p>{!characterLocked ? "请先锁定品牌角色。" : topicHasVerifiedGraphics ? "Agent 将用一个 Lingzao GitHub Skill 完成爆款类型、标题封面、逐页结构、互动机制和原创改写拆解。" : "当前热点尚未通过图文媒体校验，请先重新扫描图文热点。"}</p></div>
                <button className="generate-button" onClick={() => startJob("/api/jobs/deconstruct", { topicId: selectedTopic?.id })} disabled={busy || !selectedTopic || !topicHasVerifiedGraphics || !characterLocked}>{busy && job.type === "deconstruct" ? "Agent 正在用 Lingzao 拆解" : "用 Lingzao 拆解热点"}</button>
              </section>
            ) : (
              <>
                <section className="breakdown-panel">
                  <div className="subheading-row compact"><div><p className="eyebrow">05 / 热点拆解</p><h3>{workspace.breakdown.summary}</h3></div><StatusPill tone="live">Lingzao 单一 Skill · {workspace.breakdown.sources.length} 篇来源</StatusPill></div>
                  <div className="analysis-grid"><AnalysisCard index="01" title="内容结构" block={workspace.breakdown.contentStructure} /><AnalysisCard index="02" title="写作机制" block={workspace.breakdown.writingMechanics} /><AnalysisCard index="03" title="视觉 DNA" block={workspace.breakdown.visualDNA} /><AnalysisCard index="04" title="发布场景" block={{ summary: `${workspace.breakdown.publishingContext.observed} ${workspace.breakdown.publishingContext.recommendation}` }} /></div>
                </section>

                <section className="style-panel">
                  <div className="subheading-row compact"><div><p className="eyebrow">主题视觉推荐</p><h3>选题可以变化，品牌识别保持一致</h3></div></div>
                  <div className="direction-grid">
                    {workspace.breakdown.visualDirections.map((direction) => {
                      const active = direction.id === workspace.selectedVisualDirectionId;
                      return <button className={`direction-card ${active ? "direction-card--active" : ""}`} key={direction.id} onClick={() => setWorkspace((current) => ({ ...current, selectedVisualDirectionId: direction.id }))} disabled={busy || Boolean(workspace.draft)}><span className="direction-top"><Palette palette={direction.palette} />{direction.id === workspace.breakdown.recommendedDirectionId && <em>Agent 推荐</em>}</span><strong>{direction.name}</strong><small>{direction.rationale}</small><span className="fit-line">选题：{direction.topicFit}</span><span className="fit-line">角色：{direction.avatarFit}</span></button>;
                    })}
                  </div>
                </section>

                {!workspace.draft && <button className="generate-button generate-button--primary" onClick={() => startJob("/api/jobs/draft", { topicId: selectedTopic?.id, visualDirectionId: selectedDirection?.id })} disabled={busy || !selectedDirection || !characterLocked}>{busy && job.type === "draft" ? "Agent 正在生成初稿" : "生成文稿"}</button>}
              </>
            )}

            {(rawDraft || humanizedDraft) && <section className="copy-version-studio">
              <div className="copy-studio-heading"><div><p className="eyebrow">06—07 / 文稿版本</p><h3>原始文稿与去 AI 味版本都可直接编辑</h3></div><p>保存上游版本会主动清空失效的下游资产，避免旧配图或旧审稿结果被误发布。</p></div>
              <div className="copy-version-grid"><DraftVersionEditor version="raw" label="06 / 原始文稿" draft={rawDraft} busy={busy} onSave={saveDraft} /><DraftVersionEditor version="humanized" label="07 / 去 AI 味文稿" draft={humanizedDraft} busy={busy} onSave={saveDraft} /></div>
            </section>}

            {rawDraftReady && <section className="humanize-panel"><div><p className="eyebrow">07 / 中文去 AI 味</p><h3>先保留事实和观点，再把表达改得像真人</h3><p>使用本项目 humanized-chinese-writing-polisher Skill；不会新增经历、数据或营销号热梗。</p></div><button className="generate-button generate-button--primary" onClick={() => startJob("/api/jobs/humanize", {})} disabled={busy}>{busy && job.type === "humanize" ? "Agent 正在诊断并润色" : "执行去 AI 味"}</button></section>}

            {humanizedDraftReady && !assetsReady && workspace.humanization?.status === "completed" && <section className="humanize-result"><div className="subheading-row compact"><div><p className="eyebrow">去 AI 味记录</p><h3>已通过中文真人感质量检查</h3></div><StatusPill tone="live">单一 Skill</StatusPill></div><ul>{workspace.humanization.revisionNotes?.map((note) => <li key={note}>{note}</li>)}</ul></section>}

            {humanizedDraftReady && !assetsReady && <button className="generate-button generate-button--primary" onClick={() => startJob("/api/jobs/illustrate", {})} disabled={busy}>{busy && job.type === "illustrate" ? "Agent 正在生成逐页角色动作" : "生成配图与角色动作"}</button>}

            {assetsReady && <section className="review-workspace">
              <div className="review-header"><div><p className="eyebrow">08 / 完整预览与审稿</p><h3>先看完整文稿和每张配图，再决定调整或发布</h3></div><StatusPill tone={reviewApproved ? "live" : "warning"}>{reviewApproved ? "预览已确认" : `待审 · 第 ${workspace.review?.round || 1} 版`}</StatusPill></div>
              <div className="review-grid">
                <div className="visual-review">
                  <button className="review-image-button" onClick={() => setPreviewOpen(true)} aria-label={`查看第 ${selectedAssetIndex + 1} 张配图原图`}><img src={selectedAsset?.url} alt={`第 ${selectedAssetIndex + 1} 张小红书配图完整预览`} /></button>
                  <div className="review-image-meta"><span>{String(selectedAssetIndex + 1).padStart(2, "0")} / {String(workspace.assets.length).padStart(2, "0")}</span><strong>{selectedCard?.headline || "内容卡"}</strong><button className="text-button" onClick={() => setPreviewOpen(true)}>查看原图</button></div>
                  <div className="review-nav"><button className="secondary-button" onClick={() => setSelectedAssetIndex((index) => Math.max(0, index - 1))} disabled={selectedAssetIndex === 0}>上一张</button><button className="secondary-button" onClick={() => setSelectedAssetIndex((index) => Math.min(workspace.assets.length - 1, index + 1))} disabled={selectedAssetIndex === workspace.assets.length - 1}>下一张</button></div>
                  <div className="review-thumbnails">{workspace.assets.map((asset, index) => <button className={index === selectedAssetIndex ? "review-thumbnail review-thumbnail--active" : "review-thumbnail"} key={asset.id} onClick={() => setSelectedAssetIndex(index)} aria-label={`选择第 ${index + 1} 张配图`}><img src={asset.url} alt="" /></button>)}</div>
                </div>
                <article className="copy-review">
                  <p className="eyebrow">发布文稿</p><h2>{workspace.draft.title}</h2>
                  <div className="copy-review-body">{workspace.draft.body.split("\n").map((line, index) => line ? <p key={`${line}-${index}`}>{line}</p> : <span className="paragraph-gap" key={`review-gap-${index}`} />)}</div>
                  <div className="tag-row">{workspace.draft.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                  <div className="selected-card-copy"><span>当前配图文案</span><strong>{selectedCard?.kicker} · {selectedCard?.headline}</strong><p>{selectedCard?.body}</p></div>
                </article>
              </div>
              <div className="review-feedback">
                <div className="review-feedback-heading"><div><p className="eyebrow">预览意见</p><h3>有意见就调整，没有意见就确认</h3></div>{workspace.review?.feedback && <span>上一轮：{workspace.review.feedback}</span>}</div>
                <div className="review-input-row"><label>调整范围<select value={revisionScope} onChange={(event) => setRevisionScope(event.target.value)} disabled={busy}><option value="both">文稿与配图</option><option value="copy">仅文稿</option><option value="visual">仅配图</option></select></label><label className="review-comment">调整要求<textarea value={reviewInput} onChange={(event) => setReviewInput(event.target.value)} maxLength={1200} placeholder="例如：第 2 张文字再短一点；正文减少总结感；第 4 张角色动作换成下班后松一口气。" /></label></div>
                <div className="review-actions"><span>{reviewInput.length}/1200 · 输入意见后执行调整；留空则确认当前版本</span><button className="secondary-button" onClick={() => startJob("/api/jobs/revise", { feedback: reviewInput, scope: revisionScope })} disabled={busy || !reviewInput.trim()}>{busy && job.type === "revise" ? "Agent 正在按意见调整" : "按意见调整"}</button><button className="publish-button" onClick={approveReview} disabled={busy || Boolean(reviewInput.trim()) || reviewApproved}>{reviewApproved ? "预览已确认" : "预览无误，确认可发布"}</button></div>
              </div>
            </section>}

            <section className="publish-panel"><div className="publish-copy"><div><p className="eyebrow">09 / 发布计划</p><h3>预览确认后，选择立即发布或暂缓发布</h3></div><p>立即发布需要笔记 ID/URL；暂缓发布会由 Agent 点击小红书创作页的“暂存离开”。</p></div><div className="publish-meta"><span>审稿状态</span><strong>{reviewApproved ? "文稿与配图已确认" : "等待完整预览确认"}</strong><span>当前结果</span><strong>{workspace.publish.status === "draft_saved" ? "已暂存到小红书草稿" : workspace.publish.status === "published" ? "已公开发布" : "等待选择处理方式"}</strong></div><button className="publish-button" disabled={busy || !hasPublishableDraft} onClick={() => setPublishOpen(true)}>{busy && job.type === "publish" ? job.payload?.mode === "save_draft" ? "Agent 正在暂存" : "Agent 正在发布" : workspace.publish.status === "draft_saved" ? "重新选择处理方式" : workspace.publish.status === "published" ? "已发布" : "选择处理方式"}</button>{!reviewApproved && <p className="publish-hint">完整查看文稿和配图：有意见就提交调整；没有意见则点击“预览无误，确认可发布”。</p>}</section>
          </div>
        </aside>
      </main>

      {(message || busy) && <div className={`task-toast ${job?.status === "failed" ? "task-toast--error" : ""}`} role="status"><strong>{busy ? `Agent 任务：${job.type} · ${job.progress?.percent || 0}%` : "工作台消息"}</strong><span>{busy ? job.progress?.label || "任务执行中" : message}</span>{busy && <><div className="task-progress"><i style={{ width: `${job.progress?.percent || 0}%` }} /></div><small>已运行 {formatElapsed(job.createdAt)}；服务每 5 秒记录心跳，超过阶段上限会明确停止并报错。</small></>}</div>}
      {previewOpen && selectedAsset && <div className="modal-backdrop preview-backdrop" role="presentation" onMouseDown={() => setPreviewOpen(false)}><div className="image-preview-modal" role="dialog" aria-modal="true" aria-labelledby="image-preview-title" onMouseDown={(event) => event.stopPropagation()}><div className="image-preview-top"><div><p className="eyebrow">配图原图</p><h2 id="image-preview-title">第 {selectedAssetIndex + 1} 张 · {selectedCard?.headline}</h2></div><button className="secondary-button" onClick={() => setPreviewOpen(false)}>关闭预览</button></div><div className="image-preview-canvas"><img src={selectedAsset.url} alt={`第 ${selectedAssetIndex + 1} 张小红书配图原图`} /></div></div></div>}
      {publishOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPublishOpen(false)}><div className="confirm-modal publish-choice-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">最后一道人工闸门</p><h2 id="publish-title">这篇内容接下来怎么处理？</h2><p>两种方式都会由本地 Codex Agent 使用当前浏览器登录会话完成。请选择本轮唯一动作。</p><div className="publish-mode-grid"><button className={publishMode === "publish_now" ? "publish-mode-card publish-mode-card--active" : "publish-mode-card"} onClick={() => setPublishMode("publish_now")} aria-pressed={publishMode === "publish_now"}><span className="publish-mode-choice" aria-hidden="true" /><strong>立即发布</strong><small>上传并点击“发布”；只有取得笔记 ID 或 URL 才算成功。</small></button><button className={publishMode === "save_draft" ? "publish-mode-card publish-mode-card--active" : "publish-mode-card"} onClick={() => setPublishMode("save_draft")} aria-pressed={publishMode === "save_draft"}><span className="publish-mode-choice" aria-hidden="true" /><strong>暂缓发布</strong><small>上传并填好稿件后，点击创作页底部的“暂存离开”；不会公开发布。</small></button></div><div className="modal-summary"><span>标题</span><strong>{workspace.draft.title}</strong><span>配图</span><strong>{workspace.assets.length} 张 PNG</strong><span>本轮动作</span><strong>{publishMode === "save_draft" ? "暂缓发布 · 暂存离开" : "立即公开发布"}</strong></div><div className="modal-actions"><button className="secondary-button" onClick={() => setPublishOpen(false)}>返回检查</button><button className="publish-button" onClick={() => { const mode = publishMode; setPublishOpen(false); startJob("/api/jobs/publish", { mode, confirmation: mode === "save_draft" ? "SAVE_DRAFT_CONFIRMED" : "PUBLISH_NOW_CONFIRMED" }); }}>{publishMode === "save_draft" ? "确认暂存离开" : "确认立即发布"}</button></div></div></div>}
    </div>
  );
}
