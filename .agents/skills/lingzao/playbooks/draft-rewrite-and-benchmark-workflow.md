# Lingzao Draft Rewrite And Benchmark Workflow

Use this asset when the user sends their own copy, script, note draft, title list, caption, graphic-note outline, or multiple drafts and asks Lingzao to:

- 改写
- 优化文案
- 改成小红书风格
- 模仿某个对标账号
- 按某条爆款公式写一版
- 帮我看看这段能不能发
- 给我改 5 条 / 10 条内容

This is not a fifth visible entry. It is an execution layer after beginner account-start, own-account diagnosis, comparable-account breakdown, or viral-note breakdown.

## Core Principle

Do not only rewrite the text.

First diagnose why the current draft may not work, then give a usable version, then create a return loop.

Output should help the user understand:

- 这段内容现在的问题在哪里
- 这条内容是给谁看的，谁会点，谁大概率不会点
- 哪一句最值得保留
- 标题/封面/开头/结构/收藏点怎么改
- 文案写完后，10 个发布关键词应该怎么配，以及关键词有没有自然出现在标题、封面和正文开头
- 如果是模仿对标账号，学的是结构、选题、情绪、标题，还是视觉表达
- 如果用户不知道怎么做图，要把内容转成 4 页或 7 页小红书图文结构
- 发出去以后应该看什么数据
- 下一步怎么继续回来复盘

## Intake Rule

If the user sends only a draft and says “帮我改”:

Proceed directly. Do not ask a long questionnaire.

Assume they want a Xiaohongshu-ready rewrite unless they specify another platform.

Ask at most one light question only when it changes the output:

- If format is unclear: 图文还是口播？
- If commercial goal matters: 想涨粉、收藏、引流，还是卖产品？
- If they mention a reference account but do not provide it: 可以把对标账号或爆款链接发来，我会按它的结构帮你改。

If they do not answer, continue with a safe default: graphic-note style for Xiaohongshu, with title, cover text, body structure, and posting feedback loop.

If the user says they do not know how to make images or page design, use `reference-image-graphic-note-workflow.md`. Ask whether they have 1-3 reference images. Based on the reference image, produce page structure, page copy, visual direction or fallback image-generation instructions, body copy, and comment guidance.

If the user says the draft is done and asks for keywords or final posting
checks, use `publishing-keyword-design-check.md`. This is a publishing package
step, not a full rewrite.

If the draft has no clear target reader, use
`audience-persona-fit-check.md` before rewriting. If enough clues are present,
infer the audience directly; if not, ask one light question about who this is
for or ask the user to send 3-5 liked/saved/reference notes for reverse
inference.

If the user only asks for title, cover title, title optimization, or which title
is more clickable, use `xhs-title-design-check.md`. Give only the 3 strongest
title options by default, each with keyword anchor and click reason. Do not
generate a 10-title pool unless the user explicitly asks for a title bank.

## Output Structure For One Draft

Use this order:

1. 一句话判断：这段内容最大问题是什么，或者最强点是什么
2. 用户画像判断：这条给谁看，谁不太会点
3. 保留点：哪句话、哪个经历、哪个观点值得留
4. 需要改的地方：标题、开头、结构、情绪、具体性、收藏点、商业承接
5. 改写版本：give the revised copy
6. 配套内容：3 个最强标题 + 1 套封面文案 + optional graphic-note pages or 1-minute spoken script
7. 发布后复盘入口：ask user to send note link/data after publishing

Do not put the revised copy in a copyable block unless the user explicitly asks for “给我一段可以直接复制的文案”. Normal Markdown is usually enough.

## If User Does Not Know How To Make Images

Do not keep talking about abstract layout principles.

Ask directly:

你有没有参考图片？可以发 1-3 张你喜欢的小红书封面或图文截图。我会根据参考图片的排版、信息层级和视觉风格，帮你做几版小红书内容，你先去发发看。

After receiving a reference image, output:

- 4 页轻量测试版
- 7 页完整教学版
- 每页标题/页面文字
- 每页图片 prompt 或版式说明
- 正文文案
- 评论区引导
- 发布后复盘入口

