import { useEffect, useState } from "react";

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.code = data.code;
    throw error;
  }
  return data;
}

export function DirectCreatePanel() {
  const [status, setStatus] = useState(null);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [probe, setProbe] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [config, setConfig] = useState({ textModel: "gpt-5.4-mini", imageModel: "gpt-image-2", imageQuality: "low" });

  async function refreshStatus() {
    const next = await request("/api/direct-ai/status");
    setStatus(next);
    setConfig({ textModel: next.textModel, imageModel: next.imageModel, imageQuality: next.imageQuality });
    return next;
  }

  useEffect(() => {
    refreshStatus().catch((error) => setMessage(error.message));
    request("/api/direct-ai/latest").then((data) => { if (data?.result) setResult(data.result); }).catch(() => {});
  }, []);

  async function saveSettings() {
    setBusy("settings"); setMessage("");
    try {
      if (apiKey.trim()) await request("/api/direct-ai/key", { method: "PUT", body: JSON.stringify({ apiKey: apiKey.trim() }) });
      await request("/api/direct-ai/config", { method: "PUT", body: JSON.stringify(config) });
      setApiKey("");
      await refreshStatus();
      setSettingsOpen(false);
      setMessage("AI 已接好。API Key 保存在 macOS Keychain，不写进浏览器。 ");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  }

  async function testImage() {
    setBusy("probe"); setMessage(""); setProbe(null);
    try {
      const next = await request("/api/direct-ai/test-image", { method: "POST", body: JSON.stringify({ prompt: topic.trim() }) });
      setProbe(next);
      setMessage("主题图测试成功。这里只测试图片是否能按上方主题生成，不生成文章；要看文章请点“直接生成”。");
    } catch (error) {
      if (error.code === "AI_KEY_MISSING") setSettingsOpen(true);
      setMessage(error.message);
    } finally { setBusy(""); }
  }

  async function quickCreate() {
    if (topic.trim().length < 8) { setMessage("先写至少 8 个字的选题或原始素材。 "); return; }
    setBusy("create"); setMessage(""); setResult(null);
    try {
      const next = await request("/api/direct-ai/quick-create", { method: "POST", body: JSON.stringify({ topic, imageCount: count }) });
      setResult(next);
      setMessage(`文章与 ${next.assets.length} 张 1080×1440 小红书卡片都已生成，正文就在下方“发布文章”区。`);
    } catch (error) {
      if (error.code === "AI_KEY_MISSING") setSettingsOpen(true);
      setMessage(error.message);
    } finally { setBusy(""); }
  }

  async function copyArticle() {
    if (!result?.plan) return;
    const text = `${result.plan.title}\n\n${result.plan.body}\n\n${(result.plan.tags || []).map((tag) => `#${tag}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("发布文章已复制。 ");
    } catch {
      setMessage("复制失败，请手动选择正文复制。 ");
    }
  }

  return <section className="direct-create-shell" aria-label="小师妹直接创作">
    <div className="direct-create-head">
      <div><span>QUICK CREATE</span><h1>输入素材，直接生成小红书图文</h1><p>直连火山方舟，不经过 Codex。先生成文案与逐页画面，再用原生文字层合成 1080×1440 卡片。</p></div>
      <div className="direct-ai-state"><i className={status?.configured ? "is-live" : ""} /><strong>{status?.configured ? "方舟已连接" : "方舟未连接"}</strong><button type="button" onClick={() => setSettingsOpen(true)}>方舟状态</button></div>
    </div>

    <div className="direct-create-controls">
      <label className="direct-topic"><span>原文 / 选题 / 想法</span><textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例如：为什么真正会休息的人，工作反而更快？写成一篇有方法、有画面的小红书图文。" /></label>
      <div className="direct-side-controls">
        <label><span>配图数量</span><select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[1,2,3,4,5,6].map((value) => <option value={value} key={value}>{value} 张</option>)}</select></label>
        <button type="button" className="direct-probe-button" onClick={testImage} disabled={Boolean(busy)}>{busy === "probe" ? "正在生成主题图…" : "测试 1 张主题图"}</button>
        <button type="button" className="direct-create-button" onClick={quickCreate} disabled={Boolean(busy)}>{busy === "create" ? `正在生成文章 + ${count} 张图…` : `生成文章 + ${count} 张图`}</button>
        <small className="direct-action-note">“测试主题图”只生成一张与选题相关的图片；“生成文章 + 配图”才会生成完整正文、标签和卡片。</small>
      </div>
    </div>

    {message && <div className="direct-message" role="status">{message}</div>}
    {probe && <div className="direct-probe-result"><div><strong>主题图测试</strong><span>只验证火山生图与选题相关性，不包含文章 · {probe.id}</span></div><img src={probe.url} alt="火山方舟主题图测试结果" /></div>}

    {result && <div className="direct-result">
      <div className="direct-result-copy"><div className="direct-result-copy-head"><span>发布文章</span><button type="button" onClick={copyArticle}>复制全文</button></div><h2>{result.plan.title}</h2><p>{result.plan.body}</p><div>{result.plan.tags.map((tag) => <em key={tag}>#{tag}</em>)}</div></div>
      <div className="direct-result-grid">{result.assets.map((asset, index) => <figure key={asset.id}><a href={asset.url} target="_blank" rel="noreferrer"><img src={asset.url} alt={`第 ${index + 1} 张生成卡片`} /></a><figcaption><strong>{String(index + 1).padStart(2, "0")}</strong><span>{result.plan.cards[index].headline}</span></figcaption></figure>)}</div>
    </div>}

    {settingsOpen && <div className="direct-settings-backdrop" onMouseDown={() => !busy && setSettingsOpen(false)}>
      <div className="direct-settings" role="dialog" aria-modal="true" aria-label="火山方舟状态" onMouseDown={(event) => event.stopPropagation()}>
        <div><span>ARK STATUS</span><h2>火山方舟</h2><p>小师妹已切回国内火山方舟链路，不依赖 OpenAI，也不需要 VPN。</p></div>
        <div className="direct-message">连接状态：{status?.configured ? "已连接" : "未连接"}</div>
        <div className="direct-message">文字模型：{status?.textModel || "未读取"}</div>
        <div className="direct-message">图片模型：{status?.imageModel || "未读取"}</div>
        <div className="direct-settings-actions"><button type="button" className="direct-create-button" onClick={() => setSettingsOpen(false)}>关闭</button></div>
      </div>
    </div>}
  </section>;
}
