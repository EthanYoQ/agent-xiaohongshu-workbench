import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crop, Minus, Move, Plus, RotateCcw, ScanSearch, Shuffle, Type,
} from "lucide-react";
import {
  HTML_IMAGE_ZOOM_MAX, bodyParagraphs, editorialPanelMeta, highlightTextSegments, imageEditFor, layoutsForPage, nextHtmlLayout, normalizeHtmlState,
  objectDragEdit, objectEditFor, objectTransformStyle, updateImageEdit, updateObjectEdit,
} from "./html-layout.mjs";
import { assertRenderedImageRegions, assertRenderedPageContent } from "./export-image-verification.mjs";
import { rectContainedBy, rectsIntersect } from "./layout-qa.mjs";
import { mediaPolicyFor } from "./media-role.mjs";
import { designProgramStyle, normalizeDesignProgram } from "./design-program.mjs";

const PAGE_WIDTH = 1080;
const PAGE_HEIGHT = 1440;
const Moveable = React.lazy(() => import("react-moveable"));

function cleanEditableText(node, preserveInline = false) {
  return String((preserveInline ? node?.textContent : node?.innerText) || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function imageEntriesForPage(page) {
  const panels = Array.isArray(page?.info_panels) ? page.info_panels : [];
  if (panels.length) return editorialPanelMeta(page).map((meta, index) => ({
    id: `panel-${index}`,
    imageStyle: panels[index]?.image_style,
    mediaRole: meta.mediaRole,
    fitPolicy: meta.fitPolicy,
  }));
  const policy = mediaPolicyFor({ ...page, ...page?.image_style, content_role: "hero" });
  return [{ id: "hero", imageStyle: page?.image_style, mediaRole: policy.mediaRole, fitPolicy: policy.fitPolicy }];
}

async function detectSubjectFocus(src, mediaRole = "inline_sticker") {
  const policy = mediaPolicyFor({ media_role: mediaRole });
  if (!src) return { focalX: 50, focalY: 50, zoom: policy.defaultZoom };
  const image = new Image();
  if (!src.startsWith("data:")) image.crossOrigin = "anonymous";
  image.decoding = "async";
  await new Promise((resolve) => {
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
    if (image.complete) resolve();
  });
  if (!image.naturalWidth || !image.naturalHeight) return { focalX: 50, focalY: 50, zoom: policy.defaultZoom };
  const size = 72;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let data;
  try {
    context.drawImage(image, 0, 0, size, size);
    data = context.getImageData(0, 0, size, size).data;
  } catch {
    return { focalX: 50, focalY: 50, zoom: policy.defaultZoom };
  }
  const border = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x > 2 && x < size - 3 && y > 2 && y < size - 3) continue;
      const offset = (y * size + x) * 4;
      border.push([data[offset], data[offset + 1], data[offset + 2]]);
    }
  }
  const edge = border.reduce((sum, rgb) => rgb.map((value, index) => sum[index] + value), [0, 0, 0]).map((value) => value / Math.max(1, border.length));
  let total = 0;
  let weightedX = 0;
  let weightedY = 0;
  let minX = size;
  let maxX = 0;
  let minY = size;
  let maxY = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const rgb = [data[offset], data[offset + 1], data[offset + 2]];
      const distance = Math.sqrt(rgb.reduce((sum, value, index) => sum + (value - edge[index]) ** 2, 0));
      const saturation = Math.max(...rgb) - Math.min(...rgb);
      const weight = Math.max(0, distance - 22) + saturation * .22;
      if (weight <= 10) continue;
      total += weight;
      weightedX += x * weight;
      weightedY += y * weight;
      if (weight > 24) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  if (!total) return { focalX: 50, focalY: 50, zoom: policy.defaultZoom };
  const subjectCoverage = ((maxX - minX + 1) * (maxY - minY + 1)) / (size * size);
  return {
    focalX: Math.max(18, Math.min(82, (weightedX / total / (size - 1)) * 100)),
    focalY: Math.max(18, Math.min(82, (weightedY / total / (size - 1)) * 100)),
    zoom: policy.fitPolicy === "contain"
      ? 1
      : subjectCoverage < .28 ? 1.04 : policy.defaultZoom,
  };
}

