import crypto from "node:crypto";
import { createBrandCharacter, createDefaultState } from "./default-state.mjs";

export const MULTI_ACCOUNT_SCHEMA_VERSION = 1;

function now() {
  return new Date().toISOString();
}

export function safeFolderSegment(value, fallback = "untitled") {
  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

export function createPendingBrandVisualIdentity() {
  return {
    version: "agent-xhs-brand-v2",
    status: "not_started",
    name: "等待基于账号定位生成",
    palette: null,
    topicAccents: [],
    typography: "填写账号定位后，由 Agent 为这个账号重新设计",
    composition: "等待品牌角色与视觉语言生成",
    characterPlacement: "等待品牌角色生成",
    visualRules: [],
  };
}

export function createPublishBinding() {
  return {
    enabled: false,
    label: null,
    boundAt: null,
    warningAcknowledgedAt: null,
    method: "current-browser-session",
    message: "默认关闭。需要先在浏览器切换到目标小红书账号，再手动启用。",
  };
}

function createBlankContentWorkspace(positioning = "") {
  const workspace = createDefaultState();
  workspace.positioning = String(positioning || "").trim().slice(0, 500);
  workspace.brandCharacter = createBrandCharacter();
  workspace.brandVisualIdentity = createPendingBrandVisualIdentity();
  workspace.publish = {
    status: "not_started",
    noteId: null,
    url: null,
    message: "内容账号尚未启用发布功能",
  };
  workspace.storylineSync = {
    status: "manual_only",
    imported: 0,
    updatedAt: null,
    message: "多账号模式仅记录手动标记的已发布内容",
  };
  return workspace;
}

export function createContentAccount({ id, name, positioning = "", workspace = null, createdAt = now() } = {}) {
  const accountName = String(name || "内容账号").trim().slice(0, 40) || "内容账号";
  return {
    id: id || `content-${crypto.randomUUID().slice(0, 8)}`,
    name: accountName,
    createdAt,
    updatedAt: createdAt,
    workspace: workspace ? structuredClone(workspace) : createBlankContentWorkspace(positioning),
    publishBinding: createPublishBinding(),
    output: {
      folderSlug: safeFolderSegment(accountName, "content-account"),
      latest: null,
      entries: [],
    },
  };
}

export function createFreshMultiAccountState() {
  const account = createContentAccount({ name: "内容账号 01" });
  return {
    schemaVersion: MULTI_ACCOUNT_SCHEMA_VERSION,
    activeAccountId: account.id,
    researchOperator: {
      mode: "shared-current-browser-session",
      status: "connected",
      label: "当前浏览器小红书登录会话",
      message: "仅用于按当前内容账号定位研究图文热点；不会共享热点结果或自动发布。",
      updatedAt: now(),
    },
    contentAccounts: [account],
    lastJobId: null,
  };
}

export function isMultiAccountState(state) {
  return Boolean(state && Array.isArray(state.contentAccounts) && typeof state.activeAccountId === "string");
}

export function migrateLegacyWorkspace(legacyWorkspace) {
  const legacy = structuredClone(legacyWorkspace || createDefaultState());
  const account = createContentAccount({
    id: "content-legacy",
    name: "原有内容账号",
    workspace: legacy,
    createdAt: legacy.createdAt || now(),
  });
  return {
    schemaVersion: MULTI_ACCOUNT_SCHEMA_VERSION,
    activeAccountId: account.id,
    researchOperator: {
      mode: "shared-current-browser-session",
      status: "connected",
      label: "当前浏览器小红书登录会话",
      message: "仅用于按当前内容账号定位研究图文热点；不会共享热点结果或自动发布。",
      updatedAt: now(),
    },
    contentAccounts: [account],
    lastJobId: legacy.lastJobId || null,
  };
}

export function getContentAccount(state, accountId = null) {
  if (!isMultiAccountState(state)) return null;
  const targetId = accountId || state.activeAccountId;
  return state.contentAccounts.find((account) => account.id === targetId) || null;
}

export function getWorkspace(state, accountId = null) {
  if (!isMultiAccountState(state)) return state;
  const account = getContentAccount(state, accountId);
  if (!account) throw new Error("内容账号不存在或已被移除");
  return account.workspace;
}

export function setActiveContentAccount(state, accountId) {
  if (!isMultiAccountState(state)) throw new Error("当前工作台尚未迁移到多账号模式");
  const account = getContentAccount(state, accountId);
  if (!account) throw new Error("要切换的内容账号不存在");
  state.activeAccountId = account.id;
  account.updatedAt = now();
  return account;
}

export function addContentAccount(state, input = {}) {
  if (!isMultiAccountState(state)) throw new Error("当前工作台尚未迁移到多账号模式");
  const account = createContentAccount({ name: input.name, positioning: input.positioning });
  state.contentAccounts.push(account);
  state.activeAccountId = account.id;
  return account;
}

export function touchContentAccount(state, accountId = null) {
  const account = getContentAccount(state, accountId);
  if (account) account.updatedAt = now();
  return account;
}

function accountSummary(account) {
  const workspace = account.workspace || {};
  return {
    id: account.id,
    name: account.name,
    positioning: workspace.positioning || "",
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    avatarUrl: workspace.brandCharacter?.avatar?.url || null,
    brandStatus: workspace.brandCharacter?.status || "not_started",
    researchUpdatedAt: workspace.research?.updatedAt || null,
    researchMode: workspace.research?.mode || "not_started",
    topicCount: workspace.research?.topics?.length || 0,
    storylineCount: workspace.storyline?.entries?.length || 0,
    publishEnabled: Boolean(account.publishBinding?.enabled),
    publishLabel: account.publishBinding?.label || null,
    latestOutput: account.output?.latest ? {
      id: account.output.latest.id,
      relativePath: account.output.latest.relativePath,
      status: account.output.latest.status,
      generatedAt: account.output.latest.generatedAt,
    } : null,
  };
}

export function toClientWorkspace(state) {
  if (!isMultiAccountState(state)) return state;
  const account = getContentAccount(state);
  if (!account) throw new Error("没有可用的内容账号");
  const workspace = structuredClone(account.workspace);
  workspace.accountContext = {
    schemaVersion: state.schemaVersion,
    activeAccountId: account.id,
    activeAccountName: account.name,
    accounts: state.contentAccounts.map(accountSummary),
    researchOperator: structuredClone(state.researchOperator),
    publishBinding: structuredClone(account.publishBinding),
    output: structuredClone(account.output),
  };
  return workspace;
}
