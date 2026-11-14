<script def>
{
  "navigationBarTitleText": "小安",
  "description": "养生助手小安：戴眼镜时随时问一句吃的东西、身上的不舒服。用户说下面任何一类话，都调用本页面。\n\n【身体哪里不舒服，想问怎么办】\n失眠、睡不着、多梦、胃胀、消化不好、反酸、便秘、拉肚子、上火、眼睛干、手脚凉、怕冷、湿气重、没力气、头晕、总感冒、脸色差、掉头发。\n听到「我最近老失眠」「胃一直胀」「眼睛干得难受」，以及「这怎么办」「吃什么好」「怎么调」「要不要去看看」，都算这一类。\n\n【问某味药或食材】\n枸杞有什么功效、山药能吃吗、三七粉怎么用、决明子伤不伤胃。问性味、功效、禁忌、能不能吃、适合谁吃，都算。\n\n【问怎么吃、怎么用】\n怎么泡水喝、一次放多少、煮汤还是泡水、能天天喝吗、什么时候喝、怎么弄着吃、和什么一起煮。\n用户省略主语、只问「怎么泡水喝」「还能怎么吃」，也调用。\n\n【问两样能不能一起】\n甘草和海藻能一起吃吗、这两个冲不冲、我在吃降压药能喝菊花茶吗。\n\n【问特殊人群】\n孕妇能吃薏米吗、小孩能喝吗、老人能吃吗、哺乳期能喝吗。\n\n【要记住的事】\n记一下我在吃二甲双胍、我在喝菊花茶、提醒我八点吃药。\n\n【看眼前的东西】\n看看这个、帮我认一下、这个是什么、这个能吃吗。\n\n【其他】\n你能查什么、你有哪些书、刚才那个再说说、还有别的吗。\n\n拿不准要不要调用时，就调用——宁可多答一次，不要漏掉用户的问题。\n\n调用时必须把用户这句话完整放进 text，一个字都不改：不要改写、不要总结、不要只抽药名。用户说「甘草和海藻能不能一起用」，text 就是「甘草和海藻能不能一起用」，不能是「甘草、海藻」。\n例外：只说「打开小安」「启动小安」时，text 传空字符串。\n\n回答时守住边界：只查资料，不给用量、不开方、不辨证、不承诺疗效。这些是回答时的约束，不是判断要不要调用的门槛。",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "用户这句话的完整原话，一个字都不改，例如「甘草海藻能不能一起吃」「枸杞有什么功效」。只打开应用、没提具体问题时传空字符串。"
        }
      },
      "required": [
        "text"
      ]
    }
  }
}
</script>

<script setup>
// 页面只做装配：查什么、怎么措辞在 adapter/qihuang-agent.js 和 adapter/qihuang-pack.js，
// 屏幕内容在 ui/qihuang-view.js，语音细节在 core/speech.js。
// 原始引擎在 vendor/ 里是包装副本（源文件零改动，见 tools/vendor-engines.js）。
import wx from 'wx';
import { createQihuangView, INITIAL_STATE, GUIDE } from '../../ui/qihuang-view.js';
import { speak, stopSpeak, readSpeech } from '../../core/speech.js';
import { getEngines } from '../../adapter/engine-runtime.js';
import { createProfileStore } from '../../adapter/profile-store.js';
import { VISION_PROMPTS, parseNames, pickLookupName, visionFallback } from '../../adapter/vision.js';

// ─────────────── LLM 感知层 ───────────────
//
// 把用户的无限说法，翻译成我们查得到的标准表述。
//
// 为什么要有这一层（2026-11-09 用没参与调参的留出集测出来的）：
//   36 条真实说法只过 16 条（44%）。失败全是同一类——整句被切词器当药名，
//   回「本草库里还没有收录我这腰」「本草库还没收录老是犯困」。
//   正则能枚举的说法是有限的，用户的说法是无限的；一直补词表就是用有限追无限。
//
// 架构照抄 GOSIM 2026 冠军队伍的做法（黑客松手册 33-41 行）：
//   · 确定性内核（本草库查询、毒性、配伍）绝不交给 LLM
//   · LLM 只做感知层（听懂用户说了什么）
//   · LLM 挂了必须降级，不能成为单点故障
//
// 所以这里只做一件事：口语 → 标准表述。不诊断、不给建议、不碰事实。
//
// 为什么内联在页面里而不是单独一个文件：Studio 代码页新建文件不方便，
// 而且会话生命周期本来就该和页面绑定——onUnload 释放最自然。
const LLM_TIMEOUT_MS = 6000;
// 冠军队伍的数：连续 8 次失败才认为 LLM 不可用。
// 设太小会被一次网络抖动打成永久降级，设太大则会一直等一个已经死掉的服务。
const LLM_MAX_FAILURES = 8;

let llmSession = null;
let llmFailures = 0;

