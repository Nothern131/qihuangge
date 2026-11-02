# 岐黄阁 · AIUI 适配层（上架版）

## 铁律：只加不改

`aiui/` 是**唯一允许写入的目录**。`static/js/engines/` 下的 10 个原始引擎，
一个字都不改，也不复制一份出来改。

**为什么这条这么重要**：原始引擎是唯一事实来源。一旦复制出来改，网页版和眼镜版
会慢慢算出不同结果，以后修 bug 要修两处，而且没人知道哪份是对的。

**怎么做到不改**：`adapter/load-engines.mjs` 用 `vm` 沙箱把原始 `.js` 文件
原样读进来执行。引擎本来写的 `(function(global){...})(typeof global!=='undefined'?global:window)`，
只要给沙箱一个指向自己的 `global`，它就把 `global.XxxEngine` 挂到沙箱上——
既不碰原始文件，也不污染运行环境。

**证明**：`node tests/smoke.mjs` 最后一条用 `git status --porcelain -- static/`
断言输出为空。不是我说没改，是 git 说没改。

## 上架版只做什么（合规边界）

| 做 | 不做 | 为什么 |
|---|---|---|
| 配伍禁忌速查（十八反/十九畏/妊娠禁忌/毒性） | ❌ 辨证 | 辨证=诊断，属医疗行为 |
| 本草条目查询（性味/功效/用量/忌服） | ❌ 开方（方剂） | 开方=给处方，属医疗行为 |
| 营养素速查 | ❌ 出诊断报告 | 报告必然给结论 |
| | ❌ 大师医案 | 内容量大且属诊疗 |

`manifest.json` 里把这几个引擎排除在外，并且在 `qihuang-pack.mjs` 里
显式拒绝 `bianzheng` / `fangji` / `diagnose` / `prescribe` 四个动作——
两道防线，不是靠自觉。

**每条结论后标注出处，并且不挂免责话术**：标注走播报尾巴（tail），由播报层
强制保留，压长度也不会被截掉；测试里逐条断言「有出处」且「无免责话术」，漏一条就红。

标注只有一种形态：`出处：《儒门事亲》十八反歌诀`，**独立成行，紧跟在结论句之后**。
位置不能挪到上方（页面是 title → detail → answer，塞进 detail 就成了「先看出处、
后看结论」，Studio 实测过），也不能靠拼进 speech 末尾（播报会被截断）。
`.answer` 必须设 `white-space: pre-line`，否则 `\n` 被折叠，出处接在结论句屁股后面——
页面不报错、不白屏，只有看屏幕才发现，`platform.js` 里有一条专门守这个。

不写「这条出自…」这种替用户解释的句子，也不在开场白里预告「每条都会告诉你出处」——
后者是使用说明，用户开屏要的是能查什么，不是系统怎么实现。
命中与未命中也分两种说法：有结论才叫「出处」，没结论叫「按…核对」。
混用会让「没查到」听起来像「查到了」，而这是这类应用最不能出的错。

为什么不用免责话术：那句话对用户没信息量，听三遍就是噪音；更糟的是它把「引书」
和「给建议」混成一件事——引书能核对，建议不能。出处表在 `adapter/sources.js`，
单一来源，改口径只改一处。

## 一个必须诚实交代的现状

**医疗健康类内容在应用商店属于高敏感类目。** 即使只做「资料查询」，也可能被要求
提供资质或补充说明。这是上架前必须问平台的事，不是代码能解决的。
`Rokid-问题尽调清单.md` 里「医疗类内容审核口径」那条仍然是未关闭的阻塞项。

## 目录

