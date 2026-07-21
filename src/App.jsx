import { useEffect, useMemo, useState } from "react";

const TERMINAL_JOB_STATES = new Set(["completed", "failed"]);

function publishStatusLabel(status) {
  if (status === "draft_saved") return "已暂存到小红书草稿";
  if (status === "published") return "已公开发布";
  if (status === "content_ready") return "内容已产出，发布默认关闭";
  if (status === "manual_published") return "已手动标记已发布";
  if (status === "failed") return "处理失败，可重试";
  if (status === "unknown") return "平台结果未确认";
  return "等待选择处理方式";
}

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
          <label>标题<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={20} /><small>{form.title.length}/20 · 小红书标题上限</small></label>
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
  const [seriesPreviewIndex, setSeriesPreviewIndex] = useState(null);
  const [reviewInput, setReviewInput] = useState("");
  const [revisionScope, setRevisionScope] = useState("both");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountCreateOpen, setAccountCreateOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountPositioning, setNewAccountPositioning] = useState("");
  const [publishBindingOpen, setPublishBindingOpen] = useState(false);
  const [publishAccountLabel, setPublishAccountLabel] = useState("");
  const [publishRiskAcknowledged, setPublishRiskAcknowledged] = useState(false);

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
          const updated = await refreshWorkspace();
          const businessMessage = next.result?.message || updated.publish?.message;
          setMessage(next.status === "completed" ? businessMessage || "Agent 任务已完成，工作台已更新。" : businessMessage || next.error || "Agent 任务失败");
        }
      } catch (error) { setMessage(error.message); }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  useEffect(() => {
    setSelectedAssetIndex(0);
    setPreviewOpen(false);
    setReviewInput("");
  }, [workspace?.accountContext?.activeAccountId, workspace?.assets?.[0]?.id]);

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

  async function switchAccount(accountId) {
    if (accountId === workspace.accountContext?.activeAccountId) {
      setAccountMenuOpen(false);
      return;
    }
    try {
      const next = await api("/api/accounts/active", { method: "PUT", body: JSON.stringify({ accountId }) });
      setWorkspace(next);
      setPositioning(next.positioning || "");
      setAccountMenuOpen(false);
      setPublishOpen(false);
      setPreviewOpen(false);
      setSeriesPreviewIndex(null);
      setMessage(`已切换到内容账号：${next.accountContext?.activeAccountName || "当前账号"}`);
    } catch (error) { setMessage(error.message); }
  }

  async function createAccount() {
    try {
      const next = await api("/api/accounts", { method: "POST", body: JSON.stringify({ name: newAccountName, positioning: newAccountPositioning }) });
      setWorkspace(next);
      setPositioning(next.positioning || "");
      setAccountMenuOpen(false);
      setAccountCreateOpen(false);
      setNewAccountName("");
      setNewAccountPositioning("");
      setMessage("已新建空白内容账号。先根据定位生成专属品牌角色与视觉语言，再刷新本账号热点。");
    } catch (error) { setMessage(error.message); }
  }

  async function savePublishBinding() {
    try {
      const next = await api("/api/publish-binding", {
        method: "PUT",
        body: JSON.stringify({ enabled: true, label: publishAccountLabel, confirmation: publishRiskAcknowledged ? "PUBLISH_RISK_ACKNOWLEDGED" : "" }),
      });
      setWorkspace(next);
      setPublishBindingOpen(false);
      setPublishRiskAcknowledged(false);
      setMessage(`已选择发布账号：${next.accountContext?.publishBinding?.label}。工作台不会保存登录信息。`);
    } catch (error) { setMessage(error.message); }
  }

  async function disablePublishBinding() {
    try {
      const next = await api("/api/publish-binding", { method: "PUT", body: JSON.stringify({ enabled: false }) });
      setWorkspace(next);
      setMessage("发布功能已关闭；后续内容只产出到本地 output，可手动标记故事线。");
    } catch (error) { setMessage(error.message); }
  }

  async function markPublished() {
    try {
      const next = await api("/api/storyline/mark-published", { method: "POST", body: "{}" });
      setWorkspace(next);
      setMessage("已手动标记为已发布，仅写入当前内容账号的故事线。");
    } catch (error) { setMessage(error.message); }
  }

  async function uploadBrandCharacter(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("头像仅支持 PNG、JPG 或 WebP 图片。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("头像图片不能超过 10MB。");
      return;
    }
    setUploadBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/brand-character/upload", { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "头像上传失败");
      setWorkspace(data);
      setMessage("头像已保存在本地。请确认预览后生成系列品牌形象。");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploadBusy(false);
    }
  }

  async function toggleCharacterLock() {
    try {
      const next = await api("/api/character-lock", { method: "PUT", body: JSON.stringify({ locked: !workspace.brandCharacter.locked }) });
      setWorkspace(next);
      setMessage(next.brandCharacter.locked ? "品牌角色母版与系列形象已锁定。" : "品牌角色已解除锁定，后续内容需要重新确认。");
    } catch (error) { setMessage(error.message); }
  }

  async function chooseImageCount(imageCount) {
    if (imageCount === workspace.generationSettings?.imageCount) return;
    if (workspace.draft && !window.confirm("修改配图数量会清空当前文稿、配图和审稿结果，是否继续？")) return;
    try {
      const next = await api("/api/generation-settings", { method: "PUT", body: JSON.stringify({ imageCount }) });
      setWorkspace(next);
      setMessage(`本轮将生成 ${imageCount} 张配图。`);
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
      setMessage(next.accountContext?.publishBinding?.enabled ? "文稿和配图已确认，可以选择发布方式。" : "文稿和配图已确认，已保留在本地 output；发布功能仍默认关闭。");
    } catch (error) { setMessage(error.message); }
  }

  if (!workspace) return <main className="boot-screen">正在打开本地工作台…</main>;

  const accountContext = workspace.accountContext || { accounts: [], publishBinding: { enabled: false }, output: { entries: [], latest: null }, researchOperator: null };
  const contentAccounts = accountContext.accounts || [];
  const publishBinding = accountContext.publishBinding || { enabled: false };
  const outputArchive = accountContext.output || { entries: [], latest: null };
  const isDemo = workspace.research.mode === "demo";
  const characterHasAvatar = Boolean(workspace.brandCharacter?.avatar);
  const characterSeries = workspace.brandCharacter?.series || [];
  const characterReady = workspace.brandCharacter?.status === "ready" && characterHasAvatar && characterSeries.length === 6;
  const characterLocked = characterReady && workspace.brandCharacter.locked;
  const characterGenerationIssue = workspace.brandCharacter?.generationIssue || null;
  const identityLock = workspace.brandCharacter?.identityLock || null;
  const imageCount = Number(workspace.generationSettings?.imageCount || 4);
  const topicSignals = selectedTopic?.evidenceRefs?.map((index) => workspace.research.signals[index]).filter(Boolean) || [];
  const topicHasVerifiedGraphics = topicSignals.length > 0 && topicSignals.every((signal) => signal.mediaKind === "graphic" && signal.imageCount > 0 && signal.engagement?.verified === true);
  const breakdownReady = workspace.breakdown?.topicId === selectedTopic?.id && workspace.breakdown?.status === "success";
  const rawDraftReady = workspace.draft?.mode === "raw";
  const humanizedDraftReady = workspace.draft?.mode === "humanized";
  const rawDraft = workspace.copyVersions?.raw || (rawDraftReady ? workspace.draft : null);
  const humanizedDraft = workspace.copyVersions?.humanized || (humanizedDraftReady ? workspace.draft : null);
  const storylineEntries = workspace.storyline?.entries || [];
  const assetsReady = humanizedDraftReady && workspace.assets.length > 0;
  const reviewApproved = assetsReady && workspace.review?.status === "approved";
  const hasPublishableDraft = reviewApproved && publishBinding.enabled && !["published", "manual_published"].includes(workspace.publish.status);
  const canMarkPublished = reviewApproved && workspace.publish.status !== "manual_published";
  const selectedAsset = workspace.assets[selectedAssetIndex] || workspace.assets[0];
  const selectedCard = workspace.draft?.imageCards?.[selectedAssetIndex];
  const selectedSeriesAsset = seriesPreviewIndex === null ? null : characterSeries[seriesPreviewIndex];
  const progressStep = ["published", "draft_saved", "content_ready", "manual_published"].includes(workspace.publish.status) ? 9 : reviewApproved ? 9 : assetsReady ? 8 : humanizedDraftReady ? 7 : rawDraftReady ? 6 : breakdownReady ? 5 : characterLocked ? (selectedTopic ? 4 : workspace.research.topics.length ? 3 : 2) : 1;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="header-account-zone">
          <div className="brand-block"><span className="brand-name">AGENT 小红书工作台</span><span className="brand-subtitle">多账号图文工作流</span></div>
          <div className="account-switcher">
            <button className="account-switcher-trigger" onClick={() => setAccountMenuOpen((open) => !open)} disabled={busy} aria-expanded={accountMenuOpen} aria-controls="content-account-menu">
              {workspace.brandCharacter?.avatar?.url && <img src={workspace.brandCharacter.avatar.url} alt="" />}
              <span><small>内容账号</small><strong>{accountContext.activeAccountName || "当前内容账号"}</strong></span>
              <em>切换</em>
            </button>
            {accountMenuOpen && <div className="account-switcher-menu" id="content-account-menu" role="menu">
              <div className="account-menu-heading"><strong>内容账号</strong><span>热点、品牌与故事线独立保存</span></div>
              <div className="account-menu-list">
                {contentAccounts.map((account) => <button key={account.id} className={account.id === accountContext.activeAccountId ? "account-menu-item account-menu-item--active" : "account-menu-item"} onClick={() => switchAccount(account.id)} disabled={busy} role="menuitem"><div className={account.avatarUrl ? "account-menu-item-copy account-menu-item-copy--with-avatar" : "account-menu-item-copy"}>{account.avatarUrl && <img src={account.avatarUrl} alt="" />}<strong>{account.name}</strong><small>{account.positioning || "尚未填写定位"}</small></div><span>{account.id === accountContext.activeAccountId ? "当前" : account.researchUpdatedAt ? "已缓存热点" : "待刷新"}</span></button>)}
              </div>
              <button className="account-create-button" onClick={() => { setAccountMenuOpen(false); setAccountCreateOpen(true); }} disabled={busy}>新建内容账号</button>
            </div>}
          </div>
        </div>
        <nav className="progress" aria-label="内容生产进度">
          {["账号定位", "品牌角色", "图文热点", "确认选题", "热点拆解", "生成文稿", "去 AI 味", "生成配图", "发布"].map((label, index) => (
            <div className={`progress-step ${index + 1 <= progressStep ? "progress-step--active" : ""}`} key={label}><span className="progress-number">{String(index + 1).padStart(2, "0")}</span><span>{label}</span></div>
          ))}
        </nav>
        <div className="runtime-status"><span className="operator-status"><span className={`runtime-dot ${accountContext.researchOperator?.status === "connected" ? "runtime-dot--live" : ""}`} /><span>采集执行账号：{accountContext.researchOperator?.status === "connected" ? "已连接（仅研究）" : "待连接"}</span></span><span className="runtime-divider" /><span>{toolStatus?.codex?.installed ? "Codex Agent 已就绪" : "正在检查本地 Agent"}</span><span className="runtime-divider" /><span>{toolStatus?.opencli?.installed ? "OpenCLI 已安装" : "OpenCLI 未连接"}</span></div>
      </header>

      <main className="workspace-grid">
        <section className="left-column">
          <div className="section-heading"><div><p className="eyebrow">01 / 账号基础</p><h1>{accountContext.activeAccountName || "当前内容账号"}：为谁解决什么问题</h1></div><StatusPill tone={workspace.research.updatedAt ? "live" : "warning"}>{isDemo ? "示例数据" : workspace.research.updatedAt ? "热点缓存可用" : "等待刷新"}</StatusPill></div>
          <div className="account-scope-bar"><div><span>采集执行账号</span><strong>{accountContext.researchOperator?.label || "当前浏览器小红书会话"}</strong><small>只负责按本账号定位检索；热点不会与其他内容账号共享。</small></div><div><span>发布账号</span><strong>{publishBinding.enabled ? publishBinding.label : "未绑定（默认关闭）"}</strong><small>{publishBinding.enabled ? "仅使用当前浏览器会话，不保存登录信息。" : "产出会停在预览与本地 output。"}</small></div></div>
          <div className="positioning-box">
            <label htmlFor="positioning">账号定位</label>
            <textarea id="positioning" value={positioning} onChange={(event) => setPositioning(event.target.value)} maxLength={500} />
            <div className="field-actions"><span>{positioning.length}/500</span><button className="text-button" onClick={savePositioning} disabled={busy}>保存定位</button><button className="primary-small" onClick={() => startJob("/api/jobs/research", { positioning })} disabled={busy || !positioning.trim()}>{busy && job.type === "research" ? "Agent 正在筛选图文" : workspace.research.updatedAt ? "刷新本账号热点" : "让 Agent 扫描本账号热点"}</button></div>
          </div>

          <section className="character-section">
            <div className="subheading-row">
              <div><p className="eyebrow">02 / 品牌主体</p><h2>{characterLocked ? "品牌主体与长期视觉已锁定" : characterHasAvatar ? "用本账号母版固化系列品牌形象" : positioning ? "根据本账号定位生成专属品牌形象" : "先填写账号定位，再设计专属品牌形象"}</h2></div>
              <StatusPill tone={characterLocked ? "live" : "warning"}>{characterLocked ? "品牌母版生效" : characterReady ? "等待锁定" : characterGenerationIssue ? "上次未生成，可重试" : characterHasAvatar ? "等待生成系列" : positioning ? "可生成品牌" : "等待定位"}</StatusPill>
            </div>
            <div className="character-builder">
              <div className="avatar-column">
                <div className="avatar-stage">
                  {characterHasAvatar ? <img src={workspace.brandCharacter.avatar.url} alt="当前内容账号的品牌主体母版" /> : <div className="avatar-empty"><strong>本账号品牌主体</strong><span>可按账号定位生成，也可上传任意本地图片</span></div>}
                </div>
                <label className="secondary-button avatar-upload-button" htmlFor="brand-avatar-upload">{uploadBusy ? "正在上传" : characterHasAvatar ? "更换本地图片" : "上传本地图片"}</label>
                <input id="brand-avatar-upload" className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadBrandCharacter} disabled={busy || uploadBusy} />
                <small>PNG / JPG / WebP，最大 10MB，宽高至少 256px</small>
              </div>
              <div className="character-controls">
                <label>品牌母版与视觉语言</label>
                <p className="brand-description">新账号默认按定位设计品牌主体、配色与版式；也可上传任意本地图片（人物、动物、物体、植物或图形）。Agent 会锁定可见特征，并把裁切参考图扩展为一致的半身、贴纸或吉祥物系列；所有配图都沿用这套母版。</p>
                {identityLock && <div className="identity-summary"><p><strong>品牌主体：</strong>{identityLock.subject || identityLock.character}</p><p><strong>可辨识特征：</strong>{identityLock.distinctiveFeatures || identityLock.faceAndHair}</p><p><strong>系列形态：</strong>{identityLock.canonicalForm || identityLock.outfit}</p><p><strong>绘制方式：</strong>{identityLock.renderingStyle}</p></div>}
                {characterReady && <><div className="brand-theme"><div><strong>{workspace.brandVisualIdentity?.name}</strong><span>{workspace.brandVisualIdentity?.typography}</span></div><Palette palette={workspace.brandVisualIdentity?.palette} /></div><p className="brand-rule">{workspace.brandVisualIdentity?.composition}</p></>}
                <div className="character-actions">
                  {!characterHasAvatar && <button className="primary-small" onClick={() => startJob("/api/jobs/avatar", { mode: "generate_from_brief", brief: `账号定位：${positioning}` })} disabled={busy || uploadBusy || !positioning.trim()}>{busy && job.type === "avatar" ? "Agent 正在生成品牌" : "按账号定位生成品牌角色"}</button>}
                  {characterHasAvatar && !characterReady && <button className="primary-small" onClick={() => startJob("/api/jobs/avatar", { mode: "uploaded_reference" })} disabled={busy || uploadBusy}>{busy && job.type === "avatar" ? "Agent 正在生成系列" : "生成 6 个品牌系列形象"}</button>}
                  {characterReady && <button className={characterLocked ? "secondary-button" : "primary-small"} onClick={toggleCharacterLock} disabled={busy || uploadBusy}>{characterLocked ? "解除角色锁定" : "确认并锁定品牌母版"}</button>}
                </div>
                {characterGenerationIssue && <p className="character-generation-error">上次系列生成未完成：{characterGenerationIssue.message} 你可以直接重试；动物或裁切头像不需要重新换图。</p>}
                {characterHasAvatar && <small>更换母版或解除锁定会使旧拆解、文稿和配图失效，但不会修改已发布故事线。</small>}
              </div>
            </div>
            {characterSeries.length > 0 && <div className="brand-series"><div className="brand-series-heading"><div><strong>系列品牌形象</strong><span>母版身份不变，只切换动作与表情；生成后可逐张查看原图</span></div><em>{characterSeries.length} / 6</em></div><div className="brand-series-grid">{characterSeries.map((asset, index) => <figure key={`${asset.action}-${index}`}><img src={asset.url} alt={`品牌角色动作：${asset.action}`} /><figcaption><span>{asset.action}</span><button className="series-preview-button" onClick={() => setSeriesPreviewIndex(index)} aria-label={`预览品牌角色动作：${asset.action}`}>预览</button></figcaption></figure>)}</div></div>}
          </section>

          <section className="evidence-section">
            <div className="subheading-row"><div><p className="eyebrow">03 / 本账号图文信号</p><h2>只保留通过媒体与爆款门槛的图文笔记</h2></div><span className="timestamp">{formatTime(workspace.research.updatedAt)}</span></div>
            <p className="research-summary">{workspace.research.summary}</p>
            <p className="research-cache-note">{workspace.research.updatedAt ? `未点击“刷新本账号热点”时，会继续使用 ${formatTime(workspace.research.updatedAt)} 抓取的本账号垂类热点。` : "填写定位后刷新本账号热点；结果只会写入当前内容账号。"}</p>
            <div className="signal-list">
              {workspace.research.signals.map((signal, index) => (
                <article className="signal-row" key={`${signal.label}-${index}`}>
                  <div className="signal-rank">{String(index + 1).padStart(2, "0")}</div>
                  <div className="signal-copy"><div className="signal-title-line"><strong>{signal.label}</strong><span>{signal.heat}</span>{signal.mediaKind === "graphic" && <em>图文 · {signal.imageCount} 图</em>}{signal.engagement?.verified && <em className="viral-badge">爆款已核验</em>}</div><p>{signal.evidence}</p>{signal.engagement?.verified ? <small className="engagement-line">赞 {signal.engagement.likes} · 藏 {signal.engagement.collects} · 评 {signal.engagement.comments}</small> : <small className="engagement-line engagement-line--warning">旧证据未通过爆款门槛，请重新扫描</small>}{signal.url && <a href={signal.url} target="_blank" rel="noreferrer">查看原始笔记</a>}</div>
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
            <div className="subheading-row"><div><p className="eyebrow">长期内容资产</p><h2>账号故事线</h2></div><div className="storyline-header-actions"><span className="topic-count">已标记 {storylineEntries.length} 篇</span></div></div>
            <p className="storyline-sync-status">多账号模式仅记录工作台中手动标记为“已发布”的内容，不读取当前浏览器账号的历史笔记，避免跨账号混入。</p>
            <div className="tone-anchor"><span>账号调性锚点</span><strong>{workspace.positioning}</strong><p>下一轮 Agent 会读取最近 12 篇已发布主题，兼顾故事线承接、相邻扩展与标题查重。</p></div>
            {storylineEntries.length === 0 ? <div className="storyline-empty"><strong>尚未记录已发布内容</strong><p>确认本轮预览后，可选择“手动标记已发布”。该动作只梳理故事线，不会调用小红书发布或读取平台记录。</p></div> : <div className="storyline-list">{[...storylineEntries].reverse().map((entry) => <article className="storyline-entry" key={entry.id}><span className="story-sequence">{String(entry.sequence).padStart(2, "0")}</span><div><div className="storyline-entry-heading"><strong>{entry.topic?.title || entry.draft?.title}</strong><time>{formatTime(entry.publishedAt)}</time></div><p>{entry.topic?.angle}</p><small>{entry.source === "manual_published_mark" ? "手动标记已发布 · 仅用于故事线" : entry.topic?.reason}</small><div className="story-tags">{entry.draft?.tags?.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}</div>{entry.url && <a href={entry.url} target="_blank" rel="noreferrer">查看已发布笔记</a>}</div></article>)}</div>}
          </section>
        </section>

        <aside className="right-column">
          <div className="right-sticky">
            <div className="selected-header"><p className="eyebrow">已确认选题</p><h2>{selectedTopic?.title || "等待选择选题"}</h2><p>{selectedTopic?.reason || "先在左侧运行热点研究并选择方向。"}</p></div>

            {!breakdownReady ? (
              <section className="breakdown-empty">
                <div><p className="eyebrow">05 / 热点拆解</p><h3>先理解为什么它有效，再生成原创内容</h3><p>{!characterLocked ? "请先锁定品牌角色。" : topicHasVerifiedGraphics ? "Agent 将用一个 Lingzao GitHub Skill 完成爆款类型、标题封面、逐页结构、互动机制和原创改写拆解。" : "当前热点尚未同时通过图文媒体与爆款门槛，请先重新扫描。"}</p></div>
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
                  <div className="image-count-selector"><div><strong>本轮配图数量</strong><span>数量会同步到文稿卡片、角色动作、预览与发布</span></div><div className="image-count-options" role="group" aria-label="选择本轮配图数量">{[1, 2, 3, 4, 5, 6].map((count) => <button className={count === imageCount ? "image-count-option image-count-option--active" : "image-count-option"} key={count} onClick={() => chooseImageCount(count)} disabled={busy} aria-pressed={count === imageCount}>{count}</button>)}</div></div>
                </section>

                {!workspace.draft && <button className="generate-button generate-button--primary" onClick={() => startJob("/api/jobs/draft", { topicId: selectedTopic?.id, visualDirectionId: selectedDirection?.id })} disabled={busy || !selectedDirection || !characterLocked}>{busy && job.type === "draft" ? "Agent 正在生成初稿" : `生成文稿 · ${imageCount} 张配图`}</button>}
              </>
            )}

            {(rawDraft || humanizedDraft) && <section className="copy-version-studio">
              <div className="copy-studio-heading"><div><p className="eyebrow">06—07 / 文稿版本</p><h3>原始文稿与去 AI 味版本都可直接编辑</h3></div><p>保存上游版本会主动清空失效的下游资产，避免旧配图或旧审稿结果被误发布。</p></div>
              <div className="copy-version-grid"><DraftVersionEditor version="raw" label="06 / 原始文稿" draft={rawDraft} busy={busy} onSave={saveDraft} /><DraftVersionEditor version="humanized" label="07 / 去 AI 味文稿" draft={humanizedDraft} busy={busy} onSave={saveDraft} /></div>
            </section>}

            {rawDraftReady && <section className="humanize-panel"><div><p className="eyebrow">07 / 中文去 AI 味</p><h3>先保留事实和观点，再把表达改得像真人</h3><p>使用本项目 humanized-chinese-writing-polisher Skill；不会新增经历、数据或营销号热梗。</p></div><button className="generate-button generate-button--primary" onClick={() => startJob("/api/jobs/humanize", {})} disabled={busy}>{busy && job.type === "humanize" ? "Agent 正在诊断并润色" : "执行去 AI 味"}</button></section>}

            {humanizedDraftReady && !assetsReady && workspace.humanization?.status === "completed" && <section className="humanize-result"><div className="subheading-row compact"><div><p className="eyebrow">去 AI 味记录</p><h3>已通过中文真人感质量检查</h3></div><StatusPill tone="live">单一 Skill</StatusPill></div><ul>{workspace.humanization.revisionNotes?.map((note) => <li key={note}>{note}</li>)}</ul></section>}

            {humanizedDraftReady && !assetsReady && <button className="generate-button generate-button--primary" onClick={() => startJob("/api/jobs/illustrate", {})} disabled={busy}>{busy && job.type === "illustrate" ? "Agent 正在生成逐页角色动作" : `生成 ${imageCount} 张配图与角色动作`}</button>}

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
                <div className="review-actions"><span>{reviewInput.length}/1200 · 输入意见后执行调整；留空则确认当前版本</span><button className="secondary-button" onClick={() => startJob("/api/jobs/revise", { feedback: reviewInput, scope: revisionScope })} disabled={busy || !reviewInput.trim()}>{busy && job.type === "revise" ? "Agent 正在按意见调整" : "按意见调整"}</button><button className="publish-button" onClick={approveReview} disabled={busy || Boolean(reviewInput.trim()) || reviewApproved}>{reviewApproved ? "预览已确认" : publishBinding.enabled ? "预览无误，确认可发布" : "预览无误，确认产出"}</button></div>
              </div>
            </section>}

            <section className="publish-panel">
              <div className="publish-copy"><div><p className="eyebrow">09 / 发布与归档</p><h3>{publishBinding.enabled ? "预览确认后，选择立即发布或暂缓发布" : "默认停在内容产出与人工确认"}</h3></div><p>{publishBinding.enabled ? "立即发布需要笔记 ID/URL；暂缓发布只有在草稿箱出现标题和配图数匹配的新记录后才算成功。" : "本账号没有启用发布；完成后会保留文稿和配图到本地 output，也可以仅手动标记故事线。"}</p></div>
              <div className="publish-meta"><span>审稿状态</span><strong>{reviewApproved ? "文稿与配图已确认" : "等待完整预览确认"}</strong><span>发布账号</span><strong>{publishBinding.enabled ? publishBinding.label : "未绑定（默认关闭）"}</strong><span>本地输出</span><strong>{outputArchive.latest?.relativePath || "将在生成配图后创建"}</strong><span>当前结果</span><strong>{publishStatusLabel(workspace.publish.status)}</strong></div>
              <div className="publish-actions">
                {publishBinding.enabled ? <><button className="publish-button" disabled={busy || !hasPublishableDraft} onClick={() => setPublishOpen(true)}>{busy && job.type === "publish" ? job.payload?.mode === "save_draft" ? "Agent 正在暂存" : "Agent 正在发布" : workspace.publish.status === "draft_saved" ? "重新选择处理方式" : workspace.publish.status === "published" ? "已发布" : ["failed", "unknown"].includes(workspace.publish.status) ? "重试处理" : "选择处理方式"}</button><button className="text-button publish-binding-toggle" onClick={disablePublishBinding} disabled={busy}>关闭发布功能</button></> : <button className="publish-button" onClick={() => { setPublishAccountLabel(""); setPublishRiskAcknowledged(false); setPublishBindingOpen(true); }} disabled={busy}>选择发布账号</button>}
                <button className="secondary-button manual-storyline-button" onClick={markPublished} disabled={busy || !canMarkPublished}>{workspace.publish.status === "manual_published" ? "已标记已发布" : "手动标记已发布"}</button>
              </div>
              {workspace.publish?.message && ["failed", "unknown"].includes(workspace.publish.status) && <p className="publish-hint publish-hint--error">{workspace.publish.message}</p>}
              {!reviewApproved && <p className="publish-hint">完整查看文稿和配图：有意见就提交调整；留空确认后即可完成本地内容产出。</p>}
            </section>
          </div>
        </aside>
      </main>

      {(message || busy) && <div className={`task-toast ${job?.status === "failed" || ["failed", "unknown"].includes(job?.result?.status) ? "task-toast--error" : ""}`} role="status"><strong>{busy ? `Agent 任务：${job.type} · ${job.progress?.percent || 0}%` : "工作台消息"}</strong><span>{busy ? job.progress?.label || "任务执行中" : message}</span>{busy && <><div className="task-progress"><i style={{ width: `${job.progress?.percent || 0}%` }} /></div><small>已运行 {formatElapsed(job.createdAt)}；服务每 5 秒记录心跳，超过阶段上限会明确停止并报错。</small></>}</div>}
      {selectedSeriesAsset && <div className="modal-backdrop preview-backdrop" role="presentation" onMouseDown={() => setSeriesPreviewIndex(null)}><div className="image-preview-modal series-preview-modal" role="dialog" aria-modal="true" aria-labelledby="series-preview-title" onMouseDown={(event) => event.stopPropagation()}><div className="image-preview-top"><div><p className="eyebrow">品牌角色原图</p><h2 id="series-preview-title">{seriesPreviewIndex + 1} / {characterSeries.length} · {selectedSeriesAsset.action}</h2></div><button className="secondary-button" onClick={() => setSeriesPreviewIndex(null)}>关闭预览</button></div><div className="image-preview-canvas series-preview-canvas"><img src={selectedSeriesAsset.url} alt={`品牌角色动作原图：${selectedSeriesAsset.action}`} /></div><div className="review-nav"><button className="secondary-button" onClick={() => setSeriesPreviewIndex((index) => Math.max(0, index - 1))} disabled={seriesPreviewIndex === 0}>上一张</button><button className="secondary-button" onClick={() => setSeriesPreviewIndex((index) => Math.min(characterSeries.length - 1, index + 1))} disabled={seriesPreviewIndex === characterSeries.length - 1}>下一张</button></div></div></div>}
      {previewOpen && selectedAsset && <div className="modal-backdrop preview-backdrop" role="presentation" onMouseDown={() => setPreviewOpen(false)}><div className="image-preview-modal" role="dialog" aria-modal="true" aria-labelledby="image-preview-title" onMouseDown={(event) => event.stopPropagation()}><div className="image-preview-top"><div><p className="eyebrow">配图原图</p><h2 id="image-preview-title">第 {selectedAssetIndex + 1} 张 · {selectedCard?.headline}</h2></div><button className="secondary-button" onClick={() => setPreviewOpen(false)}>关闭预览</button></div><div className="image-preview-canvas"><img src={selectedAsset.url} alt={`第 ${selectedAssetIndex + 1} 张小红书配图原图`} /></div></div></div>}
      {publishOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPublishOpen(false)}><div className="confirm-modal publish-choice-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">最后一道人工闸门</p><h2 id="publish-title">这篇内容接下来怎么处理？</h2><p>两种方式都会由本地 Codex Agent 使用当前浏览器登录会话完成。请选择本轮唯一动作。</p><div className="publish-mode-grid"><button className={publishMode === "publish_now" ? "publish-mode-card publish-mode-card--active" : "publish-mode-card"} onClick={() => setPublishMode("publish_now")} aria-pressed={publishMode === "publish_now"}><span className="publish-mode-choice" aria-hidden="true" /><strong>立即发布</strong><small>上传并点击“发布”；只有取得笔记 ID 或 URL 才算成功。</small></button><button className={publishMode === "save_draft" ? "publish-mode-card publish-mode-card--active" : "publish-mode-card"} onClick={() => setPublishMode("save_draft")} aria-pressed={publishMode === "save_draft"}><span className="publish-mode-choice" aria-hidden="true" /><strong>暂缓发布</strong><small>上传并填好稿件后，点击创作页底部的“暂存离开”；不会公开发布。</small></button></div><div className="modal-summary"><span>标题</span><strong>{workspace.draft.title}</strong><span>配图</span><strong>{workspace.assets.length} 张 PNG</strong><span>本轮动作</span><strong>{publishMode === "save_draft" ? "暂缓发布 · 暂存离开" : "立即公开发布"}</strong></div><div className="modal-actions"><button className="secondary-button" onClick={() => setPublishOpen(false)}>返回检查</button><button className="publish-button" onClick={() => { const mode = publishMode; setPublishOpen(false); startJob("/api/jobs/publish", { mode, confirmation: mode === "save_draft" ? "SAVE_DRAFT_CONFIRMED" : "PUBLISH_NOW_CONFIRMED" }); }}>{publishMode === "save_draft" ? "确认暂存离开" : "确认立即发布"}</button></div></div></div>}
      {accountCreateOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAccountCreateOpen(false)}><div className="confirm-modal account-create-modal" role="dialog" aria-modal="true" aria-labelledby="account-create-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">新建内容账号</p><h2 id="account-create-title">从一套空白品牌与独立热点池开始</h2><p>新账号不会继承当前账号的热点、品牌角色、视觉语言、故事线或发布设置。填写定位后，Agent 会为它重新设计品牌。</p><div className="account-create-form"><label>账号名称<input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} maxLength={40} placeholder="例如：AI 职场观察" autoFocus /></label><label>账号定位（可稍后填写）<textarea value={newAccountPositioning} onChange={(event) => setNewAccountPositioning(event.target.value)} maxLength={500} placeholder="例如：高频使用 AI 的职场人，分享工具、方法与真实工作流" /></label></div><div className="modal-actions"><button className="secondary-button" onClick={() => setAccountCreateOpen(false)}>取消</button><button className="publish-button" onClick={createAccount} disabled={!newAccountName.trim()}>创建并切换</button></div></div></div>}
      {publishBindingOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPublishBindingOpen(false)}><div className="confirm-modal publish-binding-modal" role="dialog" aria-modal="true" aria-labelledby="publish-binding-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">选择发布账号</p><h2 id="publish-binding-title">只绑定当前浏览器会话，不保存登录信息</h2><p>先在浏览器中手动登录你希望发布的目标小红书账号，再在这里填写一个识别名称。自动发布或暂存都有可能触发小红书风控，请谨慎使用。</p><div className="account-create-form"><label>当前浏览器中的发布账号名称<input value={publishAccountLabel} onChange={(event) => setPublishAccountLabel(event.target.value)} maxLength={40} placeholder="例如：AI 职场观察发布号" autoFocus /></label><label className="risk-confirmation"><input type="checkbox" checked={publishRiskAcknowledged} onChange={(event) => setPublishRiskAcknowledged(event.target.checked)} />我已确认：工作台不会保存 Cookie；自动发布或暂存可能触发小红书风控，我会自行确认当前浏览器账号。</label></div><div className="modal-actions"><button className="secondary-button" onClick={() => setPublishBindingOpen(false)}>取消</button><button className="publish-button" onClick={savePublishBinding} disabled={!publishAccountLabel.trim() || !publishRiskAcknowledged}>启用本账号发布</button></div></div></div>}
    </div>
  );
}