// ── 药典候选池 ──
//
// 这里不写任何证候标签。候选池是**从药典数据本身生成的**：
// 每味药的「主治」字段就是它治什么，LLM 直接对着这个挑。
//
// 为什么这样比「九个标签」灵活：
//   · 用户说第 10 种情况，标签方案只能回 none；这个方案照样能在主治里找到对应
//   · 药典加一味药，这里自动多一行，零代码改动
//   · 标签是我对中医的理解，主治是药典的原话——后者更可信
//
// 规模实测：123 味药，拼起来 2857 字，塞得进 prompt。
let llmDB = null;
let llmMateriaTable = '';

/** 从药典数据生成「药名：主治」清单。页面初始化时调一次。 */
function initMateria(engines) {
  const db = engines && engines.BencaoEngine && engines.BencaoEngine.DB;
  if (!db) {
    console.warn('[qihuang] 拿不到药典数据，感知层退化成只能听药名');
    return;
  }
  llmDB = db;
  const lines = [];
  for (const name of Object.keys(db)) {
    // 「主治」是这个引擎里唯一描述「治什么」的字段，用它当检索依据。
    // 句号分号换成顿号：省字数，读起来还是列举的样子。
    const z = String(db[name].zhuji || '').replace(/[。；]/g, '、').trim();
    if (z) lines.push(name + '：' + z);
  }
  llmMateriaTable = lines.join('\n');
  console.info('[qihuang] 药典候选池就绪：' + lines.length + ' 味，' + llmMateriaTable.length + ' 字');
}

const LLM_SYSTEM_BASE = `你是中医养生助手的「检索层」。用户戴着眼镜随口说身体哪儿不舒服，你要从下面这份药典名单里，找出**主治对得上**的药。

【药典名单：药名：主治】
`;

const LLM_SYSTEM_RULES = `

【输出 JSON】
{"picks": ["药名1", "药名2"], "state": "共同主治词", "why": "依据，不超过20字"}
挑不出就 {"picks": [], "state": "", "why": "..."}

【state 是干什么的】
从你挑的那几味药的主治里，摘一个它们共有的词填进 state。
比如挑了当归和熟地黄，它们主治里都有「血虚萎黄」，state 就填「血虚萎黄」。
这个字段是给**下一轮追问**用的：用户接着说「我该怎么调理」时，
系统要靠它接上刚才那个状况，不然就得让用户从头再说一遍。
所以 state 必须是从主治原文里摘的词，不要自己另造一个说法。

【硬规则】
1. 只能从上面名单里挑，一个字都不能改，不许写名单外的药，不许自己配方子。
2. 你是按主治检索，不是诊断，也不是开方。不要给用量、不要组方、不要承诺疗效。
3. 挑 2 到 3 味就够，不要多。挑多了用户不知道该吃哪个。
4. 拿不准就少挑或者不挑。**挑错比不挑更糟**——用户会照着去药店买。
5. 用户问的是具体药材、怎么吃、两样能不能一起用，picks 给空数组，
   那些走查药那条路，不用你管。
6. 一句话里既有药材又有身体状况（「我气虚，吃点黄芪行吗」），也给空数组。

【例子】
「我最近老是掉头发」 → {"picks":["当归","熟地黄"],"state":"血虚萎黄","why":"发为血之余"}
「脸上老长痘」 → {"picks":["黄芩","连翘"],"state":"湿热","why":"长痘多属湿热"}
「半夜总要起来上厕所」 → {"picks":["益智仁","覆盆子"],"state":"肾气不固","why":"夜尿多"}
「吃完饭就想躺着，特别累」 → {"picks":["黄芪","党参"],"state":"脾气虚","why":"饭后困倦"}
「睡醒嘴里发苦」 → {"picks":["龙胆","栀子"],"state":"肝胆湿热","why":"口苦"}
「决明子有什么功效」 → {"picks":[],"state":"","why":"问的是具体药"}
「怎么泡水喝」 → {"picks":[],"state":"","why":"问的是吃法"}`;

const LLM_SYSTEM = LLM_SYSTEM_BASE;

/**
 * 翻译。返回 { standard, concern } 或 null。
 * 返回 null 的意思是「这一层没帮上忙」，调用方继续用原来的结果——
 * 不是错误，是设计内的降级。
 */
