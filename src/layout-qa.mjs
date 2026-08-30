function finiteRect(rect, path) {
  const value = {
    left: Number(rect?.left), top: Number(rect?.top),
    right: Number(rect?.right), bottom: Number(rect?.bottom),
  };
  if (!Object.values(value).every(Number.isFinite) || value.right <= value.left || value.bottom <= value.top) {
    throw new TypeError(`${path} must be a finite rectangle`);
  }
  return value;
}

export function rectsIntersect(left, right, tolerance = 0.5) {
  const a = finiteRect(left, "left rect");
  const b = finiteRect(right, "right rect");
  return a.left < b.right - tolerance
    && a.right > b.left + tolerance
    && a.top < b.bottom - tolerance
    && a.bottom > b.top + tolerance;
}

export function rectContainedBy(inner, outer, tolerance = 0.5) {
  const child = finiteRect(inner, "inner rect");
  const container = finiteRect(outer, "outer rect");
  return child.left >= container.left - tolerance
    && child.top >= container.top - tolerance
    && child.right <= container.right + tolerance
    && child.bottom <= container.bottom + tolerance;
}

export function figureIsFullBleed(slide, figure, tolerance = 2) {
  if (!slide || !figure) return false;
  const canvas = finiteRect(slide, "slide");
  const image = finiteRect(figure, "figure");
  return image.left <= canvas.left + tolerance
    && image.top <= canvas.top + tolerance
    && image.right >= canvas.right - tolerance
    && image.bottom >= canvas.bottom - tolerance;
}

export function inspectLayoutRects({ slide, figure = null, objects = [] }, pageIndex = 0) {
  const canvas = finiteRect(slide, "slide");
  const image = figure ? finiteRect(figure, "figure") : null;
  const checked = objects.map((object, index) => ({
    kind: String(object?.kind || `object-${index}`),
    rect: finiteRect(object?.rect, `objects[${index}].rect`),
  }));
  const issues = [];
  for (const object of checked) {
    if (object.rect.left < canvas.left - 0.5 || object.rect.top < canvas.top - 0.5 || object.rect.right > canvas.right + 0.5 || object.rect.bottom > canvas.bottom + 0.5) {
      issues.push({ page: pageIndex + 1, kind: object.kind, code: "TEXT_OVERFLOW" });
    }
    if (image && rectsIntersect(object.rect, image)) issues.push({ page: pageIndex + 1, kind: object.kind, code: "TEXT_IMAGE_OVERLAP" });
  }
  for (let left = 0; left < checked.length; left += 1) {
    for (let right = left + 1; right < checked.length; right += 1) {
      if (rectsIntersect(checked[left].rect, checked[right].rect, 1.5)) {
        issues.push({ page: pageIndex + 1, kind: `${checked[left].kind}+${checked[right].kind}`, code: "TEXT_TEXT_OVERLAP" });
      }
    }
  }
  return issues;
}

export function inspectRenderedSlides(slides, expectedCount) {
  if (!Array.isArray(slides) || slides.length !== expectedCount) throw new TypeError("all visible slides are required for layout QA");
  return slides.flatMap((slide, pageIndex) => {
    if (!slide || typeof slide.querySelectorAll !== "function") return [{ page: pageIndex + 1, kind: "slide", code: "SLIDE_NOT_RENDERED" }];
    const kind = (node) => [...node.classList].find((name) => name.startsWith("canvas-object--"))?.replace("canvas-object--", "") || "text";
    const imageNode = slide.querySelector(".slide__figure img");
    const figureNode = slide.querySelector(".slide__figure");
    const figureRect = figureNode?.getBoundingClientRect() || null;
    const fullBleedImage = figureRect ? figureIsFullBleed(slide.getBoundingClientRect(), figureRect) : false;
    const imageIssues = imageNode && (!imageNode.complete || !imageNode.naturalWidth)
      ? [{ page: pageIndex + 1, kind: "image", code: "IMAGE_NOT_READY" }]
      : [];
    return [...imageIssues, ...inspectLayoutRects({
      slide: slide.getBoundingClientRect(),
      figure: fullBleedImage ? null : figureRect,
      objects: [...slide.querySelectorAll(".canvas-object")].map((node) => {
        const textNode = node.querySelector?.(":scope > span");
        const textRect = textNode?.getBoundingClientRect?.();
        const hasRenderedText = textRect && Number(textRect.width) > 0 && Number(textRect.height) > 0;
        return { kind: kind(node), rect: hasRenderedText ? textRect : node.getBoundingClientRect() };
      }),
    }, pageIndex)];
  });
}

export function fitGeneratedPage(page, pageIndex = 0) {
  if (!page || typeof page !== "object") throw new TypeError("page is required");
  const result = structuredClone(page);
  const hasRightFigure = result.visual === "character" && !new Set(["split-reverse", "scene"]).has(result.layout);
  const bodyLength = String(result.body || "").replace(/\s/g, "").length;
  const titleLength = String(result.title || "").replace(/\s/g, "").length;
  const hasInfoPanels = Array.isArray(result.info_panels) && result.info_panels.length > 0;
  result.object_styles = structuredClone(result.object_styles || {});
  result.object_styles.title = {
    ...result.object_styles.title,
    width: Math.min(Number(result.object_styles.title?.width || 76), 84),
    fontSize: titleLength > 22 ? 60 : titleLength > 16 ? 66 : 72,
    lineHeight: 1.08,
  };
  if (result.layout === "scene") {
    result.object_styles.eyebrow = { ...result.object_styles.eyebrow, x: 7, y: 6, color: "#214336" };
    result.object_styles.title = { ...result.object_styles.title, x: 7, y: 12, width: pageIndex === 0 ? 84 : 68, color: "#15251f" };
  }
  if (hasInfoPanels) {
    result.object_styles.eyebrow = { ...result.object_styles.eyebrow, x: 7, y: 4.5, width: 48, fontSize: 24, color: "#78533c" };
    result.object_styles.title = {
      ...result.object_styles.title,
      x: 7,
      y: 8.5,
      width: 86,
      fontSize: titleLength > 18 ? 54 : 60,
      lineHeight: 1.08,
    };
    result.object_styles.brand = { ...result.object_styles.brand, x: 7, y: 94, width: 42 };
    result.object_styles.page_number = { ...result.object_styles.page_number, x: 82, y: 94, width: 11, align: "right" };
  }
  result.object_styles.body = {
    ...result.object_styles.body,
    x: 8,
    // Keep the cover action zone (usually hands + prop around the table line)
    // visible. The previous 68% placement hid the very action the cover was
    // supposed to prove after text was composited over the generated image.
    y: result.layout === "scene" ? (pageIndex === 0 ? 76 : 36) : 34,
    width: result.layout === "scene" ? (pageIndex === 0 ? 76 : 52) : hasRightFigure ? 52 : Math.min(Number(result.object_styles.body?.width || 76), 82),
    // Xiaohongshu is read on a phone. A 28px body looked acceptable on the
    // desktop canvas but collapsed into grey dust at 168x224 thumbnail size.
    // Keep instructional pages at 42-46px and let short lines create rhythm.
    fontSize: pageIndex > 0 ? (bodyLength > 120 ? 40 : bodyLength > 72 ? 42 : 46) : (bodyLength > 72 ? 34 : 36),
    lineHeight: pageIndex > 0 ? 1.5 : 1.45,
  };
  if (hasRightFigure) {
    result.object_styles.page_number = {
      ...result.object_styles.page_number,
      x: 79,
      width: 11,
      align: "right",
    };
  }
  return result;
}
