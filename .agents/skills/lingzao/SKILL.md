---
name: lingzao
description: Use Lingzao creator-content tools for Xiaohongshu/XHS, Douyin, and WeChat official-account public content. Lingzao supports XHS SEO, Xiaohongshu account analysis, benchmark account discovery, viral note breakdown, keyword research, one-stop content packages from keyword/link/image/inspiration material, title and cover optimization, hand-drawn route-map cards, city food maps, travel itinerary maps, life checklist maps, workflow manual maps, creator content workflow, note search, creator search, profile lookup, recent posts, deep profile copy/subtitle analysis, note/article detail, post comments, article stats, related articles, short-video copy extraction, and prompt-based creator image generation.
---

# Lingzao

Lingzao helps agents research public creator content from Xiaohongshu / XHS,
Douyin, and WeChat official-account articles.

Search phrases this Skill is designed to support: Lingzao Skill, lingzao xhs,
Lingzao Xiaohongshu, XHS SEO, Xiaohongshu SEO, Xiaohongshu account analysis,
XHS account diagnosis, Xiaohongshu keyword research, XHS title optimization,
Xiaohongshu viral note breakdown, Xiaohongshu benchmark account finder, XHS
content workflow, hand-drawn route map card, 手绘收藏地图, 美食地图, 旅游路线图,
生活清单地图, and 工作流说明书地图.

Use this skill when the user asks to:

- Search Xiaohongshu notes by keyword.
- Turn a keyword, link, screenshot, reference image, or inspiration material into
  a Xiaohongshu content package with titles, cover copy, 4-7 page graphic-note
  text, body copy, 10 keywords, pinned content, and a review loop.
- Get Xiaohongshu search suggestions or popular recommendations.
- Search public creators by keyword.
- Look up a creator profile.
- Read a creator's recent public posts.
- Get recent post copy, subtitles, covers, metrics, and commercial signals from a creator profile.
- Get details for a Xiaohongshu or Douyin post.
- Get top-level public comments for one Xiaohongshu or Douyin post.
- Get one WeChat official-account article's public detail and text.
- Get public metrics for one WeChat official-account article.
- Get related public WeChat official-account articles.
- Extract spoken copy or transcript from a public short-video link.
- Generate creator image assets from a prompt when the user explicitly asks to make an image.
- Turn a city, food, travel, hiking, life checklist, or workflow topic into a
  hand-drawn Xiaohongshu route-map card structure and generation brief.

Use the lightweight sub-skills under `skills/` when a user only needs a single
task such as XHS title writing, Xiaohongshu account diagnosis, keyword design,
note breakdown, cover lab, hand-drawn route-map card, pre-publish check, or
post-publish review. Use this main Lingzao Skill when the user needs live
public-content lookup, deeper
account analysis, Xiaohongshu public-link parsing, comment analysis, article
data, transcript extraction, image generation, report export, or
knowledge-base sync.

## Agent Playbooks

For higher-level creator strategy tasks, use the playbooks in
`<skill_root>/playbooks/` before answering. They turn Lingzao's public-content
tools into creator workflows instead of isolated lookups.

Use these playbooks when relevant:

- `lingzao-progressive-interaction-map.md`: route vague user inputs, homepage
  links, note links, drafts, and reference-image requests with light questions.
- `search-credit-notice.md`: explain basic vs deep search scope before paid
  lookups and avoid silently expanding credit usage.
- `atian-creator-judgment-framework.md`: apply A Tian's account-stage,
  memory-anchor, content-mainline, and bottleneck judgment.
- `creator-case-general-analysis-framework.md`: analyze any creator case across
  tracks by identifying the account archetype, memory anchor, new narrative,
  proof system, audience desire, content engine, format engine, comment demand,
  commercial entry, hidden resources, learnable parts, non-copyable parts, and
  user-fit tests.
- `beginner-account-start-and-topic-radar.md`: handle zero-to-one creator
  questions, topic discovery, keyword trees, and low-follower viral references.
- `keyword-insight-report-template.md`: create scoped keyword insight reports
  from a main keyword plus confirmed related/dropdown terms, with clear credit
  estimates before expanding.