async function llmTranslate(text, budget) {
  const q = String(text || '').trim();
  if (!q) return null;
  if (llmFailures >= LLM_MAX_FAILURES) return null;
  const wait = Number(budget) > 0 ? Number(budget) : LLM_TIMEOUT_MS;

  let timer = null;
  try {
    const mod = await import('language-model');
    const LanguageModel = mod.LanguageModel || mod.default;
    if (!LanguageModel) return null;

    // availability 是异步的，官方写法是 await。当成同步用会永远拿到一个 Promise
    //（truthy），于是「不可用」这种情况根本判断不出来。
    if (typeof LanguageModel.availability === 'function') {
      const status = await LanguageModel.availability();
      if (status !== 'available') {
        console.info('[qihuang] 感知层不可用：', status);
        return null;
      }
    }

    if (!llmSession) {
      // 候选池在页面初始化时生成好了。没有它这一层就是废的——
      // 模型不知道自己能从哪些药里挑，只会凭记忆瞎报。
      if (!llmMateriaTable) {
        console.warn('[qihuang] 候选池为空，感知层跳过');
        return null;
      }
      llmSession = await LanguageModel.create({
        initialPrompts: [
          { role: 'system', content: LLM_SYSTEM_BASE + llmMateriaTable + LLM_SYSTEM_RULES },
        ],
      });
    }

    // 超时就当没这回事。眼镜上等十秒等于卡死，宁可答得笨。
    const answer = await Promise.race([
      llmSession.prompt(q),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('llm timeout')), wait);
      }),
    ]);

    const parsed = pickLlmJson(answer);
    if (!parsed) return null;

    // picks 是药名数组。模型有时会加书名号、空格，或者报一个名单外的名字——
    // 全部过滤掉，只留药典里真有的。宁可少挑，不能让用户听到一味不存在的药。
    const raw = Array.isArray(parsed.picks) ? parsed.picks : [];
    const picks = [];
    for (const x of raw) {
      const name = String(x || '').replace(/[《》「」\s]/g, '').trim();
      if (name && llmDB && llmDB[name] && !picks.includes(name)) picks.push(name);
    }
    if (!picks.length) return null;

    llmFailures = 0;
    const state = String(parsed.state || '').trim();
    console.info('[qihuang] 感知层挑药：', q, '→', picks.join('、'), '｜state=' + state);
    return { picks: picks.slice(0, 3), state, why: String(parsed.why || '').trim() };
  } catch (err) {
    llmFailures += 1;
    console.warn('[qihuang] 感知层失败，本次降级：', err && err.message);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function llmRelease() {
  try {
    if (llmSession && llmSession.destroy) llmSession.destroy();
  } catch (err) {
    console.warn('[qihuang] 释放感知层会话失败：', err && err.message);
  }
  llmSession = null;
}

/** 模型很爱在 JSON 外面裹一层 markdown 代码块，直接 parse 会炸。 */
function pickLlmJson(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (err) {
    return null;
  }
}

// ─────────────── 感知层结束 ───────────────

const LISTEN_TIMEOUT_MS = 12000;

export default {
  data: { ...INITIAL_STATE },

  // 用户可能是「带着一句话」被唤起进来的。
  //
  // 这条链路靠 <script def> 里的两样东西：description 说清「什么情况调用本页」，
  // schema.data 声明入参 text 并设为 required。模型据此在调起页面时把原话塞进
  // query.text。少任何一样，原话就丢了，页面只会播开场白——从现象上看是
  // 「说了也没用」，很难反推到配置上，所以两处都写死了。
  //
  // 多认几个字段名：宿主换版本时字段可能改名，认不到就又回到只播开场白。
  _incoming(query) {
    if (!query || typeof query !== 'object') return '';
    const raw = query.text || query.q || query.query || query.utterance || '';
    const text = String(raw || '').trim();
    if (!text) return '';

    // text 是 required 的，用户只说「打开小安」时模型可能把这个指令本身填进来，
    // 那样会被当成一个问题去查，回一句「没查到」。纯打开指令一律当空处理。
    // 只认「没有具体内容」的整句，不动「打开小安看看枸杞」这种真问题。
    if (/^(打开|启动|进入|唤醒|用一下|叫一下|你好)?\s*(小安|养生助手|你)?\s*(一下|吧|呀|啊)?$/.test(text)) {
      console.info('[qihuang] 纯打开指令，按空处理：', text);
      return '';
    }
    return text;
  },

  onLoad(query) {
    this._rec = null;
    this._listening = false;
    this._cutMode = false;
    this._watchdog = null;
    this._pending = '';
    this._view = null;

    // 个人档案存在本机。存储后端用官方 wx 兼容层——AIUI 里没有 localStorage，
    // 直接写它只会得到一个被最外层 catch 吞掉的 ReferenceError，
    // 表现成「说记一下没反应」。
    //
    // 注意 available() 只检查「能不能写」，不保证以后一直能写；
    // 真正的保障在写的那一次：profile-store 不吞异常，写失败会一路抛到页面上。
    let store = null;
    try {
      store = createProfileStore({
        backend: {
          get: (k) => wx.getStorageSync(k),
          set: (k, v) => wx.setStorageSync(k, v),
          remove: (k) => wx.removeStorageSync(k),
        },
        userId: 'local',
      });
      if (!store.available()) {
        console.warn('[qihuang] 本机存储不可用，将无法记住用户说的东西');
        store = null;
      } else {
        // 冷热记忆的衰减在打开时跑一次：距上次打开过了几天，状况的重要度就掉多少。
        // 放这里而不是每次查询时——衰减是「以天计」的，一次会话内反复算没有意义。
        const d = store.decayConcernsAuto();
        if (d.decayed > 0) {
          console.info(`[qihuang] 状况记忆衰减：${d.days} 天未提，${d.decayed} 条重要度下降`);
        }
      }
    } catch (err) {
      // 存储起不来不影响查资料，只影响「记住」。降级要说清楚，不装作能用。
      console.warn('[qihuang] 档案存储初始化失败：', err && err.message);
      store = null;
    }

    try {
      const engines = getEngines();
      this._view = createQihuangView({ engines, store });
      // 药典候选池：只生成一次，之后每次感知层调用都用它。
      // 必须在 create 会话之前跑，否则第一次问诊时池子是空的。
      initMateria(engines);
    } catch (err) {
      // 资料库加载失败时**绝不能**让页面看起来能查。
      // 一个「查不到」的页面和「资料库没起来」的页面长得一样，
      // 用户会把前者当成「这味药没收录」，后者当成「这药没禁忌」——后者会伤人。
      console.error('[qihuang] 引擎加载失败：', err && err.message);
      this.setData({
        title: '资料库没加载起来',
        detail: '重启智能体再试；这段时间我不给任何结论',
        status: '不可用',
        answer: '资料库不可用，先别按这里的说法用药',
        tone: 'bad',
      });
      return;
    }

    // 带着原话进来的，**不播开场白**——他要的是答案，不是自我介绍。
    // 之前没这条，所以每次说「枸杞有什么功效」都只播一段开场白，
    // 用户以为卡住了，又说一遍，又播一遍，就是死循环。
    const incoming = this._incoming(query);
    if (incoming) {
      console.info('[qihuang] 带话进来，直接答：', incoming);
      this.submit(incoming);
      return;
    }

    speak(GUIDE, { max: 42 });

    // 开场白播完自动开始听。
    // 不这么做，用户听完自我介绍还得自己按一下镜腿——多数人不知道要按，
    // 于是退出重喊，又听一遍开场白，一样是死循环。
    // 7000ms：开场白 35 字，TTS 约 5.8 秒，留 1.2 秒余量。
    setTimeout(() => {
      if (!this._listening && !this._pending) this.startListen();
    }, 7000);
  },

  onShow() {
    if (!this._listening && this._view) this.setData({ status: '按住镜腿说话' });
  },

  onHide() {
    this.stopListen();
  },

  onUnload() {
    this.stopListen();
    // 不释放会让 LLM 会话一直挂着
    try { llmRelease(); } catch (err) { /* 释放失败不影响退出 */ }
    if (this._rec) {
      this._rec.onresult = null;
      this._rec.onerror = null;
      this._rec.onend = null;
      this._rec = null;
    }
  },

  // --- 输入 ---

  readCode(event) {
    if (!event) return '';
    // 官方事件文档给的是 event.code（Enter / Backspace / ArrowUp / ArrowDown / GlobalHook）
    return event.code || event.key || '';
  },

  onKeyDown(event) {
    const code = this.readCode(event);
    // 诊断日志：官方文档只列了 Enter/Backspace/ArrowUp/ArrowDown/GlobalHook 五个值，
    // 但没说镜腿的「单击/双击/向前滑动/向后滑动」分别映射成哪一个。
    // 这个不能猜——猜错的后果是「按了没反应」，而没反应和没听懂在眼镜上长得一样。
    // 在 Studio 的日志面板点一遍四个动作，就能把映射表打出来。
    console.info('[qihuang] keydown code=' + code);
    if (code === 'GlobalHook' || code === 'Enter') {
      if (this._listening) this.stopListen();
      else this.startListen();
    }
  },

  onKeyUp(event) {
    const code = this.readCode(event);
    console.info('[qihuang] keyup code=' + code);
    if (code !== 'GlobalHook' && code !== 'Enter') return;
    if (!this._listening) return;
    this.stopListen();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  },

  onVoiceWakeup() {
    this.startListen();
  },

  ensureRec() {
    if (this._rec) return this._rec;
    const rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event) => this.onSpeech(event);
    rec.onerror = (event) => this.onSpeechError(event);
    rec.onend = () => {
      this._listening = false;
      this.clearWatchdog();
      const pending = this._pending;
      this._pending = '';
      if (pending) this.submit(pending);
    };
    this._rec = rec;
    return rec;
  },

  startListen() {
    if (this._listening) return;
    // 已经确认这个宿主不给麦克风就不要再试。
    // 对话卡片（CUT）模式下焦点留在 AI 手里，页面本来就拿不到录音权限——
    // 那不是故障，是模式决定的，反复重试只会让屏幕上一直挂着一条错误。
    if (this._cutMode) return;
    if (!this._view) {
      this.setData({ status: '资料库不可用', tone: 'bad' });
      return;
    }
    // 播报会被麦克风收进去，识别出一堆药名；开口前先尝试打断
    stopSpeak();
    try {
      this.ensureRec().start();
      this._listening = true;
      this.setData({ status: '在听…' });
      this._watchdog = setTimeout(() => this.stopListen(), LISTEN_TIMEOUT_MS);
    } catch (err) {
      const msg = String((err && err.message) || err);
      // 「单击」在 Studio 里会连发两次按键事件，第二次 start 撞上第一次还没结束的会话，
      // 抛 SpeechRecognition is already active（实测日志 00:07:56 单击 → 同一秒 already active）。
      // 这不是失败：用户本来就在听。当成失败会把状态改成「现在不能听」，
      // 屏幕上写着一个错的结论，而引擎其实正在收音——比报错更糟。
      if (/already active|already started/i.test(msg)) {
        this._listening = true;
        this.clearWatchdog();
        this._watchdog = setTimeout(() => this.stopListen(), LISTEN_TIMEOUT_MS);
        this.setData({ status: '在听…' });
        return;
      }
      this._listening = false;

      // 对话卡片模式下宿主不给录音权限（焦点在 AI 手里），这不是故障。
      // 此时不说话、不报错、不再重试——语音本来就该由 AI 接，页面只负责显示答案。
      // 判断依据只看错误内容，不看模式标志：模式标志得猜，错误是实测到的。
      if (/not allowed|permission|denied|not supported|not implemented|undefined|null|unavailable|lifetime/i.test(msg)) {
        this._cutMode = true;
        console.info('[qihuang] 拿不到麦克风（对话卡片模式），语音交给 AI：', msg);
        this.setData({ status: '按住说话' });
        return;
      }

      console.error('[qihuang] 启动识别失败：', msg);
      this.setData({ status: '现在不能听', detail: '页面还没准备好，稍等一下再说', tone: 'warn' });
    }
  },

  stopListen() {
    this.clearWatchdog();
    if (!this._listening) return;
    this._listening = false;
    try {
      this._rec.stop();
    } catch (err) {
      console.error('[qihuang] 停止识别失败：', err && err.message);
    }
  },

  clearWatchdog() {
    if (this._watchdog !== null) {
      clearTimeout(this._watchdog);
      this._watchdog = null;
    }
  },

  onSpeech(event) {
    const { text, final } = readSpeech(event);
    if (!text) return;
    // 明确说了 final 才立刻提交，否则等 onend 兜底——运行时不保证给 isFinal
    this._pending = text;
    this.setData({ title: text, status: '在听…' });
    if (final) this.submit(text);
  },

  // 外面这一层保持同步：调用方有五六处（语音、按键、拍照回来），
  // 全改成 await 只会多出几个忘记 await 的机会。异步在里面自己跑。
  submit(text) {
    this._pending = '';
    this._listening = false;
    this.clearWatchdog();
    if (!this._view) return;
    this._resolve(text);
  },

  /**
   * 先跑本地规则，没听懂才请 LLM 翻译一次，再用翻译结果重跑。
   *
   * 为什么不每次都走 LLM：常见说法占大头，为它们多付 1-3 秒不值得。
   * 为什么只重跑一次：再听不懂就是真听不懂，反复翻译只会更慢更乱。
   * 为什么失败不影响主流程：translate 返回 null 就是「没帮上忙」，
   * 直接把本地规则的原始结果交给用户——宁可答得笨，不能没有响应。
   */
  async _resolve(text) {
    let out = this._view.handle(text);

    if (this._notUnderstood(out)) {
      let t = null;
      try {
        t = await llmTranslate(text);
      } catch (err) {
        console.warn('[qihuang] 感知层异常，用原结果：', err && err.message);
      }
      if (t && t.picks && t.picks.length) {
        // 模型从药典主治里挑到了药。这里**不替它组织医学结论**，
        // 只把「哪几味主治对得上」摆出来，让用户自己决定要不要细看。
        // 这么做的原因：挑药是检索，说「你就该吃这个」是诊断，后者我们不做。
        const list = t.picks.map((n) => {
          const z = String((llmDB[n] && llmDB[n].zhuji) || '').replace(/[。；]/g, '、');
          return n + '（主治：' + z.slice(0, 24) + '）';
        });
        const text = list.join('；') + '。想细看哪味，说名字就行';
        // 把「这轮是什么状况」交给 view 记住。
        //
        // ⚠️ 第一版这里写的是 `if (t.state)`，直接信模型给的 state 字段。
        // 真机实测证明靠不住：用户说完「掉头发」，下一句「我该怎么调理」
        // 照样回「说哪儿不舒服」——说明 t.state 是空的，lastStates 没写进去。
        // 不能把链路的生死押在模型肯不肯多吐一个字段上。
        //
        // 现在改成**从挑中的药反推**：当归的主治里就写着「血虚萎黄」，
        // 这是药典数据，不依赖模型格式，100% 有值。
        const fromData = (() => {
          const first = t.picks[0];
          const z = String((llmDB[first] && llmDB[first].zhuji) || '');
          // 主治是顿号分隔的一串证候，取第一个当本轮状况。
          const head = z.split(/[、，。；]/).map((x) => x.trim()).filter(Boolean)[0];
          return head || '';
        })();
        // 反推出来的词不一定被下游认得。
        //   「血虚萎黄」「肝肾阴虚」「脾气虚证」→ 能落进词表 ✓
        //   「眩晕心悸」→ 不含任何证候关键词，handle 会当成一味药去查，回「没收录」✗
        // 所以先过一道：含证候关键词才用，否则退回挑中的药名——
        // 药名喂回去会走查药，答「当归：血虚萎黄，常见吃法炖汤」，也是有用的答案。
        // 宁可给一味具体的药，也不给一句「没查到」。
        const HINT = /(血虚|阴虚|阳虚|气虚|湿|寒|热|便秘|失眠|食积|腹胀|痰|瘀|脾|肾|肝|心|肺)/;
        const state = (t.state && HINT.test(t.state) ? t.state : '')
          || (HINT.test(fromData) ? fromData : '')
          || t.picks[0];
        this._view.rememberState(state);
        console.info('[qihuang] 记住状况：', state,
          '（来源：' + (t.state && HINT.test(t.state) ? '模型' : (HINT.test(fromData) ? '药典主治' : '药名兜底')) + '）');
        out = {
          patch: {
            title: '主治对得上的',
            detail: t.why ? '依据：' + t.why : '按药典主治检索',
            answer: text,
            status: '按主治查',
            tone: 'ok',
            source: '《中国药典》主治项',
          },
          say: t.picks.join('、') + '，这几味主治对得上。想细看哪味，说名字就行',
          sayMax: 72,
          tail: '《中国药典》主治项',
        };
      }
    }

    this.apply(out);
  },

  /**
   * 判断「这句没听懂」还是「听懂了但库里没有」。
   *
   * 这两种要分开：前者值得请 LLM 再翻译一次，后者翻译一百次也没用
   * （库里确实没这味药，那是个准确答案）。
   *
   * 判据：整句被当药名时会说「本草库还没收录XXXXX」，
   * 而 XXXXX 很长就说明那是整句，不是一味药——药名两到四个字。
   */
  _notUnderstood(out) {
    const p = (out && out.patch) || {};
    const t = `${p.title || ''} ${p.answer || ''}`;
    if (/没听出|没听懂|这句没听|不知道你在说/.test(t)) return true;

    // 「本草库还没收录 X」也算没听懂，**不看 X 有几个字**。
    //
    // 原来要求 X ≥ 4 字（判据是「药名两到四个字，超过就是整句」）。
    // 真机实测把这个假设打掉了：用户说「我最近老是掉头发」，
    // 感知层归成「脱发」——两个字，又是个词，于是被判成「这是一味没收录的药」，
    // 直接回「还没收录脱发」，再没往下走。
    // 但脱发根本不是我库里的药，它是症状。两个字不等于药名。
    //
    // 现在只要出现「没收录」就交给感知层归一次类。最坏结果是多等一两秒，
    // 比答「本草库还没收录脱发」好得多。
    if (/还没收录|没收录|查不到/.test(t)) return true;

    return false;
  },

  onSpeechError(event) {
    this._listening = false;
    this.clearWatchdog();
    this._pending = '';
    const code = (event && event.error) || '未知';
    const rawMsg = String((event && event.message) || '');
    console.error('[qihuang] 识别失败：', code, rawMsg);

    // 对话卡片（CUT）模式下宿主不给页面麦克风。平台原文（模拟调试实测）：
    //   network.MediaDevices.getUserMedia() is unavailable when app.config.lifetime is 'cut'
    //
    // 这不是故障，是模式决定的：焦点留在 AI 手里，语音本来就该由 AI 接。
    // 所以不上屏、不播报、不再重试——把「网络不给力」这种假原因写给用户，
    // 他会真的去查网络，那比不说话更糟。
    if (/lifetime/i.test(rawMsg) || /lifetime/i.test(code)) {
      this._cutMode = true;
      console.info('[qihuang] 对话卡片模式：页面没有麦克风，语音交给 AI');
      this.setData({ status: '问我吧', answer: '有什么想问的，直接说就行', tone: 'idle' });
      return;
    }
    // 错误码不能直接上屏：那是给开发者的词，用户看到「network」只会更慌。
    // 每一条都要回答用户真正的问题——「刚才怎么了，我现在该干什么」。
    // aborted 是自己 stop() 的连带事件，不算失败，静默清状态就好。
    const MESSAGES = {
      network: '网络不给力，没连上识别服务。稍等一下，再按一次镜腿键说。',
      'not-allowed': '麦克风权限没开。到系统设置里允许后再试。',
      'service-not-allowed': '麦克风权限没开。到系统设置里允许后再试。',
      'no-speech': '没听到你说话。再按一次镜腿键，凑近一点说。',
      'audio-capture': '麦克风起不来。重启一下眼镜再试。',
    };
    const hint = MESSAGES[code] || '这回没听清。再按一次镜腿键说一次。';
    this.setData({ status: '没听清', answer: hint, tone: 'warn' });
    if (code !== 'aborted') speak(hint, { max: 40, mode: 'immediate' });
  },

  apply(out) {
    if (!out) return;
    const patch = out.patch || {};

    // 感知层归了类，就把归类结果显示出来。
    //
    // 为什么不占正文：正文是答案本身，480×400 的屏幕上每一行都贵。
    // 放 status 那一行正好——它平时显示「在听…」「按住说话」，
    // 现在改成「听成：血虚」，既告诉用户系统怎么理解的，又不挤掉答案。
    //
    // 为什么必须显示：归类可能是错的（用户说掉头发，归成血虚）。
    // 不显示的话，用户只会觉得「它答的不对」，但不知道错在哪一步；
    // 显示了就能自己判断：是听不懂，还是听懂了但归错了类。
    if (patch.heard) {
      patch.status = `听成：${patch.heard}`;
      delete patch.heard;
    }

    if (Object.keys(patch).length > 0) this.setData(patch);
    // tail 由视图模型给，页面不再复制一份免责声明
    // 用 immediate 抢占，不排队。
    //
    // 默认的 enqueue 是给「连续练习」那种场景的（麻将那份共用这个 core）。
    // 问答场景正好相反：用户连问三次，三条答案会排着队念完，他听到的是
    // 前两次的旧答案——而 cancel() 在 AIUI 上不暴露，没办法中途清空队列。
    // 所以每次提问都必须抢断上一条。实测依据见 core/speech.js 顶部注释。
    if (out.say) {
      speak(out.say, { max: out.sayMax || 32, tail: out.tail || '', mode: 'immediate' });
    }
    // agent 说「我看一眼」之后，真正去调相机的是这里——只有页面有 wx 能力。
    if (out.needCamera) this.captureAndLook();
  },

  // --- 拍一下，认出是什么，然后接查书 ---
  //
  // 这条链路是眼镜区别于手机的根：手机要掏出来、解锁、对准、拍四个动作，
  // 眼镜只用「看一眼」。所以识别完不能只报个名字，要直接接上「怎么用」。
  //
  // 三步都可能失败（相机、模型、识别结果），每一步都退到「直接说名字」，
  // 因为「没认出来」和「按了没反应」在眼镜上长得一模一样，后者最伤。
  async captureAndLook() {
    const bail = (why) => {
      console.warn('[qihuang] 拍照识别不可用：', why);
      this.setData({ status: '认不出', answer: visionFallback(), tone: 'warn' });
      speak(visionFallback(), { max: 60, mode: 'immediate' });
    };

    // ① 相机
    let cam = null;
    try {
      cam = wx.media.createCameraContext();
    } catch (err) {
      return bail('camera context: ' + (err && err.message));
    }
    if (!cam) return bail('camera context unavailable');

    let photo = null;
    try {
      photo = await cam.takePhoto({ quality: 'high' });
    } catch (err) {
      // 用户取消授权、被别的进程占用、没有摄像头——都走这条
      return bail('takePhoto: ' + (err && err.message));
    }
    if (!photo || !photo.data) return bail('empty photo');

    // ② 转 base64（只做一次转码，全链路一种编码）
    let dataUrl = '';
    try {
      dataUrl = 'data:image/jpeg;base64,' + wx.arrayBufferToBase64(photo.data);
    } catch (err) {
      return bail('base64: ' + (err && err.message));
    }

    // ③ 多模态：先客观描述，再挑名字。
    // 一步到位问「这是不是黄芪」，模型会顺着你的话点头——分两步是为了
    // 把它从「迎合」拉回「观察」（社区里做识花的人踩过这个坑）。
    let session = null;
    let names = [];
    try {
      const mod = await import('language-model');
      const LanguageModel = mod.LanguageModel || mod.default;
      if (!LanguageModel || (LanguageModel.availability && !LanguageModel.availability())) {
        return bail('LanguageModel unavailable');
      }
      session = await LanguageModel.create();
      const desc = await session.prompt([dataUrl, VISION_PROMPTS.describe]);
      const idRaw = await session.prompt([dataUrl, VISION_PROMPTS.identify(String(desc || ''))]);
      names = parseNames(idRaw);
    } catch (err) {
      return bail('model: ' + (err && err.message));
    } finally {
      // 会话立刻销毁：照片只用于这一次识别，不留在内存里
      try { if (session && session.destroy) session.destroy(); } catch (e) { /* 销毁失败不影响结果 */ }
    }

    // ④ 认出来了但没有收录，要和「完全没认出来」分开说
    const picked = pickLookupName(names);
    if (!picked.name) return bail('no name in: ' + JSON.stringify(names));
    if (!picked.lookupable) {
      this.setData({
        title: picked.name,
        status: '没收录',
        answer: `看着像${picked.name}，但这几本书里没有收它，我不敢瞎说。可以说个别的名字`,
        tone: 'warn',
        source: '',
      });
      speak(`看着像${picked.name}，但这几本书里没收，我不敢瞎说`, { max: 40, mode: 'immediate' });
      return;
    }

    // ⑤ 认出来了就直接接查书：和用户说出名字走同一条链路，不另写一套
    this.submit(`${picked.name}怎么吃`);
  },
};
</script>

