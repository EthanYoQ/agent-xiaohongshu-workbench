import React, { useEffect, useRef, useState } from "react";
import initEditor from "@anu3ev/fabric-image-editor";
import {
  Check, Crop, ImagePlus, Minus, Plus, Redo2, RefreshCw, RotateCcw, SquareRoundCorner, Type, Undo2,
} from "lucide-react";
import { imagePlacementForFrame } from "./canvas-image.mjs";
import { assertRenderedPageContent } from "./export-image-verification.mjs";

const PAGE_WIDTH = 1080;
const PAGE_HEIGHT = 1440;
const CONTENT_TOP = 260;
const CONTENT_HEIGHT = 1040;
const EDITOR_STATE_VERSION = 8;
// Border cleanup belongs to the mother-sheet pixel gate. The precision editor
// keeps only a 4% safety bleed so it does not amputate faces, hands or props.
const IMAGE_BLEED_SCALE = 1.04;
const IMAGE_CORNER_RADIUS = 28;

async function verifyExportDataUrl(dataUrl, label = "FABRIC") {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`${label}_EXPORT_DECODE_FAILED`));
    image.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  assertRenderedPageContent(context.getImageData(0, 0, canvas.width, canvas.height), label);
  return dataUrl;
}

const FONT_FAMILY = {
  songti: "serif",
  heiti: "sans-serif",
  kaiti: "serif",
  fangsong: "serif",
  yuanti: "sans-serif",
  pingfang: "sans-serif",
};

function clamp(value, low, high) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(low, Math.min(high, number)) : low;
}

function percentFrame(style = {}, fallback = {}) {
  return {
    x: clamp(style.x ?? fallback.x ?? 8, 0, 96),
    y: clamp(style.y ?? fallback.y ?? 8, 0, 96),
    width: clamp(style.width ?? fallback.width ?? 50, 8, 100),
    height: clamp(style.height ?? fallback.height ?? 20, 5, 100),
  };
}

function panelFrame(page, panel, index, kind) {
  const stored = page.layout_ir?.placements?.[panel.id]?.[`${kind}_frame`];
  if (stored) return percentFrame(stored);
  const count = Math.max(1, page.info_panels?.length || 1);
  const slot = 100 / count;
  if (kind === "image") return { x: index % 2 ? 57 : 2, y: index * slot + 2, width: 39, height: Math.max(18, slot - 8) };
  return { x: index % 2 ? 2 : 46, y: index * slot + 5, width: 50, height: Math.max(16, slot - 12) };
}

function pageFrameToPixels(frame, contentArea = false) {
  const top = contentArea ? CONTENT_TOP : 0;
  const height = contentArea ? CONTENT_HEIGHT : PAGE_HEIGHT;
  return {
    left: (frame.x / 100) * PAGE_WIDTH,
    top: top + (frame.y / 100) * height,
    width: (frame.width / 100) * PAGE_WIDTH,
    height: (frame.height / 100) * height,
  };
}

function textOptions(text, style, id, frameOverride = null) {
  const frame = pageFrameToPixels(frameOverride || percentFrame(style));
  return {
    id,
    text: String(text || ""),
    left: frame.left,
    top: frame.top,
    width: frame.width,
    autoExpand: false,
    splitByGrapheme: true,
    originX: "left",
    originY: "top",
    fontFamily: FONT_FAMILY[style?.fontFamily] || "sans-serif",
    fontSize: clamp(style?.fontSize ?? 42, 16, 132),
    lineHeight: clamp(style?.lineHeight ?? 1.35, 0.9, 2),
    bold: Number(style?.fontWeight || 400) >= 700,
    align: style?.align || "left",
    color: style?.color || "#17211e",
    opacity: clamp(style?.opacity ?? 1, 0.1, 1),
    customData: { xiaoshimeiKind: id },
  };
}

