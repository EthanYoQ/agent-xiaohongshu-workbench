import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("v2 production server owns and serves the configured canonical build", async (t) => {
  const dist = await mkdtemp(join(tmpdir(), "xiaoshimei-runtime-"));
  await writeFile(join(dist, "index.html"), "v2-canonical-runtime", "utf8");
  const port = 4300 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, ["server/index.mjs", "--production"], {
    env: {
      ...process.env,
      AGENT_XHS_RUNTIME_DIR: dist,
      XIAOSHIMEI_CANONICAL_DIST: dist,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    child.kill("SIGTERM");
    await rm(dist, { recursive: true, force: true });
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("server readiness timeout")), 3_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("AGENT_XHS_READY")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "v2-canonical-runtime");
});
