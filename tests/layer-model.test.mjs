import test from "node:test";
import assert from "node:assert/strict";
import {
  PAGE_LAYER_KEYS, layerIsLocked, layerIsVisible, layerZIndex, moveLayer,
  normalizeLayerState, setLayerFlag,
} from "../src/layer-model.mjs";

test("legacy pages receive a complete reversible layer state", () => {
  const state = normalizeLayerState();
  assert.deepEqual(state.order, PAGE_LAYER_KEYS);
  assert.equal(Object.values(state.visible).every(Boolean), true);
  assert.equal(Object.values(state.locked).some(Boolean), false);
});

test("layer visibility and lock flags are immutable updates", () => {
  const original = normalizeLayerState();
  const hidden = setLayerFlag(original, "visible", "title", false);
  const locked = setLayerFlag(hidden, "locked", "image", true);
  assert.equal(layerIsVisible({ layer_state: locked }, "title"), false);
  assert.equal(layerIsLocked({ layer_state: locked }, "image"), true);
  assert.equal(original.visible.title, true);
});

test("visual layers move within the editable stack while background stays pinned", () => {
  const original = normalizeLayerState();
  const raised = moveLayer(original, "title", "up");
  assert.ok(raised.order.indexOf("title") > raised.order.indexOf("body"));
  assert.ok(moveLayer(original, "image", "up").order.indexOf("image") > original.order.indexOf("image"));
  assert.deepEqual(moveLayer(original, "background", "up"), original);
  assert.equal(layerZIndex({ layer_state: raised }, "title") > layerZIndex({ layer_state: raised }, "body"), true);
});