export function inspectHtmlPageLayout(pageElement) {
  if (!(pageElement instanceof Element)) return { fits: false, reasons: ["PAGE_MISSING"] };
  const pageRect = pageElement.getBoundingClientRect();
  const footer = pageElement.querySelector(".html-page__footer");
  const footerRect = footer?.getBoundingClientRect();
  const reasons = [];
  if (pageElement.scrollWidth > pageElement.clientWidth + 1 || pageElement.scrollHeight > pageElement.clientHeight + 1) reasons.push("PAGE_SCROLL_OVERFLOW");
  const boundaryBottom = footerRect ? footerRect.top - pageRect.height * .012 : pageRect.bottom;
  /* Flex/grid containers intentionally occupy the available safe area. Judge
     their rendered children, otherwise a healthy layout fails merely because
     its container reaches the footer boundary. */
  const content = [...pageElement.querySelectorAll([
    ".html-page__header",
    ".html-page__eyebrow",
    ".html-page__title",
    ".html-page__title-phrase",
    ".html-page mark",
    ".html-page__cover-lede",
    ".html-page__panels > .html-page__panel",
    ".html-page__panel-copy h2",
    ".html-page__panel-copy p",
    ".html-page__essay > .html-page__body",
    ".html-page__essay > .html-page__body p",
    ".html-page__essay > .html-page__image",
  ].join(", "))]
    /* Inline descendants of a hidden cover/panel copy can still report
       display:inline while having no rendered box. Their zero rectangle sits
       at the viewport origin and used to create a false HORIZONTAL_OVERFLOW
       warning even after a successful export. */
    .filter((element) => getComputedStyle(element).display !== "none" && element.getClientRects().length > 0);
  content.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const identity = element.dataset.panelId || element.dataset.imageId || element.className;
    if (rect.left < pageRect.left - 1 || rect.right > pageRect.right + 1) reasons.push(`HORIZONTAL_OVERFLOW:${identity}`);
    if (rect.bottom > boundaryBottom + 1) reasons.push(`FOOTER_COLLISION:${identity}`);
  });

  const panels = [...pageElement.querySelectorAll(".html-page__panels > .html-page__panel")]
    .filter((element) => getComputedStyle(element).display !== "none");
  const panelGeometry = panels.map((panel, index) => ({
    id: panel.dataset.panelId || `panel-${index + 1}`,
    panel: panel.getBoundingClientRect(),
    copy: panel.querySelector(".html-page__panel-copy")?.getBoundingClientRect(),
    image: panel.querySelector(".html-page__image")?.getBoundingClientRect(),
  }));
  panelGeometry.forEach((entry) => {
    if (entry.copy && !rectContainedBy(entry.copy, entry.panel, 1)) reasons.push(`PANEL_CHILD_ESCAPE:${entry.id}:copy`);
    if (entry.image && !rectContainedBy(entry.image, entry.panel, 1)) reasons.push(`PANEL_CHILD_ESCAPE:${entry.id}:image`);
    if (entry.copy && entry.image && rectsIntersect(entry.copy, entry.image, 1)) reasons.push(`PANEL_SELF_OVERLAP:${entry.id}`);
  });
  for (let left = 0; left < panelGeometry.length; left += 1) {
    for (let right = left + 1; right < panelGeometry.length; right += 1) {
      const first = panelGeometry[left];
      const second = panelGeometry[right];
      if (rectsIntersect(first.panel, second.panel, 1)) reasons.push(`PANEL_OVERLAP:${first.id}:${second.id}`);
      if (first.copy && second.image && rectsIntersect(first.copy, second.image, 1)) reasons.push(`CROSS_PANEL_OVERLAP:${first.id}:copy:${second.id}:image`);
      if (first.image && second.copy && rectsIntersect(first.image, second.copy, 1)) reasons.push(`CROSS_PANEL_OVERLAP:${first.id}:image:${second.id}:copy`);
    }
  }

  const essayBody = pageElement.querySelector(".html-page__essay > .html-page__body");
  const essayImage = pageElement.querySelector(".html-page__essay > .html-page__image");
  if (essayBody && essayImage && getComputedStyle(essayBody).display !== "none" && rectsIntersect(essayBody.getBoundingClientRect(), essayImage.getBoundingClientRect(), 1)) {
    reasons.push("ESSAY_TEXT_IMAGE_OVERLAP");
  }
  const coverHeader = pageElement.querySelector(".html-page__header");
  const coverLede = pageElement.querySelector(".html-page__cover-lede");
  if (coverHeader && coverLede && getComputedStyle(coverLede).display !== "none" && rectsIntersect(coverHeader.getBoundingClientRect(), coverLede.getBoundingClientRect(), 1)) {
    reasons.push("COVER_HEADER_LEDE_OVERLAP");
  }
  if (coverLede && essayImage && getComputedStyle(coverLede).display !== "none" && rectsIntersect(coverLede.getBoundingClientRect(), essayImage.getBoundingClientRect(), 1)) {
    reasons.push("COVER_LEDE_IMAGE_OVERLAP");
  }
  [...pageElement.querySelectorAll(".html-page__image[data-preferred-aspect='3:4']")]
    .filter((element) => getComputedStyle(element).display !== "none")
    .forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.height <= 0 || Math.abs((rect.width / rect.height) - .75) > .015) {
        reasons.push(`IMAGE_ASPECT_MISMATCH:${element.dataset.imageId || index}`);
      }
    });
  [...pageElement.querySelectorAll(".html-page__image[data-preferred-aspect='9:8']")]
    .filter((element) => getComputedStyle(element).display !== "none")
    .forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.height <= 0 || Math.abs((rect.width / rect.height) - 1.125) > .015) {
        reasons.push(`IMAGE_ASPECT_MISMATCH:${element.dataset.imageId || index}`);
      }
    });
  return { fits: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function HighlightedText({ value, phrases = [] }) {
  return highlightTextSegments(value, phrases).map((segment, index) => segment.highlight
    ? <mark key={`${index}-${segment.text}`}>{segment.text}</mark>
    : <React.Fragment key={`${index}-${segment.text}`}>{segment.text}</React.Fragment>);
}

function PhraseSafeTitle({ value, phrases = [] }) {
  return highlightTextSegments(value, phrases).map((segment, index) => segment.highlight
    ? <span className="html-page__title-phrase" key={`${index}-${segment.text}`}><mark>{segment.text}</mark></span>
    : <span className="html-page__title-phrase html-page__title-phrase--plain" key={`${index}-${segment.text}`}>{segment.text}</span>);
}

function EditableText({ as: Tag = "div", value, className, onCommit, onSelect, multiline = true, highlightPhrases = [], phraseSafe = false }) {
  return <Tag
    className={className}
    contentEditable
    suppressContentEditableWarning
    spellCheck={false}
    data-phrase-safe={phraseSafe ? "true" : undefined}
    data-editable-text="true"
    onFocus={onSelect}
    onPointerDown={onSelect}
    onKeyDown={(event) => {
      if (!multiline && event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    }}
    onBlur={(event) => {
      const next = cleanEditableText(event.currentTarget, phraseSafe);
      if (next && next !== String(value || "").trim()) onCommit(next);
    }}
  >{phraseSafe ? <PhraseSafeTitle value={value} phrases={highlightPhrases} /> : <HighlightedText value={value} phrases={highlightPhrases} />}</Tag>;
}

function cssAspectRatio(value) {
  return ({ "1:1": "1 / 1", "4:5": "4 / 5", "3:4": "3 / 4", "4:3": "4 / 3", "9:8": "9 / 8" })[String(value || "")] || "3 / 4";
}

function pageAccentColor(page) {
  const color = String(page?.accent || "").trim().toLowerCase();
  // Migrate former wellness defaults without overriding deliberate custom colors.
  const formerSystemAccents = ["", "#1f5948", "#b86442", "#805b3d", "#a6362b", "#245d77", "#9b5f52", "#6b6953", "#79653d"];
  return formerSystemAccents.includes(color) ? "#e6773d" : page.accent;
}

function pageDisplayAccentColor(page) {
  const color = String(page?.accent || "").trim().toLowerCase();
  const formerSystemAccents = ["", "#1f5948", "#b86442", "#e6773d", "#805b3d", "#a6362b", "#245d77", "#9b5f52", "#6b6953", "#79653d"];
  return formerSystemAccents.includes(color) ? "#fd8502" : page.accent;
}

function PageImage({ id, objectId, imageStyle, mediaRole, fitPolicy, preferredAspect, state, alt, selected, objectSelected, interactionMode, onSelect, onSelectObject, onEdit, onObjectPointerDown, onObjectPointerMove, onObjectPointerUp, onObjectPointerCancel, renderOnly = false }) {
  const dragRef = useRef(null);
  const [orientation, setOrientation] = useState("unknown");
  const src = String(imageStyle?.src || "").trim();
  if (!src || imageStyle?.hidden) return null;
  const edit = imageEditFor(state, id, { ...imageStyle, media_role: mediaRole });
  const objectStyle = objectTransformStyle(state, objectId);
  return <figure
    className={`html-page__image html-editor-object is-${orientation} ${selected ? "is-selected" : ""} ${objectSelected ? "is-object-selected" : ""}`}
    data-image-id={id}
    data-editor-object-id={objectId}
    data-media-role={mediaRole}
    data-fit-policy={fitPolicy}
    data-preferred-aspect={preferredAspect || imageStyle?.preferred_aspect || "3:4"}
    onClick={renderOnly ? undefined : (event) => { event.stopPropagation(); onSelect?.(id); onSelectObject?.(objectId); }}
    onPointerDown={renderOnly ? undefined : (event) => {
      if (interactionMode === "move") {
        onSelect?.(id);
        onObjectPointerDown?.(event, objectId);
        return;
      }
      event.stopPropagation();
      onSelect?.(id);
      onSelectObject?.(objectId);
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { x: event.clientX, y: event.clientY, focalX: edit.focalX, focalY: edit.focalY };
    }}
    onPointerMove={renderOnly ? undefined : (event) => {
      if (interactionMode === "move") {
        onObjectPointerMove?.(event, objectId);
        return;
      }
      const drag = interactionMode === "edit" ? dragRef.current : null;
      if (!drag) return;
      const rect = event.currentTarget.getBoundingClientRect();
      onEdit?.(id, {
        focalX: drag.focalX - ((event.clientX - drag.x) / Math.max(1, rect.width)) * 100,
        focalY: drag.focalY - ((event.clientY - drag.y) / Math.max(1, rect.height)) * 100,
      });
    }}
    onPointerUp={renderOnly ? undefined : (event) => {
      if (interactionMode === "move") onObjectPointerUp?.(event, objectId);
      dragRef.current = null;
    }}
    onPointerCancel={renderOnly ? undefined : (event) => {
      if (interactionMode === "move") onObjectPointerCancel?.(event, objectId);
      dragRef.current = null;
    }}
    style={{
      ...objectStyle,
      "--image-focal-x": `${edit.focalX}%`,
      "--image-focal-y": `${edit.focalY}%`,
      "--image-zoom": edit.zoom,
      "--image-aspect": cssAspectRatio(preferredAspect || imageStyle?.preferred_aspect),
    }}
  >
    <img
      src={src}
      alt={alt || ""}
      draggable="false"
      crossOrigin={src.startsWith("data:") ? undefined : "anonymous"}
      onLoad={(event) => {
        const image = event.currentTarget;
        setOrientation(image.naturalHeight > image.naturalWidth * 1.08 ? "portrait" : image.naturalWidth > image.naturalHeight * 1.08 ? "landscape" : "square");
      }}
    />
  </figure>;
}

export function HtmlPageCanvas({ page, pageIndex, totalPages, state, selectedImage, selectedObject, interactionMode = "edit", onSelectImage, onSelectObject, onImageEdit, onObjectEdit, onPagePatch, renderOnly = false }) {
  const directMoveRef = useRef(null);
  const panels = Array.isArray(page.info_panels) ? page.info_panels : [];
  const panelMeta = editorialPanelMeta(page);
  const paragraphs = bodyParagraphs(page.body);
  const primaryImageStyle = panels[0]?.image_style || page.image_style;
  const primaryImageId = panels.length ? "panel-0" : "hero";
  const primaryPolicy = mediaPolicyFor({ ...page, ...primaryImageStyle, content_role: "hero" });
  const isPrimaryCover = state.layout_id === "cover-poster" && (pageIndex === 0 || page.page_role === "hook");
  const designProgram = normalizeDesignProgram(state.design_program, page, pageIndex);
  const patchParagraph = (index, next) => {
    const updated = [...paragraphs];
    updated[index] = next;
    onPagePatch?.({ body: updated.join("\n\n") });
  };
  const patchPanel = (index, patch) => onPagePatch?.({
    info_panels: panels.map((panel, panelIndex) => panelIndex === index ? { ...panel, ...patch } : panel),
  });
  const beginObjectMove = (event, objectId) => {
    event.stopPropagation();
    onSelectObject?.(objectId);
    if (interactionMode !== "move" || (Number.isFinite(event.button) && event.button !== 0)) return;
    const pageElement = event.currentTarget.closest(".html-page");
    const pageRect = pageElement?.getBoundingClientRect();
    if (!pageRect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    directMoveRef.current = {
      objectId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pageWidth: pageRect.width,
      pageHeight: pageRect.height,
      start: objectEditFor(state, objectId),
      next: null,
      target: event.currentTarget,
    };
  };
  const continueObjectMove = (event, objectId) => {
    const drag = directMoveRef.current;
    if (!drag || drag.objectId !== objectId || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const next = objectDragEdit(drag.start, event.clientX - drag.startX, event.clientY - drag.startY, drag.pageWidth, drag.pageHeight);
    drag.target.style.setProperty("--object-x", `${next.x}cqw`);
    drag.target.style.setProperty("--object-y", `${next.y}cqh`);
    drag.next = next;
  };
  const finishObjectMove = (event, objectId, commit = true) => {
    const drag = directMoveRef.current;
    if (!drag || drag.objectId !== objectId || drag.pointerId !== event.pointerId) return;
    drag.target.releasePointerCapture?.(event.pointerId);
    directMoveRef.current = null;
    if (commit && drag.next) onObjectEdit?.(objectId, drag.next);
  };
  const objectMoveHandlers = (objectId) => renderOnly ? {} : {
    onPointerDown: (event) => beginObjectMove(event, objectId),
    onPointerMove: (event) => continueObjectMove(event, objectId),
    onPointerUp: (event) => finishObjectMove(event, objectId),
    onPointerCancel: (event) => finishObjectMove(event, objectId, false),
    onClick: (event) => { event.stopPropagation(); onSelectObject?.(objectId); },
  };

  return <article
    className={`html-page is-density-${state.density}`}
    data-layout={state.layout_id}
    data-panel-count={panels.length}
    data-title-length={String(page.title || "").replace(/\s/g, "").length > 16 ? "long" : "normal"}
    data-page-role={page.page_role || (pageIndex === 0 ? "hook" : "example")}
    data-design-composition={designProgram.composition}
    data-design-rhythm={designProgram.rhythm}
    data-image-edge={designProgram.image_edge}
    data-focal-order={designProgram.focal_order.join("-")}
    style={{ "--page-accent": pageAccentColor(page), "--page-display-accent": pageDisplayAccentColor(page), "--page-soft": "#ffffff", ...designProgramStyle(designProgram, page, pageIndex) }}
    onPointerDown={renderOnly ? undefined : (event) => {
      if (event.target !== event.currentTarget) return;
      onSelectImage?.(null);
      onSelectObject?.(null);
    }}
  >
    <header
      className={`html-page__header html-editor-object ${selectedObject === "title-block" ? "is-object-selected" : ""}`}
      data-editor-object-id="title-block"
      style={objectTransformStyle(state, "title-block")}
      {...objectMoveHandlers("title-block")}
    >
      {renderOnly
        ? <p className="html-page__eyebrow">{page.eyebrow}</p>
        : <EditableText key={`eyebrow-${page.eyebrow}`} as="p" className="html-page__eyebrow" value={page.eyebrow} multiline={false} onSelect={() => onSelectObject?.("title-block")} onCommit={(eyebrow) => onPagePatch?.({ eyebrow })} />}
      {renderOnly
        ? <h1 className="html-page__title"><PhraseSafeTitle value={page.title} phrases={page.highlight_phrases} /></h1>
        : <EditableText key={`title-${page.title}`} as="h1" className="html-page__title" value={page.title} highlightPhrases={page.highlight_phrases} phraseSafe onSelect={() => onSelectObject?.("title-block")} onCommit={(title) => onPagePatch?.({ title })} />}
    </header>

    {state.layout_id === "cover-poster" && <div className={`html-page__cover-lede html-editor-object ${selectedObject === "cover-lede" ? "is-object-selected" : ""}`} data-editor-object-id="cover-lede" style={objectTransformStyle(state, "cover-lede")} {...objectMoveHandlers("cover-lede")}>
      {renderOnly
        ? <p>{paragraphs[0]}</p>
        : <EditableText key={`cover-lede-${paragraphs[0]}`} as="p" value={paragraphs[0]} onSelect={() => onSelectObject?.("cover-lede")} onCommit={(next) => patchParagraph(0, next)} />}
    </div>}

    {panels.length ? <section className="html-page__panels">
      {panels.map((panel, index) => <article className="html-page__panel" key={panel.id || index} data-panel-index={index} data-panel-id={panel.id || `panel-${index + 1}`} data-panel-title={panel.title} data-content-role={panelMeta[index].contentRole} data-shot-role={panelMeta[index].shotRole} data-program-focal={designProgram.hero_panel === index ? "true" : "false"}>
        <div className={`html-page__panel-copy html-editor-object ${selectedObject === `panel-${index}-copy` ? "is-object-selected" : ""}`} data-editor-object-id={`panel-${index}-copy`} style={objectTransformStyle(state, `panel-${index}-copy`)} {...objectMoveHandlers(`panel-${index}-copy`)}>
          {renderOnly
            ? <h2><HighlightedText value={panel.title} phrases={panelMeta[index].highlightPhrases} /></h2>
            : <EditableText key={`panel-title-${panel.title}`} as="h2" value={panel.title} highlightPhrases={panelMeta[index].highlightPhrases} multiline={false} onSelect={() => onSelectObject?.(`panel-${index}-copy`)} onCommit={(title) => patchPanel(index, { title })} />}
          {renderOnly
            ? <p><HighlightedText value={panel.body} phrases={panelMeta[index].highlightPhrases} /></p>
            : <EditableText key={`panel-body-${panel.body}`} as="p" value={panel.body} highlightPhrases={panelMeta[index].highlightPhrases} onSelect={() => onSelectObject?.(`panel-${index}-copy`)} onCommit={(body) => patchPanel(index, { body })} />}
        </div>
        <PageImage
          id={`panel-${index}`}
          objectId={`panel-${index}-image`}
          imageStyle={panel.image_style}
          mediaRole={panelMeta[index].mediaRole}
          fitPolicy={panelMeta[index].fitPolicy}
          preferredAspect={panelMeta[index].preferredAspect}
          state={state}
          alt={panel.title}
          selected={selectedImage === `panel-${index}`}
          objectSelected={selectedObject === `panel-${index}-image`}
          interactionMode={interactionMode}
          onSelect={onSelectImage}
          onSelectObject={onSelectObject}
          onEdit={onImageEdit}
          onObjectPointerDown={beginObjectMove}
          onObjectPointerMove={continueObjectMove}
          onObjectPointerUp={finishObjectMove}
          onObjectPointerCancel={(event, objectId) => finishObjectMove(event, objectId, false)}
          renderOnly={renderOnly}
        />
      </article>)}
    </section> : <section className="html-page__essay">
      <div className={`html-page__body html-editor-object ${selectedObject === "body-block" ? "is-object-selected" : ""}`} data-editor-object-id="body-block" style={objectTransformStyle(state, "body-block")} {...objectMoveHandlers("body-block")}>
        {paragraphs.map((paragraph, index) => renderOnly
          ? <p key={`${index}-${paragraph.slice(0, 12)}`}><HighlightedText value={paragraph} phrases={page.highlight_phrases} /></p>
          : <EditableText key={`${index}-${paragraph.slice(0, 12)}`} as="p" value={paragraph} highlightPhrases={page.highlight_phrases} onSelect={() => onSelectObject?.("body-block")} onCommit={(next) => patchParagraph(index, next)} />)}
      </div>
      <PageImage
        id={primaryImageId}
        objectId="hero-image"
        imageStyle={primaryImageStyle}
        mediaRole={primaryPolicy.mediaRole}
        fitPolicy={primaryPolicy.fitPolicy}
        preferredAspect={isPrimaryCover ? "9:8" : primaryPolicy.preferredAspect}
        state={state}
        alt={page.title}
        selected={selectedImage === primaryImageId}
        objectSelected={selectedObject === "hero-image"}
        interactionMode={interactionMode}
        onSelect={onSelectImage}
        onSelectObject={onSelectObject}
        onEdit={onImageEdit}
        onObjectPointerDown={beginObjectMove}
        onObjectPointerMove={continueObjectMove}
        onObjectPointerUp={finishObjectMove}
        onObjectPointerCancel={(event, objectId) => finishObjectMove(event, objectId, false)}
        renderOnly={renderOnly}
      />
    </section>}

  </article>;
}

export function HtmlPageEditor({ page, pageIndex, totalPages, onStateChange, onPagePatch }) {
  const state = useMemo(() => normalizeHtmlState(page.html_state, page, pageIndex), [page, pageIndex]);
  const eligibleLayouts = useMemo(() => layoutsForPage(page), [page]);
  const imageEntries = useMemo(() => imageEntriesForPage(page), [page]);
  const imageSignature = imageEntries.map(({ id, imageStyle }) => `${id}:${imageStyle?.src || ""}`).join("|");
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [interactionMode, setInteractionMode] = useState("edit");
  const [moveableTarget, setMoveableTarget] = useState(null);
  const [focusBusy, setFocusBusy] = useState(false);
  const [layoutIssue, setLayoutIssue] = useState(null);
  const stageRef = useRef(null);
  const selectedEntry = selectedImage ? imageEntries.find((item) => item.id === selectedImage) : null;
  const selectedEdit = selectedEntry
    ? imageEditFor(state, selectedImage, { ...selectedEntry.imageStyle, media_role: selectedEntry.mediaRole })
    : null;
  const selectedObjectEdit = selectedObject ? objectEditFor(state, selectedObject) : null;
  const updateSelectedImage = (patch) => {
    if (!selectedImage) return;
    onStateChange?.(updateImageEdit(state, selectedImage, patch, page, pageIndex));
  };
  const updateImage = (imageId, patch) => onStateChange?.(updateImageEdit(state, imageId, patch, page, pageIndex));
  const updateSelectedObject = (patch) => {
    if (!selectedObject) return;
    onStateChange?.(updateObjectEdit(state, selectedObject, patch, page, pageIndex));
  };
  const autoFocusImage = async (imageId) => {
    const entry = imageEntries.find((item) => item.id === imageId);
    if (!entry?.imageStyle?.src) return;
    setFocusBusy(true);
    try { updateImage(imageId, await detectSubjectFocus(entry.imageStyle.src, entry.mediaRole)); }
    finally { setFocusBusy(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const missing = imageEntries.filter(({ id, imageStyle }) => imageStyle?.src && !page.html_state?.image_edits?.[id]);
    if (!missing.length) return undefined;
    void (async () => {
      let next = state;
      for (const entry of missing) {
        const focus = await detectSubjectFocus(entry.imageStyle.src, entry.mediaRole);
        if (cancelled) return;
        next = updateImageEdit(next, entry.id, focus, page, pageIndex);
      }
      if (!cancelled) onStateChange?.(next, { record: false, source: "image-focus-initialization" });
    })();
    return () => { cancelled = true; };
  // Re-run only when the page's image sources change. Existing manual edits win.
  }, [pageIndex, imageSignature]);

  useEffect(() => {
    if (page.html_state?.design_program?.schema === state.design_program.schema) return;
    onStateChange?.(state, { record: false, source: "design-program-initialization" });
  }, [pageIndex, page.html_state?.design_program?.schema, state.design_program.schema]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const result = inspectHtmlPageLayout(stageRef.current?.querySelector(".html-page"));
      if (!result.fits && state.density !== "compact") {
        onStateChange?.({ ...state, density: "compact" }, { record: false, source: "overflow-auto-compact" });
        return;
      }
      setLayoutIssue(result.fits ? null : result.reasons.join("、"));
    });
    return () => cancelAnimationFrame(frame);
  }, [page, state.layout_id, state.density, totalPages]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMoveableTarget(selectedObject
        ? stageRef.current?.querySelector(`[data-editor-object-id="${selectedObject}"]`) || null
        : null);
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedObject, page, state.layout_id, state.density, state.object_edits]);

  return <section className={`html-editor is-${interactionMode}-mode`}>
    <div className="html-editor__toolbar" aria-label="HTML 智能排版工具">
      {selectedEdit ? <div className="html-editor__image-tools" aria-label="图片裁剪与取景">
        <Crop /><span>裁剪 / 取景</span>
        <button type="button" aria-label="智能识别主体" title="智能识别主体" disabled={focusBusy} onClick={() => autoFocusImage(selectedImage)}><ScanSearch /></button>
        <button type="button" aria-label="缩小图片" title="缩小图片" disabled={selectedEdit.zoom <= 1} onClick={() => updateSelectedImage({ zoom: selectedEdit.zoom - 0.04 })}><Minus /></button>
        <output aria-label="当前图片缩放">{Math.round(selectedEdit.zoom * 100)}%</output>
        <button type="button" aria-label="放大图片" title="放大图片" disabled={selectedEdit.zoom >= HTML_IMAGE_ZOOM_MAX} onClick={() => updateSelectedImage({ zoom: selectedEdit.zoom + 0.04 })}><Plus /></button>
        <button type="button" aria-label="重置图片取景" title="重置图片取景" onClick={() => {
          const policy = mediaPolicyFor({ ...selectedEntry?.imageStyle, media_role: selectedEntry?.mediaRole });
          updateSelectedImage({ focalX: 50, focalY: 50, zoom: policy.defaultZoom });
        }}><RotateCcw /></button>
      </div> : interactionMode === "edit" ? <span className="html-editor__crop-prompt"><Crop />点图片裁剪</span> : null}
      <select aria-label="版式" value={state.layout_id} onChange={(event) => onStateChange?.({ ...state, layout_id: event.target.value })}>
        {eligibleLayouts.map((layout) => <option value={layout.id} key={layout.id}>{layout.label}</option>)}
      </select>
      <button type="button" onClick={() => onStateChange?.({ ...state, layout_id: nextHtmlLayout(state.layout_id, page, pageIndex) })}><Shuffle />换种构图</button>
      <div className="html-editor__mode-switch" role="group" aria-label="编辑手势">
        <button type="button" className={interactionMode === "edit" ? "is-active" : ""} aria-pressed={interactionMode === "edit"} onClick={() => setInteractionMode("edit")}><Type />改字 / 取景</button>
        <button type="button" className={interactionMode === "move" ? "is-active" : ""} aria-pressed={interactionMode === "move"} onClick={() => setInteractionMode("move")}><Move />移动模块</button>
      </div>
      <span className="html-editor__hint">{interactionMode === "move" ? "点选图文后直接拖；调整会保存并参与导出" : "点文字直接改；拖图片改变取景"}</span>
      {layoutIssue && <span className="html-editor__layout-warning" title={layoutIssue}><AlertTriangle />内容过满，导出会拦截</span>}
      <span className="html-editor__spacer" />
      {selectedObjectEdit && interactionMode === "move" && <div className="html-editor__object-tools" aria-label="模块调整">
        <span>模块</span>
        <button type="button" aria-label="模块左移" onClick={() => updateSelectedObject({ x: selectedObjectEdit.x - 2 })}><ArrowLeft /></button>
        <button type="button" aria-label="模块右移" onClick={() => updateSelectedObject({ x: selectedObjectEdit.x + 2 })}><ArrowRight /></button>
        <button type="button" aria-label="模块上移" onClick={() => updateSelectedObject({ y: selectedObjectEdit.y - 2 })}><ArrowUp /></button>
        <button type="button" aria-label="模块下移" onClick={() => updateSelectedObject({ y: selectedObjectEdit.y + 2 })}><ArrowDown /></button>
        <button type="button" aria-label="缩小模块" onClick={() => updateSelectedObject({ scale: selectedObjectEdit.scale - .04 })}><Minus /></button>
        <button type="button" aria-label="放大模块" onClick={() => updateSelectedObject({ scale: selectedObjectEdit.scale + .04 })}><Plus /></button>
        <button type="button" aria-label="重置模块位置" onClick={() => updateSelectedObject({ x: 0, y: 0, scale: 1 })}><RotateCcw /></button>
      </div>}
    </div>
    <div className="html-editor__stage" ref={stageRef}>
      <HtmlPageCanvas
        page={page}
        pageIndex={pageIndex}
        totalPages={totalPages}
        state={state}
        selectedImage={selectedImage}
        selectedObject={selectedObject}
        interactionMode={interactionMode}
        onSelectImage={setSelectedImage}
        onSelectObject={setSelectedObject}
        onImageEdit={updateImage}
        onObjectEdit={(objectId, patch) => onStateChange?.(updateObjectEdit(state, objectId, patch, page, pageIndex))}
        onPagePatch={onPagePatch}
      />
      {interactionMode === "move" && moveableTarget && <React.Suspense fallback={null}><Moveable
        target={moveableTarget}
        container={stageRef.current}
        origin={false}
        throttleDrag={0}
        className="xiaoshimei-moveable"
      /></React.Suspense>}
    </div>
  </section>;
}

async function waitForImages(host) {
  const images = [...host.querySelectorAll("img")];
  await Promise.all(images.map((img) => img.complete
    ? Promise.resolve()
    : new Promise((resolve, reject) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", () => reject(new Error(`HTML_EXPORT_IMAGE_LOAD_FAILED:${img.alt || "unknown"}`)), { once: true });
    })));
  images.forEach((img) => {
    if (!img.naturalWidth || !img.naturalHeight) throw new Error(`HTML_EXPORT_IMAGE_LOAD_FAILED:${img.alt || "unknown"}`);
  });
  return images;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result), { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("HTML_EXPORT_IMAGE_INLINE_FAILED")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesForExport(host) {
  const images = await waitForImages(host);
  await Promise.all(images.map(async (img) => {
    const source = img.currentSrc || img.src;
    if (!source || source.startsWith("data:")) return;
    const response = await fetch(source, { cache: "force-cache" });
    if (!response.ok) throw new Error(`HTML_EXPORT_IMAGE_FETCH_FAILED:${response.status}`);
    img.removeAttribute("crossorigin");
    img.removeAttribute("srcset");
    img.src = await blobToDataUrl(await response.blob());
    if (typeof img.decode === "function") await img.decode();
  }));
  return waitForImages(host);
}

function renderedImageRegions(host, canvas) {
  const pageRect = host.firstElementChild.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, pageRect.width);
  const scaleY = canvas.height / Math.max(1, pageRect.height);
  return [...host.querySelectorAll("figure.html-page__image")].map((figure) => {
    const rect = figure.getBoundingClientRect();
    const insetX = rect.width * .03;
    const insetY = rect.height * .03;
    return {
      id: figure.dataset.imageId || "unknown",
      x: (rect.left - pageRect.left + insetX) * scaleX,
      y: (rect.top - pageRect.top + insetY) * scaleY,
      width: Math.max(1, (rect.width - insetX * 2) * scaleX),
      height: Math.max(1, (rect.height - insetY * 2) * scaleY),
    };
  });
}