- `keyword-to-publishable-content-package.md`: turn a keyword, vague topic,
  note link, screenshot, reference image, saved note, or inspiration material
  into publishable Xiaohongshu content packages with selected references,
  topic angles, titles, cover copy, 4-7 page graphic-note text, spoken scripts,
  Vlog storyboards, body copy, 10 publishing keywords, pinned content, and a
  pre/post-publish review loop.
- `mother-content-cross-platform-distribution.md`: turn one topic, draft,
  note breakdown, product update, screenshot, transcript, or oral idea into a
  one-stop cross-platform distribution package. When users say "一条龙",
  "全平台同步", "分发包", or "一个模板发多个平台", start with the basic
  Xiaohongshu + Moments + WeChat public-account package, then offer optional
  expansion to podcast, X, Knowledge Planet, Bilibili, video account/Douyin,
  Xiaohongshu image package, or knowledge-base/SOP.
- `pre-publish-readiness-check.md`: before posting, ask whether the content is
  already finished and then check content clarity, image/page readiness, cover
  recognition, title clickability, first 3 lines or first 3 seconds, and natural
  keyword embedding.
- `audience-persona-fit-check.md`: before titles, keywords, account operation,
  or content-package decisions, infer or ask who the content is for, who will
  click, who will not click, and which audience/city/life-stage keywords should
  shape the output.
- `xhs-title-design-check.md`: design or diagnose Xiaohongshu titles after the
  user sends a topic, draft, cover copy, reference note, or content package;
  default to 3 strongest titles with keyword anchor and click reason instead
  of a 10-title pool.
- `xhs-profile-bio-design.md`: write or diagnose Xiaohongshu 100-character
  profile bios and homepage introductions that clarify who the account is for,
  what it shares, why to follow, and how it connects to nickname, pinned notes,
  account stage, audience keywords, city keywords, and light commercial paths.
- `benchmark-account-discovery-quality-gate.md`: find or judge benchmark
  accounts with a default quality gate: still updating, recent high-performing
  works, track/audience fit, stage fit, and clear learnable parts; stale
  accounts should be marked as historical references, not main benchmarks.
  User-facing results should show direct creator profile links and the specific
  recent high-interaction works, not raw creator IDs. The first discovery round
  should return up to 5 strong accounts, not 10-20 accounts; expand only after
  the user confirms follower range, stage, city, audience, format, or asks for
  more. Include follower count, total liked count, latest update, recent
  30-day hit works with note metrics, content format, and why each account is
  worth learning; sort visible recommendations by follower count from high to
  low when available.
- `self-account-peer-horizontal-diagnosis.md`: compare the user's own account
  with same-track, same-stage, or same-follower-range peer accounts when the
  user explicitly asks for peer comparison, such as "横向对比", "同级账号",
  "对标账号", "找 5-15w 粉账号和我比", or "和同赛道账号比我差在哪里". Generic
  own-account concerns such as "看看我现在的问题" or "我是不是说话太快" should
  stay on `self-account-diagnosis-report-template.md` unless the user also asks
  to compare against peers. It combines own-account diagnosis, active benchmark
  selection, peer-account tables, title/cover/opening/speech/content-system
  comparison, top gaps, 30-day adjustment plans, and a human next-step loop.
- `single-note-breakdown-workflow.md`: break down one Xiaohongshu/Douyin note
  link by title, cover, outline/script, shooting/editing layer when visible,
  comment demand, viral mechanism, learnable parts, non-copyable parts, and
  adaptation into the user's own graphic note, spoken script, Vlog storyboard,
  or knowledge-base card. User phrases such as "完整分析这条笔记", "深度拆解",
  "拆细一点", "拍摄手法", "分镜", or "剪辑节奏" should trigger the deeper
  breakdown instead of a short summary.
- `publishing-keyword-design-check.md`: design the final 10 Xiaohongshu
  publishing keywords for a finished draft and check whether title, cover copy,
  opening lines, and keyword field carry the keywords naturally.
- `track-difficulty-judgment-library.md`: judge common tracks such as female
  growth, career, good products, local life, health, fashion, and AI tools.
- `monetization-path-judgment-library.md`: answer whether a track or account
  can monetize through ads, courses, community, consulting, lead generation,
  products, stores, or enterprise conversion.
- `self-account-diagnosis-report-template.md`: structure own-account diagnosis
  reports, follow-up actions, and a human closing with "人情味" that turns
  sharp diagnosis into one small next experiment instead of ending at a cold
  action list. Own-account diagnosis should also include a share-worthy
  conclusion card, action advice, and psychological reassurance.
