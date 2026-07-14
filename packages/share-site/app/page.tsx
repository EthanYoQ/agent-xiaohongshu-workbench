"use client";

import { useEffect, useMemo, useState } from "react";

type Topic = { id: string; title: string; angle: string; reason: string };
type CardCopy = { kicker: string; headline: string; body: string; action: string };
type Draft = { title: string; body: string; tags: string[]; cards: CardCopy[] };
type StudioState = { positioning: string; selectedTopicId: string; topics: Topic[]; raw: Draft; humanized: Draft };

const signals = [
  { heat: 92, title: "高收藏图文的开场如何更快进入问题", meta: "演示信号 · 图文", evidence: "示例仅用于展示媒体校验、热点拆解和选题推荐的工作流，不代表实时平台数据。" },
  { heat: 84, title: "一篇信息卡怎样形成清晰的阅读节奏", meta: "演示信号 · 图文", evidence: "将标题承诺、分步信息和收尾行动拆开观察，再转换为账号自己的原创表达。" },
  { heat: 78, title: "系列化配图怎样保持同一账号识别", meta: "演示信号 · 图文", evidence: "品牌角色、主题配色和右下角安全区由每位账号主人自行建立并锁定。" },
];

const initialState: StudioState = {
  positioning: "面向希望稳定输出图文内容的创作者：用可核验热点、原创表达和统一视觉完成单账号发布。",
  selectedTopicId: "topic-3",
  topics: [
    { id: "topic-1", title: "一个热点，怎样变成符合账号调性的图文选题", angle: "从热点事实、受众痛点和账号边界中找到自己的切口。", reason: "适合展示从实时信号到原创选题的完整转换。" },
    { id: "topic-2", title: "仿写前，先把热门笔记拆成这四层", angle: "区分标题承诺、信息路线、情绪机制和不可复制条件。", reason: "强调拆解是为了原创，不是复制别人的表达。" },
    { id: "topic-3", title: "图文账号怎样让每一张配图看起来像同一个系列", angle: "用品牌角色、基础配色和动态视觉方向建立连续识别。", reason: "适合展示工作台的角色动作与品牌视觉工作流。" },
    { id: "topic-4", title: "初稿写完后，怎样去掉明显的 AI 腔", angle: "从具体场景、自然停顿和真实判断入手做中度润色。", reason: "对应原始文稿与去 AI 味版本的可编辑对照。" },
    { id: "topic-5", title: "发布前的五分钟：图文预览清单", angle: "依次核对标题、正文、卡片、角色动作和发布模式。", reason: "把预览确认做成发布前的最后一道安全门。" },
  ],
  raw: {
    title: "图文账号怎样让每一张配图看起来像同一个系列",
    body: "做图文账号时，最容易忽略的不是某一张图好不好看，而是连续翻几篇以后，读者能不能一眼认出这是同一个账号。\n\n我会先固定不轻易变的部分：人物形象、基础配色、字的气质和角色出现的位置。再让每个选题决定这次该用什么动作、强调什么颜色、怎么安排信息。\n\n这样做不是把所有内容做成同一种模板。账号要有识别，选题也要有新鲜感。稳定的是底层规则，变化的是每一篇要解决的问题。\n\n发布前再完整看一遍：这张图能不能独立读懂？角色动作是否和配文有关？读者看到的文字里有没有混进制作说明？",
    tags: ["小红书图文", "内容创作", "账号运营", "视觉表达", "AI工作流"],
    cards: [
      { kicker: "先看连续三篇", headline: "能认出是同一个账号吗", body: "先固定不轻易变化的识别线索。", action: "翻看三张内容卡" },
      { kicker: "第一层", headline: "锁定品牌角色", body: "人物形象和主要穿着保持稳定。", action: "拿着头像卡" },
      { kicker: "第二层", headline: "保留基础配色", body: "让每篇有变化，也有共同的底色。", action: "对比色卡" },
      { kicker: "第三层", headline: "让动作服务内容", body: "右下角角色不是装饰，要回应这一页。", action: "指向信息卡" },
      { kicker: "发布前", headline: "完整预览再确认", body: "删掉制作说明，只留下读者需要的内容。", action: "检查放大镜" },
    ],
  },
  humanized: {
    title: "图文账号怎样让每一张配图看起来像同一个系列",
    body: "做图文账号久了，会发现一张图好看还不够。读者连续翻几篇，最好能很快认出来：这应该是同一个账号发的。\n\n我会先定下几件不太动的事：人物长什么样、常用什么颜色、字看起来是什么感觉，还有角色通常出现在哪个位置。选题变了，再去调整动作、重点色和信息安排。\n\n这样不是把每篇做成复制粘贴的模板。底下有一套稳定的规则，表面可以跟着选题换。\n\n正式发布前，我会把图一张张看过去：单独看能不能懂？右下角的小角色有没有在帮这页说话？画面上的字是不是都该给读者看？",
    tags: ["小红书图文", "内容创作", "账号运营", "品牌视觉", "AI工作流"],
    cards: [
      { kicker: "先看连续三篇", headline: "让人认出是你", body: "先把不轻易变化的部分定下来。", action: "翻看三张内容卡" },
      { kicker: "第一层", headline: "角色先保持稳定", body: "人物和主要穿着不跟着选题乱变。", action: "拿着头像卡" },
      { kicker: "第二层", headline: "颜色留一点共同感", body: "每篇可以不同，但别像换了一个账号。", action: "对比色卡" },
      { kicker: "第三层", headline: "动作也要有用", body: "让右下角角色回应这一页的内容。", action: "指向信息卡" },
      { kicker: "发之前", headline: "再看一遍读者会看到什么", body: "制作说明不该留在图里。", action: "检查放大镜" },
    ],
  },
};