```
aiui/                        ← AIUI 工程根，打包成 .aix 只收这个目录
├── app.json                 AIUI 应用配置（pages / permissions / window）
├── app.js                   入口，export default（不能写 App({...})）
├── AGENTS.md                本文件
├── .aixignore               不打进包的开发目录
├── manifest.json            引擎加载清单（含「哪些引擎不纳入」及原因），只服务 Node 侧
├── adapter/
│   ├── load-engines.js      vm 沙箱加载原始引擎（Node 测试用，零改动）
│   ├── engine-runtime.js    设备侧引擎加载（走 vendor/ 包装副本）
│   ├── herb-lexicon.js      药材切词 + 营养素识别（词表取自引擎公开字段，不新增医理知识）
│   ├── profile-store.js     个人档案存储（按人隔离；写失败必须抛，不许静默）
│   ├── sources.js           出处表（十八反/十九畏/药典/现代营养学，单一来源）
│   ├── qihuang-agent.js     听懂层：意图分流 / 三分档 / 自检 / 养生边界 / 记住与主动提醒
│   └── qihuang-pack.js      技能包：只调用，不实现业务逻辑
├── core/
│   ├── pipeline.js          七站流水线骨架（与麻将那份逐字节一致）
│   └── speech.js            播报出口（压长度 / 强制保留出处 / ASR 事件解析）
├── ui/
│   └── qihuang-view.js      视图模型（纯函数：patch + say，无 DOM）
├── pages/
│   └── index/index.ink      页面：script def + script setup + page + style
├── vendor/                  ★ 生成的产物（源文件零改动，见 tools/）
│   ├── engines.js           六个引擎的包装 + 汇总入口
│   └── ancient-texts.js     110 条经典原文（内嵌，带源哈希）
├── tools/
│   ├── vendor-engines.js    生成器：把 static/ 里的 IIFE 包成 ES 模块
│   └── vendor-data.js       生成器：把 static/data 的 JSON 内嵌成 ES 模块
└── tests/
    ├── smoke.js             63 条断言，含「原始文件零改动」的 git 断言
    ├── agent.js             73 条：听懂层（含营养素、搭配、经典原文、养生边界、出处自检）
    ├── view.js              30 条：视图模型 + 播报出处不被裁（无假 DOM）
    ├── memo.js              13 条：记住 / 主动提醒 / 存不上必须说没记上
    ├── profile-store.js     18 条：档案读写、按人隔离、写失败必抛
    ├── vendor-parity.js     29 条：包装副本与原始引擎一致 + 经典数据未漂移
    ├── parity.js            1 条：core/pipeline.js 与麻将那份是否一致
    └── platform.js          27 条：AIUI 平台合规（结构 / 权限 / 绑定 / 清理）
```

### 为什么有 vendor/

原始引擎在 `aiui/` 外面的 `static/` 里，打包成 `.aix` 收不到；而它们是 IIFE，
不会自己 `export`。`tools/vendor-engines.js` 生成包装：原源码逐字放进函数体，
给一个局部对象当 `global`，再把挂上去的 `XxxEngine` 导出来。

**原始文件一个字节没改**，由 `vendor-parity.js` 两件事证明：比 sha256（源文件没变）、
比查询结果（包装没改变行为，8 个真实问法 + 12 个引擎方法逐字段相同）。
改引擎后必须重跑 `node tools/vendor-engines.js`，否则设备上还是旧数据——
这种漂移不报错，只在 `vendor-parity.js` 里会红。

## 动作清单

| 动作 | 用途 | 谁调 |
|---|---|---|
| `ask` | **自然语言入口**，自动分流到下面五个之一 | 页面只调这一个 |
| `check` | 配伍禁忌（十八反 / 十九畏 / 妊娠 / 毒性） | `ask` 分流 / 直接调 |
| `pregnancy` | 单味或多味的妊娠禁忌 | `ask` 分流 / 直接调 |
| `safety` | 「X 能不能吃」：妊娠 + 毒性合并回答 | `ask` 分流 / 直接调 |
| `toxicity` | 毒性分级 | `ask` 分流 / 直接调 |
| `herb` | 本草条目（性味 / 功效 / 用量 / 忌服） | `ask` 默认档 |
| `vitamin` | 营养素速查 | `ask` 分流 |

分流规则（`INTENT` 表）按顺序匹配，顺序不能随便改：
**配伍 → 妊娠 → 「能不能吃」 → 毒性 → 营养素 → 默认本草**。
另外有一条兜底：一句话里识别出 ≥2 味药，一律按配伍处理——
「甘草、海藻、甘遂」如果走本草条目，只会答第一味甘草的性味功效，
十八反埋在「忌服」字段里，用户很可能没听完就走了。

## 已接通的引擎（实测）

| 引擎 | 用到的方法 | 用途 |
|---|---|---|
| InteractionEngine | `check` / `checkPregnancy` / `getToxicity` | 配伍禁忌、妊娠禁忌、毒性分级 |
| BencaoEngine | `search` / `query` | 本草条目（性味、归经、功效、用量、忌服） |
| VitaminEngine | `getAllVitamins` / `getVitaminDetail` | 营养素速查 |

加载了但本版未接动作：`TizhiEngine`（体质辨识，边界偏诊断，先不开放）、
`SymptomEngine`（需存储与隐私设计，二期）。

## 两个踩过的坑

### 坑一：单味药的妊娠禁忌 `check()` 给不出来

