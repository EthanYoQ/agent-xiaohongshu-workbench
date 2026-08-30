import { recommendHtmlLayout } from "./html-layout.mjs";

function compact(value) { return String(value || "").replace(/\s/g, "").length; }

/**
 * A deterministic pre-publish scorecard. It checks information architecture,
 * not taste: the browser geometry and pixel gates remain separate authorities.
 */
export function inspectXhsPublishQuality(pages, { pillar = "", publishBody = "" } = {}) {
  if (!Array.isArray(pages) || !pages.length) return [{ code: "XHS_PAGES_MISSING", page: 0 }];
  const issues = [];
  const layouts = pages.map((page, index) => recommendHtmlLayout(page, index));
  pages.forEach((page, index) => {
    const role = String(page?.page_role || (index === 0 ? "hook" : "example"));
    const panels = Array.isArray(page?.info_panels) ? page.info_panels : [];
    if (index === 0) {
      if (role !== "hook") issues.push({ code: "XHS_COVER_ROLE_REQUIRED", page: 1 });
      if (compact(page?.eyebrow) > 10) issues.push({ code: "XHS_COVER_EYEBROW_TOO_LONG", page: 1 });
      if (compact(page?.title) < 6 || compact(page?.title) > 16) issues.push({ code: "XHS_COVER_TITLE_BUDGET", page: 1 });
      if (layouts[index] !== "cover-poster") issues.push({ code: "XHS_COVER_POSTER_REQUIRED", page: 1 });
      if (panels.length) issues.push({ code: "XHS_COVER_SINGLE_VISUAL_REQUIRED", page: 1 });
      return;
    }
    if (compact(page?.eyebrow) > 18 || compact(page?.title) > 24) issues.push({ code: "XHS_INNER_TITLE_BUDGET", page: index + 1 });
    if (["method", "checklist", "pitfall"].includes(role) && (panels.length < 2 || panels.length > 4)) {
      issues.push({ code: "XHS_METHOD_UNITS_REQUIRED", page: index + 1 });
    }
    if (panels.length >= 2 && panels.filter((panel) => panel?.content_role === "hero").length !== 1) {
      issues.push({ code: "XHS_SINGLE_HERO_REQUIRED", page: index + 1 });
    }
    if (panels.some((panel) => compact(panel?.title) < 2 || compact(panel?.title) > 28 || compact(panel?.body) < 12 || compact(panel?.body) > 120)) {
      issues.push({ code: "XHS_PANEL_COPY_BUDGET", page: index + 1 });
    }
  });
  for (let index = 2; index < layouts.length; index += 1) {
    if (layouts[index] === layouts[index - 1] && layouts[index] === layouts[index - 2] && layouts[index] !== "visual-story") {
      issues.push({ code: "XHS_THREE_PAGE_LAYOUT_MONOTONY", page: index + 1 });
    }
  }
  if (String(pillar) === "wellness") {
    const allCopy = `${publishBody}\n${pages.map((page) => [page?.title, page?.body, ...(page?.info_panels || []).flatMap((panel) => [panel?.title, panel?.body])].join("\n")).join("\n")}`;
    if (!/不适|疼痛|异常|停止|停下|就医|医生|专业帮助|专业人士|咨询|不能替代|不代替|仅作日常/.test(allCopy)) {
      issues.push({ code: "XHS_WELLNESS_SAFETY_BOUNDARY_MISSING", page: pages.length });
    }
  }
  return issues;
}

export function assertXhsPublishQuality(pages, context = {}) {
  const issues = inspectXhsPublishQuality(pages, context);
  if (issues.length) throw new TypeError(`XHS_PUBLISH_GATE_FAILED:${issues.map((issue) => `${issue.page}:${issue.code}`).join(",")}`);
  return pages;
}