function TopicCard({ topic, active, onSelect, onSave }: { topic: Topic; active: boolean; onSelect: () => void; onSave: (topic: Topic) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic);

  useEffect(() => setDraft(topic), [topic]);

  return <article className={`topic-card ${active ? "active" : ""}`}>
    {editing ? <div className="topic-editor">
      <label>选题标题<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>切入角度<textarea value={draft.angle} onChange={(event) => setDraft({ ...draft, angle: event.target.value })} /></label>
      <label>推荐理由<textarea value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></label>
      <div className="editor-actions"><button className="button secondary" onClick={() => { setDraft(topic); setEditing(false); }}>取消</button><button className="button dark" onClick={() => { onSave(draft); setEditing(false); }}>保存并采用</button></div>
    </div> : <>
      <button className="topic-select" onClick={onSelect} aria-pressed={active}><span>{topic.id.slice(-1).padStart(2, "0")}</span><div><strong>{topic.title}</strong><small>{topic.angle} · {topic.reason}</small></div><i /></button>
      <button className="topic-edit" onClick={() => setEditing(true)}>编辑选题</button>
    </>}
  </article>;
}

function CopyEditor({ label, tone, value, onSave }: { label: string; tone: "raw" | "human"; value: Draft; onSave: (draft: Draft) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  function updateCard(index: number, field: keyof CardCopy, next: string) {
    setDraft({ ...draft, cards: draft.cards.map((card, cardIndex) => cardIndex === index ? { ...card, [field]: next } : card) });
  }

  return <article className="copy-card">
    <div className="copy-heading"><div><p className="eyebrow">{label}</p><h3>{value.title}</h3></div><span className={`pill ${tone}`}>{tone === "human" ? "真人感版本" : "Agent 初稿"}</span></div>
    {editing ? <div className="copy-editor">
      <label>标题<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>正文<textarea className="body-input" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
      <label>标签<input value={draft.tags.join("，")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean) })} /></label>
      <div className="card-edit-list"><strong>逐页配图文案</strong>{draft.cards.map((card, index) => <fieldset key={index}><legend>第 {index + 1} 张</legend><input aria-label={`第 ${index + 1} 张眉题`} value={card.kicker} onChange={(event) => updateCard(index, "kicker", event.target.value)} /><input aria-label={`第 ${index + 1} 张标题`} value={card.headline} onChange={(event) => updateCard(index, "headline", event.target.value)} /><textarea aria-label={`第 ${index + 1} 张正文`} value={card.body} onChange={(event) => updateCard(index, "body", event.target.value)} /><small>角色动作：{card.action}</small></fieldset>)}</div>
      <div className="local-note">本次修改只保存在当前浏览器；真实 Agent 工作流仍在本地工作台执行。</div>
      <div className="editor-actions"><button className="button secondary" onClick={() => { setDraft(value); setEditing(false); }}>取消</button><button className="button dark" onClick={() => { onSave(draft); setEditing(false); }}>保存本版</button></div>
    </div> : <>
      <div className="copy-body">{value.body.split("\n").map((line, index) => line ? <p key={index}>{line}</p> : <span key={index} />)}</div>
      <div className="tag-row">{value.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <div className="copy-footer"><span>{value.cards.length} 张卡片文案</span><button className="button secondary" onClick={() => setEditing(true)}>编辑本版</button></div>
    </>}
  </article>;
}