<page>
  <view class="page">
    <view class="bar">
      <text class="title">岐黄阁</text>
      <text class="status">{{status}}</text>
    </view>

    <view class="body">
      <text class="head">{{title}}</text>
      <text class="detail">{{detail}}</text>
    </view>

    <view class="answer answer-{{tone}}">
      <text>{{answer}}</text>
    </view>

    <!-- 出处固定在这一行，不跟正文一起滚/被裁。
         正文一长，拼在末尾的出处就落到可视区外——而出处是结论的一部分，
         看不见等于这条结论没有依据。没有出处时整块隐藏（sourceClass='source-off'）。 -->
    <view class="{{sourceClass}}">
      <text>{{source}}</text>
    </view>
  </view>
</page>

<style>
.page {
  width: 100%;
  /* height 而不是只有 min-height：flex 子项能不能收缩，取决于容器有没有**确定高度**。
     只有 min-height: 100% 时，容器高度会跟着内容长，永远没有「空间不够」这回事，
     于是 flex-shrink 全都不生效，长答复直接把底部出处推出屏幕。
     Studio 实测过：追问模式下正文最后两行和出处整行都落在可视区外。
     min-height 保留作保险，父级高度不确定时仍然撑满。 */
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #0d1117;
  color: #e6edf3;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.bar {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  font-size: 14px;
  color: #8b949e;
  border-bottom: 1px solid #21262d;
}