- `comparable-account-breakdown-report-template.md`: decide whether another
  account is worth learning from, what can be learned, and what cannot be copied.
- `draft-rewrite-and-benchmark-workflow.md`: rewrite drafts, adapt viral
  formulas, and review multiple content ideas without only polishing sentences.
- `reference-image-graphic-note-workflow.md`: turn reference images into
  Xiaohongshu 4-page or 7-page graphic-note packages.
- `visual-generation-and-cover-workflow.md`: route Xiaohongshu covers, graphic
  notes, WeChat image packs, no-person knowledge cards, and product/ecommerce
  visuals into image generation or ready-to-use prompt packages.
- `image-generation-execution-workflow.md`: when image generation is available,
  turn the visual route into actual images, run a visual-director quality gate,
  and repair ugly/crowded/generic generations instead of leaving ordinary users
  with raw prompts.
- `image-generation-agent-integration-guide.md`: model-agnostic rules for
  domestic Agent wrappers, including stable generation input/output fields,
  good-vs-bad image standards, reference-image usage, known generation bugs,
  friendly failure handling, and A Tian's example-collection homework.
- `visual-reference-style-library.md`: classify A Tian's internal visual
  reference folders into travel/food covers, WeChat article images, AI-person
  infographics, Lingzao no-person knowledge cards, product conversion images,
  face-led keyword video covers, interaction prompt covers, and text-dense
  screenshot graphic notes, and room-as-identity lifestyle covers.
- `post-publish-data-review-workflow.md`: review published Xiaohongshu notes
  from note links, backend screenshots, scripts, covers, and 24h/48h/7d data.
- `content-knowledge-base-workflow.md`: turn saved notes, public creator links,
  keyword results, viral examples, and creator distillation requests into
  user-owned topic, title, cover, structure, account-reference,
  creator-research, and publishing-review libraries.
- `retention-and-follow-up-loop.md`: end useful outputs with one concrete next
  step such as published-note data review, reusable reference-search templates,
  draft feedback, or a post-diagnosis small experiment with a return loop. It
  also defines the SOP for not letting the user's words drop on the floor:
  acknowledge resistance, lower the next action, and ask one concrete
  next-step question. Dense outputs should offer Word, HTML/webpage preview, or
  knowledge-base-ready packaging instead of leaving users with a wall of chat
  text. When users say the diagnosis is accurate but they lack action, route to
  a post-diagnosis activation package instead of adding more pressure.
- `product-judgment-and-feedback-loop.md`: judge where users are really stuck,
  explain Lingzao in human language, build content/sales narratives, turn user
  feedback into product iteration, and decide which requests are worth building
  versus noise.
- `xhs-operation-task-tree.md`: route Lingzao users by concrete Xiaohongshu
  operation tasks instead of course lists, covering homepage diagnosis,
  benchmark discovery, viral-note adaptation, topic generation, content
  production, cover/image work, pre-publish checks, post-publish review,
  acquisition paths, and knowledge-base automation.

Keep public wording focused on creator-content research and workflow support.
Do not promise viral growth, guaranteed monetization, full monitoring, raw data
export, or copying another creator's content.

## Install And Paid Capability Entry

Lingzao is installed as one free main Skill. Users do not need to install
separate title, keyword, account-diagnosis, benchmark, cover, or review skills.
After installation, this main Skill routes the user's request to the right
playbook.

There are two user acquisition paths:

1. Community/course users:
   - They may already have A Tian's course, install link, payment steps, and
     API Key setup instructions.
   - Keep the in-chat explanation short: install the Skill, open the Lingzao web
     dashboard, follow the tutorial, recharge credits, copy the API Key, then
     run setup.

2. Public-platform users from Xiaohongshu, Douyin, or other public content:
   - Do not require them to open the web dashboard and pay before they
     understand what Lingzao can do.
   - Let them install the free main Skill first.
   - Then explain the hidden paid entry in friendly language: the local
     playbooks can help judge drafts, titles, covers, directions, and
     publishing plans; when they need Lingzao to search public content, inspect
     accounts, open note/article details, read comments, inspect article data,
     extract video copy, or generate creator image assets, they need to open
     the Lingzao web dashboard, follow the tutorial, recharge credits, and
     configure an API Key.