`InteractionEngine.check()` 返回的 `pregnancy` 字段在**单味药**时是空的——
妊娠禁忌必须单独调 `checkPregnancy()`。只用 `check()` 会漏掉「桃仁」这类，
而妊娠禁忌恰恰是这个功能最不能漏的一项。已在 `qihuang-pack.mjs` 里两路合并去重。

### 坑二：把「没听懂」说成「没问题」是医疗场景最危险的假阴性

用户在眼镜上说「甘草海藻能不能一起吃」，语音识别不会带「和」。
老版本按标点和连词切词，只能切出一个整体「甘草海藻能不能一起吃」，
拿去查禁忌当然查不到——然后播报「没有查到十八反、十九畏或妊娠禁忌」。

用户听到的是「可以一起吃」。**这是把一个查询失败包装成了安全结论。**

两道修正，缺一不可：

1. `herb-lexicon.mjs`：用药名表做最长匹配切词，词表来自 `InteractionEngine`
   自己暴露的 `ANTI_GROUP1/2/3`、`FEAR_PAIRS`、`PREGNANCY_Toxic/Mild`（共 62 味）。
2. `qihuang-pack.mjs` 的 `findUnrecognized`：查禁忌前先确认「这些到底是不是药名」
   （词表命中 或 `BencaoEngine.search` 有结果）。全都认不出 → 说「没听出药名」；
   部分认不出 → 结论只说认出来的药，并单独念出没查到的那味。

对应测试：`smoke.mjs` 的【8】【9】两组。

### 坑三：`getToxicity()` 对任何未知输入都返回「无毒」

引擎的实现是「遍历毒性表，没命中就 `return '无毒'`」。直接透传的后果：

```
getToxicity('★☆※') → '无毒'   → 播报「★☆※在药典里标注为无毒」
getToxicity('三七')  → '无毒'   → 播报「三七在药典里标注为无毒」（实际库外）
```

**把「查不到」说成了「安全」，而且发生在最不能出错的毒性问答上。**
修法是在适配层先过一道 `isKnownHerb()`（禁忌词表命中 或 `BencaoEngine.search` 有结果），
过不了就直说「本草库还没收录，查不到毒性记录」。对应测试【12】。

### 坑四：同一味药两条相反的妊娠结论

引擎把「桃仁」同时放进了 `PREGNANCY_Toxic` 和 `PREGNANCY_Mild`，
`checkPregnancy()` 就吐出「妊娠禁忌（禁用）」和「妊娠慎用」两条。
直接念给用户，用户只会记住后面那个「慎用」，而实际更严。
适配层用 `collapseByHerb()` 按 `strong > moderate > mild` 收敛成一条。对应测试【13】。

### 坑五：查不到记录 ≠ 可以用

`pregnancy` 查到 0 条时，如果只说「未查到」，会被听成「孕妇可以吃」。
所有「没查到」的分支都强制带一句「没记录不等于可以吃」，并且给出这次是拿什么核对过的。
这不是措辞偏好，是这类应用最低的错误容忍度。对应测试【13】最后一条。

### 已知数据问题（未修，不属于适配层职责）

引擎的十九畏表写的是 `["人参","赤石脂"]`，而传统十九畏是「人参畏五灵脂、官桂畏石脂」。
这是原始引擎的**数据**问题，不是代码问题。适配层不改写引擎的医理数据——
改数据需要出处，凭空改会变成「我以为我知道」。如果要修，应在 `static/` 里
连同出处在网页版一起改，让两个版本始终一致。

## 测试

```bash
node tests/smoke.js          # 63 条：适配层 + 合规边界 + 零改动证明 + 切词/假阴性 + 意图分流 + 每条带出处
node tests/agent.js          # 73 条：听懂层（三分档 + 危险结论一致性 + 营养素 + 搭配 + 原文 + 拒答边界 + 出处自检）
node tests/memo.js           # 13 条：记住常吃的东西、下次主动提醒、存不上要说没记上
node tests/profile-store.js  # 18 条：档案读写、按人隔离、写失败必抛、怪数据不崩
node tests/view.js           # 31 条：视图模型 + 播报出处 + 结论后标出处 + 引擎缺失要报错
node tests/vendor-parity.js  # 29 条：包装副本与原始引擎一致 + 经典数据未漂移
node tests/parity.js         # 1 条：core/pipeline.js 与麻将那份一致
node tests/platform.js       # 28 条：AIUI 平台合规（含 .answer 必须有 pre-line）
```