export default function Home() {
  const [studio, setStudio] = useState<StudioState>(initialState);
  const [notice, setNotice] = useState("分享演示版：可浏览和编辑，Agent 执行仍在本地工作台完成。");

  useEffect(() => {
    const saved = window.localStorage.getItem("agent-xiaohongshu-workbench-share");
    if (saved) {
      try { setStudio(JSON.parse(saved)); } catch { window.localStorage.removeItem("agent-xiaohongshu-workbench-share"); }
    }
  }, []);

  useEffect(() => window.localStorage.setItem("agent-xiaohongshu-workbench-share", JSON.stringify(studio)), [studio]);

  const selectedTopic = useMemo(() => studio.topics.find((topic) => topic.id === studio.selectedTopicId) || studio.topics[0], [studio]);

  function updateTopic(next: Topic) {
    setStudio((current) => ({ ...current, selectedTopicId: next.id, topics: current.topics.map((topic) => topic.id === next.id ? next : topic) }));
    setNotice("选题已保存到当前浏览器。回到本地 Agent 工作台后，请从该选题重新拆解。");
  }

  async function copyHandoff() {
    const handoff = `账号定位：${studio.positioning}\n确认选题：${selectedTopic.title}\n切入角度：${selectedTopic.angle}\n推荐理由：${selectedTopic.reason}\n\n去 AI 味终稿：\n${studio.humanized.title}\n${studio.humanized.body}\n\n标签：${studio.humanized.tags.join("、")}`;
    await navigator.clipboard.writeText(handoff);
    setNotice("交接摘要已复制，可粘贴回本地 Agent 工作台或发给协作者。 ");
  }

  return <div className="site-shell">
    <header className="topbar">
      <div className="brand"><strong>AGENT 小红书工作台</strong><span>单账号图文工作流 · 分享演示版</span></div>
      <nav aria-label="内容生产进度">{["账号定位", "品牌角色", "图文热点", "确认选题", "热点拆解", "生成文稿", "去 AI 味", "生成配图", "发布"].map((item, index) => <span key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</span>)}</nav>
      <div className="share-status"><i />协作预览可用</div>
    </header>

    <div className="mode-banner"><div><strong>这是可分享的协作预览</strong><span>内容编辑保存在访问者浏览器；热点抓取、生图与发布不会在公开站点伪执行。</span></div><button className="button coral" onClick={copyHandoff}>复制交接摘要</button></div>

    <main className="workspace">
      <section className="left-panel">
        <div className="section-title"><div><p className="eyebrow">01 / 账号基础</p><h1>账号定位：为谁解决什么问题</h1></div><span className="pill human">工作台快照</span></div>
        <div className="positioning-card"><label>账号定位<textarea value={studio.positioning} onChange={(event) => setStudio({ ...studio, positioning: event.target.value })} /></label><div><span>{studio.positioning.length}/500</span><button className="button dark" onClick={() => setNotice("账号定位已保存到当前浏览器。")}>保存定位</button></div></div>

        <section className="character-section"><div className="section-title"><div><p className="eyebrow">02 / 品牌角色</p><h2>由每个账号自行生成并锁定</h2></div><span className="pill human">本地角色资产</span></div><div className="character-card"><img src="/project-logo.png" alt="Agent 小红书工作台项目图标" /><div><strong>本地专属品牌角色</strong><p>公开演示不会携带任何用户的头像或角色素材。正式工作台会根据你的头像描述锁定人物、穿着和绘制方式，只改变每页对应的动作与表情。</p><div className="palette" aria-label="示例品牌配色"><i /><i /><i /><i /><i /></div><small>每张配图右下角保留角色安全区，并由选题推荐动态视觉方向。</small></div></div></section>

        <section><div className="section-title"><div><p className="eyebrow">03 / 图文信号</p><h2>只保留通过媒体校验的图文笔记</h2></div><span className="quiet">快照证据</span></div><div className="signal-list">{signals.map((signal, index) => <article key={signal.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{signal.title}</strong><p>{signal.evidence}</p></div><div><b>{signal.heat}</b><small>{signal.meta}</small></div></article>)}</div></section>

        <section><div className="section-title"><div><p className="eyebrow">04 / 选题方向</p><h2>候选选题可直接编辑并采用</h2></div><span className="quiet">{studio.topics.length} 个候选</span></div><div className="topic-list">{studio.topics.map((topic) => <TopicCard key={topic.id} topic={topic} active={topic.id === studio.selectedTopicId} onSelect={() => setStudio({ ...studio, selectedTopicId: topic.id })} onSave={updateTopic} />)}</div></section>

        <section className="story-section"><div className="section-title"><div><p className="eyebrow">长期内容资产</p><h2>账号故事线</h2></div><span className="quiet">已发布 0 篇</span></div><div className="tone-anchor"><span>账号调性锚点</span><strong>{studio.positioning}</strong><p>正式版会读取最近 12 篇已发布主题，用于连续性、相邻扩展和标题查重。</p></div><div className="empty-story"><strong>第一篇验证发布后，故事线会从这里开始</strong><p>只有取得小红书笔记 ID 或 URL 的成功发布才会入档。</p></div></section>
      </section>

      <aside className="right-panel">
        <div className="selected-title"><p className="eyebrow">已确认选题</p><h2>{selectedTopic.title}</h2><p>{selectedTopic.reason}</p></div>

        <section className="analysis-panel"><div className="section-title compact"><div><p className="eyebrow">05 / 热点拆解</p><h3>从“高耗时痛点”进入三步交接，再把判断权还给人</h3></div><span className="pill human">Lingzao 单一 Skill</span></div><div className="analysis-grid">{[
          ["01", "内容结构", "痛点开场、三步清单、边界提醒和轻行动收尾。"],
          ["02", "写作机制", "短句、具体场景、可执行动作，避免万能总结。"],
          ["03", "视觉 DNA", "奶油底、可可字、珊瑚强调和右下角品牌角色。"],
          ["04", "发布场景", "在完整预览确认后，选择立即发布或暂缓发布。"],
        ].map(([index, title, body]) => <article key={index}><span>{index}</span><div><strong>{title}</strong><p>{body}</p></div></article>)}</div></section>

        <section className="visual-panel"><div className="section-title compact"><div><p className="eyebrow">主题视觉推荐</p><h3>选题变化，品牌识别保持一致</h3></div></div><div className="visual-grid">{[
          ["三件事交接清单", "把三个收尾任务做成收藏型信息卡。", "推荐"],
          ["品牌角色信息卡", "用右下角动作承接页面信息，而不是堆砌装饰。", ""],
          ["发布前预览清单", "先确认读者可见内容，再选择发布模式。", ""],
        ].map(([title, body, badge], index) => <article className={index === 0 ? "selected" : ""} key={title}><div className="mini-palette"><i /><i /><i /></div>{badge && <em>{badge}</em>}<strong>{title}</strong><p>{body}</p></article>)}</div></section>

        <section className="copy-studio"><div className="copy-studio-title"><div><p className="eyebrow">06—07 / 文稿版本</p><h3>原始文稿与去 AI 味版本都可编辑</h3></div><p>上游修改回到本地工作台后，应重新生成下游资产。</p></div><div className="copy-grid"><CopyEditor label="06 / 原始文稿" tone="raw" value={studio.raw} onSave={(raw) => { setStudio({ ...studio, raw }); setNotice("原始文稿已保存到当前浏览器。正式流程需要重新执行去 AI 味。") }} /><CopyEditor label="07 / 去 AI 味文稿" tone="human" value={studio.humanized} onSave={(humanized) => { setStudio({ ...studio, humanized }); setNotice("去 AI 味文稿已保存到当前浏览器。正式流程需要重新生成配图。") }} /></div></section>

        <section className="agent-gate"><div><p className="eyebrow">08—09 / Agent 执行边界</p><h3>生图、预览和发布保留在本地工作台</h3><p>分享站点不会接平台登录态，也不会调用模型或平台 API。审稿确认后，本地版会要求选择“立即发布”或“暂缓发布”。</p><div className="agent-mode-preview"><span><strong>立即发布</strong>取得笔记 ID 或 URL 后入档故事线</span><span><strong>暂缓发布</strong>填好稿件后点击“暂存离开”，不公开发布</span></div></div><button className="button dark" onClick={copyHandoff}>复制后回本地执行</button></section>
      </aside>
    </main>

    <div className="toast" role="status">{notice}</div>
  </div>;
}