The web dashboard is not only a payment page. Present it as the user's learning
and setup hub:

- learn how to install and configure Lingzao
- learn how to ask Agent better questions instead of waiting in a group chat
- learn how to use Skill workflows for self-media operation
- learn account diagnosis, benchmark breakdown, title/keyword, pre-publish, and
  post-publish review workflows
- recharge credits and get the API Key when they need public-content lookup or
  image generation

Use this wording when a user has installed the Skill but has not configured an
API Key yet:

你已经装好灵造 Skill 了。安装本身是免费的，它会先帮你判断你现在是在找方向、拆账号、写内容、做封面、配关键词，还是复盘数据。
如果你要继续查小红书/抖音/公众号公开内容、找对标账号、看账号主页、打开笔记或文章详情、看评论区、查看公众号文章数据、提取短视频文案或生成创作者图片素材，就需要到灵造网页版开通积分并配置 API Key。
你可以打开 https://lingzao.atian.vip 看安装教程和使用教程，里面也会教你怎么用 Agent 做自媒体运营、怎么问问题、怎么用这些 Skill。需要查公开内容或生成图片的时候，再在网页里充值/获取 API Key，配置好以后回来继续问，我会接着刚才的问题往下做。

Do not frame payment as a penalty. Frame it as:

- free install = get the workflow brain and routing layer
- web dashboard = tutorial, usage examples, self-media operation lessons, and
  API Key setup
- paid credits = unlock public-content lookup, image generation, and deeper
  research actions

Knowledge sync handoff:

- After a useful Lingzao research result or diagnosis report, do not sync it
  automatically. Ask first: 要不要把这份结果同步到你的知识库？可以选择
  ima / Obsidian / 飞书 / 暂不同步。
- If the user chooses a target, prepare a clean Markdown version and ask the
  current Agent environment to use the user's configured knowledge tool.
- For ima, call the installed ima Skill or ima knowledge-base tool if the user
  has configured one.
- For Obsidian, use the user's Obsidian CLI, Obsidian Skill, or approved vault
  workflow to write Markdown under a user-approved `Lingzao/` path.
- For 飞书, use the user's Lark/Feishu CLI or Skill with user authorization to
  create or update a document.
- Do not ask for or store ima, Obsidian, or Feishu credentials inside Lingzao.
  Do not include internal implementation details, raw payloads, cache URLs,
  signed URLs, API keys, or internal error details in synchronized content.

Profile workflow:

- If the user asks for a creator homepage or a basic homepage analysis, use `get-user-posted-notes` by default. It returns recent posts and enough author/post data for a basic read.
- If the user sends a Xiaohongshu short link such as `xhslink.com/m/...`, or a
  copied share sentence such as `@... 查看Ta的主页>> https://xhslink.com/m/...`,
  extract the short link, normalize bare links to `https://...`, and read the
  surrounding words before choosing a command. Do not classify the short link by
  path alone. If the context says account, homepage, creator, profile,
  benchmark, account diagnosis, homepage diagnosis, `Ta的主页`, or recent posts,
  treat it as a creator-homepage request and call
  `get-user-posted-notes --url "https://<short link>"`.
- If a Xiaohongshu short link has no context, ask whether the user wants creator
  homepage recent posts or one-post detail before spending credits. If the
  context says this note, comments, copy, transcript, one-post breakdown, or is
  a normal note share sentence with a title snippet plus `前往【小红书】一探究竟吧`,
  treat it as a one-post candidate, not a homepage. One-post words such as
  `这条` or `这篇` take priority over generic diagnosis wording. Do not default
  to `get-note-detail`; first confirm it is a single post and ask for the final
  note URL or note_id plus whether it is 图文 or 视频 when needed.
