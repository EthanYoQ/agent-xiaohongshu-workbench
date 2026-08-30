import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  Check, ChevronDown, Clipboard, Copy, Download, Eye, EyeOff, Image as ImageIcon,
  Crop, ImagePlus, Layers3, Library, Lock, Minus, Move, Palette, Plus, Redo2, RefreshCw, RotateCcw, Save,
  Search, SlidersHorizontal, Trash2, Type, Undo2, Unlock, Upload, UserRound, X,
} from "lucide-react";
import { buildPublishZip } from "./publish-package.mjs";
import {
  admitProducerWithVerdict, admitSingleExpansion, deletePage, duplicatePage, generateContentPackage,
  generateWithProvider, importLocalEditableDraft, inspectImportContract, invalidateVisualReview,
  parseContentPackage, publishCopy, reorderPage, TEXT_FONT_FAMILIES,
} from "./content-engine.mjs";
import { BENCHMARK_CLASS_LABELS, PROFILE_FIELDS, buildGenerationContract, createProfileV2, parseProfileV2 } from "./profile-v2.mjs";
import { createLocalHttpProvider } from "./provider-client.mjs";
import { loadLocalDraft } from "./draft-loader.mjs";
import { createEditorHistory, redoEditorHistory, undoEditorHistory, updateEditorHistory } from "./editor-history.mjs";
import {
  REORDERABLE_LAYER_KEYS, TEXT_LAYER_KEYS, layerIsLocked, layerIsVisible,
  layerZIndex, moveLayer, setLayerFlag,
} from "./layer-model.mjs";
import { buildWorkspaceBackup, parseWorkspaceBackup, persistWorkspaceState, prepareFreshDraftWorkspace } from "./workspace-state.mjs";
import { generationFailureFeedback, providerHealthState } from "./generation-feedback.mjs";
import { GENERATION_SESSION_SCHEMA, loadGenerationSession, persistGenerationSession } from "./generation-session.mjs";
import { deriveCreatorJourney } from "./creator-journey.mjs";
import { REALITY_METRICS, REALITY_WINDOWS, createRealityFeedback, normalizeRealityFeedback, realityFeedbackStatus, updateRealityFeedback } from "./reality-feedback.mjs";
import {
  COMPOSITION_MODES, DESIGN_PRESETS, applyCompositionMode, applyDesignPreset,
  backgroundCss, backgroundStyleForPage, compositionModeForPage,
} from "./design-presets.mjs";
import {
  IMAGE_FRAME_MIN, IMAGE_SCALE_MAX, IMAGE_SCALE_MIN, imageElementStyle,
  imageCropSourceStyle, nudgeImageScale, panImageFocalPoint, preserveImageCropForFrameResize, resizeImageFrame, resizeTextFrame,
} from "./canvas-image.mjs";
import { infoPanelMediaStyle, panelCropForIndex } from "./infographic-panels.mjs";
import {
  IMAGE_CONTEXT_FIELDS, TEXT_CONTEXT_FIELDS, deletePromptHistory, parsePromptMemory,
  promptContextForProvider, rememberPromptValues,
} from "./prompt-context.mjs";
import { PRODUCTION_MODES, productionModeLabel } from "./production-mode.mjs";
import { estimateMotherSheetPlan } from "./mother-sheet.mjs";
import { SMART_LAYOUT_RECIPES, applySmartLayoutSequence, buildEditablePanelLayout, layoutRecipeForPage, layoutRecipeOptionsForPage } from "./smart-layout.mjs";
import { MaturePageEditor, renderMaturePageToPng } from "./MaturePageEditor.jsx";
import { HtmlPageEditor, renderHtmlPageToPng } from "./HtmlPageEditor.jsx";
import { editorModeForPage } from "./html-layout.mjs";
import { XIAOSHIMEI_AVATAR_DATA_URL } from "../api/xiaoshimei-avatar-data.mjs";
import "./styles.css";

const STORAGE_KEY = "xiaoshimei-studio.local-beta.v1";
const LIBRARY_KEY = "xiaoshimei-studio.library.local-beta.v1";
const PROFILE_KEY = "xiaoshimei-studio.profile.v2";
const PROMPT_MEMORY_KEY = "xiaoshimei-studio.prompt-memory.v1";
const GENERATION_FAILURE_KEY = "xiaoshimei-studio.last-generation-failure.v1";
const GENERATION_SESSION_KEY = "xiaoshimei-studio.generation-session.v1";
const STORAGE_KEYS = { content: STORAGE_KEY, library: LIBRARY_KEY, profile: PROFILE_KEY };
const DEFAULT_TOPIC = "工作太久眼睛发紧，如何用3分钟离屏恢复状态？";
const IS_PUBLIC_RUNTIME = !new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(window.location.hostname);
const PROVIDER_URL = String(import.meta.env.VITE_XIAOSHIMEI_PROVIDER_URL || (IS_PUBLIC_RUNTIME ? `${window.location.origin}/api/provider/generate` : "http://127.0.0.1:4175/generate")).trim();
const TEXT_FONT_OPTIONS = Object.freeze([
  { id: "songti", label: "华文宋体", stack: '"STSong", "华文宋体", "Songti SC", serif' },
  { id: "heiti", label: "华文黑体", stack: '"STHeiti", "华文黑体", "Heiti SC", "PingFang SC", sans-serif' },
  { id: "kaiti", label: "楷体", stack: '"Kaiti SC", "STKaiti", "KaiTi", serif' },
  { id: "fangsong", label: "仿宋", stack: '"STFangsong", "FangSong", serif' },
  { id: "yuanti", label: "圆体", stack: '"Yuanti SC", "STYuanti", "PingFang SC", sans-serif' },
  { id: "pingfang", label: "苹方", stack: '"PingFang SC", "Hiragino Sans GB", sans-serif' },
]);
const TEXT_FONT_STACKS = Object.freeze(Object.fromEntries(TEXT_FONT_OPTIONS.map(({ id, stack }) => [id, stack])));
if (TEXT_FONT_OPTIONS.some(({ id }) => !TEXT_FONT_FAMILIES.includes(id))) throw new Error("text font options drifted from the content contract");

function safeParse(value) {
  try { return parseContentPackage(value); } catch { return null; }
}

async function copyTextToClipboard(value) {
  const text = String(value || "");
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Localhost/IAB can expose Clipboard API while denying the write. Fall
    // through to the selection-based path instead of showing a false success.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let copied = false;
  try { copied = document.execCommand("copy"); } finally { textarea.remove(); }
  if (!copied) throw new Error("CLIPBOARD_WRITE_FAILED");
  return true;
}

function researchPositioningFromProfile(profile) {
  const goal = String(profile?.account_goal || "").trim();
  const pillars = Array.isArray(profile?.content_portfolio?.active_pillars)
    ? profile.content_portfolio.active_pillars.filter(Boolean).join("、")
    : "";
  return [goal, pillars ? `内容支柱：${pillars}` : ""].filter(Boolean).join("\n");
}