function applyRoundedImageMask(editor, image, radius = IMAGE_CORNER_RADIUS) {
  const RectClass = editor?.canvas?.clipPath?.constructor;
  const width = Math.max(1, Number(image?.width) || 1);
  const height = Math.max(1, Number(image?.height) || 1);
  if (!RectClass || !image) return;
  const safeRadius = Math.min(radius, width / 2, height / 2);
  image.set({
    clipPath: new RectClass({
      left: 0,
      top: 0,
      width,
      height,
      rx: safeRadius,
      ry: safeRadius,
      originX: "center",
      originY: "center",
      absolutePositioned: false,
    }),
    customData: {
      ...(image.customData || {}),
      xiaoshimeiCornerRadius: radius,
    },
  });
  image.setCoords();
}

function restoreImageMasks(editor) {
  editor?.canvas?.getObjects?.().forEach((object) => {
    if (String(object?.type || "").toLowerCase() !== "image") return;
    applyRoundedImageMask(editor, object, object?.customData?.xiaoshimeiCornerRadius || IMAGE_CORNER_RADIUS);
  });
  editor?.canvas?.requestRenderAll?.();
}

function removeLegacyPageNumbers(editor) {
  editor?.canvas?.getObjects?.().forEach((object) => {
    const kind = object?.customData?.xiaoshimeiKind || object?.id;
    if (kind === "xsm-page_number") editor.canvas.remove(object);
  });
  editor?.canvas?.requestRenderAll?.();
}

async function addImage(editor, imageStyle, frame, id, contentArea = false) {
  if (!imageStyle?.src || imageStyle.hidden) return null;
  const result = await editor.imageManager.importImage({
    source: imageStyle.src,
    scale: "image-contain",
    withoutSave: true,
    withoutSelection: true,
    customData: { xiaoshimeiKind: id },
  });
  const image = result?.image;
  if (!image) return null;
  const target = pageFrameToPixels(frame, contentArea);
  const intrinsicWidth = Math.max(1, Number(image.width) || 1);
  const intrinsicHeight = Math.max(1, Number(image.height) || 1);
  const placement = imagePlacementForFrame({
    intrinsicWidth,
    intrinsicHeight,
    targetWidth: target.width,
    targetHeight: target.height,
    fit: imageStyle.fit,
    focalX: imageStyle.focalX,
    focalY: imageStyle.focalY,
    bleedScale: IMAGE_BLEED_SCALE,
  });
  image.set({
    left: target.left + target.width / 2,
    top: target.top + target.height / 2,
    width: placement.visibleWidth,
    height: placement.visibleHeight,
    cropX: placement.cropX,
    cropY: placement.cropY,
    originX: "center",
    originY: "center",
    scaleX: placement.scale,
    scaleY: placement.scale,
    angle: Number(imageStyle.rotation || 0),
    opacity: clamp(imageStyle.opacity ?? 1, 0.1, 1),
  });
  applyRoundedImageMask(editor, image);
  image.setCoords();
  return image;
}