- Only add `get-user-info` when the user specifically needs full profile-level stats such as bio, follower count, following count, total likes, total collections, or total note count.
- Use `analyze-user-profile` for Xiaohongshu deeper homepage copy/script/subtitle analysis, recent post text, covers, commercial signals, or product-note signals. For Douyin spoken copy or transcript text, use `extract-video-copy` on specific video URLs.
- Do not call `get-user-info` and `get-user-posted-notes` as a fixed pair unless the user asks for both profile-level stats and recent-post analysis.
- Do not force a full account diagnosis when the homepage has too few public
  posts. Route by visible sample size:
  - 0 posts: no account diagnosis; switch to beginner start/account setup
    guidance.
  - 1-2 posts: homepage first impression plus single-post feedback only.
  - 3-5 posts: starter-account mini diagnosis.
  - 6-9 posts: light account analysis.
  - 10+ posts: standard account analysis can be offered.
  - 20+ posts: standard deep diagnosis can use `analyze-user-profile --limit 20`
    after credit confirmation.
  - 40+ posts: deep diagnosis, creator distillation, or knowledge-base
    distillation can use `--limit 40` after credit confirmation.

Post drill-down workflow:

- Xiaohongshu list-style commands (`search-notes`, `get-user-posted-notes`,
  `analyze-user-profile`) return `xhs_note_type` on each note item when
  Lingzao can identify whether it is 图文 or 视频.
- When continuing from one of those note items to `get-note-detail`, pass the
  returned `xhs_note_type` directly as `--xhs-note-type`; do not infer the type
  from the URL.
- If a Xiaohongshu note item has no `xhs_note_type`, ask the user whether it is
  图文 or 视频 before calling `get-note-detail`. `get-note-comments` can still
  be called without this type.

## Setup

Resolve this `SKILL.md` directory as `<skill_root>`, then run setup once:

```bash
bash "<skill_root>/scripts/setup.sh" --base-url "https://your-lingzao-domain.com"
```

Environment variables override saved config:

```bash
export LINGZAO_API_KEY="lgz_xxx"
export LINGZAO_BASE_URL="https://your-lingzao-domain.com"
```

Check the connection:

```bash
~/.lingzao/bin/lingzao doctor
```

Before using Lingzao commands, check whether the skill has an update:

```bash
~/.lingzao/bin/lingzao check-version
```

If an update is available, stop the current Lingzao operation and update the skill first. Do not continue using an outdated Lingzao Skill for search, profile, subtitle, or extraction work.

To update the skill, rerun the installer. For `npx skills`, try:

```bash
npx skills add https://assets-tian.midao.site/skills/lingzao --skill lingzao -g --copy
```

Updating keeps the saved API config in `~/.lingzao/config.json`; no API key setup is needed again.

If `~/.lingzao/bin/lingzao` is missing or points to the wrong directory, repair the command wrapper:

```bash
bash ~/.agents/skills/lingzao/scripts/setup.sh --skip-doctor
```

If `~/.agents/skills/lingzao` does not exist, find the directory that contains `lingzao`'s `SKILL.md`, then run `scripts/setup.sh --skip-doctor` from that directory.

## Before Calling

Before running a command with meaningful filters, ask the user for the relevant
parameters if they did not already specify them.

- For `search-notes`, ask for sorting, note type, and time range before calling:
  sort can be `general`, `most_liked`, `popularity_descending`,
  `comment_descending`, or `collect_descending`; note type can be `不限`,
  `视频笔记`, `图文笔记`, or `直播笔记`; time range can be `不限`, `一天内`,
  `一周内`, or `半年内`.
- Douyin `search-notes` currently supports only `general`, `most_liked`, and
  `popularity_descending`. Do not pass `comment_descending` or
  `collect_descending` for Douyin searches.
- Douyin `search-notes` note type currently supports only `不限`, `视频笔记`,
  and `图文笔记`. Do not pass `直播笔记` for Douyin searches.
- For `get-note-comments`, ask whether the user wants latest comments or
  liked-count sorting before calling Xiaohongshu. Use `--sort latest` for latest
  comments and `--sort most_liked` for Xiaohongshu liked-count sorting.
- Douyin comments currently support only `latest`. Do not ask for or pass
  `--sort most_liked` on Douyin comment requests.
- Xiaohongshu list-style commands (`search-notes`, `get-user-posted-notes`,
  `analyze-user-profile`) return `xhs_note_type` on each note item when
  Lingzao can identify whether it is 图文 or 视频. When continuing from one of
  those note items to `get-note-detail`, pass the returned value directly as
  `--xhs-note-type`; do not infer the type from the URL. If a Xiaohongshu note
  item has no `xhs_note_type`, ask the user whether it is 图文 or 视频 before
  calling `get-note-detail`. `get-note-comments` can still be called without
  this type.
