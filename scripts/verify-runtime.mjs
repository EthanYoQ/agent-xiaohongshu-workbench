import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
const minimumNode = major > 22 || (major === 22 && minor >= 13);

function run(command, args, env = process.env) {
  const isWindowsCommandShim = process.platform === "win32" && (command === "codex" || /\.(cmd|bat)$/i.test(command));
  const executable = isWindowsCommandShim ? (process.env.ComSpec || "cmd.exe") : command;
  const executableArgs = isWindowsCommandShim ? ["/d", "/s", "/c", command, ...args] : args;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, executableArgs, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} ${args.join(" ")} exited with ${code}: ${output.trim()}`)));
  });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

const failures = [];
if (!minimumNode) failures.push(`需要 Node.js >= 22.13，当前为 ${process.versions.node}`);

const localBin = path.join(root, "node_modules", ".bin");
const opencliEntry = path.join(root, "node_modules", "@jackwener", "opencli", "dist", "src", "main.js");
if (!(await exists(opencliEntry))) {
  failures.push("未找到项目内 OpenCLI。请先运行 npm install。");
}

const runtimePath = [localBin, process.env.PATH].filter(Boolean).join(path.delimiter);
const codexOverride = process.env.CODEX_JS_PATH;
const codexCommand = codexOverride ? process.execPath : "codex";
const codexArgs = codexOverride ? [codexOverride, "--version"] : ["--version"];

if (failures.length === 0) {
  try {
    const [opencliVersion, codexVersion] = await Promise.all([
      run(process.execPath, [opencliEntry, "--version"], { ...process.env, PATH: runtimePath }),
      run(codexCommand, codexArgs, { ...process.env, PATH: runtimePath }),
    ]);
    process.stdout.write(`OpenCLI: ${opencliVersion}\n`);
    process.stdout.write(`Codex CLI: ${codexVersion}\n`);
  } catch (error) {
    failures.push(`运行时验证失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.stderr.write("完成 npm install，并确认 Codex CLI 已安装、可在 PATH 中执行且已登录后重试。\n");
  process.exitCode = 1;
} else {
  process.stdout.write("运行时检查通过。Chrome Browser Bridge 和小红书登录态将在首次浏览器任务前由当前用户配置。\n");
}