async function seedPage(editor, page, pageIndex, totalPages) {
  editor.historyManager.suspendHistory();
  try {
    editor.backgroundManager.setColorBackground({ color: page.background_style?.color || "#ffffff", withoutSave: true });
    const entries = [
      ["eyebrow", page.eyebrow],
      ["title", page.title],
      ["body", page.body],
      ["brand", page.brand],
    ];
    entries.forEach(([kind, text]) => {
      const style = page.object_styles?.[kind];
      if (!style || page.layer_state?.visible?.[kind] === false) return;
      const characterBody = kind === "body" && page.visual === "character";
      const options = textOptions(text, style, `xsm-${kind}`, characterBody ? { x: 8, y: 48, width: 36, height: 44 } : null);
      if (characterBody) options.fontSize = clamp(style.fontSize ?? 36, 20, 34);
      editor.textManager.addText(options, { withoutSelection: true, withoutSave: true });
    });

    if (page.info_panels?.length) {
      for (const [index, panel] of page.info_panels.entries()) {
        const imageFrame = panelFrame(page, panel, index, "image");
        const copyFrame = panelFrame(page, panel, index, "text");
        await addImage(editor, panel.image_style, imageFrame, `xsm-info-image-${index}`, true);
        const copyPixels = pageFrameToPixels(copyFrame, true);
        const copyStyle = panel.text_style || {};
        const dense = page.info_panels.length >= 3;
        const titleSize = dense ? 40 : 46;
        const bodySize = dense ? 30 : 36;
        editor.textManager.addText({
          ...textOptions(panel.title, copyStyle, `xsm-info-title-${index}`),
          left: copyPixels.left,
          top: copyPixels.top,
          width: copyPixels.width,
          fontSize: titleSize,
          bold: true,
        }, { withoutSelection: true, withoutSave: true });
        editor.textManager.addText({
          ...textOptions(panel.body, copyStyle, `xsm-info-body-${index}`),
          left: copyPixels.left,
          top: copyPixels.top + titleSize * 1.45,
          width: copyPixels.width,
          fontSize: bodySize,
          bold: false,
          lineHeight: 1.35,
        }, { withoutSelection: true, withoutSave: true });
      }
    } else if (page.visual === "character") {
      const imageFrame = percentFrame(page.image_style?.frame, { x: 48, y: 30, width: 42, height: 55 });
      await addImage(editor, page.image_style, { ...imageFrame, y: Math.max(30, imageFrame.y) }, "xsm-image");
    }
    removeLegacyPageNumbers(editor);
    editor.canvas.discardActiveObject();
    editor.canvas.requestRenderAll();
  } finally {
    editor.historyManager.resumeHistory();
    editor.historyManager.saveState();
  }
}

export async function renderMaturePageToPng(page, pageIndex, totalPages) {
  const hostId = `xsm-export-editor-${Math.random().toString(36).slice(2)}`;
  const host = document.createElement("div");
  host.id = hostId;
  Object.assign(host.style, {
    position: "fixed",
    left: "-20000px",
    top: "0",
    width: `${PAGE_WIDTH}px`,
    height: `${PAGE_HEIGHT}px`,
    pointerEvents: "none",
  });
  document.body.appendChild(host);
  let editor = null;
  try {
    editor = await initEditor(hostId, {
      montageAreaWidth: PAGE_WIDTH,
      montageAreaHeight: PAGE_HEIGHT,
      editorContainerWidth: `${PAGE_WIDTH}px`,
      editorContainerHeight: `${PAGE_HEIGHT}px`,
      canvasWrapperWidth: `${PAGE_WIDTH}px`,
      canvasWrapperHeight: `${PAGE_HEIGHT}px`,
      canvasCSSWidth: `${PAGE_WIDTH}px`,
      canvasCSSHeight: `${PAGE_HEIGHT}px`,
      defaultScale: 1,
      showToolbar: false,
      showViewportScrollbars: false,
      resetObjectFitByDoubleClick: false,
      fonts: [],
      initialState: page.editor_state?.__xsm_editor_version === EDITOR_STATE_VERSION ? page.editor_state : null,
    });
    if (page.editor_state?.__xsm_editor_version !== EDITOR_STATE_VERSION) await seedPage(editor, page, pageIndex, totalPages);
    removeLegacyPageNumbers(editor);
    editor.canvas.discardActiveObject();
    editor.canvas.requestRenderAll();
    const result = await editor.imageManager.exportCanvasAsImageFile({
      fileName: `${String(pageIndex + 1).padStart(2, "0")}.png`,
      contentType: "image/png",
      exportAsBase64: true,
    });
    if (typeof result?.image === "string") return verifyExportDataUrl(result.image);
    if (result?.image instanceof Blob) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error || new Error("PNG export failed"));
        reader.readAsDataURL(result.image);
      });
      return verifyExportDataUrl(dataUrl);
    }
    throw new Error(`page ${pageIndex + 1} export returned no image`);
  } finally {
    try { editor?.destroy?.(); }
    catch { editor?.canvas?.dispose?.(); }
    host.remove();
  }
}