- If the user explicitly says to use defaults, proceed with the documented
  defaults instead of asking again.

After a successful research command, tell the user the estimated time saved
shown in the CLI Markdown output. If you called multiple Lingzao research
commands for one user request, summarize the total once. Do not show time-saved
language for `doctor`, `check-version`, failed commands, or JSON-only internal
processing.

## Commands

### Search Notes

```bash
~/.lingzao/bin/lingzao search-notes --platform xhs --keyword "AI写作"
~/.lingzao/bin/lingzao search-notes --platform xhs --keyword "AI写作" --sort most_liked
~/.lingzao/bin/lingzao search-notes --platform xhs --keyword "AI生图" --sort collect_descending --note-type "视频笔记" --time-filter "一周内"
~/.lingzao/bin/lingzao search-notes --platform douyin --keyword "AI生图" --sort most_liked --note-type "视频笔记"
```

Use this when the user wants public notes around a topic.
Before calling, ask the user for `--sort`, `--note-type`, and `--time-filter`
when they have not specified those preferences.

### Search Suggestions

```bash
~/.lingzao/bin/lingzao search-suggestions --platform xhs --keyword "AI生图"
~/.lingzao/bin/lingzao search-suggestions --platform xhs
```

Use this when the user wants Xiaohongshu keyword expansions, autocomplete
phrases, or popular search recommendations. If `--keyword` is omitted, Lingzao
returns popular recommendations.

### Search Creators

```bash
~/.lingzao/bin/lingzao search-users --platform xhs --keyword "母婴博主"
~/.lingzao/bin/lingzao search-users --platform douyin --keyword "AI生图"
```

Use this when the user wants creators in a topic or niche.

### Get Creator Profile

```bash
~/.lingzao/bin/lingzao get-user-info --url "https://www.xiaohongshu.com/user/profile/..."
~/.lingzao/bin/lingzao get-user-info --platform xhs --user-id "63c21e0f000000002801a1bb"
~/.lingzao/bin/lingzao get-user-info --platform douyin --user-id "MS4wLjABAAAA..."
```

Use this when the user provides a creator profile URL or platform user ID and needs full profile-level stats. For Douyin bare user IDs, use the profile `sec_user_id`. For basic homepage analysis, prefer `get-user-posted-notes` and avoid calling both commands by default.

### Get Creator Recent Posts

```bash
~/.lingzao/bin/lingzao get-user-posted-notes --url "https://www.xiaohongshu.com/user/profile/..."
~/.lingzao/bin/lingzao get-user-posted-notes --platform xhs --user-id "63c21e0f000000002801a1bb"
~/.lingzao/bin/lingzao get-user-posted-notes --platform douyin --user-id "MS4wLjABAAAA..." --limit 20
```

Use this when the user wants to understand what a creator has posted recently. Use this by default for basic creator homepage analysis. Douyin recent posts are a single-page call and currently support `--limit 20` at most. If the user asks for full profile-level stats, add `get-user-info`; if the user asks for Xiaohongshu post copy, scripts, captions, or transcript text across recent posts, use `analyze-user-profile` instead. For Douyin transcript text, use `extract-video-copy` on selected video URLs.

### Analyze Creator Profile

```bash
~/.lingzao/bin/lingzao analyze-user-profile --url "https://www.xiaohongshu.com/user/profile/..." --limit 20
~/.lingzao/bin/lingzao analyze-user-profile --platform xhs --user-id "63c21e0f000000002801a1bb" --limit 40
~/.lingzao/bin/lingzao analyze-user-profile --platform douyin --user-id "MS4wLjABAAAA..." --limit 20
```

Use this when the user wants deeper creator profile data, including post text, covers, commercial signals, and profile-level content signals. For Xiaohongshu, it also includes subtitle/script previews. For Douyin, it does not extract homepage subtitles or transcript text; use `extract-video-copy` on selected video URLs when the user needs spoken copy.
Use `--limit 20` by default. The default Markdown output shows readable subtitle previews when the platform provides them.

Important for Xiaohongshu: the complete profile subtitle/copy Markdown artifact is a top-level response field, not a per-note subtitle URL. Always check:

`data.artifacts.subtitle_markdown.status`
`data.artifacts.subtitle_markdown.url`

