<script def>
{
  "navigationBarTitleText": "岐黄阁",
  "description": "随身养生助手：说一味药查性味功效与禁忌，说两味药查能不能一起用，也能问毒性、孕妇能不能用、营养素。说「记一下我在吃钙片」会本机记住，以后查别的会主动提醒冲突。只查资料，不给用量、不开方、不辨证。",
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
    this.setData({ status: '没听清', answer: '（识别失败：' + code + '）', tone: 'warn' });
  },

  apply(out) {
    if (!out) return;
    const patch = out.patch || {};
    if (Object.keys(patch).length > 0) this.setData(patch);
    // tail 由视图模型给，页面不再复制一份免责声明
    if (out.say) speak(out.say, { max: out.sayMax || 32, tail: out.tail || '' });
  },
};
</script>

<page>
  <view class="page">
    <view class="bar">
      <text class="title">本草速查</text>
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