export function MaturePageEditor({ page, pageIndex, totalPages, onSceneChange, onAutoArrange }) {
  const hostIdRef = useRef(`xsm-mature-editor-${Math.random().toString(36).slice(2)}`);
  const editorRef = useRef(null);
  const onSceneChangeRef = useRef(onSceneChange);
  const fileRef = useRef(null);
  const saveTimerRef = useRef(null);
  const [status, setStatus] = useState("LOADING");
  const [selectionKind, setSelectionKind] = useState("none");
  const [cropping, setCropping] = useState(false);

  onSceneChangeRef.current = onSceneChange;

  useEffect(() => {
    let cancelled = false;
    const hostId = hostIdRef.current;
    const persistScene = () => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const editor = editorRef.current;
        if (!editor) return;
        onSceneChangeRef.current?.({
          ...structuredClone(editor.historyManager.getFullState()),
          __xsm_editor_version: EDITOR_STATE_VERSION,
        });
      }, 120);
    };
    const syncSelection = () => {
      const target = editorRef.current?.canvas?.getActiveObject?.();
      const type = String(target?.type || "").toLowerCase();
      setSelectionKind(type === "image" ? "image" : type.includes("text") ? "text" : target ? "object" : "none");
    };
    const boot = async () => {
      setStatus("LOADING");
      try {
        const editor = await initEditor(hostId, {
          montageAreaWidth: PAGE_WIDTH,
          montageAreaHeight: PAGE_HEIGHT,
          editorContainerWidth: "100%",
          editorContainerHeight: "100%",
          canvasWrapperWidth: "100%",
          canvasWrapperHeight: "100%",
          canvasCSSWidth: "100%",
          canvasCSSHeight: "100%",
          defaultScale: 0.96,
          minZoom: 0.2,
          maxZoom: 2.5,
          enableRetinaScaling: true,
          showToolbar: false,
          showViewportScrollbars: false,
          resetObjectFitByDoubleClick: false,
          fonts: [],
          initialState: page.editor_state?.__xsm_editor_version === EDITOR_STATE_VERSION ? page.editor_state : null,
        });
        if (cancelled) {
          try { editor.destroy(); } catch { editor.canvas?.dispose?.(); }
          return;
        }
        editorRef.current = editor;
        if (page.editor_state?.__xsm_editor_version !== EDITOR_STATE_VERSION) await seedPage(editor, page, pageIndex, totalPages);
        removeLegacyPageNumbers(editor);
        editor.zoomManager.calculateAndApplyDefaultZoom(0.96);
        editor.canvas.on("selection:created", syncSelection);
        editor.canvas.on("selection:updated", syncSelection);
        editor.canvas.on("selection:cleared", syncSelection);
        editor.canvas.on("editor:history-changed", persistScene);
        editor.canvas.on("editor:history-state-loaded", () => { restoreImageMasks(editor); removeLegacyPageNumbers(editor); });
        editor.canvas.on("editor:crop:started", () => setCropping(true));
        editor.canvas.on("editor:crop:applied", ({ target }) => {
          applyRoundedImageMask(editor, target, target?.customData?.xiaoshimeiCornerRadius || IMAGE_CORNER_RADIUS);
          editor.canvas.requestRenderAll();
          setCropping(false);
          persistScene();
        });
        editor.canvas.on("editor:crop:cancelled", () => setCropping(false));
        editor.canvas.on("mouse:dblclick", ({ target }) => {
          if (String(target?.type || "").toLowerCase() !== "image" || target.locked) return;
          editor.cropManager.startImageCrop({ target, preserveAspectRatio: false, allowFrameOverflow: false, showGrid: true, cancelOnSelectionClear: false });
        });
        setStatus("READY");
      } catch (error) {
        console.error("[xiaoshimei-mature-editor]", error);
        setStatus("FAILED");
      }
    };
    void boot();
    return () => {
      cancelled = true;
      clearTimeout(saveTimerRef.current);
      try { editorRef.current?.destroy?.(); }
      catch { editorRef.current?.canvas?.dispose?.(); }
      editorRef.current = null;
      const host = document.getElementById(hostId);
      if (host) host.replaceChildren();
    };
  }, [pageIndex]);

  const startCrop = () => {
    const editor = editorRef.current;
    const target = editor?.canvas?.getActiveObject?.();
    if (!editor || String(target?.type || "").toLowerCase() !== "image") return;
    editor.cropManager.startImageCrop({ target, preserveAspectRatio: false, allowFrameOverflow: false, showGrid: true, cancelOnSelectionClear: false });
  };

  const finishCrop = () => editorRef.current?.cropManager.apply();
  const cancelCrop = () => editorRef.current?.cropManager.cancel();
  const addText = () => editorRef.current?.textManager.addText({ text: "双击输入文字", width: 420, autoExpand: false, splitByGrapheme: true, fontFamily: "sans-serif", fontSize: 52, color: "#17211e" });
  const addRoundedRectangle = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const shape = await editor.shapeManager.add({
      presetKey: "square",
      options: {
        id: `xsm-rounded-rect-${Date.now()}`,
        left: PAGE_WIDTH / 2,
        top: PAGE_HEIGHT / 2,
        originX: "center",
        originY: "center",
        width: 420,
        height: 240,
        text: "",
        fill: "#dfe9e3",
        stroke: "transparent",
        strokeWidth: 0,
      },
    });
    await editor.shapeManager.setRounding({ target: shape, rounding: 36 });
    editor.canvas.setActiveObject(shape);
    editor.canvas.requestRenderAll();
  };
  const addImageFromFile = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !editorRef.current) return;
    const result = await editorRef.current.imageManager.importImage({ source: file, scale: "image-contain" });
    if (result?.image) applyRoundedImageMask(editorRef.current, result.image);
  };

  return <section className="mature-editor" data-status={status}>
    <div className="mature-editor__toolbar" aria-label="页面编辑工具">
      <button type="button" onClick={addText} disabled={status !== "READY"}><Type />文字</button>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={status !== "READY"}><ImagePlus />图片</button>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={addImageFromFile} />
      <button type="button" onClick={addRoundedRectangle} disabled={status !== "READY"}><SquareRoundCorner />圆角矩形</button>
      <button type="button" onClick={onAutoArrange} disabled={status !== "READY" || !page.info_panels?.length}><RefreshCw />灵动排版</button>
      <span className="mature-editor__divider" />
      {cropping ? <>
        <button type="button" className="is-primary" onClick={finishCrop}><Check />完成裁剪</button>
        <button type="button" onClick={cancelCrop}><RotateCcw />取消</button>
        <span className="mature-editor__hint">直接拖要裁掉的那一边</span>
      </> : <button type="button" className={selectionKind === "image" ? "is-primary" : ""} onClick={startCrop} disabled={selectionKind !== "image"}><Crop />裁剪</button>}
      <span className="mature-editor__spacer" />
      <button type="button" aria-label="撤销" onClick={() => editorRef.current?.historyManager.undo()}><Undo2 /></button>
      <button type="button" aria-label="重做" onClick={() => editorRef.current?.historyManager.redo()}><Redo2 /></button>
      <button type="button" aria-label="缩小画布" onClick={() => editorRef.current?.zoomManager.zoom(-0.1)}><Minus /></button>
      <button type="button" aria-label="放大画布" onClick={() => editorRef.current?.zoomManager.zoom(0.1)}><Plus /></button>
    </div>
    <div className="mature-editor__stage" id={hostIdRef.current} />
    {status === "LOADING" && <div className="mature-editor__status">正在载入编辑器…</div>}
    {status === "FAILED" && <div className="mature-editor__status is-error">编辑器载入失败，请刷新重试</div>}
  </section>;
}