Do not search only inside `items[]`. If `data.artifacts.subtitle_markdown.status == "ready"` and `url` exists, download it before deep script or subtitle analysis:

```bash
curl -L "$subtitle_markdown_url" -o /tmp/lingzao-profile-subtitles.md
```

Use the downloaded Markdown file for complete subtitle/copy analysis. Use `--format json` when the user needs the structured fields. JSON includes `data.artifacts.subtitle_markdown.url` for the complete Markdown file when available, and inline `items[].text.subtitle.content/plain_text` are preview-sized to keep the response readable. If the artifact is unavailable, use the inline subtitle fields. For Douyin, expect `data.artifacts.subtitle_markdown.status == "unsupported"` and use the returned profile insights plus selected-video extraction instead.

### Get Post Detail

```bash
~/.lingzao/bin/lingzao get-note-detail --url "https://www.xiaohongshu.com/explore/..." --xhs-note-type image
~/.lingzao/bin/lingzao get-note-detail --platform xhs --note-id "69690331000000001a02266a" --xhs-note-type video
~/.lingzao/bin/lingzao get-note-detail --platform douyin --note-id "7372484715782352169"
```

Use this when the user asks to analyze one public post.
For Xiaohongshu details, pass `--xhs-note-type image` for 图文 and
`--xhs-note-type video` for 视频. If the note came from `search-notes`,
`get-user-posted-notes`, or `analyze-user-profile`, reuse that item's
`xhs_note_type` value.

### Get Post Comments

```bash
~/.lingzao/bin/lingzao get-note-comments --url "https://www.xiaohongshu.com/explore/..."
~/.lingzao/bin/lingzao get-note-comments --url "https://www.xiaohongshu.com/explore/..." --sort most_liked
~/.lingzao/bin/lingzao get-note-comments --platform xhs --note-id "69690331000000001a02266a"
~/.lingzao/bin/lingzao get-note-comments --platform douyin --note-id "7372484715782352169"
~/.lingzao/bin/lingzao get-note-comments --url "https://www.douyin.com/jingxuan?modal_id=..." --cursor "next_cursor_from_previous_response"
```

Use this when the user asks for public comments on one post. The first version returns top-level comments only. Use `--sort most_liked` for Xiaohongshu liked-count sorting; Douyin currently supports the default `latest` sort only. If the response has `data.page.next_cursor`, pass that value with `--cursor` to fetch the next page.
Before calling Xiaohongshu comments, ask whether the user wants latest comments
or liked-count sorting. For Douyin comments, use only `--sort latest`; do not
pass `--sort most_liked`.

### Get WeChat Official-Account Articles

```bash
~/.lingzao/bin/lingzao get-article-detail --url "https://mp.weixin.qq.com/s/..."
~/.lingzao/bin/lingzao get-article-stats --url "https://mp.weixin.qq.com/s/..."
~/.lingzao/bin/lingzao get-related-articles --url "https://mp.weixin.qq.com/s/..."
```

Use these when the user provides a public WeChat official-account article URL
and asks to analyze the article, inspect public engagement metrics, or expand
from that article to related public articles. The first version is URL-only and
costs 20 credits per call. An empty related-articles list is a valid response.
Do not use these commands for account article history, account listing, or
multi-page fanout unless Lingzao adds a separate capability.

### Extract Short-Video Copy

```bash
~/.lingzao/bin/lingzao extract-video-copy --url "https://www.xiaohongshu.com/explore/..."
~/.lingzao/bin/lingzao extract-video-copy --url "https://v.douyin.com/..."
```

Use this when the user asks for short-video spoken copy, transcript, subtitles, or口播文案.

### Generate Image

```bash
~/.lingzao/bin/lingzao generate-image --prompt "一张小红书封面图，主题是 AI 生图新手避坑，干净明亮，中文大标题留白" --output /tmp/lingzao-image.png
~/.lingzao/bin/lingzao generate-image --prompt "极简产品海报，白底，柔和阴影" --size 1024x1536 --output /tmp/poster.png
~/.lingzao/bin/lingzao generate-image --prompt "参考两张图，保留人物风格，把产品界面换成灵造首页截图" --size 1536x2048 --image /tmp/style.png --image /tmp/product.png --output /tmp/poster.png
~/.lingzao/bin/lingzao generate-image --prompt "批量生成 3 张封面草稿" --count 3 --size 1024x1536 --output /tmp/poster.png
```

