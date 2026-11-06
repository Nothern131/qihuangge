<script def>
{
  "navigationBarTitleText": "岐黄阁",
  "description": "私人养生助手：说一味药或食材查性味功效与禁忌，说两味查能不能一起用，也能问毒性、孕妇能不能吃、营养素。说「记一下我在吃钙片」会本机记住，以后查别的会主动提醒冲突；说「记一下早上八点吃二甲双胍」会记下用药时间。只查资料，不给用量、不开方、不辨证、不承诺疗效。",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "text": { "type": "string", "description": "用户这句话，例如「甘草海藻能不能一起吃」" }
      }
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

const LISTEN_TIMEOUT_MS = 12000;

export default {
  data: { ...INITIAL_STATE },

  onLoad() {
    this._rec = null;
    this._listening = false;
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
      this._view = createQihuangView({ engines: getEngines(), store });
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

    speak(GUIDE, { max: 42 });
  },

  onShow() {
    if (!this._listening && this._view) this.setData({ status: '按住镜腿说话' });
  },

  onHide() {
    this.stopListen();
  },

  onUnload() {
    this.stopListen();
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

  submit(text) {
    this._pending = '';
    this._listening = false;
    this.clearWatchdog();
    if (!this._view) return;
    this.apply(this._view.handle(text));
  },

  onSpeechError(event) {
    this._listening = false;
    this.clearWatchdog();
    this._pending = '';
    const code = (event && event.error) || '未知';
    console.error('[qihuang] 识别失败：', code, event && event.message);
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