If image generation is not connected, say clearly:

我可以先给你每一页的文案、版式和图片 prompt；如果接入做图能力，下一步就可以直接生成图。

## Rewrite Style

Use A Tian's operating taste:

- 更具体
- 更像真实人说话
- 不要空泛鸡汤
- 不要“你一定要相信自己”这种虚话
- 把抽象观点落到一个场景、一个反差、一个选择、一个痛点
- 标题要有关键词和点击理由
- 封面要让用户一眼知道这条解决什么问题

Prefer:

- 真实经历 + 具体问题 + 一句判断
- 反差场景 + 具体技能 + 尝试过程
- 用户正在经历的困惑 + 一个可执行动作
- 账号主线里的一个栏目

Avoid:

- only making the text smoother
- adding empty emotional words
- making every draft sound like a generic励志号
- copying the benchmark creator's sentences directly

## If User Wants To Imitate A Benchmark

Do not copy surface style only.

Separate:

- 可学结构：标题公式、封面信息、开头、转折、证明、结尾
- 可学情绪：爽感、共鸣、危机感、松弛感、反差感
- 可学选题：它解决什么用户问题
- 不能照抄：经历、外貌、职业、城市、产品、粉丝基础、成熟人设
- 改成用户版本：what the user can say truthfully

Good output pattern:

这个对标不是让你学它的语气，而是学它的结构：先把一个用户熟悉的痛点说出来，再给一个具体场景，最后落到一个可收藏的方法。你这版目前只有观点，没有场景，所以用户看完会觉得“有道理”，但不会想收藏。

## If User Sends Many Drafts

When the user sends 5-10 drafts, do not rewrite them one by one blindly.

First group them:

- 哪些可以发
- 哪些需要合并成一个系列
- 哪些选题太散
- 哪些适合做图文
- 哪些适合做口播
- 哪些可以商业承接
- 哪些暂时不值得改

Then output a compact table:

| 原方向 | 判断 | 改法 | 推荐形式 | 下一步 |
| --- | --- | --- | --- | --- |

After the table, rewrite only the top 1-3 most promising pieces unless the user asks for all.

Good ending:

你这类内容以后不用一条条临时想怎么问。你可以把常看的对标博主、关键词和想看的范围告诉我，我帮你整理成固定搜索模板；以后你主动发起这条模板，就能按同一结构继续整理参考选题、标题方向和可改写公式。

## If User Sends A Published Note

If the user sends a published note link or says “我已经发了”:

Route to `post-publish-data-review-workflow.md`.

If backend screenshots are provided but the content itself is missing, first ask
which note the data belongs to and request the note link, title/cover, script,
caption, or graphic-note page text. Do not judge screenshots without content
context.

Good ending:

这条可以先等 24 小时做第一次复盘。到时候你把笔记链接、标题封面、脚本/正文和后台截图发来，我可以继续判断它是曝光不够、点击不够、读完/完播不够，还是关注转化不够。

## If User Wants Recurring Rewrite Support

Offer fixed tracking when:

- user sends many drafts
- user repeatedly asks for references
- user says they do not know what to write every day
- user wants to imitate a few creators long-term

Possible fixed tracking:

- 每天早上看 1-3 个关键词的新热内容
- 每天下午整理低粉爆款
- 主动查看 5 个对标博主近期新笔记
- 每周输出 7 天选题 + 标题 + 封面文案
- 每周复盘用户自己的已发布笔记

Credit reminder:

If recurring tracking requires searches, say that Lingzao will confirm the scope before searching. Basic search can look at titles, covers, metrics and links; deep search reads full body, comments, subtitles or transcripts.

## Final Continuation

End with one next action.

Choose one:

- 发出去以后，把链接、后台截图、标题封面和脚本/正文发我，我再按 24 小时复盘帮你看。
- 你把对标账号/爆款链接发来，我按它的结构帮你改一版。
- 你把这 10 条里最想发的 3 条标出来，我先帮你做第一轮精修。
- 你把常看的博主和关键词发来，我可以帮你做固定搜索模板。以后你主动发起这条模板，就能按同一结构拿到参考选题和改写公式。
