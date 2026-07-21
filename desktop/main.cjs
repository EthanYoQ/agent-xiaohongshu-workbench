const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let serverProcess = null;
let mainWindow = null;

function appRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "app") : path.resolve(__dirname, "..");
}

function startWorkbench() {
  const root = appRoot();
  const runtimeRoot = process.env.AGENT_XHS_DESKTOP_RUNTIME_DIR || app.getPath("userData");
  fs.mkdirSync(runtimeRoot, { recursive: true });
  serverProcess = spawn(process.execPath, [path.join(root, "server", "index.mjs"), "--production"], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      AGENT_XHS_RUNTIME_DIR: runtimeRoot,
      PORT: "0",
      HOST: "127.0.0.1",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`本地服务未能在 20 秒内启动。${output.slice(-1000)}`)), 20_000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/AGENT_XHS_READY\s+(http:\/\/127\.0\.0\.1:\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(match[1]);
    };
    serverProcess.stdout.on("data", onData);
    serverProcess.stderr.on("data", onData);
    serverProcess.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    serverProcess.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`本地服务启动后退出（代码 ${code}）。${output.slice(-1000)}`));
    });
  });
}

async function runSmokeTest() {
  try {
    const url = await startWorkbench();
    const response = await fetch(`${url}/api/workspace`);
    if (!response.ok) throw new Error(`工作区接口返回 HTTP ${response.status}`);
    await response.json();
    process.stdout.write(`AGENT_XHS_DESKTOP_SMOKE_OK ${url}\n`);
    app.quit();
  } catch (error) {
    process.stderr.write(`AGENT_XHS_DESKTOP_SMOKE_FAILED ${error.message}\n`);
    app.exit(1);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 980,
    minWidth: 1120,
    minHeight: 760,
    autoHideMenuBar: true,
    show: false,
    title: "Agent 小红书工作台",
  });
  try {
    await mainWindow.loadURL(await startWorkbench());
    mainWindow.show();
  } catch (error) {
    dialog.showErrorBox("工作台启动失败", `${error.message}\n\n请检查 Codex CLI、项目依赖和本地安全软件后重试。`);
    app.quit();
  }
}

app.whenReady().then(() => (process.argv.includes("--smoke-test") ? runSmokeTest() : createWindow()));
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
