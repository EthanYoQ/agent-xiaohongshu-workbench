import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createContentAccount } from "../server/account-workspace.mjs";
import { archiveContentOutput, updateArchivedOutputStatus } from "../server/output-archive.mjs";

test("content output is versioned by account and includes markdown plus copied images", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-output-archive-"));
  const sourceImage = path.join(root, "source-card.png");
  await fs.writeFile(sourceImage, Buffer.from("test-image"));
  const account = createContentAccount({ name: "AI 职场观察", positioning: "高频使用 AI 的职场人" });
  const workspace = account.workspace;
  workspace.research.topics = [{ id: "topic-1", title: "AI 协作复盘", angle: "真实工作流", reason: "故事线承接" }];
  workspace.selectedTopicId = "topic-1";
  workspace.breakdown = { visualDirections: [{ id: "direction-1", name: "暖纸工作流" }] };
  workspace.selectedVisualDirectionId = "direction-1";
  workspace.draft = {
    mode: "humanized",
    title: "AI 协作复盘",
    body: "这是一段可发布的正文。",
    tags: ["AI", "职场"],
    imageCards: [{ kicker: "01", headline: "开始协作", body: "先把问题讲清楚。" }],
  };
  workspace.assets = [{ absolutePath: sourceImage }];

  const entry = await archiveContentOutput({ root, account, workspace, jobId: "job-output-1" });
  const destination = path.join(root, ...entry.relativePath.split("/"));

  assert.equal(entry.status, "content_ready");
  assert.equal(account.output.latest.id, entry.id);
  assert.match(entry.relativePath, /^output\/AI-职场观察\//);
  assert.match(await fs.readFile(path.join(destination, "note.md"), "utf8"), /AI 协作复盘/);
  await fs.access(path.join(destination, "01.png"));
  await fs.access(path.join(destination, "manifest.json"));

  updateArchivedOutputStatus(account, entry.id, "manual_published");
  assert.equal(account.output.latest.status, "manual_published");
});