export async function renderHtmlPageToPng(page, pageIndex, totalPages) {
  const host = document.createElement("div");
  host.className = "xsm-html-export-host";
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${PAGE_WIDTH}px`,
    height: `${PAGE_HEIGHT}px`,
    pointerEvents: "none",
    zIndex: "-2147483647",
  });
  document.body.appendChild(host);
  const root = createRoot(host);
  const state = normalizeHtmlState(page.html_state, page, pageIndex);
  try {
    root.render(<HtmlPageCanvas page={page} pageIndex={pageIndex} totalPages={totalPages} state={state} renderOnly />);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await document.fonts?.ready;
    await inlineImagesForExport(host);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const layout = inspectHtmlPageLayout(host.firstElementChild);
    if (!layout.fits) throw new Error(`HTML_LAYOUT_OVERFLOW:page-${pageIndex + 1}:${layout.reasons.join("|")}`);
    const canvas = await html2canvas(host.firstElementChild, {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      scale: 1,
      useCORS: true,
      foreignObjectRendering: true,
      backgroundColor: page.background_style?.color || "#ffffff",
      logging: false,
    });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    assertRenderedPageContent(imageData, "HTML");
    try {
      assertRenderedImageRegions(imageData, renderedImageRegions(host, canvas));
    } catch (error) {
      if (String(error?.message || error).startsWith("HTML_EXPORT_IMAGE_MISSING:")) {
        throw new Error(`HTML_EXPORT_IMAGE_MISSING:page-${pageIndex + 1}:${String(error.message).slice("HTML_EXPORT_IMAGE_MISSING:".length)}`);
      }
      throw error;
    }
    return canvas.toDataURL("image/png");
  } finally {
    root.unmount();
    host.remove();
  }
}