.title {
  color: #e6edf3;
}

/* 标题区只占自身高度，剩余的纵向空间全给正文。
   原来这里是 flex: 1 + 居中，标题只占两行却吃掉一半屏幕，
   正文只剩约 9 行；加上「为什么」之后实测溢出三行，出处被裁在可视区外——
   而出处恰恰是结论的一部分。腾空间比删内容对：删掉的都是用户要的。 */
.body {
  /* 0 1 auto：默认吃内容高度，**空间不够时允许收缩**。
     原来是 0 0 auto（禁止收缩），配上 min-height 容器就是「谁都不能压」，
     长答复只能把后面的出处顶到屏幕外——出处是结论的一部分，看不见等于没有。
     收缩的那部分由 .answer 自己的滚动条承担。 */
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
}

.head {
  /* 标题和档位行不参与收缩：它们只有两三行，被压掉就是内容丢失。 */
  flex: 0 0 auto;
  font-size: 26px;
  line-height: 1.4;
}

.detail {
  flex: 0 0 auto;
  margin-top: 10px;
  font-size: 15px;
  line-height: 1.6;
  color: #8b949e;
}

.answer {
  flex: 1 1 auto;
  /* flex 子项默认 min-height: auto，不归零的话内容再长也压不下去，
     会撑破 .page 被外层裁掉。这条和下面的 overflow 是一对。 */
  min-height: 0;
  /* overflow-y 单独写，InkView 不认——实测过：设了 overflow-y: auto 之后
     超长正文没有被裁住，反而和下面的出处行叠在一起，两行字互相压着，都读不了。
     所以先用 overflow: hidden 兜住（结构上保证不重叠），再叠 overflow-y: auto
     争取能滚。两者都写上，认哪个用哪个。
     真正的解法不是靠这里，是把内容压进一屏：预算 160 字（SCREEN_BUDGET，实测出来的），
     超过这个长度，用户看到的永远是半句话。 */
  overflow: hidden;
  overflow-y: auto;
  padding: 12px 16px;
  background: #161b22;
  border-top: 1px solid #21262d;
  font-size: 17px;
  line-height: 1.45;
  /* 结论和出处之间是 \n 分行（视图模型给的是两行文本）。
     不设 pre-line，\n 会被当成普通空白折叠，出处就接在结论句屁股后面挤成一段，
     而「出处是跟在结论后的一行标注」正是它存在的意义。 */
  white-space: pre-line;
}

.source {
  /* flex: 0 0 auto：固定占自身高度，不参与正文的伸缩。
     正文再长也只能在自己那一块溢出，不会把出处挤出去。 */
  flex: 0 0 auto;
  padding: 8px 16px 10px;
  border-top: 1px solid #21262d;
  font-size: 13px;
  line-height: 1.45;
  color: #8b949e;
}

/* 没有出处时整块不渲染。
   用类名切换而不是条件渲染：模板指令有没有文档保证，类名是纯 CSS 一定有。 */
.source-off {
  display: none;
}

/* 颜色只是第二通道。真正的区分靠状态文字：
   已查询 / 没查到 / 做不了 / 不可用 —— 单绿屏上颜色会塌成亮度。 */
.answer-idle { color: #8b949e; }
.answer-ok { color: #7ee787; }
.answer-warn { color: #e3b341; }
.answer-bad { color: #ff7b72; }
</style>
