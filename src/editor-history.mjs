const DEFAULT_LIMIT = 60;
const DEFAULT_GROUP_WINDOW_MS = 900;

export function createEditorHistory(present, options = {}) {
  return {
    past: [],
    present,
    future: [],
    limit: Number.isInteger(options.limit) ? options.limit : DEFAULT_LIMIT,
    lastGroup: null,
    lastUpdatedAt: 0,
  };
}

export function updateEditorHistory(history, next, options = {}) {
  if (Object.is(next, history.present)) return history;
  if (options.record === false) {
    return { ...history, present: next, future: [] };
  }
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const group = typeof options.group === "string" && options.group ? options.group : null;
  const groupWindowMs = Number.isFinite(options.groupWindowMs) ? options.groupWindowMs : DEFAULT_GROUP_WINDOW_MS;
  const coalesces = Boolean(group && group === history.lastGroup && now - history.lastUpdatedAt <= groupWindowMs);
  const past = coalesces ? history.past : [...history.past, history.present].slice(-history.limit);
  return { ...history, past, present: next, future: [], lastGroup: group, lastUpdatedAt: now };
}

export function undoEditorHistory(history) {
  if (!history.past.length) return history;
  const present = history.past.at(-1);
  return {
    ...history,
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future].slice(0, history.limit),
    lastGroup: null,
    lastUpdatedAt: 0,
  };
}

export function redoEditorHistory(history) {
  if (!history.future.length) return history;
  const [present, ...future] = history.future;
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present,
    future,
    lastGroup: null,
    lastUpdatedAt: 0,
  };
}
