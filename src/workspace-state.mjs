import { generateContentPackage, importLocalEditableDraft, parseContentPackage } from "./content-engine.mjs";
import { normalizeProfileV2, parseProfileV2 } from "./profile-v2.mjs";

export const WORKSPACE_BACKUP_SCHEMA = "xiaoshimei.workspace-backup.v1";

function checkedContent(value, path) {
  try { return parseContentPackage(JSON.stringify(value)); }
  catch (error) { throw new TypeError(`${path}: ${error.message}`); }
}

export function buildWorkspaceBackup({ profile, currentContent, library = [], createdAt = new Date().toISOString() }) {
  if (!Array.isArray(library) || library.length > 50) throw new TypeError("library must contain at most 50 drafts");
  if (typeof createdAt !== "string" || !createdAt.trim()) throw new TypeError("createdAt is required");
  return {
    schema: WORKSPACE_BACKUP_SCHEMA,
    created_at: createdAt,
    authority_effect: "LOCAL_EDITING_ONLY",
    profile: normalizeProfileV2(profile),
    current_content: checkedContent(currentContent, "current_content"),
    library: library.map((item, index) => checkedContent(item, `library[${index}]`)),
  };
}

export function parseWorkspaceBackup(serialized) {
  let value;
  try { value = JSON.parse(serialized); }
  catch { throw new TypeError("workspace backup is not valid JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== WORKSPACE_BACKUP_SCHEMA) {
    throw new TypeError("workspace backup schema is not supported");
  }
  if (value.authority_effect !== "LOCAL_EDITING_ONLY") throw new TypeError("workspace backup cannot carry authority");
  if (!Array.isArray(value.library) || value.library.length > 50) throw new TypeError("workspace backup library is invalid");
  const profile = parseProfileV2(JSON.stringify(value.profile));
  const currentContent = importLocalEditableDraft(JSON.stringify(value.current_content));
  const library = value.library.map((item) => importLocalEditableDraft(JSON.stringify(item)));
  return { profile, currentContent, library };
}

export function persistWorkspaceState(storage, state, keys) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") throw new TypeError("storage adapter is invalid");
  const entries = [
    [keys.content, JSON.stringify(state.currentContent)],
    [keys.library, JSON.stringify(state.library)],
    [keys.profile, JSON.stringify(state.profile)],
  ];
  const before = [];
  try {
    for (const [key] of entries) before.push([key, storage.getItem(key)]);
    for (const [key, serialized] of entries) storage.setItem(key, serialized);
    return { ok: true, code: "WORKSPACE_SAVED" };
  } catch (error) {
    let rollbackFailed = false;
    for (const [key, serialized] of before) {
      try {
        if (serialized == null) storage.removeItem(key);
        else storage.setItem(key, serialized);
      } catch { rollbackFailed = true; }
    }
    return { ok: false, code: rollbackFailed ? "STORAGE_ROLLBACK_FAILED" : "STORAGE_WRITE_FAILED", message: String(error?.message || error) };
  }
}

export function prepareFreshDraftWorkspace({ currentContent, library = [], profile, draftId, savedAt }) {
  if (!Array.isArray(library)) throw new TypeError("library must be an array");
  const current = checkedContent(currentContent, "current_content");
  const fresh = generateContentPackage({ topic: "", pillar: "wellness", goal: "save" });
  const hasWorkToPreserve = Boolean(
    current.id
    || current.saved_at
    || String(current.source_input || "").trim()
    || current.generation?.mode === "PROVIDER"
  );
  if (!hasWorkToPreserve) return { currentContent: fresh, library: [...library], profile, preservedPrevious: false };
  if (typeof draftId !== "string" || !draftId.trim()) throw new TypeError("draftId is required when preserving the current draft");
  if (typeof savedAt !== "string" || !savedAt.trim()) throw new TypeError("savedAt is required when preserving the current draft");
  const preserved = { ...current, id: current.id || draftId, saved_at: current.saved_at || savedAt };
  const nextLibrary = [preserved, ...library.filter((item) => item.id !== preserved.id)].slice(0, 50);
  return { currentContent: fresh, library: nextLibrary, profile, preservedPrevious: true };
}
