import { execFileSync, spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = process.env.XIAOSHIMEI_RUNTIME_DIR
  ? path.resolve(process.env.XIAOSHIMEI_RUNTIME_DIR)
  : path.join(homedir(), ".mesy", "runtime", "packages", "xiaoshimei-studio-v2");
const account = process.env.USER || process.env.LOGNAME;
if (!account) {
  console.error("[xiaoshimei-v2] KEYCHAIN_ACCOUNT_MISSING");
  process.exit(78);
}

let apiKey;
try {
  apiKey = execFileSync(
    "/usr/bin/security",
    ["find-generic-password", "-a", account, "-s", "com.mesy.xiaoshimei-studio.volcengine-ark", "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
} catch {
  console.error("[xiaoshimei-v2] ARK_API_KEY_NOT_FOUND");
  process.exit(78);
}

const environment = {
  ...process.env,
  ARK_API_KEY: apiKey,
  ARK_TEXT_MODEL: process.env.ARK_TEXT_MODEL || "doubao-seed-2-0-lite-260428",
  ARK_IMAGE_MODEL: process.env.ARK_IMAGE_MODEL || "doubao-seedream-5-0-lite-260128",
  PORT: process.env.PORT || "4184",
  HOST: process.env.HOST || "127.0.0.1",
  ARK_PROVIDER_PORT: process.env.ARK_PROVIDER_PORT || "4175",
  XIAOSHIMEI_WEB_ORIGIN: process.env.XIAOSHIMEI_WEB_ORIGIN || "http://127.0.0.1:4184",
  ARK_IMAGE_PRICE_CNY: process.env.ARK_IMAGE_PRICE_CNY || "0.22",
  AGENT_XHS_RUNTIME_DIR: runtimeRoot,
  XIAOSHIMEI_RUNTIME_DIR: runtimeRoot,
};

const node = process.execPath;
const children = [
  spawn(node, [path.join(root, "scripts", "ark-provider-server.mjs")], { cwd: root, env: environment, stdio: "inherit" }),
  spawn(node, [path.join(root, "server", "index.mjs"), "--production"], { cwd: root, env: environment, stdio: "inherit" }),
];
let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`[xiaoshimei-v2] child exited code=${code} signal=${signal || "none"}`);
      stop();
    }
    if (children.every((entry) => entry.exitCode !== null || entry.signalCode !== null)) {
      process.exit(code === 0 && stopping ? 0 : code || 1);
    }
  });
}
