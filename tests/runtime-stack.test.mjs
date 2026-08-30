import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const packageUrl = new URL("../package.json", import.meta.url);
const stackUrl = new URL("../server/run-stack.mjs", import.meta.url);

test("the default production command starts both web and generation services", async () => {
  const pkg = JSON.parse(await readFile(packageUrl, "utf8"));
  const stack = await readFile(stackUrl, "utf8");

  assert.equal(pkg.scripts.start, "node server/run-stack.mjs");
  assert.match(pkg.scripts["start:web"], /PORT=4184/);
  assert.match(stack, /PORT: process\.env\.PORT \|\| "4184"/);
  assert.match(stack, /ARK_PROVIDER_PORT: process\.env\.ARK_PROVIDER_PORT \|\| "4175"/);
  assert.match(stack, /scripts", "ark-provider-server\.mjs"/);
  assert.match(stack, /server", "index\.mjs"/);
});
