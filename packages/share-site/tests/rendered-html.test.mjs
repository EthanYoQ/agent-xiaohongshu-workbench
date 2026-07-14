import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://agent-xiaohongshu-workbench.example/", { headers: { accept: "text/html", host: "agent-xiaohongshu-workbench.example", "x-forwarded-proto": "https" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the shareable Agent workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Agent 小红书工作台 · 单账号图文工作流<\/title>/i);
  assert.match(html, /可分享的协作预览/);
  assert.match(html, /账号故事线/);
  assert.match(html, /原始文稿与去 AI 味版本都可编辑/);
  assert.match(html, /立即发布/);
  assert.match(html, /暂存离开/);
  assert.match(html, /https:\/\/agent-xiaohongshu-workbench\.example\/project-logo\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("ships the public project logo without a user brand asset", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/project-logo.png", import.meta.url)),
  ]);
  assert.match(page, /热点抓取、生图与发布不会在公开站点伪执行/);
  assert.match(page, /agent-xiaohongshu-workbench-share/);
  assert.match(layout, /summary_large_image/);
});