## AIUI Studio 实测结果（2026-11-03）

已经跑过的，都有截图/日志：

| 项 | 结果 |
|---|---|
| `.ink` 四块结构 | ✅ 装得上，四块都被识别 |
| 路由 `pages/index/index.ink` | ✅ 下拉框能选中页面 |
| `vendor/` 的 ESM 包装在 Ink 运行时 import | ✅ 引擎加载成功（失败会直接报「资料库没加载起来」） |
| `setData` 渲染中文/长文本 | ✅ 正常，字体不缺失 |
| 镜腿「单击」 | `keydown` + `keyup` 同一刻，`code=Enter` |
| 镜腿「向后滑动」 | `code=ArrowDown` |
| `answer` 里的 `\n` | ❌ 被折叠成空白，必须给 `.answer` 加 `white-space: pre-line` |
| 麦克风（`getUserMedia`） | ❌ Studio Web 版拿不到，报 `network Failed to open browser media stream` |

两个待解决的推论：

1. **镜腿键是 `Enter`，不是 `GlobalHook`。** 官方文档把两个都列为合法值，但实际下发的
   是 `Enter`。页面已经两个都认，不用改。
2. **「按住说话」在 Studio 里测不了。** 因为 `keydown` 和 `keyup` 在同一刻到达，
   等于按了就放；真机是不是分开发，这里验不出来。
   风险：若真机只发 `keydown` 不发 `keyup`，页面会一直听到 12 秒 watchdog 超时。
   这条必须上真机才能定，不能靠模拟器下结论。

`SpeechRecognition` 的 `result` 事件形状仍未验证（麦克风打不开，ASR 链路根本没跑起来）。
这条要从真机日志拿，不能猜。

## 听懂层（adapter/qihuang-agent.mjs）

页面不再直接 `pack.invoke('ask')`，中间隔一层流水线：
`清洗 → 认药名 → 意图/置信 → 执行 → 自检 → 话术`。

加这一层的理由不是「更聪明」，是原来**没有地方能说「这个我不答」**。
`invoke` 一进去就开查，剂量和开方拦不住。现在这两类走 `stop` 档，直接拒绝并说明原因。

两处容易改坏的地方：

- **`core/pipeline.mjs` 是副本**。原件在 `E:\hackathons\rokid-agent\aiui\js\core\pipeline.mjs`，
  改原件后必须整份复制过来，否则 `tests/parity.mjs` 会红。
- **自检规则要跟「出错代价」对齐**。中药这边查的是「话和数据对不对得上」
  （有风险却说放心、查不到却说不出查不到），不是麻将那种数值一致性。
  加规则前先问：这条能防住哪种真实误导？



## 记忆与存储（V1 的核心差异，不要当成可选功能）

产品定位是「越用越懂你」，落地全靠 `adapter/profile-store.js`：

- **后端注入**：AIUI 上是官方的 `wx.setStorageSync / getStorageSync`（页面里构造），
  Node 测试里是 `memoryBackend()`。同一套逻辑，不需要伪造 wx。
- **按人隔离**：key 里带 userId。同一副眼镜给两个人用，互相看不到对方的记录。
- **写失败必须抛**。官方文档写明 storage 不可用时同步方法直接 throw。
  捕获掉当成「这次没存上」继续跑，用户会以为记下了——三个月后才发现什么都没有。
  所以 `rememberItem` 不吞异常，一路抛到页面的 `onError`，答复是「这次没记上（原因）」。
- **只有一处允许吞**：`pushHistory`。它失败不影响用户这一次问的问题。

「下次主动提醒」在 `qihuang-agent.js` 的 `decorate(ctx)` 里，由 `core/pipeline.js`
在 answer 档之后调用。三条克制规则：

1. 用户记着 A、问的是 B，**且库里真有 A 与 B 的记录**才说；
2. 药材侧只说「可以查配伍」，**不替用户下结论**（只认出一味就断言不能同用是没有依据的）；
3. 没有数据就不说。为了显得聪明硬凑一句，比不说更糟。

改 `static/data/ancient_texts.json` 后必须重跑 `node tools/vendor-data.js`，
否则设备上还是旧数据——`vendor-parity.js` 用 sha256 守着这种漂移。

**经典原文只给真正讲这味药的 5 条**（神农本草经：五味子/人参/牡丹皮/桔梗/当归）。
其余 105 条是方论（「桂枝汤主之」），虽然提到了某味药，但讲的是方不是药。
把它们贴在药性下面会让用户以为古人是这么论述的——给错出处比不给更糟。