function loadStored() {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function loadLibrary() {
  try {
    const value = JSON.parse(localStorage.getItem(LIBRARY_KEY));
    return Array.isArray(value) ? value.map((item) => safeParse(JSON.stringify(item))).filter(Boolean) : [];
  } catch { return []; }
}

function collectReusableImageAssets(content, library) {
  const assets = [];
  const seen = new Set();
  const add = (imageStyle, label) => {
    const src = String(imageStyle?.src || "").trim();
    if (!src || imageStyle?.hidden) return;
    const crop = imageStyle?.crop && typeof imageStyle.crop === "object" ? imageStyle.crop : null;
    const key = `${src}|${JSON.stringify(crop || {})}`;
    if (seen.has(key)) return;
    seen.add(key);
    assets.push({
      id: key,
      label,
      src,
      imageStyle: {
        ...imageStyle,
        hidden: false,
        ...(crop ? { crop: { ...crop } } : {}),
      },
    });
  };
  const addPackage = (pkg, sourceLabel) => {
    (pkg?.pages || []).forEach((page, pageIndex) => {
      (page.info_panels || []).forEach((panel, panelIndex) => add(panel.image_style, `${sourceLabel} · 第 ${pageIndex + 1} 页插画 ${panelIndex + 1}`));
      if (!page.info_panels?.length) add(page.image_style, `${sourceLabel} · 第 ${pageIndex + 1} 页`);
    });
  };
  addPackage(content, "当前稿件");
  (library || []).forEach((item, index) => addPackage(item, item.selectedTitle || `过往稿件 ${index + 1}`));
  return assets.slice(0, 36);
}

function loadProfile() {
  try { return parseProfileV2(localStorage.getItem(PROFILE_KEY)); }
  catch { return createProfileV2(); }
}

function loadPromptMemory() {
  return parsePromptMemory(localStorage.getItem(PROMPT_MEMORY_KEY));
}

function loadGenerationFailure() {
  try {
    const value = JSON.parse(localStorage.getItem(GENERATION_FAILURE_KEY));
    if (!value || typeof value !== "object" || typeof value.title !== "string") return null;
    if (value.technical_code) {
      return generationFailureFeedback({ message: value.technical_code, providerCode: value.technical_code, providerStage: value.stage, failureId: value.failure_id });
    }
    return value;
  } catch { return null; }
}

function jsonBlob(value) {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
}

async function downloadBlob(name, blob) {
  let url;
  let revoke = false;
  let transport = "http_attachment";
  let savedPath = null;
  try {
    const response = await fetch("/api/local-export", {
      method: "POST",
      headers: { "content-type": blob.type || "application/octet-stream", "x-export-filename": encodeURIComponent(name) },
      body: blob,
    });
    const result = await response.json();
    if (!response.ok || !result.download_url) throw new Error(result.error || `HTTP ${response.status}`);
    url = result.download_url;
    savedPath = result.saved_path || null;
  } catch {
    transport = "blob_fallback";
    url = URL.createObjectURL(blob);
    revoke = true;
  }
  window.__xiaoshimeiLastDownload = { name, size: blob.size, type: blob.type, transport, saved_path: savedPath, completed_at: new Date().toISOString() };
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { transport, savedPath };
}

function explainExportFailure(error) {
  const message = String(error?.message || error || "未知错误");
  const missing = /^HTML_EXPORT_IMAGE_MISSING:page-(\d+):([^:]+)(?::.*)?$/.exec(message);
  if (missing) return `第 ${missing[1]} 页的插图没有进入导出结果（对象 ${missing[2]}）。原稿和编辑仍保留，请检查该图后重试。`;
  const overflow = /^HTML_LAYOUT_OVERFLOW:page-(\d+):(.*)$/.exec(message);
  if (overflow) {
    const reason = overflow[2].split("|").map((item) => {
      if (item.startsWith("IMAGE_ASPECT_MISMATCH")) return "插图不是 3:4";
      if (item.startsWith("HORIZONTAL_OVERFLOW") || item.startsWith("TEXT_BOX_OVERFLOW")) return "文字或图片越出左右页边";
      if (item.startsWith("FOOTER_COLLISION") || item === "PAGE_SCROLL_OVERFLOW") return "内容越出底部安全区";
      if (item.includes("OVERLAP") || item.startsWith("PANEL_CHILD_ESCAPE")) return "图文模块发生重叠";
      return "版面超出安全区";
    })[0];
    return `第 ${overflow[1]} 页${reason}，发布包未生成。原稿已保留，请调整该页后重试。`;
  }
  if (message.includes("HTML_EXPORT_IMAGE_LOAD_FAILED")) return "有插图尚未加载完成，发布包未生成。原稿已保留，请等待图片出现后重试。";
  if (message.includes("EXPORT_BLANK_OR_FLAT")) return "检测到空白导出页，发布包未生成。原稿已保留，请检查当前页后重试。";
  return `下载没有完成：${message.split("\n")[0]}`;
}


function PromptContextField({ field, value, history, onChange, onRemember, onUse, onDelete, rows = 3, className = "" }) {
  return <section className={`prompt-context-field ${className}`}>
    <label>
      <span>{field.label}</span>
      {field.helper && <small>{field.helper}</small>}
      <textarea rows={rows} value={value} placeholder={field.placeholder || ""} onChange={(event) => onChange(event.target.value)} onBlur={() => onRemember(value)} />
    </label>
    {history.length > 0 && <details className="prompt-history">
      <summary>历史记录 · {history.length} 条 <ChevronDown /></summary>
      <div className="prompt-history__list">{history.map((entry) => <article key={entry.id}>
        <button className="prompt-history__use" type="button" aria-label={`使用${field.label}历史记录：${entry.value.slice(0, 36)}`} onClick={() => onUse(entry.value)}><span>{entry.value}</span><small>{new Date(entry.saved_at).toLocaleString("zh-CN", { hour12: false })}</small></button>
        <button className="prompt-history__delete" type="button" aria-label={`删除${field.label}历史记录`} onClick={() => onDelete(entry.id)}><Trash2 /></button>
      </article>)}</div>
    </details>}
  </section>;
}

function imageFrameForPage(page) {
  if (page.image_style.frame) return page.image_style.frame;
  if (page.page_role === "hook" && page.layout === "scene") return { x: 52, y: 8, width: 43, height: 60 };
  if (page.layout === "scene") return { x: 28, y: 4, width: 64, height: 50 };
  if (page.layout === "split-reverse") return { x: 0, y: 33, width: 34, height: 67 };
  if (page.layout === "closing") return { x: 65, y: 33, width: 35, height: 67 };
  return { x: 61, y: 33, width: 39, height: 67 };
}

function textBoxBackground(style = {}) {
  if (style.backgroundOpacity == null || Number(style.backgroundOpacity) <= 0) return {};
  return {
    background: `color-mix(in srgb, ${style.backgroundColor || "#fffaf1"} ${Math.round(Number(style.backgroundOpacity) * 100)}%, transparent)`,
    borderRadius: `${Number(style.backgroundRadius ?? 12)}px`,
  };
}

function infoObjectSelection(value) {
  const match = /^info-(panel|text|image)-(\d+)$/.exec(String(value || ""));
  if (!match) return null;
  return { kind: match[1] === "panel" ? "text" : match[1], index: Number(match[2]) };
}

function panelSelectionIndex(value) {
  return infoObjectSelection(value)?.index ?? null;
}


function FailureNotice({ feedback, onRetry }) {
  if (!feedback) return null;
  return <div className="generation-error" role="alert" data-error-code={feedback.code}>
    <div><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>
    <footer><code>{feedback.stage === "image" ? "图片" : "文字"} · {feedback.technical_code || feedback.code}</code><button type="button" onClick={onRetry}>重试{feedback.stage === "image" ? "图片" : "文字"}</button></footer>
  </div>;
}


function ProfileEditor({ profile, onChange, onSave, onImport, importRef }) {
  const setField = (field, value) => onChange({ ...profile, [field]: value, updated_at: new Date().toISOString() });
  const setPersona = (field, value) => onChange({ ...profile, persona: { ...profile.persona, [field]: value }, updated_at: new Date().toISOString() });
  const setPortfolio = (field, value) => onChange({ ...profile, content_portfolio: { ...profile.content_portfolio, [field]: value }, updated_at: new Date().toISOString() });
  const setBenchmark = (index, field, value) => onChange({ ...profile, updated_at: new Date().toISOString(), benchmark_pool: profile.benchmark_pool.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) });
  return <section className="profile-view">
    <header><div><span>PROFILE v2</span><h1>小师妹账号生产合同</h1><p>人物 IP 固定；三类对标拥有不同权限，不会相互冒充。</p></div><div className="profile-actions"><button onClick={onSave}><Save />保存</button><button onClick={() => importRef.current?.click()}><Upload />回载</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={onImport} /><button onClick={() => downloadBlob("xiaoshimei-profile-v2.json", jsonBlob(profile))}><Download />档案 JSON</button><button onClick={() => downloadBlob("xiaoshimei-generation-contract-v2.json", jsonBlob(buildGenerationContract(profile)))}><Download />生成合同</button></div></header>
    <div className="profile-grid">
      <section className="profile-card profile-card--persona"><h2>人格内核</h2><p className="profile-card__note">“小师妹是谁”与“今天讲什么”分开。人格稳定，栏目可以演化。</p>
        <label><span>角色定位</span><textarea rows="3" value={profile.persona.role} onChange={(event) => setPersona("role", event.target.value)} /></label>
        <label><span>聪明与观察</span><textarea rows="3" value={profile.persona.intelligence} onChange={(event) => setPersona("intelligence", event.target.value)} /></label>
        <label><span>锋芒边界</span><textarea rows="3" value={profile.persona.edge} onChange={(event) => setPersona("edge", event.target.value)} /></label>
        <label><span>善意边界</span><textarea rows="3" value={profile.persona.kindness} onChange={(event) => setPersona("kindness", event.target.value)} /></label>
        <label><span>说话方式</span><textarea rows="3" value={profile.persona.voice} onChange={(event) => setPersona("voice", event.target.value)} /></label>
      </section>
      <section className="profile-card profile-card--portfolio"><h2>内容组合</h2><p className="profile-card__note">当前主航道与实验栏目，不会反过来改写人格。</p>
        <label><span>主航道（每行一个）</span><textarea rows="6" value={profile.content_portfolio.active_pillars.join("\n")} onChange={(event) => setPortfolio("active_pillars", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></label>
        <label><span>实验栏目（每行一个）</span><textarea rows="5" value={profile.content_portfolio.experiments.join("\n")} onChange={(event) => setPortfolio("experiments", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></label>
      </section>
      <section className="profile-card profile-card--identity"><h2>品牌与事实合同</h2>{PROFILE_FIELDS.map(([field, label]) => <label key={field}><span>{label}</span><textarea rows={field === "account_owner" ? 2 : 4} value={profile[field]} onChange={(event) => setField(field, event.target.value)} /></label>)}<label><span>允许场景元素（每行一个）</span><textarea rows="5" value={profile.allowed_scene_elements.join("\n")} onChange={(event) => setField("allowed_scene_elements", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></label><label><span>事实与表达边界（每行一个）</span><textarea rows="7" value={profile.claim_boundaries.join("\n")} onChange={(event) => setField("claim_boundaries", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></label></section>
      <section className="profile-card profile-card--benchmarks"><div className="profile-card__head"><div><h2>Benchmark Pool</h2><p>只有已确认的现实同级对标可影响账号策略。</p></div></div>{profile.benchmark_pool.map((item, index) => <article key={`${item.class}-${index}`} className={`benchmark benchmark--${item.class.toLowerCase()}`}><div className="benchmark__head"><span>{BENCHMARK_CLASS_LABELS[item.class]}</span><select value={item.status} onChange={(event) => setBenchmark(index, "status", event.target.value)}><option value="CONFIRMED">已确认</option><option value="CANDIDATE">候选</option><option value="EVIDENCE_PENDING">待证据</option><option value="EXCLUDED">已排除</option></select></div><label><span>账号 / 样本</span><input value={item.account} onChange={(event) => setBenchmark(index, "account", event.target.value)} /></label><label><span>证据</span><textarea rows="3" value={item.evidence.join("\n")} onChange={(event) => setBenchmark(index, "evidence", event.target.value.split("\n").filter(Boolean))} /></label><label><span>可迁移机制</span><textarea rows="3" value={item.transferable_mechanism.join("\n")} onChange={(event) => setBenchmark(index, "transferable_mechanism", event.target.value.split("\n").filter(Boolean))} /></label><label><span>明确排除</span><textarea rows="3" value={item.exclusions.join("\n")} onChange={(event) => setBenchmark(index, "exclusions", event.target.value.split("\n").filter(Boolean))} /></label></article>)}</section>
    </div>
  </section>;
}

const PALM_CHART = Object.freeze({
  bg: "#F0EFEB", text: "#58402E", data: "#43593B", olive: "#77835A",
  moss: "#ACAD79", wheat: "#F2D17E", hero: "#D4A017",
  muted: "rgba(88,64,46,.60)", label: "rgba(88,64,46,.72)",
  faint: "rgba(88,64,46,.32)", grid: "rgba(88,64,46,.16)",
});

function useLieflatReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: .3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const replayChart = () => {
    setVisible(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setReplay((value) => value + 1);
      setVisible(true);
    }));
  };
  return { ref, visible, replay, replayChart };
}


function AssetPageRows({ library }) {
  const reveal = useLieflatReveal();
  const rows = library.slice(0, 6);
  const maxPages = Math.max(1, ...rows.map((item) => item.visible_pages));
  const conclusion = maxPages <= 2 ? "最近保存仍以 1 到 2 页质量试稿为主" : `最近保存里已有 ${maxPages} 页完整草稿`;
  const yFor = (index) => 48 + index * 40;
  const x0 = 152;
  const step = 30;
  const rowColors = [PALM_CHART.hero, PALM_CHART.data, PALM_CHART.olive, "#929960", PALM_CHART.moss, PALM_CHART.wheat];

  return <section className="lf-card asset-page-chart" ref={reveal.ref}>
    <div className="lf-card__head"><div><h2>{conclusion}</h2><p>一根短线 = 一页 · 最近 {rows.length} 份本机资产 · 数值不补齐</p></div><button type="button" onClick={reveal.replayChart} aria-label="重播资产页数动画">重播</button></div>
    <svg key={reveal.replay} className={reveal.visible ? "is-revealed" : ""} viewBox="0 0 500 300" role="img" aria-label={`最近 ${rows.length} 份草稿的页数比较`}>
      {rows.map((item, index) => {
        const y = yFor(index);
        const color = rowColors[index];
        const label = new Date(item.saved_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
        return <g key={item.id || `${item.selectedTitle}-${index}`}>
          <g className="lf-fade"><title>{item.selectedTitle}</title><text x="132" y={y + 4} textAnchor="end" fontSize="11" fontWeight="700" fill={PALM_CHART.label}>{label}</text></g>
          <line className="lf-fade" x1={x0} y1={y + 10} x2={x0 + 8 * step} y2={y + 10} stroke={PALM_CHART.grid} strokeWidth="1.4" />
          {Array.from({ length: item.visible_pages }, (_, tick) => {
            const x = x0 + tick * step + step / 2;
            const height = 14 + ((tick * 7 + index * 3) % 6);
            return <line key={tick} className="lf-fade" x1={x} y1={y + 10} x2={x} y2={y + 10 - height} stroke={color} strokeWidth="3" opacity={.85 + ((tick + index) % 3) * .06} style={{ animationDelay: `${index * .08 + tick * .04}s` }}><title>{`${item.selectedTitle} · 第 ${tick + 1} 页`}</title></line>;
          })}
          <text className="lf-fade" x={x0 + item.visible_pages * step + 10} y={y + 4} fontSize="15" fontWeight="800" fill={PALM_CHART.text}>{item.visible_pages}</text>
        </g>;
      })}
    </svg>
  </section>;
}

const REALITY_METRIC_LABELS = {
  views: "浏览", likes: "点赞", comments: "评论", saves: "收藏", shares: "分享", followers_gained: "涨粉",
};
const REALITY_WINDOW_LABELS = { "24h": "24 小时", "72h": "72 小时", "7d": "7 天" };
const REALITY_STATUS_LABELS = { UNPUBLISHED: "未登记发布", PUBLISHED: "已发布", TRACKING: "跟踪中", "7D_COMPLETE": "已记录至 7 天", INVALID: "待修正" };

function RealityFeedbackEditor({ item, onSave, onClose }) {
  const [draft, setDraft] = useState(() => normalizeRealityFeedback(item.reality_feedback) || createRealityFeedback());
  useEffect(() => { setDraft(normalizeRealityFeedback(item.reality_feedback) || createRealityFeedback()); }, [item.id, item.reality_feedback]);
  const status = (() => { try { return realityFeedbackStatus(draft); } catch { return "INVALID"; } })();
  const setMetric = (window, metric, value) => setDraft((current) => updateRealityFeedback(current, {
    snapshots: { ...current.snapshots, [window]: { ...current.snapshots[window], [metric]: value === "" ? "UNKNOWN" : Number(value) } },
  }));
  return <section className="reality-feedback-editor" aria-label="发布后现实反馈">
    <header><div><span>REALITY FEEDBACK</span><h2>{item.selectedTitle}</h2><p>只记录真实发布结果；没有的数据保持 UNKNOWN。</p></div><button type="button" onClick={onClose}><X />关闭</button></header>
    <div className="reality-publication-row">
      <label><span>发布时间</span><input type="datetime-local" value={draft.published_at.replace(/Z$/, "").slice(0, 16)} onChange={(event) => setDraft((current) => updateRealityFeedback(current, { published_at: event.target.value }))} /></label>
      <label><span>作品链接</span><input type="url" placeholder="https://..." value={draft.published_url} onChange={(event) => setDraft((current) => ({ ...current, published_url: event.target.value }))} /></label>
      <div className={`reality-status is-${status.toLowerCase()}`}><span>状态</span><strong>{REALITY_STATUS_LABELS[status]}</strong></div>
    </div>
    <div className="reality-snapshots">{REALITY_WINDOWS.map((window) => <section key={window} className="reality-snapshot">
      <header><strong>{REALITY_WINDOW_LABELS[window]}</strong><span>空白 = UNKNOWN</span></header>
      <div>{REALITY_METRICS.map((metric) => <label key={metric}><span>{REALITY_METRIC_LABELS[metric]}</span><input type="number" min="0" step="1" inputMode="numeric" placeholder="UNKNOWN" value={draft.snapshots[window][metric] === "UNKNOWN" ? "" : draft.snapshots[window][metric]} onChange={(event) => setMetric(window, metric, event.target.value)} /></label>)}</div>
    </section>)}</div>
    <label className="reality-reflection"><span>一句复盘</span><textarea rows="3" placeholder="例如：封面点击可以，但收藏弱；下一条把方法步骤前置。" value={draft.reflection} onChange={(event) => setDraft((current) => ({ ...current, reflection: event.target.value }))} /></label>
    <footer><small>这些数据不会进入发布 ZIP，也不会授予任何发布或放量权限。</small><button type="button" onClick={() => onSave(updateRealityFeedback(draft, {}))}><Save />保存现实反馈</button></footer>
  </section>;
}

function App() {
  const initial = useMemo(() => loadStored() || generateContentPackage({ topic: DEFAULT_TOPIC }), []);
  const initialPromptMemory = useMemo(() => loadPromptMemory(), []);
  const initialGenerationSession = useMemo(() => loadGenerationSession(localStorage, GENERATION_SESSION_KEY), []);
  const [contentHistory, setContentHistory] = useState(() => createEditorHistory(initial));
  const [layoutRefreshToken, setLayoutRefreshToken] = useState(0);
  const content = contentHistory.present;
  const setContent = useCallback((updater, options = {}) => {
    setContentHistory((history) => {
      const next = typeof updater === "function" ? updater(history.present) : updater;
      return updateEditorHistory(history, next, options);
    });
  }, []);
  const resetContent = useCallback((next) => setContentHistory(createEditorHistory(next)), []);
  const undo = useCallback(() => { setContentHistory((history) => undoEditorHistory(history)); setLayoutRefreshToken((value) => value + 1); }, []);
  const redo = useCallback(() => { setContentHistory((history) => redoEditorHistory(history)); setLayoutRefreshToken((value) => value + 1); }, []);
  const [topic, setTopic] = useState(initialGenerationSession?.topic || initialPromptMemory.defaults.source_topic || initial.source_input);
  const [pillar, setPillar] = useState(initialGenerationSession?.pillar || initial.pillar);
  const [goal, setGoal] = useState(initialGenerationSession?.goal || initial.goal);
  const [textRequirements, setTextRequirements] = useState(initialGenerationSession?.text_requirements || initialPromptMemory.defaults.text_requirements || "");
  const [promptMemory, setPromptMemory] = useState(initialPromptMemory);
  const [promptValues, setPromptValues] = useState(() => Object.fromEntries([...TEXT_CONTEXT_FIELDS, ...IMAGE_CONTEXT_FIELDS].map((field) => [field.id, initialPromptMemory.defaults[field.id] || field.defaultValue])));
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedObject, setSelectedObject] = useState("title");
  const [editingObject, setEditingObject] = useState(null);
  const [imageEditMode, setImageEditMode] = useState("frame");
  const cropSessionRef = useRef(null);
  const selectObject = useCallback((kind) => {
    setSelectedObject(kind);
    setEditingObject(null);
    if (kind !== "image" && !String(kind).startsWith("info-image-")) {
      cropSessionRef.current = null;
      setImageEditMode("frame");
    }
  }, []);
  const changeEditingObject = useCallback((kind) => {
    setEditingObject(kind);
    if (kind) setSelectedObject(kind);
  }, []);
  const [view, setView] = useState("compose");
  const [creatorOpen, setCreatorOpen] = useState(true);
  const [researchWorkspace, setResearchWorkspace] = useState(null);
  const [researchPositioning, setResearchPositioning] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchMessage, setResearchMessage] = useState("");
  const [library, setLibrary] = useState(loadLibrary);
  const [realityFeedbackId, setRealityFeedbackId] = useState(null);
  const [profile, setProfile] = useState(loadProfile);
  const [authorityAdmission, setAuthorityAdmission] = useState(null);
  const [toast, setToast] = useState("");
  const [storageIssue, setStorageIssue] = useState("");
  const [exportState, setExportState] = useState("IDLE");
  const [generationState, setGenerationState] = useState("IDLE");
  const [generationError, setGenerationError] = useState(loadGenerationFailure);
  const [textDraft, setTextDraft] = useState(initialGenerationSession?.text_draft || null);
  const [textConfirmed, setTextConfirmed] = useState(Boolean(initialGenerationSession?.text_confirmed));
  const [assembledDraftId, setAssembledDraftId] = useState(initialGenerationSession?.assembled_draft_id || null);
  const [imageCountMode, setImageCountMode] = useState(initialGenerationSession?.image_count_mode || "AUTO");
  const [customImageCount, setCustomImageCount] = useState(initialGenerationSession?.custom_image_count || 3);
  const [productionMode, setProductionMode] = useState(initialGenerationSession?.production_mode || "smart");
  const [imageResume, setImageResume] = useState(initialGenerationSession?.image_resume || null);
  const [actionReferences, setActionReferences] = useState([]);
  const [actionReferenceNote, setActionReferenceNote] = useState("");
  const [providerHealth, setProviderHealth] = useState(PROVIDER_URL ? "CHECKING" : "DEMO");
  const [providerMeta, setProviderMeta] = useState(null);
  const [providerSettingsOpen, setProviderSettingsOpen] = useState(false);
  const [providerSettingsSaving, setProviderSettingsSaving] = useState(false);
  const [providerSettingsForm, setProviderSettingsForm] = useState({ provider: "volcengine-ark", label: "火山方舟", base_url: "https://ark.cn-beijing.volces.com/api/v3", text_model: "", image_model: "", api_key: "" });
  const [candidateState, setCandidateState] = useState("IDLE");
  const [imageCandidates, setImageCandidates] = useState([]);
  const [candidateLoadState, setCandidateLoadState] = useState({});
  const [candidatePageIndex, setCandidatePageIndex] = useState(null);
  const [candidateRunId, setCandidateRunId] = useState(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const provider = useMemo(() => {
    if (!PROVIDER_URL) return null;
    try { return createLocalHttpProvider({ endpoint: PROVIDER_URL }); }
    catch { return null; }
  }, []);
  const importRef = useRef(null);
  const profileImportRef = useRef(null);
  const workspaceImportRef = useRef(null);
  const imageRef = useRef(null);
  const infoPanelImageRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const actionReferenceRef = useRef(null);

  const visiblePages = content.pages.slice(0, content.visible_pages);
  const realityFeedbackItem = library.find((item) => item.id === realityFeedbackId) || null;
  const currentPage = visiblePages[Math.min(pageIndex, visiblePages.length - 1)];
  const currentEditorMode = editorModeForPage(currentPage);
  const currentStyle = TEXT_LAYER_KEYS.includes(selectedObject) ? currentPage.object_styles[selectedObject] : null;
  const selectedInfoObject = infoObjectSelection(selectedObject);
  const selectedInfoPanelIndex = Math.min(Math.max(panelSelectionIndex(selectedObject) ?? 0, 0), Math.max(0, (currentPage.info_panels?.length || 1) - 1));
  const selectedInfoPanelKind = selectedInfoObject?.kind || "text";
  const selectedInfoPanel = currentPage.info_panels?.[selectedInfoPanelIndex] || null;
  const activeTextStyle = currentStyle || (selectedInfoObject?.kind === "text" ? selectedInfoPanel?.text_style : null);
  const activeImageStyle = selectedObject === "image" && !currentPage.info_panels?.length
    ? currentPage.image_style
    : selectedInfoObject?.kind === "image" ? selectedInfoPanel?.image_style : null;
  const activeObjectLocked = selectedInfoObject ? layerIsLocked(currentPage, "image") : layerIsLocked(currentPage, selectedObject);
  const generatedImageCount = visiblePages.filter((page) => page.visual === "character" && page.image_style?.src).length;
  const canUndo = contentHistory.past.length > 0;
  const canRedo = contentHistory.future.length > 0;
  const isGenerating = generationState === "TEXT_GENERATING" || generationState === "IMAGE_GENERATING";
  const providerCanAttempt = providerHealth === "ONLINE" || providerHealth === "DEGRADED" || providerHealth === "UNVERIFIED";
  const providerStatusLabel = providerHealth === "ONLINE" ? "连接已验证" : providerHealth === "UNVERIFIED" ? "已配置 · 未验证" : providerHealth === "DEGRADED" ? "连接异常" : providerHealth === "OFFLINE" ? "离线" : "检查中";
  const reusableImageAssets = useMemo(() => collectReusableImageAssets(content, library), [content, library]);
  const resolvedPageCount = textDraft ? (imageCountMode === "AUTO" ? textDraft.recommended_image_count : Number(customImageCount)) : 0;
  const motherSheetEstimate = textDraft && resolvedPageCount ? estimateMotherSheetPlan(resolvedPageCount, productionMode) : null;
  const motherSheetRange = motherSheetEstimate ? (motherSheetEstimate.minMotherSheets === motherSheetEstimate.maxMotherSheets ? `${motherSheetEstimate.minMotherSheets}` : `${motherSheetEstimate.minMotherSheets}–${motherSheetEstimate.maxMotherSheets}`) : "0";
  const illustrationUnitRange = motherSheetEstimate ? (motherSheetEstimate.minIllustrationUnits === motherSheetEstimate.maxIllustrationUnits ? `${motherSheetEstimate.minIllustrationUnits}` : `${motherSheetEstimate.minIllustrationUnits}–${motherSheetEstimate.maxIllustrationUnits}`) : "0";
  const hasConfirmedContent = Boolean(
    (content.generation?.mode === "PROVIDER" || content.saved_at)
    && content.selectedTitle?.trim()
    && content.body?.trim()
    && content.tags?.length === 5
    && visiblePages.length > 0
    && visiblePages.every((page) => page.title?.trim() && page.body?.trim())
  );
  const isDraftInputOnly = !hasConfirmedContent;
  const isFreshDraft = isDraftInputOnly && !String(topic || "").trim() && !textDraft;
  const requiredImageCount = textConfirmed
    ? textDraft?.draft_id && assembledDraftId === textDraft.draft_id
      ? visiblePages.length
      : Math.max(1, Number(resolvedPageCount) || 1)
    : hasConfirmedContent ? visiblePages.length : 0;
  const generatedForCurrentDraft = imageResume?.resume_run_id
    ? Math.max(0, Number(imageResume.completed_pages) || 0)
    : textDraft?.draft_id && assembledDraftId === textDraft.draft_id
      ? generatedImageCount
      : hasConfirmedContent ? generatedImageCount : 0;
  const creatorJourney = deriveCreatorJourney({ topic, textDraft, textConfirmed, hasConfirmedContent, generatedImageCount: generatedForCurrentDraft, requiredImageCount, layoutIssueCount: 0, exportState });
  const currentInLibrary = Boolean(content.id && library.some((item) => item.id === content.id && item.saved_at === content.saved_at));

  useEffect(() => {
    if (!textDraft) return;
    try {
      persistGenerationSession(localStorage, GENERATION_SESSION_KEY, { schema: GENERATION_SESSION_SCHEMA, topic, pillar, goal, text_requirements: textRequirements, text_draft: textDraft, text_confirmed: textConfirmed, assembled_draft_id: assembledDraftId, image_count_mode: imageCountMode, custom_image_count: customImageCount, production_mode: productionMode, image_resume: imageResume });
    } catch {}
  }, [topic, pillar, goal, textRequirements, textDraft, textConfirmed, assembledDraftId, imageCountMode, customImageCount, productionMode, imageResume]);

  function beginImageCrop() {
    const imageSelected = selectedObject === "image" || infoObjectSelection(selectedObject)?.kind === "image";
    if (imageEditMode === "crop" || !imageSelected || layerIsLocked(currentPage, "image")) return;
    cropSessionRef.current = { pageIndex, history: contentHistory };
    if (activeImageStyle?.fit === "contain") changeActiveImageStyle({ fit: "cover", allowLetterbox: false, scale: Math.max(108, Number(activeImageStyle.scale || 100)) }, "crop-begin");
    setImageEditMode("crop");
  }

  function finishImageCrop() {
    cropSessionRef.current = null;
    setImageEditMode("frame");
  }

  function cancelImageCrop() {
    const snapshot = cropSessionRef.current;
    if (snapshot?.pageIndex === pageIndex) setContentHistory(snapshot.history);
    cropSessionRef.current = null;
    setImageEditMode("frame");
  }

  function scrollCreatorStage(targetId) {
    setCreatorOpen(true);
    setMobileInspectorOpen(true);
    window.setTimeout(() => {
      const node = document.getElementById(targetId);
      if (!node) return;
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function openProviderSettings() {
    if (!provider?.getSettings) return;
    try {
      const settings = await provider.getSettings();
      setProviderSettingsForm({
        provider: settings.provider || "volcengine-ark",
        label: settings.provider_label || "生成服务",
        base_url: settings.base_url || "",
        text_model: settings.text_model || "",
        image_model: settings.image_model || "",
        api_key: "",
      });
      setProviderMeta(settings);
      setProviderSettingsOpen(true);
    } catch {
      setToast("生成服务设置暂时不可读取");
    }
  }

  async function saveProviderSettings() {
    if (!provider?.updateSettings || providerSettingsSaving) return;
    setProviderSettingsSaving(true);
    try {
      const settings = await provider.updateSettings(providerSettingsForm);
      setProviderMeta(settings);
      setProviderSettingsForm((current) => ({ ...current, api_key: "" }));
      setProviderHealth(settings.configured ? "ONLINE" : "OFFLINE");
      setProviderSettingsOpen(false);
      setToast(IS_PUBLIC_RUNTIME ? "模型已连接；API Key 只保存在当前标签页" : "生成服务已切换；API Key 只保存在本机钥匙串");
    } catch (error) {
      setToast(`生成服务设置未保存：${String(error?.providerCode || error?.message || "UNKNOWN")}`);
    } finally {
      setProviderSettingsSaving(false);
    }
  }

  function persistPromptMemory(next) {
    try { localStorage.setItem(PROMPT_MEMORY_KEY, JSON.stringify(next)); setStorageIssue(""); }
    catch { setStorageIssue("提示词历史无法写入本机存储；本次内容仍可生成，请先导出工作台备份。"); }
    setPromptMemory(next);
    return next;
  }

  function rememberPromptSnapshot(values) {
    return persistPromptMemory(rememberPromptValues(promptMemory, values));
  }

  function setPromptFieldValue(fieldId, value) {
    setAssembledDraftId(null);
    if (fieldId === "source_topic") { setTopic(value); setTextConfirmed(false); return; }
    if (fieldId === "text_requirements") { setTextRequirements(value); setTextConfirmed(false); return; }
    if (TEXT_CONTEXT_FIELDS.some((field) => field.id === fieldId)) setTextConfirmed(false);
    setPromptValues((current) => ({ ...current, [fieldId]: value }));
  }

  function rememberPromptField(fieldId, value) {
    if (!String(value || "").trim()) return;
    rememberPromptSnapshot({ [fieldId]: value });
  }

  function deletePromptEntry(fieldId, entryId) {
    persistPromptMemory(deletePromptHistory(promptMemory, fieldId, entryId));
  }

  function rememberAllPromptInputs() {
    rememberPromptSnapshot({ source_topic: topic, text_requirements: textRequirements, ...promptValues });
  }

  useEffect(() => {
    if (!provider?.checkHealth) { setProviderHealth("DEMO"); return undefined; }
    let active = true;
    const check = async () => {
      try {
        const health = await provider.checkHealth();
        if (active) { setProviderHealth(providerHealthState(health)); setProviderMeta(health); }
      }
      catch { if (active) setProviderHealth("OFFLINE"); }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [provider]);

  useEffect(() => {
    if (view === "research") loadResearchWorkspace();
  }, [view]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(content)); setStorageIssue(""); }
    catch { setStorageIssue("本机存储空间不足或不可用：当前改动尚未可靠落盘，请立即备份工作台。"); }
  }, [content]);
  useEffect(() => {
    const draft = new URL(window.location.href).searchParams.get("draft");
    if (!draft) return;
    let active = true;
    loadLocalDraft(draft, { origin: window.location.origin })
      .then((imported) => {
        if (!active || !imported) return;
        resetContent(imported); setTopic(imported.source_input); setPillar(imported.pillar); setGoal(imported.goal);
        setPageIndex(0); setSelectedObject("title"); setView("compose");
        setToast("同源 AI 草稿已加载并保存到本机；尚未独立评测");
      })
      .catch((error) => { console.warn(error); if (active) setToast("草稿链接无效，原内容未改变"); });
    return () => { active = false; };
  }, [resetContent]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => { if (pageIndex >= visiblePages.length) setPageIndex(Math.max(0, visiblePages.length - 1)); }, [pageIndex, visiblePages.length]);
  useEffect(() => {
    const panelIndex = panelSelectionIndex(selectedObject);
    if (panelIndex != null && (!currentPage.info_panels?.length || panelIndex >= currentPage.info_panels.length)) setSelectedObject(currentPage.info_panels?.length ? "info-text-0" : "title");
  }, [currentPage, selectedObject]);
  useEffect(() => {
    selectObject(currentPage.info_panels?.length ? "info-text-0" : "title");
  }, [pageIndex, currentPage.info_panels?.length]);
  useEffect(() => {
    const onKeyDown = (event) => {
      const isTyping = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if (event.key === "Escape") {
        if (editingObject) { event.preventDefault(); event.target instanceof HTMLElement && event.target.blur(); setEditingObject(null); return; }
        if (imageEditMode === "crop") { event.preventDefault(); cancelImageCrop(); return; }
      }
      if (!isTyping && event.key === "Enter" && imageEditMode === "crop") {
        event.preventDefault(); finishImageCrop(); return;
      }
      if (!isTyping && event.key === "Enter" && TEXT_LAYER_KEYS.includes(selectedObject) && selectedObject !== "page_number") {
        event.preventDefault(); setEditingObject(selectedObject); return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingObject, imageEditMode, pageIndex, redo, selectedObject, undo]);

  function mutatePage(mutator, options = {}) {
    setContent((current) => invalidateVisualReview({ ...current, pages: current.pages.map((page, index) => index === pageIndex ? mutator(page) : page) }), options);
  }

  function changeObject(kind, mode, value, options = {}) {
    mutatePage((page) => {
      if (mode === "text") return { ...page, [kind]: value };
      if (mode === "image") return { ...page, image_style: { ...page.image_style, ...value } };
      return { ...page, object_styles: { ...page.object_styles, [kind]: { ...page.object_styles[kind], ...value } } };
    }, options);
  }

  function changeStyle(field, value) {
    if (!TEXT_LAYER_KEYS.includes(selectedObject)) return;
    changeObject(selectedObject, "style", { [field]: value }, { group: `inspector-${pageIndex}-${selectedObject}-${field}` });
  }

  function changeInfoPanel(panelIndex, patch, group = `panel-${pageIndex}-${panelIndex}`) {
    mutatePage((page) => ({
      ...page,
      info_panels: page.info_panels.map((panel, index) => index === panelIndex ? {
        ...panel,
        ...patch,
        ...(patch.text_style ? { text_style: { ...panel.text_style, ...patch.text_style } } : {}),
        ...(patch.image_style ? { image_style: { ...panel.image_style, ...patch.image_style } } : {}),
      } : panel),
    }), { group });
  }

  function changeActiveTextStyle(patch, reason = "style") {
    if (currentStyle) {
      changeObject(selectedObject, "style", patch, { group: `context-text-${pageIndex}-${selectedObject}-${reason}` });
      return;
    }
    if (selectedInfoObject?.kind === "text" && selectedInfoPanel) {
      changeInfoPanel(selectedInfoPanelIndex, { text_style: { ...selectedInfoPanel.text_style, ...patch } }, `context-panel-text-${pageIndex}-${selectedInfoPanelIndex}-${reason}`);
    }
  }

  function changeActiveImageStyle(patch, reason = "image") {
    if (selectedObject === "image" && !currentPage.info_panels?.length) {
      changeObject("image", "image", patch, { group: `context-image-${pageIndex}-${reason}` });
      return;
    }
    if (selectedInfoObject?.kind === "image" && selectedInfoPanel) {
      changeInfoPanel(selectedInfoPanelIndex, { image_style: { ...selectedInfoPanel.image_style, ...patch } }, `context-panel-image-${pageIndex}-${selectedInfoPanelIndex}-${reason}`);
    }
  }

  function changeInfoPanelFrame(panelIndex, objectKind, frame, group = `flow-${pageIndex}-${panelIndex}-${objectKind}`) {
    mutatePage((page) => {
      const panelId = page.info_panels?.[panelIndex]?.id;
      const placement = page.layout_ir?.placements?.[panelId];
      if (!panelId || !placement || !["text", "image"].includes(objectKind)) return page;
      const frameKey = `${objectKind}_frame`;
      return {
        ...page,
        layout_ir: {
          ...page.layout_ir,
          placements: {
            ...page.layout_ir.placements,
            [panelId]: {
              ...placement,
              [frameKey]: frame,
              manual_override: { ...placement.manual_override, [objectKind]: true },
            },
          },
        },
      };
    }, { group });
  }

  function autoArrangeInfoPanels() {
    mutatePage((page) => {
      if (!page.info_panels?.length || !page.layout_ir) return page;
      return { ...page, editor_state: null, layout_ir: buildEditablePanelLayout(page.info_panels, { pattern: page.layout_ir?.engine?.pattern }) };
    }, { group: `flow-${pageIndex}-auto-layout` });
    setLayoutRefreshToken((value) => value + 1);
    setToast("已按竖幅插画、安全边距和阅读节奏重新排版；可撤销");
  }


  function setInfoPanelImageHidden(panelIndex, hidden = true) {
    changeInfoPanel(panelIndex, { image_style: { hidden: Boolean(hidden) } }, `panel-${pageIndex}-${panelIndex}-${hidden ? "delete" : "restore"}-image`);
  }

  function requestInfoPanelImageReplacement(panelIndex) {
    setSelectedObject(`info-image-${panelIndex}`);
    requestAnimationFrame(() => infoPanelImageRef.current?.click());
  }

  function useInfoPanelAsset(panelIndex, imageStyle) {
    changeInfoPanel(panelIndex, {
      image_style: {
        ...imageStyle,
        hidden: false,
      },
    }, `panel-${pageIndex}-${panelIndex}-reuse-image`);
    setToast("已换成过往素材；位置与大小保持不变");
  }

  function replaceInfoPanelImage(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const targetIndex = selectedInfoPanelIndex;
    const reader = new FileReader();
    reader.onload = () => changeInfoPanel(targetIndex, { image_style: { src: String(reader.result), hidden: false, fit: "cover", focalX: 50, focalY: 50, scale: 108, crop: { x: 0, y: 0, width: 1, height: 1 } } }, `panel-${pageIndex}-${targetIndex}-replace-image`);
    reader.readAsDataURL(file);
  }

  function resetInfoPanelImage(panelIndex) {
    const panel = currentPage.info_panels?.[panelIndex];
    if (!panel) return;
    const independent = panel.image_style.src !== currentPage.image_style.src;
    changeInfoPanel(panelIndex, { image_style: { ...panel.image_style, hidden: false, fit: "cover", allowLetterbox: false, focalX: 50, focalY: 50, scale: 108, crop: independent ? { x: 0, y: 0, width: 1, height: 1 } : panelCropForIndex(panelIndex, currentPage.info_panels.length) } }, `panel-${pageIndex}-${panelIndex}-reset-image`);
  }

  function changeLayerFlag(bucket, key, value) {
    mutatePage((page) => ({ ...page, layer_state: setLayerFlag(page.layer_state, bucket, key, value) }));
  }

  function changeLayerOrder(key, direction) {
    mutatePage((page) => ({ ...page, layer_state: moveLayer(page.layer_state, key, direction) }));
  }

  function openCreator() {
    const next = prepareFreshDraftWorkspace({
      currentContent: content,
      library,
      profile,
      draftId: content.id || crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    });
    const persisted = persistWorkspaceState(localStorage, next, STORAGE_KEYS);
    if (!persisted.ok) {
      setStorageIssue("新稿没有建立：旧稿无法安全保留，请先下载工作台备份。");
      setToast("旧稿未丢失；新创作已暂停");
      return;
    }
    resetContent(next.currentContent);
    setLibrary(next.library);
    setTopic("");
    setPillar(next.currentContent.pillar);
    setGoal(next.currentContent.goal);
    setPageIndex(0);
    setSelectedObject("title");
    setView("compose");
    setCreatorOpen(true);
    setMobileInspectorOpen(true);
    setTextDraft(null);
    setTextConfirmed(false);
    setAssembledDraftId(null);
    setGenerationState("IDLE");
    setGenerationError(null);
    try { localStorage.removeItem(GENERATION_FAILURE_KEY); } catch {}
    setImageCountMode("AUTO");
    setProductionMode("smart");
    setImageResume(null);
    try { localStorage.removeItem(GENERATION_SESSION_KEY); } catch {}
    setActionReferences([]);
    setActionReferenceNote("");
    setStorageIssue("");
    setToast(next.preservedPrevious ? "已开始新稿；上一稿已自动保留到资产库" : "已开始空白新稿");
  }

  function failGeneration(feedback) {
    setGenerationState("FAILED");
    setGenerationError(feedback);
    try { localStorage.setItem(GENERATION_FAILURE_KEY, JSON.stringify(feedback)); } catch {}
    setToast(feedback.title);
  }

  function clearGenerationFailure() {
    setGenerationError(null);
    try { localStorage.removeItem(GENERATION_FAILURE_KEY); } catch {}
  }

  async function generateTextNode() {
    if (!provider?.generateTextDraft) {
      failGeneration({ code: "LOCAL_PROVIDER_UNAVAILABLE", title: "生成服务没有接好", detail: IS_PUBLIC_RUNTIME ? "请打开模型设置，填入自己的火山方舟 API Key 后从当前节点重试。" : "工作台地址没有填错。请确认本机生成服务正在运行，然后从当前节点重试。" });
      return;
    }
    if (provider && !providerCanAttempt) { setToast(IS_PUBLIC_RUNTIME ? "先在模型设置里连接自己的火山方舟" : "本机生成服务暂时不可连接，请稍后再试"); return; }
    if (String(topic || "").trim().length < 8) {
      failGeneration({ code: "INPUT_TOO_SHORT", title: "请再多写一点", detail: "至少写清楚一个选题，或者粘贴一段原始文本。当前内容还不足以开始创作。" });
      return;
    }
    try {
      rememberAllPromptInputs();
      setGenerationState("TEXT_GENERATING");
      clearGenerationFailure();
      setToast("请求已收到：现在只生成文字，不会产生图片费用");
      const draft = await provider.generateTextDraft({ topic, text_requirements: textRequirements, prompt_context: promptContextForProvider(promptValues), pillar, goal, profile_contract: buildGenerationContract(profile) });
      setTextDraft(draft);
      setTextConfirmed(false);
      setAssembledDraftId(null);
      setImageResume(null);
      setCustomImageCount(draft.recommended_image_count);
      setGenerationState("IDLE");
      clearGenerationFailure();
      setToast("文字草稿已生成，请先检查和微调");
    } catch (error) {
      console.warn(error);
      failGeneration(generationFailureFeedback(error));
    }
  }

  function editTextDraft(field, value, index = null) {
    setImageResume(null);
    setTextConfirmed(false);
    setAssembledDraftId(null);
    setTextDraft((current) => {
      if (!current) return current;
      if (field === "selected_title") {
        const titles = current.titles.map((title) => title === current.selected_title ? value : title);
        return { ...current, selected_title: value, titles };
      }
      if (field === "tag") return { ...current, tags: current.tags.map((tag, tagIndex) => tagIndex === index ? value : tag) };
      return { ...current, [field]: value };
    });
    clearGenerationFailure(); setGenerationState("IDLE");
  }

  function chooseDraftTitle(title) {
    setTextConfirmed(false);
    setAssembledDraftId(null);
    setTextDraft((current) => current ? { ...current, selected_title: title } : current);
  }

  function textDraftIsReady() {
    if (!textDraft || textDraft.selected_title.trim().length < 8) { failGeneration({ code: "TITLE_TOO_SHORT", title: "标题还不完整", detail: "请把标题补充到至少8个字。" }); return false; }
    if (textDraft.body.replace(/\s/g, "").length < 240) { failGeneration({ code: "BODY_TOO_SHORT", title: "正文被改得太短", detail: "至少保留240个有效字符。" }); return false; }
    if (textDraft.tags.length !== 5 || textDraft.tags.some((tag) => !tag.trim())) { failGeneration({ code: "TAGS_INVALID", title: "标签还没填完", detail: "请保留5个有内容的标签。" }); return false; }
    return true;
  }

  async function addActionReferences(event) {
    const files = [...event.target.files]; event.target.value = "";
    const room = Math.max(0, 3 - actionReferences.length);
    const accepted = files.filter((file) => new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type) && file.size <= 3_000_000).slice(0, room);
    if (!accepted.length) { setToast(room ? "请选择 3MB 以内的 PNG、JPG 或 WebP" : "动作参考图最多 3 张"); return; }
    const readDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file);
    });
    try {
      const next = await Promise.all(accepted.map(async (file) => ({ id: crypto.randomUUID(), name: file.name, size: file.size, data_url: await readDataUrl(file) })));
      setActionReferences((current) => [...current, ...next].slice(0, 3));
      setImageResume(null);
      setAssembledDraftId(null);
      setToast(`已加入 ${next.length} 张动作参考图`);
    } catch { setToast("参考图读取失败，原选择未改变"); }
  }

  function removeActionReference(id) {
    setActionReferences((current) => current.filter((item) => item.id !== id));
    setImageResume(null);
    setAssembledDraftId(null);
  }

  async function generateImageNode() {
    if (!textConfirmed) { setToast("请先确认文字，再进入配图"); return; }
    if (!provider?.generateImages) {
      failGeneration({ code: "LOCAL_PROVIDER_UNAVAILABLE", title: "生成服务没有接好", detail: IS_PUBLIC_RUNTIME ? "文字草稿和当前画布已经保留。请在模型设置中连接自己的火山方舟，再重试图片。" : "文字草稿和当前画布已经保留。请确认本机生成服务正在运行，然后重试图片。", stage: "image" });
      return;
    }
    if (!textDraftIsReady()) return;
    try {
      rememberAllPromptInputs();
      setGenerationState("IMAGE_GENERATING"); clearGenerationFailure();
      const count = imageCountMode === "AUTO" ? "AUTO" : Number(customImageCount);
      const resolvedCount = count === "AUTO" ? textDraft.recommended_image_count : count;
      const estimate = estimateMotherSheetPlan(resolvedCount, productionMode);
      const estimatedSheets = estimate.minMotherSheets === estimate.maxMotherSheets ? `${estimate.minMotherSheets}` : `${estimate.minMotherSheets}–${estimate.maxMotherSheets}`;
      setToast(imageResume?.completed_mother_sheets != null ? `正在从第 ${imageResume.completed_mother_sheets + 1} 张母图继续，已切片结果不会重做` : `文字已确认：正在规划 ${resolvedCount} 个画板，预计生成 ${estimatedSheets} 张母图`);
      const draftForImages = { ...textDraft, prompt_context: promptContextForProvider(promptValues) };
      const result = parseContentPackage(JSON.stringify(await provider.generateImages({ draft: draftForImages, production_mode: productionMode, image_count: count, resume_run_id: imageResume?.resume_run_id || null, reference_images: actionReferences.map(({ name, data_url }) => ({ name, data_url })), reference_note: actionReferenceNote })));
      resetContent(result); setPageIndex(0); setSelectedObject("title"); setCreatorOpen(true); setView("compose"); setGenerationState("IDLE");
      setAssembledDraftId(textDraft.draft_id);
      clearGenerationFailure();
      setImageResume(null);
      setToast(`${productionModeLabel(productionMode)} · ${resolvedCount} 个画板已完成母图切分与排版，向下继续编辑`);
    } catch (error) {
      console.warn(error);
      setImageResume(error?.providerDetails?.resume_run_id ? error.providerDetails : null);
      failGeneration(generationFailureFeedback(error));
    }
  }

  function saveDraft() {
    const entry = { ...content, id: content.id || crypto.randomUUID(), saved_at: new Date().toISOString() };
    const next = [entry, ...library.filter((item) => item.id !== entry.id)].slice(0, 50);
    const persisted = persistWorkspaceState(localStorage, { currentContent: entry, library: next, profile }, STORAGE_KEYS);
    if (!persisted.ok) { setStorageIssue("保存失败：本机存储不可用。请先导出工作台备份，再释放浏览器空间。"); setToast("保存失败，旧资产库未改变"); return; }
    setContent(entry, { record: false });
    setLibrary(next);
    setStorageIssue("");
    try { localStorage.removeItem(GENERATION_SESSION_KEY); } catch {}
    setToast("已保存到本机资产库");
  }

  async function importJson(event) {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    try {
      const serializedFiles = await Promise.all(files.map(async (file) => ({ file, serialized: await file.text() })));
      const values = serializedFiles.map((item) => { try { return { ...item, value: JSON.parse(item.serialized) }; } catch { return { ...item, value: null }; } });
      const producerItem = values.find((item) => inspectImportContract(item.value).contract === "PRODUCER_TWO_PAGE");
      const verdictItem = values.find((item) => item.value?.schema === "xiaoshimei.visual-verdict.v1");
      const evaluatorInputItem = values.find((item) => item.value?.schema === "xiaoshimei.visual-evaluator-input.v1");
      const expansionItem = values.find((item) => item.value?.schema === "xiaoshimei.expansion-package.v2");
      const expansionHandoffItem = values.find((item) => item.value?.schema === "xiaoshimei.expansion-handoff.v1");
      if (producerItem) {
        if (!verdictItem || !evaluatorInputItem) { setToast("Producer 已识别：请同时选择根目录 KEEP 与 evaluator-input"); return; }
        const admission = await admitProducerWithVerdict(producerItem.serialized, verdictItem.serialized, evaluatorInputItem.serialized);
        if (expansionItem && !expansionHandoffItem) throw new TypeError("EXPANSION_HANDOFF_REQUIRED");
        const imported = expansionItem ? await admitSingleExpansion(admission, expansionItem.serialized, expansionHandoffItem.serialized) : admission.content;
        setAuthorityAdmission(admission); resetContent(imported); setTopic(imported.source_input); setPillar(imported.pillar); setGoal(imported.goal); setPageIndex(0); setView("compose");
        setToast(expansionItem ? `已绑定 KEEP 并导入唯一 ${imported.visible_pages} 页扩展包` : "已核验根目录 KEEP，真实两页 Producer 包已导入");
        return;
      }
      if (expansionItem && authorityAdmission) {
        if (!expansionHandoffItem) throw new TypeError("EXPANSION_HANDOFF_REQUIRED");
        const imported = await admitSingleExpansion(authorityAdmission, expansionItem.serialized, expansionHandoffItem.serialized);
        resetContent(imported); setPageIndex(0); setView("compose"); setToast(`已导入唯一 ${imported.visible_pages} 页扩展包；等待新评测`); return;
      }
      const serialized = values[0].serialized;
      const contract = inspectImportContract(serialized);
      if (contract.status === "WAIT_INDEPENDENT_VERDICT") {
        setToast("Producer 两页包已识别：等待独立 KEEP，未导入");
        return;
      }
      if (contract.status !== "READY") throw new TypeError(contract.code);
      const imported = importLocalEditableDraft(serialized);
      resetContent(imported); setTopic(imported.source_input); setPillar(imported.pillar); setGoal(imported.goal); setPageIndex(0); setView("compose");
      setToast(contract.contract === "LEGACY_SEVEN_PAGE" ? "7 页 legacy 草稿已安全回载" : `${imported.visible_pages} 页本地草稿已安全回载`);
    } catch (error) {
      console.warn(error);
      setToast("内容包不受支持，当前草稿未改变");
    }
  }

  function saveProfile() {
    const checked = parseProfileV2(JSON.stringify(profile));
    const persisted = persistWorkspaceState(localStorage, { currentContent: content, library, profile: checked }, STORAGE_KEYS);
    if (!persisted.ok) { setStorageIssue("Profile 保存失败：本机存储不可用，请导出工作台备份。"); setToast("Profile 保存失败"); return; }
    setStorageIssue("");
    setProfile(checked); setToast("Profile v2 已保存到本机");
  }

  async function importProfile(event) {
    const [file] = event.target.files; event.target.value = ""; if (!file) return;
    try {
      const next = parseProfileV2(await file.text());
      const persisted = persistWorkspaceState(localStorage, { currentContent: content, library, profile: next }, STORAGE_KEYS);
      if (!persisted.ok) throw new Error(persisted.code);
      setProfile(next); setStorageIssue(""); setToast("Profile v2 已回载");
    }
    catch { setToast("Profile v2 合同无效，原档案未改变"); }
  }

  function downloadWorkspaceBackup() {
    try {
      const backup = buildWorkspaceBackup({ profile, currentContent: content, library });
      downloadBlob("小师妹-工作台备份.json", jsonBlob(backup));
      setToast("工作台备份已下载：账号档案、当前稿与资产库");
    } catch (error) {
      console.warn(error); setToast("工作台备份失败，请先修复无效草稿");
    }
  }

  async function restoreWorkspaceBackup(event) {
    const [file] = event.target.files; event.target.value = ""; if (!file) return;
    try {
      const restored = parseWorkspaceBackup(await file.text());
      const persisted = persistWorkspaceState(localStorage, restored, STORAGE_KEYS);
      if (!persisted.ok) throw new Error(persisted.code);
      setProfile(restored.profile); resetContent(restored.currentContent); setLibrary(restored.library);
      setTopic(restored.currentContent.source_input); setPillar(restored.currentContent.pillar); setGoal(restored.currentContent.goal);
      setPageIndex(0); setView("compose"); setStorageIssue(""); setToast("工作台已完整恢复；不携带新的评测或放量权限");
    } catch (error) {
      console.warn(error); setToast("工作台备份无效或无法落盘，原数据未改变");
    }
  }

  function replaceImage(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => mutatePage((page) => ({ ...page, visual: "character", image_style: { ...page.image_style, src: String(reader.result) } }));
    reader.readAsDataURL(file);
  }

  function applyPagePreset(presetId) {
    if (layerIsLocked(currentPage, "background")) return;
    mutatePage((page) => applyDesignPreset(page, presetId), { group: `template-${pageIndex}` });
    setSelectedObject("background");
    setToast("模板已套用；文字、图片和每个图层仍可继续修改");
  }

  function applyPageCompositionMode(mode) {
    if (layerIsLocked(currentPage, "background")) return;
    mutatePage((page) => applyCompositionMode(page, mode, { pageIndex, previousRecipe: pageIndex > 0 ? visiblePages[pageIndex - 1]?.layout_recipe : null }), { group: `composition-${pageIndex}-${mode}` });
    setSelectedObject("background");
    setToast("当前页已重新编排；文字和图片内容没有改变");
  }

  function applyCompositionModeToAll(mode) {
    if (layerIsLocked(currentPage, "background")) return;
    setContent((current) => {
      const composed = current.pages.map((page, index) => index < current.visible_pages && !layerIsLocked(page, "background") ? applyCompositionMode(page, mode, { pageIndex: index }) : page);
      return invalidateVisualReview({ ...current, pages: applySmartLayoutSequence(composed) });
    }, { group: `composition-all-${mode}` });
    setSelectedObject("background");
    setToast("整套页面已按同一策略编排；封面和内页仍会使用不同版式");
  }

  function applyPageLayoutRecipe(layoutRecipe) {
    if (layerIsLocked(currentPage, "background") || !SMART_LAYOUT_RECIPES.some((recipe) => recipe.id === layoutRecipe)) return;
    mutatePage((page) => ({ ...page, layout_recipe: layoutRecipe }), { group: `layout-recipe-${pageIndex}` });
    setSelectedObject("background");
    setToast("本页阅读结构已切换；插图与对应文字仍保持绑定");
  }

  function changeBackground(patch) {
    if (layerIsLocked(currentPage, "background")) return;
    mutatePage((page) => ({ ...page, background_style: { ...backgroundStyleForPage(page), ...patch } }), { group: `background-${pageIndex}-${Object.keys(patch)[0]}` });
    setSelectedObject("background");
  }

  function resetBackground() {
    if (layerIsLocked(currentPage, "background")) return;
    mutatePage((page) => {
      const { background_style: _backgroundStyle, ...rest } = page;
      return rest;
    }, { group: `background-${pageIndex}-reset` });
    setSelectedObject("background");
  }

  function replaceBackgroundImage(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file || !new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type) || file.size > 8_000_000) {
      if (file) setToast("请选择 8MB 以内的 PNG、JPG 或 WebP 背景图");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => changeBackground({ kind: "image", imageSrc: String(reader.result), focalX: 50, focalY: 50, scale: 100, opacity: 1 });
    reader.onerror = () => setToast("背景图读取失败，原背景未改变");
    reader.readAsDataURL(file);
  }

  async function generateImageCandidates() {
    if (!provider?.generatePageCandidates) { setToast("当前未连接可用的图片候选服务"); return; }
    if (!providerCanAttempt) { setToast(IS_PUBLIC_RUNTIME ? "先在模型设置里连接自己的火山方舟" : "本机生成服务暂时不可连接，请稍后再试"); return; }
    try {
      setCandidateState("GENERATING"); setImageCandidates([]); setCandidateLoadState({}); setCandidatePageIndex(pageIndex); setCandidateRunId(null);
      setToast("正在为当前页生成 3 张候选图…");
      const result = await provider.generatePageCandidates({
        page_index: pageIndex,
        source_input: content.source_input,
        title: currentPage.title,
        body: currentPage.body,
        layout: currentPage.layout,
        content_type: content.content_strategy?.content_type || textDraft?.content_type || "knowledge_card",
        page_role: currentPage.page_role || (pageIndex === 0 ? "hook" : "example"),
        visual_action: currentPage.visual_action || "",
        image_prompt: currentPage.image_prompt || "",
        style_lock: content.content_strategy?.style_lock || textDraft?.style_lock || null,
        prompt_context: promptContextForProvider(promptValues),
      });
      setImageCandidates(result.candidates); setCandidateLoadState(Object.fromEntries(result.candidates.map((candidate) => [candidate.sha256, "LOADING"]))); setCandidateRunId(result.run_id); setCandidateState("READY");
      setToast("3 张候选图已生成，请选择一张");
    } catch (error) {
      console.warn(error); setCandidateState("FAILED"); setImageCandidates([]); setCandidateLoadState({}); setToast("候选图生成失败，当前图片未改变");
    }
  }

  function chooseImageCandidate(candidate) {
    if (candidatePageIndex !== pageIndex || !candidateRunId || candidateLoadState[candidate.sha256] !== "READY") return;
    mutatePage((page) => ({ ...page, visual: "character", image_style: { ...page.image_style, src: candidate.src, focalX: 50, focalY: 50, scale: 100 } }));
    setContent((current) => ({ ...current, generation: { ...current.generation, notice: `${current.generation.notice}; page ${pageIndex + 1} candidate ${candidateRunId}:${candidate.sha256}` } }));
    setImageCandidates([]); setCandidateLoadState({}); setCandidateState("SELECTED");
    setToast("候选图已应用；可撤销，也可重新生成");
  }

  function movePage(delta) {
    const target = pageIndex + delta;
    if (target < 0 || target >= visiblePages.length) return;
    setContent((current) => reorderPage(current, pageIndex, target));
    setPageIndex(target);
  }

  function copyPage() {
    if (visiblePages.length >= 8) { setToast("单篇最多 8 页"); return; }
    setContent((current) => duplicatePage(current, pageIndex));
    setPageIndex(pageIndex + 1);
    setToast("页面已复制；仍是本地编辑草稿");
  }

  function removePage() {
    if (visiblePages.length <= 1) return;
    setContent((current) => deletePage(current, pageIndex));
    setPageIndex(Math.max(0, pageIndex - 1));
    setToast("页面已删除");
  }

  async function downloadZip() {
    try {
      setExportState("GENERATING");
      setToast("正在渲染发布包…");
      const pngPages = [];
      for (let index = 0; index < visiblePages.length; index += 1) {
        const page = visiblePages[index];
        const dataUrl = editorModeForPage(page) === "html"
          ? await renderHtmlPageToPng(page, index, visiblePages.length)
          : await renderMaturePageToPng(page, index, visiblePages.length);
        const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (character) => character.charCodeAt(0));
        pngPages.push(bytes);
      }
      const download = await downloadBlob("小师妹-发布包.zip", await buildPublishZip(content, pngPages, { createdAt: content.created_at }));
      setExportState("COMPLETE");
      setToast(`${download.savedPath ? `ZIP 已保存到下载目录` : download.transport === "http_attachment" ? "ZIP 下载已开始" : "已触发浏览器下载"}：${visiblePages.length} 张 PNG + 文案 + 数据`);
    } catch (error) {
      setExportState("FAILED");
      document.documentElement.dataset.xsmExportFailure = String(error?.message || error);
      window.__xiaoshimeiLastExportFailure = {
        message: String(error?.message || error),
        completed_at: new Date().toISOString(),
      };
      console.error(error);
      setToast(explainExportFailure(error));
    }
  }

  async function loadResearchWorkspace() {
    if (window.location.port !== "4184") { setResearchMessage(IS_PUBLIC_RUNTIME ? "公网体验暂未接入登录态研究 Agent；新创作、真实文案、母版生图、排版、回载与发布包仍可完整体验。" : "研究台通过 4184 的 Creator Workbench 后端工作。当前地址只提供 Studio。 "); return null; }
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setResearchWorkspace(data);
      const inheritedPositioning = researchPositioningFromProfile(profile);
      setResearchPositioning(data.positioning || inheritedPositioning);
      setResearchMessage(data.positioning ? "" : "已从账号档案带入定位；保存后研究台才会采用。 ");
      return data;
    } catch (error) {
      setResearchMessage(`研究台暂不可用：${error.message}`);
      return null;
    }
  }

  async function saveResearchPositioning() {
    if (!researchPositioning.trim()) { setResearchMessage("先写清账号定位。 "); return; }
    try {
      const response = await fetch("/api/workspace", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ positioning: researchPositioning.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setResearchWorkspace(data);
      setResearchMessage("定位已保存。 ");
    } catch (error) { setResearchMessage(error.message); }
  }

  async function runResearch() {
    if (!researchPositioning.trim()) { setResearchMessage("先写清账号定位。 "); return; }
    setResearchBusy(true); setResearchMessage("正在让研究 Agent 扫描本账号相关图文热点…");
    try {
      await saveResearchPositioning();
      const response = await fetch("/api/jobs/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ positioning: researchPositioning.trim() }) });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || `HTTP ${response.status}`);
      let current = job;
      for (let attempt = 0; attempt < 100 && !new Set(["completed", "failed"]).has(current.status); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const statusResponse = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
        current = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(current.error || `HTTP ${statusResponse.status}`);
        setResearchMessage(current.progress?.label || "研究进行中…");
      }
      if (current.status !== "completed") throw new Error(current.error || "研究任务未完成");
      await loadResearchWorkspace();
      setResearchMessage("热点与候选选题已更新。 ");
    } catch (error) { setResearchMessage(`研究没有完成：${error.message}`); }
    finally { setResearchBusy(false); }
  }

  function inferPillarFromTopic(value) {
    const text = String(value || "");
    if (/恋爱|单身|关系|人性|情绪|伴侣|亲密/.test(text)) return "relationships";
    if (/茶|传统|文化|禅|道家|书院|古法|东方/.test(text)) return "culture";
    if (/养生|身体|睡眠|眼|疲劳|呼吸|经络/.test(text)) return "wellness";
    if (/成长|职场|工作|努力|自律|认知|思维/.test(text)) return "growth";
    return "identity";
  }

  function useResearchTopic(item) {
    const nextTopic = [item?.title, item?.angle ? `切入角度：${item.angle}` : "", item?.reason ? `为什么值得写：${item.reason}` : ""].filter(Boolean).join("\n");
    setTopic(nextTopic); setPillar(inferPillarFromTopic(nextTopic)); setGoal("save"); setTextDraft(null); setTextConfirmed(false); setAssembledDraftId(null);
    setView("compose"); setCreatorOpen(true); setMobileInspectorOpen(true); setToast("选题已带入 Studio，先生成文字再确认配图");
  }

  function saveRealityFeedback(itemId, feedback) {
    try {
      const checked = normalizeRealityFeedback(feedback);
      const nextLibrary = library.map((item) => item.id === itemId ? { ...item, reality_feedback: checked } : item);
      const nextContent = content.id === itemId ? { ...content, reality_feedback: checked } : content;
      const persisted = persistWorkspaceState(localStorage, { currentContent: nextContent, library: nextLibrary, profile }, STORAGE_KEYS);
      if (!persisted.ok) throw new Error(persisted.code);
      if (content.id === itemId) setContent(nextContent, { record: false });
      setLibrary(nextLibrary); setStorageIssue(""); setToast("现实反馈已保存");
    } catch (error) {
      console.warn(error); setToast("现实反馈没有保存，请检查链接或指标");
    }
  }

  function openDraft(item) {
    setRealityFeedbackId(null);
    resetContent(item); setTopic(item.source_input); setPillar(item.pillar); setGoal(item.goal); setPageIndex(0); setView("compose");
  }

  function renderCreatorWorkflow() {
    return <>
      {provider && providerHealth === "OFFLINE" && <div className="creator-service-state is-offline">{IS_PUBLIC_RUNTIME ? "尚未连接模型：点击顶部生成服务设置" : "生成服务离线，正在恢复"}</div>}
      {provider && providerHealth === "DEGRADED" && <div className="creator-service-state is-degraded">本机工作台正常，火山方舟连接异常；检查网络、代理或 VPN 后再试</div>}

      <section id="creator-source" className="workbench-section workbench-source">
        <header><div><strong>原文</strong><small>写清素材，再用 AI 扩写</small></div><button className="creator-flow-close" type="button" onClick={() => setCreatorOpen(false)} disabled={isGenerating} title="收起原文" aria-label="收起原文"><X /></button></header>
        <PromptContextField field={{ id: "source_topic", label: "原文或选题", placeholder: "写清想讲什么，或直接粘贴原文" }} value={topic} history={promptMemory.histories.source_topic} rows={5} onChange={(value) => { setTopic(value); setTextConfirmed(false); setAssembledDraftId(null); if (generationState === "FAILED") { setGenerationState("IDLE"); setGenerationError(null); } }} onRemember={(value) => rememberPromptField("source_topic", value)} onUse={(value) => setPromptFieldValue("source_topic", value)} onDelete={(entryId) => deletePromptEntry("source_topic", entryId)} />
        <details className="prompt-context-panel creator-requirements-panel">
          <summary><div><strong>补充要求</strong><small>{textRequirements.trim() ? "已填写" : "选填"}</small></div><ChevronDown /></summary>
          <div><PromptContextField className="creator-requirements" field={{ id: "text_requirements", label: "补充要求", helper: "结构化字段没覆盖的本次特殊要求写在这里。", placeholder: "例如：保留原文步骤；不要引用古籍；正文约400字" }} value={textRequirements} history={promptMemory.histories.text_requirements} onChange={(value) => { setTextRequirements(value); setTextConfirmed(false); setAssembledDraftId(null); }} onRemember={(value) => rememberPromptField("text_requirements", value)} onUse={(value) => setPromptFieldValue("text_requirements", value)} onDelete={(entryId) => deletePromptEntry("text_requirements", entryId)} /></div>
        </details>
        <details className="prompt-context-panel">
          <summary><div><strong>口吻与结构</strong><small>9 项</small></div><ChevronDown /></summary>
          <div className="prompt-context-grid">{TEXT_CONTEXT_FIELDS.map((field) => <PromptContextField key={field.id} field={field} value={promptValues[field.id]} history={promptMemory.histories[field.id]} onChange={(value) => setPromptFieldValue(field.id, value)} onRemember={(value) => rememberPromptField(field.id, value)} onUse={(value) => setPromptFieldValue(field.id, value)} onDelete={(entryId) => deletePromptEntry(field.id, entryId)} />)}</div>
        </details>
        <section className="creator-routing"><div className="creator-options"><label><span>内容来源</span><select value={pillar} onChange={(event) => { setPillar(event.target.value); setTextConfirmed(false); setAssembledDraftId(null); }} disabled={isGenerating}><option value="relationships">人性关系</option><option value="growth">成长观察</option><option value="culture">东方生活 / 文化</option><option value="wellness">古法养生</option><option value="academy">书院成长</option><option value="daoism">道家文化</option><option value="identity">账号成长</option></select></label><label><span>结尾目标</span><select value={goal} onChange={(event) => { setGoal(event.target.value); setTextConfirmed(false); setAssembledDraftId(null); }} disabled={isGenerating}><option value="save">收藏</option><option value="consult">咨询</option><option value="visit">到访</option></select></label></div></section>
        {generationState === "TEXT_GENERATING" && <div className="generation-progress" role="status"><RefreshCw /><div><strong>正在生成文字</strong></div></div>}
        <button className="creator-submit" onClick={generateTextNode} disabled={isGenerating || (provider && !providerCanAttempt)}>{generationState === "TEXT_GENERATING" ? "正在生成文字…" : textDraft ? "重新生成文字" : "生成文字"}</button>
        {generationState === "FAILED" && generationError?.stage !== "image" && <FailureNotice feedback={generationError} onRetry={generateTextNode} />}
      </section>

      {textDraft && <section id="creator-text" className="workbench-section workbench-draft">
        <header><div><strong>文字草稿</strong><small>先改到满意，再确认进入配图；确认前图片调用数 = 0</small></div><span className={`text-gate ${textConfirmed ? "is-confirmed" : ""}`}>{textConfirmed ? "已确认" : "待确认"}</span></header>
        <div className="text-review">
          <div className="title-candidates" aria-label="标题候选">{textDraft.titles.map((title, index) => <button key={`${index}-${title}`} className={title === textDraft.selected_title ? "is-selected" : ""} onClick={() => chooseDraftTitle(title)}>{title}</button>)}</div>
          <label><span>最终标题</span><input value={textDraft.selected_title} onChange={(event) => editTextDraft("selected_title", event.target.value)} /></label>
          <label><span>发布正文 <small>{textDraft.body.replace(/\s/g, "").length} 字</small></span><textarea rows="11" value={textDraft.body} onChange={(event) => editTextDraft("body", event.target.value)} /></label>
          <div className="draft-tags"><span>标签</span>{textDraft.tags.map((tag, index) => <input key={index} value={tag} onChange={(event) => editTextDraft("tag", event.target.value, index)} />)}</div>
          <button className="text-confirm-button" type="button" onClick={() => { if (textDraftIsReady()) { setTextConfirmed(true); clearGenerationFailure(); setToast("文字已确认，现在可以决定页数与配图"); } }}>{textConfirmed ? <><Check />文字已确认</> : <><Check />确认文字，进入配图</>}</button>
        </div>
      </section>}

      {textDraft && textConfirmed && <section id="creator-images" className="workbench-section workbench-images">
        <header><div><strong>配图生成</strong><small>文字已锁定为本轮输入 · AI 建议 1–8 页，你可以覆盖</small></div><span className="text-gate is-confirmed">文字已确认</span></header>
        <fieldset className="production-mode-picker">
          <legend><strong>内容表现方式</strong><small>先选整套怎么讲，系统再做分镜和排版</small></legend>
          <div className="production-mode-options">{PRODUCTION_MODES.map((mode) => <label key={mode.id} className={productionMode === mode.id ? "is-selected" : ""}>
            <input type="radio" name="production-mode" value={mode.id} checked={productionMode === mode.id} disabled={Boolean(imageResume) || isGenerating} onChange={() => { setProductionMode(mode.id); setImageResume(null); setAssembledDraftId(null); }} />
            <span><strong>{mode.label}{mode.id === "smart" && <em>推荐</em>}</strong><small>{mode.fit}</small><b>{mode.result}</b></span>
          </label>)}</div>
        </fieldset>
        <section className="image-plan-card"><div className="image-count-choice"><label className={imageCountMode === "AUTO" ? "is-selected" : ""}><input type="radio" name="image-count" checked={imageCountMode === "AUTO"} disabled={Boolean(imageResume)} onChange={() => { setImageCountMode("AUTO"); setAssembledDraftId(null); }} /><span><strong>智能判断</strong><small>建议 {textDraft.recommended_image_count} 个画板</small></span></label><label className={imageCountMode === "CUSTOM" ? "is-selected" : ""}><input type="radio" name="image-count" checked={imageCountMode === "CUSTOM"} disabled={Boolean(imageResume)} onChange={() => { setImageCountMode("CUSTOM"); setAssembledDraftId(null); }} /><span><strong>指定画板数</strong><small>1 到 8 页</small></span>{imageCountMode === "CUSTOM" && <select aria-label="指定画板数量" value={customImageCount} disabled={Boolean(imageResume)} onChange={(event) => { setCustomImageCount(Number(event.target.value)); setAssembledDraftId(null); }}>{[1,2,3,4,5,6,7,8].map((count) => <option key={count} value={count}>{count} 页</option>)}</select>}</label></div><p>{imageResume?.completed_mother_sheets != null ? `已保留 ${imageResume.completed_mother_sheets}/${imageResume.total_mother_sheets} 张母图，从第 ${imageResume.completed_mother_sheets + 1} 张继续。` : `预计 ${illustrationUnitRange} 个插画单元 · ${motherSheetRange} 张 3:4 母版图（首张含 9:8 高清 KV，后续按需续页）· 约 ¥${(motherSheetEstimate.minMotherSheets * 0.22).toFixed(2)}${motherSheetEstimate.minMotherSheets === motherSheetEstimate.maxMotherSheets ? "" : `–${(motherSheetEstimate.maxMotherSheets * 0.22).toFixed(2)}`}`}</p></section>
        <section className="action-reference-panel">
          <div className="action-reference-panel__head"><div><strong>动作参考图</strong><small>拳架、器械与连续姿势 · 最多 3 张</small></div><button type="button" onClick={() => actionReferenceRef.current?.click()} disabled={actionReferences.length >= 3}><ImagePlus />加入</button></div>
          <input ref={actionReferenceRef} hidden multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={addActionReferences} />
          {actionReferences.length > 0 && <div className="action-reference-list">{actionReferences.map((item) => <figure key={item.id}><img src={item.data_url} alt={item.name} /><figcaption>{item.name}</figcaption><button type="button" onClick={() => removeActionReference(item.id)} aria-label={`删除参考图 ${item.name}`}><X /></button></figure>)}</div>}
          <label><span>参考图说明 · 选填</span><textarea rows="2" value={actionReferenceNote} placeholder="例如：只参考弓步重心和出拳方向，不参考人物外貌与服装" onChange={(event) => { setActionReferenceNote(event.target.value); setImageResume(null); setAssembledDraftId(null); }} /></label>
          <p>身份仍以小师妹固定图为准；参考图不进账号档案。</p>
        </section>
        <details className="prompt-context-panel prompt-context-panel--image">
          <summary><div><strong>画面设置</strong><small>人物、动作、场景、风格与构图 8 项</small></div><ChevronDown /></summary>
          <div className="prompt-context-grid">{IMAGE_CONTEXT_FIELDS.map((field) => <PromptContextField key={field.id} field={field} value={promptValues[field.id]} history={promptMemory.histories[field.id]} onChange={(value) => setPromptFieldValue(field.id, value)} onRemember={(value) => rememberPromptField(field.id, value)} onUse={(value) => setPromptFieldValue(field.id, value)} onDelete={(entryId) => deletePromptEntry(field.id, entryId)} />)}</div>
        </details>
        {generationState === "IMAGE_GENERATING" && <div className="generation-progress" role="status"><RefreshCw /><div><strong>正在生成 {motherSheetRange} 张母图并切分为独立插画</strong></div></div>}
        <button className="creator-submit" onClick={generateImageNode} disabled={isGenerating}>{generationState === "IMAGE_GENERATING" ? `${productionModeLabel(productionMode)}生成中 · ${motherSheetRange} 张母图` : imageResume?.total_mother_sheets != null ? `继续母图 ${imageResume.completed_mother_sheets + 1}/${imageResume.total_mother_sheets}` : `生成 ${motherSheetRange} 张母图并自动排版 ${resolvedPageCount} 页`}</button>
        {generationState === "FAILED" && generationError?.stage === "image" && <FailureNotice feedback={generationError} onRetry={generateImageNode} />}
      </section>}
    </>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="avatar-frame"><img className="avatar" src={IS_PUBLIC_RUNTIME ? XIAOSHIMEI_AVATAR_DATA_URL : "/assets/xiaoshimei-character-full.png"} alt="小师妹 Q 版头像" /></div>
        <strong>小师妹</strong>
        <span className="sidebar__caption">小红书图文工作台</span>
        <nav aria-label="主导航">
          <button className={view === "compose" ? "is-active" : ""} onClick={openCreator}><Plus />新创作</button>
          <button className={view === "research" ? "is-active" : ""} onClick={() => setView("research")}><Search />研究选题</button>
          <button className={view === "library" ? "is-active" : ""} onClick={() => setView("library")}><Library />资产库</button>
          <button className={view === "profile" ? "is-active" : ""} onClick={() => setView("profile")}><UserRound />账号档案</button>
        </nav>
        <span className="local-state">{IS_PUBLIC_RUNTIME ? "公网生产体验 · 人工发布" : "本地 Beta · 未发布"}</span>
      </aside>

      <main>
        <header className="topbar">
          <div className="file-title"><strong>{isDraftInputOnly ? "未命名新稿" : content.selectedTitle}</strong><span>{isDraftInputOnly ? (String(topic || "").trim() ? "等待生成文字" : "等待原文") : `${visiblePages.length} 页 · ${generatedImageCount} 张图`}</span></div>
          {provider && <button type="button" className={`provider-health is-${providerHealth.toLowerCase()}`} aria-label="生成服务设置" onClick={openProviderSettings}><SlidersHorizontal />{providerMeta?.provider_label || "生成服务"} · {providerStatusLabel}</button>}
          {storageIssue && <span className="storage-alert" title={storageIssue}>存储未落盘</span>}
          {view === "compose" && <div className="topbar-actions">
            <button className="icon-button" onClick={undo} title="撤销（⌘Z）" aria-label="撤销" disabled={!canUndo}><Undo2 /></button>
            <button className="icon-button" onClick={redo} title="重做（⇧⌘Z / ⌘Y）" aria-label="重做" disabled={!canRedo}><Redo2 /></button>
          </div>}
        </header>

        {providerSettingsOpen && <div className="provider-settings-layer" role="presentation" onClick={() => setProviderSettingsOpen(false)}>
          <section className="provider-settings-card" role="dialog" aria-modal="true" aria-label="生成服务设置" onClick={(event) => event.stopPropagation()}>
            <header><div><strong>生成服务</strong><span>{IS_PUBLIC_RUNTIME ? "API Key 只保存在当前标签页；关闭标签页即清除，不进入草稿或发布包。" : "可换服务与模型；密钥只写入本机钥匙串，不进入草稿。"}</span></div><button type="button" aria-label="关闭生成服务设置" onClick={() => setProviderSettingsOpen(false)}><X /></button></header>
            <label><span>服务类型</span><select value={providerSettingsForm.provider} onChange={(event) => {
              const nextProvider = event.target.value;
              setProviderSettingsForm((current) => ({
                ...current,
                provider: nextProvider,
                label: nextProvider === "volcengine-ark" ? "火山方舟" : "OpenAI 兼容服务",
                base_url: nextProvider === "volcengine-ark" ? "https://ark.cn-beijing.volces.com/api/v3" : "https://api.openai.com/v1",
              }));
            }}><option value="volcengine-ark">火山方舟</option>{!IS_PUBLIC_RUNTIME && <option value="openai-compatible">OpenAI 兼容服务</option>}</select></label>
            <label><span>显示名称</span><input value={providerSettingsForm.label} onChange={(event) => setProviderSettingsForm((current) => ({ ...current, label: event.target.value }))} /></label>
            <label><span>API 地址</span><input type="url" value={providerSettingsForm.base_url} readOnly={IS_PUBLIC_RUNTIME} onChange={(event) => setProviderSettingsForm((current) => ({ ...current, base_url: event.target.value }))} /></label>
            <div className="control-grid"><label><span>文字模型</span><input value={providerSettingsForm.text_model} onChange={(event) => setProviderSettingsForm((current) => ({ ...current, text_model: event.target.value }))} /></label><label><span>图片模型</span><input value={providerSettingsForm.image_model} onChange={(event) => setProviderSettingsForm((current) => ({ ...current, image_model: event.target.value }))} /></label></div>
            <label><span>API Key</span><input type="password" autoComplete="new-password" placeholder={providerMeta?.configured ? (IS_PUBLIC_RUNTIME ? "留空则继续使用当前标签页中的密钥" : "留空则继续使用钥匙串中的密钥") : (IS_PUBLIC_RUNTIME ? "输入后仅保存到当前标签页" : "输入后保存到本机钥匙串")} value={providerSettingsForm.api_key} onChange={(event) => setProviderSettingsForm((current) => ({ ...current, api_key: event.target.value }))} /></label>
            <p>{IS_PUBLIC_RUNTIME ? "公网体验当前使用火山方舟 Responses 与 Images Generations；服务端只转发本次调用，不落库、不回显 API Key。" : "兼容服务需同时支持 OpenAI Responses 与 Images Generations 接口；工作台不会把 Key 写进浏览器存储或导出包。"}</p>
            <footer><button type="button" className="provider-settings-cancel" onClick={() => setProviderSettingsOpen(false)}>取消</button><button type="button" className="provider-settings-save" disabled={providerSettingsSaving} onClick={saveProviderSettings}>{providerSettingsSaving ? "保存中…" : "保存并切换"}</button></footer>
          </section>
        </div>}

        {view === "compose" && <section className={`workbench ${creatorOpen ? "is-creator-open" : ""}`}>
          <section className="gallery" aria-label="页面编辑区">
            <div className="gallery__toolbar">
              <span className="mode-badge">{content.generation?.mode === "PROVIDER" ? "AI 素材草稿" : "演示模板"}</span>
              <span>{visiblePages.length} 页 · {generatedImageCount} 图</span>
              <span className="canvas-size">1080×1440 · 3:4</span>
              <div className="editor-engine-switch" aria-label="页面编辑方式">
                <button type="button" className={currentEditorMode === "html" ? "is-active" : ""} onClick={() => mutatePage((page) => ({ ...page, editor_mode: "html" }), { group: `editor-mode-${pageIndex}` })}>智能版式</button>
                <button type="button" className={currentEditorMode === "fabric" ? "is-active" : ""} onClick={() => mutatePage((page) => ({ ...page, editor_mode: "fabric" }), { group: `editor-mode-${pageIndex}` })}>精细画布</button>
              </div>
              <div className="gallery__actions">
                <button className="mobile-edit-button" onClick={() => setMobileInspectorOpen(true)}><SlidersHorizontal />编辑</button>
                <button onClick={() => importRef.current?.click()}><Upload />回载</button>
                <input ref={importRef} hidden multiple type="file" accept="application/json,.json" onChange={importJson} />
              </div>
            </div>

            <div className="canvas-stage canvas-stage--mature">
              {isDraftInputOnly ? <section className="fresh-draft-empty" aria-label="空白新稿">
                <span>NEW DRAFT</span>
                <h2>{isFreshDraft ? "从一段原文开始" : "原文已就位"}</h2>
                <p>{isFreshDraft ? "旧稿已安全留在资产库。先在右侧写下原文或选题，再生成文字。" : "继续在右侧补充要求，或直接生成文字；完成配图后才会进入页面精修与发布包。"}</p>
                <button type="button" onClick={() => scrollCreatorStage("creator-source")}><Plus />{isFreshDraft ? "填写原文" : "继续创作"}</button>
              </section> : currentEditorMode === "html" ? <HtmlPageEditor
                key={`html-${pageIndex}-${layoutRefreshToken}`}
                page={currentPage}
                pageIndex={pageIndex}
                totalPages={visiblePages.length}
                onStateChange={(htmlState, options = {}) => mutatePage((page) => ({ ...page, html_state: htmlState }), { group: `html-layout-${pageIndex}`, ...options })}
                onPagePatch={(patch) => mutatePage((page) => ({ ...page, ...patch }), { group: `html-copy-${pageIndex}` })}
              /> : <MaturePageEditor
                key={`fabric-${pageIndex}-${layoutRefreshToken}`}
                page={currentPage}
                pageIndex={pageIndex}
                totalPages={visiblePages.length}
                onAutoArrange={autoArrangeInfoPanels}
                onSceneChange={(editorState) => mutatePage((page) => ({ ...page, editor_state: editorState }), { group: `mature-editor-${pageIndex}` })}
              />}
            </div>

            {!isDraftInputOnly && <div className="filmstrip" aria-label="页面胶片条">
              <div className="filmstrip__tools">
                <button onClick={() => movePage(-1)} disabled={pageIndex === 0} title="左移"><ArrowLeft /></button>
                <button onClick={() => movePage(1)} disabled={pageIndex === visiblePages.length - 1} title="右移"><ArrowRight /></button>
                <button onClick={copyPage} title="复制页面"><Copy /></button>
                <button onClick={removePage} disabled={visiblePages.length <= 1} title="删除页面"><Trash2 /></button>
              </div>
              {visiblePages.map((page, index) => <button key={`${index}-${page.title}`} className={`film-thumb ${pageIndex === index ? "is-active" : ""}`} onClick={() => { setPageIndex(index); selectObject("title"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{page.title}</strong></button>)}
              <button className="film-add" onClick={copyPage} title="复制当前页作为新页"><Plus /></button>
            </div>}
          </section>

          {mobileInspectorOpen && <button className="mobile-inspector-backdrop" aria-label="关闭编辑面板" onClick={() => setMobileInspectorOpen(false)} />}
          <aside className={`inspector ${mobileInspectorOpen ? "is-mobile-open" : ""} ${creatorOpen ? "is-creator-flow" : ""}`}>
            <div className="mobile-inspector-head"><strong>创作与编辑</strong><div><button onClick={undo} disabled={!canUndo} aria-label="编辑栏撤销"><Undo2 /></button><button onClick={redo} disabled={!canRedo} aria-label="编辑栏重做"><Redo2 /></button><button onClick={() => setMobileInspectorOpen(false)} aria-label="关闭编辑面板"><X /></button></div></div>
            <div className="workbench-stream">
              <nav className="creator-journey" aria-label="创作阶段">
                {creatorJourney.steps.map((stage) => <button key={stage.step} type="button" className={`is-${stage.state}`} aria-current={stage.state === "current" ? "step" : undefined} onClick={() => {
                  if (stage.step <= 3 && !creatorOpen) { setCreatorOpen(true); setTimeout(() => scrollCreatorStage(stage.target), 0); }
                  else scrollCreatorStage(stage.target);
                }}><span>{stage.step}</span><strong>{stage.label}</strong></button>)}
              </nav>
              {creatorOpen ? renderCreatorWorkflow() : <button className="creator-resume" type="button" onClick={() => setCreatorOpen(true)}><Plus />展开完整创作链</button>}
            {!isDraftInputOnly && <section id="creator-design" className="editor-waterfall workbench-section workbench-design" aria-label="编辑栏">
              <header className="editor-waterfall__head"><div><strong>精修当前页</strong><small>{currentEditorMode === "html" ? "双击文字直接改；点图片后移动焦点或缩放，版式会随内容自然回流" : "直接在画布选中对象；拖动、缩放、双击改字，图片拖任意边裁剪"}</small></div><span className="editor-current-layer">{currentEditorMode === "html" ? "HTML Flow" : "Fabric 7"}</span></header>
              <section id="creator-publish" className="publish-copy">
                <div className="publish-copy__head"><strong>发布文案</strong><span>标题、正文与标签</span></div>
                <label><span>发布标题</span><input value={content.selectedTitle} onChange={(event) => setContent((current) => { const nextTitle = event.target.value; return { ...invalidateVisualReview(current), selectedTitle: nextTitle, titles: current.titles.map((title) => title === current.selectedTitle ? nextTitle : title), pages: current.pages.map((page, index) => index === 0 ? { ...page, title: nextTitle } : page) }; }, { group: "publish-title" })} /></label>
                <label><span>发布正文</span><textarea rows="8" value={content.body} onChange={(event) => setContent((current) => ({ ...invalidateVisualReview(current), body: event.target.value }), { group: "publish-body" })} /></label>
                <div className="tag-editor"><span>标签</span>{content.tags.map((tag, index) => <input key={index} value={tag} onChange={(event) => setContent((current) => ({ ...current, tags: current.tags.map((item, tagIndex) => tagIndex === index ? event.target.value : item) }), { group: `publish-tag-${index}` })} />)}</div>
                <button className="copy-publish" onClick={async () => {
                  try { await copyTextToClipboard(publishCopy(content)); setToast("发布文案已复制"); }
                  catch { setToast("复制失败，请直接从发布文案框选复制"); }
                }}><Clipboard />复制完整发布文案</button>
              </section>
            </section>}
            {!isDraftInputOnly && <section className="workbench-section workbench-export" aria-label="保存与下载">
              <div className="export-actions"><button type="button" className="save-final" onClick={saveDraft}><Save />保存草稿</button><button type="button" className="download-final" data-export-state={exportState} onClick={downloadZip} disabled={exportState === "GENERATING"}>{exportState === "GENERATING" ? <RefreshCw /> : <Download />}{exportState === "GENERATING" ? "正在生成发布包…" : exportState === "COMPLETE" ? "再次下载发布包" : "下载发布包"}</button></div>
              {exportState === "FAILED" && <p className="export-inline-error">下载没有完成；请先处理上方排版提示后重试。</p>}
            </section>}
            </div>
          </aside>
        </section>}

        {view === "research" && <section className="research-view">
          <header><div><span className="section-kicker">CREATOR RESEARCH</span><h1>研究选题</h1><p>用 GitHub Creator Workbench 的研究底盘找真实图文信号；选中方向后一键带回小师妹 Studio，不绕过文字确认门。</p></div><button onClick={runResearch} disabled={researchBusy || !researchPositioning.trim()}><Search />{researchBusy ? "研究中…" : researchWorkspace?.research?.updatedAt ? "刷新热点" : "扫描热点"}</button></header>
          <section className="research-positioning"><label><span>账号定位 · 与账号档案贯通</span><textarea rows="3" value={researchPositioning} onChange={(event) => setResearchPositioning(event.target.value)} placeholder="例如：聪明敏锐的小师妹，用人性关系、成长观察和东方生活把复杂问题讲清楚" /><small>研究台为空时自动带入账号档案；只有点击保存后才写入研究后端。</small></label><button onClick={saveResearchPositioning}>保存定位</button></section>
          {researchMessage && <div className="research-message">{researchMessage}</div>}
          {!researchWorkspace ? <div className="research-empty"><Search /><strong>正在读取研究工作区</strong><span>研究结果不会直接发布，只负责给 Studio 提供候选选题。</span></div> : <>
            <div className="research-summary"><span>研究状态</span><strong>{researchWorkspace.research?.updatedAt ? `最近更新 ${new Date(researchWorkspace.research.updatedAt).toLocaleString("zh-CN", { hour12: false })}` : "尚未扫描"}</strong><p>{researchWorkspace.research?.summary || "先保存定位，再扫描本账号相关的图文热点。"}</p></div>
            <section className="research-section"><div className="research-section__head"><strong>真实图文信号</strong><span>{researchWorkspace.research?.signals?.length || 0} 条</span></div><div className="research-signals">{(researchWorkspace.research?.signals || []).length ? researchWorkspace.research.signals.map((signal, index) => <article key={`${signal.label}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{signal.label}</strong><p>{signal.evidence}</p><small>{signal.engagement?.verified ? `赞 ${signal.engagement.likes} · 藏 ${signal.engagement.collects} · 评 ${signal.engagement.comments}` : "互动尚未核验"}</small></div></article>) : <p className="research-placeholder">还没有真实信号。</p>}</div></section>
            <section className="research-section"><div className="research-section__head"><strong>候选选题</strong><span>{researchWorkspace.research?.topics?.length || 0} 个</span></div><div className="research-topics">{(researchWorkspace.research?.topics || []).length ? researchWorkspace.research.topics.map((item, index) => <article key={item.id || index}><div><span>0{index + 1}</span><h2>{item.title}</h2><p>{item.angle}</p><small>{item.reason}</small></div><button onClick={() => useResearchTopic(item)}>带入 Studio</button></article>) : <p className="research-placeholder">扫描后会出现候选方向。</p>}</div></section>
          </>}
        </section>}

        {view === "library" && <section className="library-view">
          <header><div><span className="section-kicker">LOCAL ASSET LIBRARY</span><h1>资产库</h1><p>保存创作，也记录发布后的真实结果；没有的数据保持 UNKNOWN。</p></div><div className="library-actions"><button onClick={downloadWorkspaceBackup}><Download />备份工作台</button><button onClick={() => workspaceImportRef.current?.click()}><Upload />恢复备份</button><input ref={workspaceImportRef} hidden type="file" accept="application/json,.json" onChange={restoreWorkspaceBackup} /><button onClick={openCreator}><Plus />新创作</button></div></header>
          <section className={`library-current ${currentInLibrary ? "is-saved" : "is-unsaved"}`} aria-label="当前工作台保存状态"><div><span>当前工作台 · {visiblePages.length} 页</span><strong>{content.selectedTitle}</strong><small>{currentInLibrary ? "已在资产库，可继续补现实反馈" : "尚未进入资产库；回到工作台点击保存草稿"}</small></div><button type="button" onClick={() => { setView("compose"); setCreatorOpen(false); }}>返回编辑</button></section>
          {library.length === 0 ? <div className="empty-library"><Library /><strong>还没有保存的内容</strong><span>回到工作台保存后，会留在这台 Mac。</span></div> : <>
            {library.length >= 3 && <AssetPageRows library={library} />}
            {realityFeedbackItem && <RealityFeedbackEditor item={realityFeedbackItem} onSave={(feedback) => saveRealityFeedback(realityFeedbackItem.id, feedback)} onClose={() => setRealityFeedbackId(null)} />}
            <div className="library-section-title"><strong>逐份打开</strong><span>{library.length} 份本机资产 · 发布后可持续补真实数据</span></div>
            <div className="library-grid">{library.map((item) => {
              const status = realityFeedbackStatus(item.reality_feedback);
              return <article className="library-item" key={item.id}>
                <button className="library-card" onClick={() => openDraft(item)}><span>{item.visible_pages} 页</span><strong>{item.selectedTitle}</strong><small>{new Date(item.saved_at).toLocaleString("zh-CN", { hour12: false })}</small><em>{REALITY_STATUS_LABELS[status]}</em></button>
                <button className="library-feedback-action" type="button" onClick={() => setRealityFeedbackId(item.id)}>现实反馈</button>
              </article>;
            })}</div>
          </>}
        </section>}
        {view === "profile" && <ProfileEditor profile={profile} onChange={setProfile} onSave={saveProfile} onImport={importProfile} importRef={profileImportRef} />}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