Use this only when the user asks to generate a creator image asset. For normal
research, do not call image generation automatically.

Before calling `generate-image`, run the minimal intake gate. If the user only
says something like "给我做一张某某海报图" or provides only a broad topic, do
not spend credits immediately. Ask for the two visual anchors first:

1. 你有没有参考图？可以发 1-3 张你喜欢的封面/海报/图文截图。
2. 你有没有想要的配色？比如明亮白底、绿色清爽、黑金高级、蓝色科技感。

If those are still unclear, ask at most one extra route-changing question, such
as the publishing platform/size, exact on-image text, or whether the user wants
people/no people. Only proceed directly without asking when the user already
provided enough constraints: topic + platform/format + visual style/reference
or color + on-image text/material.
Use `--image` for local reference images; repeat it for multiple images. The
Skill uploads those files directly to Lingzao for the current request, so the
user does not need to upload them elsewhere first. Supported reference image
formats are png, jpeg, and webp.

#### Reference Image Handling

For Codex, WorkBuddy, and other agent runtimes:

- `--image` accepts local filesystem paths only. If the user provides a
  reference image through a chat attachment, pasted image, screenshot, or input
  box, first materialize that image as a local file before calling the CLI.
  Preserve the original supported image format when saving the file.
- Use a per-run temporary directory for runtime-provided images, for example
  `/tmp/lingzao-image-inputs/<run-id>/ref-1.png` and
  `/tmp/lingzao-image-inputs/<run-id>/ref-2.png`. Use absolute paths in the CLI
  call.
- If the user already provided a stable local path, such as a file under
  `/Users/...`, you may pass that path directly. If the runtime-provided image
  lives in a transient attachment/cache path, copy it into the per-run temp
  directory first.
- Do not proactively convert image formats. If the input image is already png,
  jpeg, or webp and its file size is reasonable, pass it as-is. Do not convert
  png to webp or jpeg just because an example path uses a different extension.
- Only when a reference image is larger than 2 MB, create a smaller copy in the
  temp directory and pass that copy with `--image`. Keep the file extension and
  actual image bytes consistent. If resizing or compression fails, use the
  original supported image file instead of trying another format.
- Do not overwrite the user's original image file. Do not store reference
  images in the repo. If the runtime cannot save an uploaded or pasted image to
  a local path, ask the user to save the image locally and provide the path.
- In the prompt, state what should be borrowed from the reference images, such
  as layout, color palette, product shape, character style, or composition. Do
  not say only "reference this image" when a more specific instruction is
  possible.

Example with a runtime-provided reference image:

```bash
mkdir -p /tmp/lingzao-image-inputs/run-001 /tmp/lingzao-image-outputs/run-001
~/.lingzao/bin/lingzao generate-image \
  --prompt "参考这张图的排版和明亮色彩，生成一张小红书封面图，主题是 AI 生图新手避坑，中文大标题留白" \
  --size 1024x1024 \
  --image /tmp/lingzao-image-inputs/run-001/ref-1.png \
  --output /tmp/lingzao-image-outputs/run-001/result.png
```

The command creates a Lingzao async batch and automatically polls the returned
status URL until the background job finishes or the command timeout is reached.
Image generation can take several minutes; `--timeout` can extend waiting for
large or slow batches, but does not shorten the built-in per-image polling
window. For one image, `--output` writes the result to the exact path you
provide. For `--count` greater than 1, `--output /tmp/poster.png` writes every
successful image as numbered files such as `/tmp/poster-1.png`,
`/tmp/poster-2.png`, and so on. Default Markdown output requires `--output` so
paid generated images are saved locally. Use `--format json` only when you need
structured item statuses or raw image payloads.

## Usage Notes

- For profile and post URLs, pass the URL directly when possible.
- For raw IDs, include `--platform`.
- Omit `--limit` unless the user asks for a specific count.
- Search notes default to comprehensive sorting, all note types, and all time; use `--sort`, `--note-type`, and `--time-filter` when the user asks for ranked or filtered note search.
- Use `--format json` only when another tool needs structured output.
- Default output is Markdown for agents to read and summarize.
- If the API key or account needs attention, ask the user to open the Lingzao dashboard.
