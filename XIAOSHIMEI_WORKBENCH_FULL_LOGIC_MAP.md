# 小师妹工作台：全量逻辑地图、问题挂点与修复备料

## 权威与发布传力链（2026-08-30）

```mermaid
flowchart LR
  L[本地功能分支\n可逆工作副本] --> G[GitHub PR\n源码唯一权威]
  G --> Q[quality workflow\n全测 + production build]
  Q --> V[Vercel Preview\n同一待发布制品]
  V --> D[桌面 / 360px / 编辑保存 / 导出\n现实验收]
  D --> M[合并 main]
  M --> P[Promote to Production\nxiaoshimei-full-workbench]
  P --> R[稳定域名回读\n资源版本 + 核心路径]
  R -.失败.-> B[上一份已验证 deployment\n即时回滚]
```

本地 `~/.mesy/runtime/packages/xiaoshimei-studio-v2/` 只承载工作状态、生成图片与 Provider 回执；它不授予源码或生产权威。详细操作、发布 ID 与回滚点只记录在 `deployment/PRODUCTION_RUNBOOK.md`，避免在逻辑地图里形成第二份发布台账。

```mermaid
flowchart TB
  %% =====================================================================
  %% 图例与总目标
  %% =====================================================================
  classDef surface fill:#FFF7ED,stroke:#C2410C,color:#431407,stroke-width:1px;
  classDef current fill:#F8FAFC,stroke:#64748B,color:#0F172A,stroke-width:1px;
  classDef issue fill:#FFF1F2,stroke:#E11D48,color:#4C0519,stroke-width:1px;
  classDef debt fill:#FEF2F2,stroke:#B91C1C,color:#450A0A,stroke-width:1px,stroke-dasharray:5 3;
  classDef target fill:#ECFDF5,stroke:#059669,color:#022C22,stroke-width:1.5px;
  classDef phase fill:#EFF6FF,stroke:#2563EB,color:#172554,stroke-width:1.5px;
  classDef evidence fill:#F5F3FF,stroke:#7C3AED,color:#2E1065,stroke-width:1px;
  classDef gate fill:#FFFBEB,stroke:#D97706,color:#451A03,stroke-width:1.5px;
  classDef stop fill:#F1F5F9,stroke:#475569,color:#0F172A,stroke-width:1px,stroke-dasharray:5 3;

  GOAL["总目标：让小师妹从选题到发布包形成一条可编辑、可解释、可验收的 3:4 小红书图文生产链<br/>手机上字够大、图文有呼吸、主体不被乱裁、导出与编辑所见一致"]:::surface
  RULE["总原则：语义与版式先决定插图角色和槽位比例，裁剪最后执行；<br/>一个页面真相、一个导出真相、每次交付必须打开真实发布包验收"]:::gate
  GOAL --> RULE

  %% =====================================================================
  %% A. 当前完整逻辑
  %% =====================================================================
    subgraph NOW["A｜当前工作台完整逻辑：Reality readback 2026-08-28"]
    direction TB

    subgraph SURF["A1｜用户表面"]
      direction LR
      N01["新创作"]:::surface
      N02["研究选题"]:::surface
      N03["资产库"]:::surface
      N04["账号档案"]:::surface
    end

    subgraph CREATE["A2｜新创作五步旅程"]
      direction LR
      C01["1 原文<br/>主题、素材、历史、要求"]:::current
      C02["2 文字<br/>生成草稿、人工确认"]:::current
      C03["3 配图<br/>页面规划、母版生成"]:::current
      C04["4 排版<br/>智能版式或精细画布"]:::current
      C05["5 发布包<br/>PNG、文案、JSON、manifest"]:::current
      C01 -->|text brief| C02 -->|confirmed draft| C03 -->|content package| C04 -->|page render| C05
    end

    subgraph TEXTGEN["A3｜文字与页面计划"]
      direction LR
      T01["本地 HTTP Provider<br/>/text-draft"]:::current
      T02["结构化草稿<br/>标题、正文、页面角色"]:::current
      T03{"人工确认文字？"}:::gate
      T04["Page Plan<br/>cover / content pages<br/>hero / support / detail"]:::current
      T01 --> T02 --> T03
      T03 -->|是，才允许调图| T04
      T03 -->|否| C02
    end

    subgraph IMAGEGEN["A4｜当前插图生产链"]
      direction LR
      I01["buildIllustrationUnits<br/>scene / action / detail / comparison"]:::current
      I02["母版1：上两行合并 9:8 KV + 底行 A/B/C<br/>母版2起：3×3 D–L，按需续页"]:::current
      I03["图像模型生成母版"]:::current
      I04["Sharp 按模板角色切片<br/>KV 1080×960；插图 1080×1440"]:::current
      I05["面板资产<br/>保留 role / aspect / presence / edge metadata"]:::current
      I01 --> I02 --> I03 --> I04 --> I05
    end

    subgraph PACKAGE["A5｜内容包与当前版式决策"]
      direction LR
      PAK01["Content Package<br/>pages + panels + image assets"]:::current
      PAK02["Page Plan + Design Program v1<br/>整组构思：composition / focal order / rhythm<br/>image edge/scale / title measure / whitespace"]:::current
      PAK03["design-program.mjs<br/>枚举与范围约束；semantic hero 优先<br/>旧稿确定性回退"]:::current
      PAK04["html_state v10<br/>设计程序 + 用户版式/取景/对象编辑<br/>同一可回载状态"]:::current
      PAK05["DOM / 像素几何评分<br/>overflow、重叠、比例、图片存在性"]:::current
      PAK01 --> PAK02 --> PAK03 --> PAK04 --> PAK05
    end

    subgraph DUAL["A6｜两套整页真相"]
      direction LR
      H01["HTML 智能版式<br/>cover-poster / editorial-notes<br/>visual-story / spatial-list"]:::current
      H02["DOM 文字可编辑<br/>Grid/Flex + container units"]:::current
      H03["HTML 图片取景<br/>focalX / focalY / zoom<br/>粗糙 72×72 边缘色检测"]:::current
      F01["Fabric 精细画布<br/>绝对坐标对象、拖动缩放"]:::current
      F02["独立状态与独立导出路径"]:::current
      PAK05 --> H01 --> H02 --> H03
      PAK05 --> F01 --> F02
    end

    subgraph CROPNOW["A7｜当前图片适配"]
      direction LR
      CR01["独立图片默认 cover"]:::current
      CR02["最小 110% scale"]:::current
      CR03["HTML 再做 -2% inset + 104% 尺寸 + zoom"]:::current
      CR04["同一张图被连续三次构图<br/>切母版 → 面板归一化 → 编辑器显示"]:::debt
      CR01 --> CR02 --> CR03 --> CR04
    end

    subgraph EXPORTNOW["A8｜导出、保存与反馈"]
      direction LR
      E01["HTML：html2canvas<br/>检查画布非空与图片区域"]:::current
      E02["Fabric：导出 PNG<br/>当前缺非空与图片区域检查"]:::debt
      E03["publish-package<br/>只验 PNG 签名与尺寸"]:::debt
      E04["JSZip：5 张 PNG<br/>发布文案、content、manifest"]:::current
      E05["localStorage 资产库"]:::current
      E06["24h / 72h / 7d Reality Feedback<br/>尚未反哺版式与裁剪 fitness"]:::debt
      E01 --> E03
      E02 --> E03
      E03 --> E04 --> E05 --> E06
    end

    subgraph OTHERFLOW["A9｜其他工作流"]
      direction LR
      R01["研究选题<br/>/api/jobs/research 轮询"]:::current
      R02["选中题目回填新创作"]:::current
      L01["资产库<br/>历史内容、发布包、反馈"]:::current
      A01["账号档案<br/>人设锁、Provider、Keychain"]:::current
      B01["Workspace<br/>备份、恢复、生成设置"]:::current
      R01 --> R02 --> C01
      E05 --> L01
      A01 --> C01
      B01 --> C01
    end

    N01 --> C01
    N02 --> R01
    N03 --> L01
    N04 --> A01
    C02 --> T01
    T04 --> I01
    I05 --> PAK01
    C04 --> H01
    C04 --> F01
    H03 --> CR01
    F02 --> CR01
    H03 --> E01
    F02 --> E02
    E04 --> C05
  end

  RULE --> N01

  %% =====================================================================
  %% B. 全量问题，逐条保留编号并挂到现状与修复域
  %% =====================================================================
  subgraph PROBLEMS["B｜全量问题清单：用户反馈 + 现场代码与发布包发现"]
    direction TB

    subgraph USERISSUES["B1｜用户明确反馈"]
      direction TB
      U01["U01 整体 UI、排版、字体不够精致｜挂点 A6｜修复 P4/P5"]:::issue
      U02["U02 竖屏插图像被强裁成横屏｜挂点 A4/A7｜修复 P2/P3"]:::issue
      U03["U03 图文太规矩、PPT 感、少灵动与人味｜挂点 A5/A6｜修复 P4"]:::issue
      U04["U04 图文太贴边、缺安全区和呼吸｜挂点 A5/A6｜修复 P4/P7"]:::issue
      U05["U05 图片白边；需要稳健去边，不是盲目放大｜挂点 A4/A7｜修复 P2/P3"]:::issue
      U06["U06 默认版式没有吃透 Desktop/ref｜挂点 A5/A6｜修复 P0/P4/P7"]:::issue
      U07["U07 改动看不出；不清楚旧稿是否需重新生成｜挂点 A6/状态持久化｜修复 P1/P5"]:::issue
      U08["U08 插图和文字偏小，不适合手机｜挂点 A6｜修复 P4/P7"]:::issue
      U09["U09 图应可移动可裁剪，文字可编辑｜挂点 A6/A7｜修复 P3/P5"]:::issue
      U10["U10 主体构图不协调，人物、手、动作、道具被切｜挂点 A4/A7｜修复 P2/P3"]:::issue
      U11["U11 HTML 智能排版会乱｜挂点 A5/A6｜修复 P4/P5"]:::issue
      U12["U12 页面底部多次溢出、截断或留大空洞｜挂点 A5/A6｜修复 P4/P7"]:::issue
      U13["U13 换个节奏每种都跑调｜挂点 A5/A6｜修复 P4/P5"]:::issue
      U14["U14 下载发布包曾出现整张空白｜挂点 A8｜修复 P6/P7"]:::issue
      U15["U15 交付前没有完整自检和 dogfood｜挂点 A8/全旅程｜修复 P0/P7"]:::issue
      U16["U16 总差点意思：缺主角、重点、节奏、图文语义配对｜挂点 A3/A5/A6｜修复 P1/P4"]:::issue
      U17["U17 常规修复仍反复索要审批，流程摩擦大｜挂点执行流程｜修复 P8"]:::issue
      U18["U18 图片裁剪与图文比例仍差｜挂点 A4/A5/A7｜修复 P2/P3/P4"]:::issue
      U19["U19 小红书模块未映射成 HTML 能力｜挂点 A6｜修复 P1/P4"]:::issue
      U20["U20 成品仍出现手机无意义小字｜挂点 A5/A6｜修复 P4/P7"]:::issue
      U21["U21 圆角矩形四角不对称且插图有灰边｜挂点 A6/A7/A8｜修复 P3/P4/P6"]:::issue
      U22["U22 内页圆角过重、交错图文未顺边对齐、裁剪入口不显眼｜挂点 A5-A7｜修复 P3/P4/P5"]:::issue
    end

    subgraph DISCOVERED["B2｜现场进一步发现"]
      direction TB
      D01["D01 HTML 与 Fabric 各自拥有整页状态和导出真相｜挂点 A6/A8｜修复 P1/P5/P6"]:::debt
      D02["D02 同图被母版切片、面板归一化、编辑器三次重构｜挂点 A4/A7｜修复 P1/P2/P3"]:::debt
      D03["D03 RESOLVED_LOCAL v13｜设计程序已加入整组视线顺序、节奏、图像份量、方向与留白｜挂点 A5｜待真实视觉签字"]:::gate
      D04["D04 固定百分比 frame + 字符数估高，不测真实 DOM｜挂点 A5｜修复 P4"]:::debt
      D05["D05 QA 不看视觉重量、主体完整、安全边距、留白节奏｜挂点 A5/A8｜修复 P4/P7"]:::debt
      D06["D06 全局 cover/overscan 混淆 hero、贴纸、细节、背景｜挂点 A7｜修复 P1/P3"]:::debt
      D07["D07 固定 3×3 且全格 3:4，无法服务多种目标槽位｜挂点 A4｜修复 P2"]:::debt
      D08["D08 固定 2% 内缩不识别真实网格线和背景｜挂点 A4｜修复 P2"]:::debt
      D09["D09 主体检测仅低分辨率颜色差，无脸、手、动作、道具｜挂点 A6/A7｜修复 P3"]:::debt
      D10["D10 缺统一 Asset IR：角色、alpha/subject/face/action/prop bbox、比例、fit、crop｜挂点 A4-A7｜修复 P1"]:::debt
      D11["D11 PARTIAL v13｜已有受约束 Design Program；Asset bbox 与现实反馈 fitness 仍缺｜挂点 A5/A6/A8｜继续 P3/P8"]:::gate
      D12["D12 测试重代码与几何，缺视觉金图、手机缩略、解压打开与按钮全旅程｜挂点 A8｜修复 P7"]:::debt
      D13["D13 Fabric 导出缺 blank/flat/image-region QA｜挂点 A8｜修复 P6"]:::debt
      D14["D14 旧 html/editor state 可保留旧版式，代码改了旧稿未迁移｜挂点 A6｜修复 P1/P5"]:::debt
      D15["D15 CSS 多层覆写、重复选择器、固定行高导致漂移｜挂点 A6｜修复 P4"]:::debt
      D16["D16 contentEditable 曾观察 React 崩溃风险，当前需回归复验｜挂点 A6｜修复 P5/P7"]:::debt
      D17["D17 缺页面 density budget 与溢出解算器｜挂点 A5/A6｜修复 P4"]:::debt
      D18["D18 没有明确先定槽位再裁剪，裁剪被用来补救坏比例｜挂点 A5/A7｜修复 P1/P3"]:::debt
      D19["D19 生成提示词没有输出可裁剪余量与结构化 bbox｜挂点 A3/A4｜修复 P2/P3"]:::debt
      D20["D20 Reality feedback 已有但未进入 layout/crop fitness｜挂点 A8｜修复 P8"]:::debt
      D21["D21 字号 Gate 只检查正文，漏掉眉题、提示、品牌与页码｜挂点 A5/A8｜修复 P4/P7"]:::debt
      D22["D22 旧 figure 样式残留非对称 radius/shadow，覆盖角色化媒体策略｜挂点 A6/A7｜修复 P3/P4"]:::debt
      D23["D23 母版按前 N 个几何格顺序绑定，空白格会被当成页面插图并使后续图错位｜挂点 A4｜修复 P2/P7"]:::debt
      D24["D24 Blob 链接被点击不等于 ZIP 已进入文件系统，曾产生下载假成功｜挂点 A8｜修复 P6/P7"]:::debt
      D25["D25 对象点击事件冒泡会清空选中态，使移动/缩放控件看似存在却不可用｜挂点 A6｜修复 P5/P7"]:::debt
      D26["D26 编辑视口未暴露封面文字与图片间距问题，真实导出 PNG 才看到贴撞｜挂点 A6/A8｜修复 P4/P7"]:::debt
      D27["D27 母版固定 3:4 与内页近方形槽位冲突，再叠加全局 116% overscan，白边与主体过大只能二选一｜挂点 A4/A5/A7｜修复 P1-P4"]:::debt
      D28["D28 取景能力藏在通用编辑手势里且缩放无产品上限，用户无法发现也无法稳定控制｜挂点 A6/A7｜修复 P3/P5/P7"]:::debt
    end

    ICROP["问题簇 CROP<br/>U02 U05 U10 U18<br/>D02 D06-D10 D18 D19"]:::issue
    ILAYOUT["问题簇 LAYOUT<br/>U01 U03 U04 U06 U08 U11-U13 U16 U19 U20<br/>D03-D05 D11 D15 D17 D21"]:::issue
    ISTATE["问题簇 STATE/EDITOR<br/>U07 U09<br/>D01 D14 D16"]:::issue
    IEXPORT["问题簇 EXPORT/QA<br/>U14 U15<br/>D12 D13"]:::issue
    IPROCESS["问题簇 PROCESS/LEARNING<br/>U17 D20"]:::issue

    U02 & U05 & U10 & U18 --> ICROP
    D02 & D06 & D07 & D08 & D09 & D10 & D18 & D19 --> ICROP
    U01 & U03 & U04 & U06 & U08 & U11 & U12 & U13 & U16 & U19 & U20 --> ILAYOUT
    D03 & D04 & D05 & D11 & D15 & D17 & D21 --> ILAYOUT
    U21 --> ICROP
    U21 --> ILAYOUT
    U22 --> ICROP
    U22 --> ILAYOUT
    U22 --> ISTATE
    D22 --> ICROP
    D22 --> ILAYOUT
    D23 --> ICROP
    D24 --> IEXPORT
    D25 --> ISTATE
    D26 --> ILAYOUT
    D26 --> IEXPORT
    D27 --> ICROP
    D27 --> ILAYOUT
    D28 --> ICROP
    D28 --> ISTATE
    U07 & U09 --> ISTATE
    D01 & D14 & D16 --> ISTATE
    U14 & U15 --> IEXPORT
    D12 & D13 --> IEXPORT
    U17 & D20 --> IPROCESS
  end

  I01 -.-> ICROP
  PAK02 -.-> ILAYOUT
  H01 -.-> ISTATE
  E03 -.-> IEXPORT
  E06 -.-> IPROCESS

  %% =====================================================================
  %% C. 目标架构：唯一推荐，但必须由原型和真实包证据转正
  %% =====================================================================
  subgraph TARGET["C｜唯一推荐目标：HTML_CANONICAL_HYBRID（待原型与真实发布包 Gate 转正）"]
    direction TB
    DEC0["Decision Evidence 当前结论<br/>BLOCKED · FULL_CONTRACT_REQUIRED<br/>因此这里只是唯一推荐假设，不是正式默认裁决"]:::gate

    subgraph CANON["C1｜一个规范数据真相"]
      direction LR
      IR01["Semantic Content IR<br/>Page → Header → Title → Lede → Sections → Highlight → Figure → Footer"]:::target
      IR02["Asset IR<br/>media_role · src · source_kind<br/>alpha/subject/face/action/prop bbox<br/>preferred_aspects · fit_policy · crop_candidates · manual_crop"]:::target
      IR03["Page Composition IR<br/>语义 block tree + density budget<br/>不把绝对 x/y 当页面真相"]:::target
      IR04["Versioned Migration<br/>旧稿显式 reapply/migrate，禁止静默沿用旧布局"]:::target
      IR01 --> IR03
      IR02 --> IR03
      IR03 --> IR04
    end

    subgraph ROLE["C2｜图片角色决定适配策略"]
      direction LR
      MR01["hero_scene<br/>允许 cover，但主体/动作安全"]:::target
      MR02["inline_sticker<br/>透明去边 + contain<br/>不强塞照片卡"]:::target
      MR03["evidence_detail<br/>保留手、道具、细节<br/>contain 或 fit-width"]:::target
      MR04["texture_background<br/>允许 cover"]:::target
      MR05["mother_tile<br/>先识别网格/背景去边<br/>再进入角色策略"]:::target
    end

    subgraph XHSHTML["C3｜小红书图文模块 → HTML 语义模块"]
      direction LR
      XM01["3:4 页面与安全区<br/>article.xhs-page"]:::target
      XM02["眉题/色条<br/>header + eyebrow"]:::target
      XM03["主标题<br/>h1"]:::target
      XM04["导语<br/>p.lede"]:::target
      XM05["每个核心观点<br/>section[data-role=step]"]:::target
      XM06["步骤标题 + 正文<br/>h2 + p"]:::target
      XM07["强调短语<br/>mark"]:::target
      XM08["角色化插图<br/>figure[data-media-role]"]:::target
      XM09["页脚/页码<br/>footer"]:::target
      XM10["装饰<br/>CSS background / pseudo-element<br/>不做成正文位图"]:::target
      XM01 --> XM02 --> XM03 --> XM04 --> XM05 --> XM06 --> XM07 --> XM08 --> XM09 --> XM10
    end

    subgraph ENGINE["C4｜扬长避短的渲染与编辑"]
      direction LR
      EN01["HTML 为整页 canonical renderer<br/>CSS Grid/Flex + container queries<br/>真实 DOM 测量与自然回流"]:::target
      EN02["文字先继续 DOM 编辑<br/>补 error boundary、undo、回归<br/>只有需求证据出现才上 Lexical"]:::target
      EN03["选中图片打开局部 crop overlay<br/>拖动、缩放、旋转<br/>百分比裁剪写回 Asset IR"]:::target
      EN04["Sharp 服务<br/>网格边界、alpha/背景 trim<br/>attention/entropy 仅产生候选"]:::target
      EN05["Fabric/Konva 降级为可选局部精修<br/>不能再拥有第二套整页真相"]:::target
      EN01 --> EN02
      EN01 --> EN03
      EN03 --> EN04
      EN01 --> EN05
    end

    subgraph EXPORTTARGET["C5｜一个导出真相"]
      direction LR
      EX01["等待 fonts.ready 与全部图片 ready"]:::target
      EX02["从 canonical DOM 导出<br/>先保留 html2canvas；对比 html-to-image"]:::target
      EX03["逐页检查非空、非纯色、文字区域、每个 figure 像素区"]:::target
      EX04["生成 ZIP 后自动解压检查<br/>再用 Finder/Preview 打开真实 PNG"]:::target
      EX05["编辑器、预览、发布包使用同一 content/layout/crop 状态"]:::target
      EX01 --> EX02 --> EX03 --> EX04 --> EX05
    end

    DEC0 --> IR01
    IR02 --> MR01 & MR02 & MR03 & MR04 & MR05
    IR03 --> XM01
    XM10 --> EN01
    MR01 & MR02 & MR03 & MR04 & MR05 --> EN03
    EN01 --> EX01
  end

  %% =====================================================================
  %% D. 备料后实施的唯一流程
  %% =====================================================================
  subgraph REPAIR["D｜从备料到现实闭环的修复流程"]
    direction LR
    P0["P0 冻结基线<br/>Desktop/ref 两张参考<br/>当前 5 页发布包与 content JSON<br/>桌面/窄屏截图、问题编号、旧编辑状态"]:::phase
    P1["P1 统一合同<br/>Content IR + Asset IR + Page Composition IR<br/>schema version + 非破坏迁移"]:::phase
    P2["P2 修母版切片<br/>吸收 huashu bbox/density/alpha 轮子<br/>Sharp 检测真实格线、背景、白边<br/>输出 tile metadata"]:::phase
    P3["P3 角色化构图<br/>media_role → slot ratio → crop candidate<br/>react-easy-crop 手动微调<br/>保存百分比 crop 与 undo"]:::phase
    P4["P4 HTML 语义排版<br/>模块库 + 编辑决策层<br/>真实 DOM 测量、手机字号、安全区、density/overflow solver<br/>内容过载时缩文、换版或拆页"]:::phase
    P5["P5 编辑器迁移<br/>HTML 成为整页主引擎<br/>Fabric 只留 legacy/局部精修<br/>旧稿显式迁移、文字编辑稳定性"]:::phase
    P6["P6 导出收口<br/>单一 DOM export<br/>字体/图片 ready、每页内容检查<br/>ZIP 解压与系统预览 readback"]:::phase
    P7["P7 全旅程验收<br/>单元 + visual golden + 360px 手机缩略<br/>所有按钮 dogfood、5 页发布包逐张打开<br/>与 Desktop/ref 做结构和节奏对照"]:::phase
    P8["P8 Reality 学习<br/>实际使用者接受后再看 24h/72h/7d<br/>把真实阅读/互动反馈回灌 layout/crop fitness<br/>重复 Episode 足够时才触发 gene-skill"]:::phase
    P0 --> P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8
  end

  ICROP --> P2
  ICROP --> P3
  ILAYOUT --> P4
  ISTATE --> P1
  ISTATE --> P5
  IEXPORT --> P6
  IEXPORT --> P7
  IPROCESS --> P8
  P1 --> IR01
  P2 --> MR05
  P3 --> EN03
  P4 --> EN01
  P5 --> EN05
  P6 --> EX01

  subgraph PRACTICE["D2｜2026-08-27 实践回灌：当前证据直接改写下一步"]
    direction TB
    EV01["R01 P3 PASS｜inline_sticker 右移 58.4%→62.4%，undo 回到 58.4%；zoom=1 保持 contain"]:::evidence
    EV02["R02 P4 PARTIAL｜第 3 页两种节奏均 720/720、无页脚碰撞；用户判定方向正确"]:::evidence
    EV03["R03 A12 FAIL｜第 3 页眉题 11.6px、页脚 10.7px；正文虽 20.3px，但小字 Gate 漏检"]:::stop
    EV04["R04 A13 FAIL｜第 1/5 页同构；第 2/4 页视觉重量失衡、图小空洞大，页面角色未充分分流"]:::stop
    EV05["R05 A10 FAIL｜现场 computed style：四角 radius 不等且 hero 残留 shadow；用户观察到灰边"]:::stop
    EV06["R06 A15 BLOCKED｜首次真实下载等待超时；不得声称发布包修复，须修后重跑 ZIP/PNG 实物验收"]:::stop
    EV07["R07 P4 PASS（本地）｜5 页按内容角色分流：hook 封面、judgment 主次、method 纵向三段、pitfall 双区、closing 图像叙事；均 720/720 且无告警"]:::evidence
    EV08["R08 A12 PASS（结构/运行时）｜导出字号下限约 48px，手机等效约 16px；删除微型品牌字，compact 不再突破正文下限"]:::evidence
    EV09["R09 A10 PARTIAL｜现场 computed style 四角统一 2.8cqw、shadow=none、背景透明；自适应去边测试 PASS；新 ZIP 实物边缘仍待验"]:::gate
    EV10["R10 A14 PASS（本地）｜图片焦点 58.4%→62.4%→undo 58.4%；文字编辑提交与 undo 回读，最终恢复原文"]:::evidence
    EV11["R11 P6 PASS（应用内）｜导出先后暴露第 2/3/4 页脚碰撞；逐项修正安全预算后，5 页像素 Gate 与 ZIP 组装进入 COMPLETE"]:::evidence
    EV12["R12 A15 PARTIAL｜浏览器未暴露 blob download 事件，文件系统未发现新 ZIP；旧 2026-08-25 发布包不能充当新证据"]:::gate
    EV13["R13 A17 PARTIAL｜已走版式切换、换构图、翻页、图像移动、文字编辑、undo、导出；破坏性删除未执行，窄屏与发布包实物闭环未全 PASS"]:::gate
    EV14["R14 P2/A15 PASS｜扫描母版全部 9 格并过滤背景格；真实有效槽位为 1,2,4,5,6,7,8，修复第 2 页空图与后续错位"]:::evidence
    EV15["R15 P6/A15 PASS｜下载改为本地 HTTP attachment + 服务端原子落盘；按钮现场生成新 ZIP，Desktop 实物可读"]:::evidence
    EV16["R16 P5/A14 PASS｜对象选择不再被冒泡清空；模块位移状态 0→2cqw，undo 回 0；文字与图片焦点编辑均可撤销"]:::evidence
    EV17["R17 P4/A13 PASS｜导出 PNG 暴露封面贴撞后修正 portrait 专用尺寸；实测文字到图片间距约 23.6px，无溢出告警"]:::evidence
    EV18["R18 P7 PASS（本地发布包）｜225/225 tests、build PASS、ZIP 六文件无 CRC 错误；3 张 PNG 均 1080×1440 并逐张目检"]:::evidence
    EV19["R19 A4/A7 PASS（现实重放）｜公网 API 不再给各页重复整张母版；2 张已付费母版经 Sharp 主体检测与有界去边切为 12 个独立 JPEG，页面回读 12 个不同 Hash，刷新后无存储告警"]:::evidence
    EV20["R20 production_applied PASS｜Vercel dpl_2Zrubh7bf4nALw4uoUQVjDEJurn3 READY，稳定别名已指向最终 CSS/API；窄屏圆角 computed style 为对称 14px"]:::evidence
    EV21["R21 A15/P7 PASS（公网渲染实物）｜235/235 tests、build PASS；生产页面回载后导出 5 页 ZIP，8 个文件 CRC 全 PASS，5 张 PNG 均 1080×1440，逐页 contact sheet 目检无九宫格/白边/空图"]:::evidence
    EV22["R22 D24 REMAINS｜应用内 Blob 按钮会进入“再次下载发布包”，但内置浏览器仍不能给出文件系统路径；本轮用同一生产 UI 的 headless Chromium download/saveAs 取得可回读 ZIP，按钮文案不得单独算落盘"]:::gate
    EV23["R23 provenance PASS｜最终 content.json 保留完整原始素材、真实生成正文、5 标签、5 页与 12 个独立图片源；ZIP Hash=8f5199b51adb78831e187eb04c81d5efe413e04c0b0b74bd4a5e02e0a460da14"]:::evidence
    EV24["R24 P7/A10-A17 PASS（本地完整 dogfood）｜先文字确认、后 2 次付费母版调用（¥0.44），10 插画单元组装 5 页；保存/刷新、360px、编辑/undo、复制、下载、ZIP 解包与逐页目检全走通；256/256 tests + build PASS"]:::evidence
    EV25["R25 当前正式版漂移｜本轮动态分隔线、完整边带清理、语义换行与复制回退仅在本地构建；既有 Vercel 部署未包含最新修复，production_applied 不得沿用旧 PASS"]:::gate
    EV26["R26 A10-A17 PASS_LOCAL｜新母版=9:8 KV + A/B/C，封面=1/3 标题 + 2/3 KV；参考橙落地；258/258 tests + build；桌面/360px 五页无 overflow/告警，改字/移动/undo/保存刷新回读通过；未付费生图、未部署"]:::evidence
    EV01 --> P5
    EV02 --> P4
    EV03 --> U20
    EV03 --> D21
    EV04 --> D03
    EV04 --> D05
    EV05 --> U21
    EV05 --> D22
    EV06 --> P6
    EV07 --> P4
    EV08 --> A12
    EV09 --> A10
    EV10 --> A14
    EV11 --> P6
    EV11 --> A15
    EV12 --> A15
    EV13 --> A17
    EV14 --> D23
    EV14 --> P2
    EV15 --> D24
    EV15 --> P6
    EV16 --> D25
    EV16 --> P5
    EV17 --> D26
    EV17 --> P4
    EV18 --> P7
    EV18 --> A15
    EV19 --> P2
    EV19 --> A10
    EV19 --> A11
    EV20 --> A10
    EV21 --> A15
    EV21 --> P7
    EV22 --> D24
    EV22 --> P6
    EV23 --> A15
    EV24 --> P7
    EV24 --> A10
    EV24 --> A11
    EV26 --> A10
    EV26 --> A11
    EV26 --> A13
    EV26 --> A14
    EV26 --> A16
    EV26 --> A17
    EV24 --> A12
    EV24 --> A13
    EV24 --> A14
    EV24 --> A15
    EV24 --> A16
    EV24 --> A17
    EV25 --> CT03
  end

  %% =====================================================================
  %% E. Skills、资料与轮子
  %% =====================================================================
  subgraph MATERIALS["E｜各环节 Skills、资料与可吸收轮子"]
    direction TB

    subgraph SKILLS["E1｜Skills 路由"]
      direction LR
      S01["architecture-compiler<br/>本图、Unit/Edge/Authority/Rollback"]:::evidence
      S02["decision-evidence<br/>默认架构候选与 FULL decision gate"]:::evidence
      S03["research-engineering<br/>官方资料、GitHub 轮子、反证"]:::evidence
      S04["design-experience + design-taste-frontend<br/>编辑判断、参考对照、桌面/窄屏审美验收"]:::evidence
      S05["engineering-systems<br/>schema、迁移、渲染、导出实现"]:::evidence
      S06["product-design:audit<br/>旅程、交互与可用性审计"]:::evidence
      S07["browser / agent-browser-verify<br/>按钮全旅程与截图"]:::evidence
      S08["computer-use<br/>Finder/Preview 打开真实 ZIP/PNG"]:::evidence
      S09["completion-truth<br/>五层完成真相"]:::evidence
      S10["skill-lifecycle-manager<br/>仅当外部轮子正式沉淀成 MeSy Skill 时交 mia-3<br/>普通代码依赖不冒充 Skill"]:::evidence
      S11["gene-skill<br/>仅在重复真实 Episode 形成证据后改规则"]:::evidence
      S12["aigc / imagegen<br/>角色化插图提示词与资产原型<br/>不负责最终文字排版"]:::evidence
    end

    subgraph LOCALWHEELS["E2｜本地轮子取舍"]
      direction LR
      W01["huashu-gpt-image-master<br/>吸收 extract_grid.py 的内容 bbox、密度扫描、透明紧裁<br/>改写为当前 JS/Sharp 合同"]:::evidence
      W02["img2046-main<br/>吸收 ReactCrop/Konva 的拖拽、对齐线、历史栈交互<br/>不照搬其疑似 percent/pixel 混用的裁剪实现"]:::evidence
      W03["小红书配图skill<br/>吸收封面/内页分类、一页一观点、手机可读、反 PPT QA<br/>不吸收禁止 HTML/CSS/canvas 与让模型直接画文字的生产方式"]:::evidence
      W04["Desktop/ref<br/>封面：大标题 + 大场景<br/>内页：纵向三段、重点高亮、插图贴合段落<br/>作为结构参考，不做像素级抄袭"]:::evidence
    end

    subgraph GITHUB["E3｜优先核验的成熟源代码与官方资料"]
      direction LR
      G01["react-easy-crop<br/>移动、缩放、旋转、pixel/percent crop、移动端"]:::evidence
      G02["Sharp resize/trim<br/>cover/contain、attention/entropy、边缘背景/alpha trim"]:::evidence
      G03["smartcrop.js<br/>edge/saturation/skin/boost 候选<br/>只做候选，不做唯一裁决"]:::evidence
      G04["MDN Container Queries<br/>让模块按自身容器回流"]:::evidence
      G05["html-to-image<br/>DOM → PNG/SVG 的对照导出候选"]:::evidence
      G06["Playwright screenshots/snapshots<br/>稳定环境中的元素截图与视觉回归"]:::evidence
      G07["react-konva<br/>局部自由对象精修，不做整页真相"]:::evidence
      G08["Lexical<br/>仅在文本编辑复杂度有证据时引入"]:::evidence
      G09["Apple Typography<br/>iOS 默认正文 17pt、最低 11pt<br/>工作台目标：1080 导出正文约 48–54px，手机等效 16–18px"]:::evidence
    end

    S01 --> P0
    S02 --> DEC0
    S03 --> P0
    S04 --> P4
    S05 --> P1
    S06 --> P7
    S07 --> P7
    S08 --> P6
    S09 --> P7
    S10 --> W01
    S11 --> P8
    S12 --> P2
    W01 --> P2
    W02 --> P3
    W03 --> P4
    W04 --> P0
    G01 --> P3
    G02 --> P2
    G03 --> P3
    G04 --> P4
    G05 --> P6
    G06 --> P7
    G07 --> P5
    G08 --> P5
    G09 --> P4
  end

  click G01 "https://github.com/ValentinH/react-easy-crop" "react-easy-crop"
  click G02 "https://sharp.pixelplumbing.com/api-resize/" "Sharp resize"
  click G03 "https://github.com/jwagner/smartcrop.js/" "smartcrop.js"
  click G04 "https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries" "MDN Container Queries"
  click G05 "https://github.com/bubkoo/html-to-image" "html-to-image"
  click G06 "https://playwright.dev/docs/test-snapshots" "Playwright visual snapshots"
  click G07 "https://github.com/konvajs/react-konva" "react-konva"
  click G08 "https://github.com/facebook/lexical" "Lexical"
  click G09 "https://developer.apple.com/design/human-interface-guidelines/typography" "Apple Typography"

  %% =====================================================================
  %% F. Acceptance、rollback、五层真相
  %% =====================================================================
  subgraph CLOSE["F｜验收、回滚与完成真相"]
    direction TB
    subgraph ACCEPT["F1｜必须同时满足的 Acceptance"]
      direction LR
      A10["A10 母版：首张=上方连续 9:8 KV + 底行 A/B/C<br/>后续=3×3 连续字母；无透明边、分隔线或邻格残片"]:::gate
      A11["A11 构图：封面上 1/3 标题、下 2/3 满宽贴底 KV<br/>正文插图 3:4；取景焦点 12–88%、缩放 100–180% 可保存"]:::gate
      A12["A12 手机：360px 预览正文等效 ≥16–17px<br/>标题、正文、图像层级清楚"]:::gate
      A13["A13 版式：无文字、图片、页脚溢出<br/>无无意的大块底部空洞<br/>每页只有一个明确视觉重点"]:::gate
      A14["A14 编辑：点图片立即出现‘裁剪 / 取景’，缩放有边界<br/>文字、模块移动、undo/redo 可用；旧稿迁移结果可解释"]:::gate
      A15["A15 导出：5 张 PNG 均非空、含预期图片区域<br/>ZIP 可解压，Finder/Preview 实际可打开"]:::gate
      A16["A16 参考：与 Desktop/ref 对照<br/>达到大字、纵向节奏、插图服务段落、非 PPT"]:::gate
      A17["A17 全旅程：每个按钮至少走一遍<br/>桌面与窄屏均现场截图验收"]:::gate
      A10 & A11 & A12 & A13 & A14 & A15 & A16 & A17 --> PASSALL{"全部 PASS？"}:::gate
    end

    subgraph ROLLBACK["F2｜Rollback"]
      direction LR
      RB01["feature flag：HTML_CANONICAL_HYBRID"]:::stop
      RB02["保留现有 content JSON 与旧 renderer 只读兼容"]:::stop
      RB03["迁移只新增 schema version，不破坏原稿"]:::stop
      RB04["任一关键验收 FAIL<br/>关闭 flag，回当前 dual mode<br/>保留失败快照与可复现实例"]:::stop
      RB01 --> RB02 --> RB03 --> RB04
    end

    subgraph TRUTH["F3｜Completion Truth 五层"]
      direction LR
      CT01["mechanism_ready<br/>PASS：9:8 KV/3:4 插图角色化切片、智能布局、自由编辑与像素导出 Gate 已实现"]:::target
      CT02["package_verified<br/>PASS（当前本地 5 页实物包）：256/256 tests、Vite build、ZIP 8 文件 CRC、5 张 1080×1440 PNG 逐图目检<br/>ZIP sha256 a89e54808e8c4ad9cec96147a1b92d44e18b49c2f59c52c51cbcf69acec8b062"]:::target
      CT03["production_applied<br/>NOT RUN（最新修复）：既有 dpl_CunmG5zG5kq6CLtVJzaDjjLsQ5aN 不含本轮动态分隔线、边带清理、语义换行与复制回退；需单独 Human Gate 后部署回读"]:::gate
      CT04["runtime_operational<br/>PASS_LOCAL：真实 Provider 在文字确认后完成 2 次付费母版调用（¥0.44），保存/刷新、编辑、360px 与最终 ZIP 均现场回读"]:::target
      CT05["reality_validated<br/>PASS_LOCAL_DOGFOOD：本地真实旅程与发布包可用；外部平台发布、24h/72h/7d 读者效果与最终审美签字未执行"]:::gate
      CT01 --> CT02 --> CT03 --> CT04 --> CT05
    end

    PASSALL -->|是| P8
    PASSALL -->|否| RB04
  end

  P7 --> A10
  DEC0 -.->|必须由 P0-P7 的真实证据解除| PASSALL
```
