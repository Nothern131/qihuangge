// 语音层：把一句长结论压成「眼镜上能听完的一句」，并按 AIUI 真实 API 播报/识别。
//
// 全部依据官方仓库 yodaos-project/AIUI 的 skills/aiui-dev/references/apis/ai.md
// （2026-11-02 取回，逐条对照过）：
//   · speechSynthesis.speak(utterance, mode?)  —— 第一个参数是 SpeechSynthesisUtterance
//     对象，不是字符串；mode 为 'enqueue' | 'immediate'，省略时默认 'enqueue'
//   · utterance.lang **当前不受支持**，改它不会改变语音语言 → 要中文音色必须设 voice
//   · cancel / pause / resume / getVoices **均未暴露**
//   · SpeechRecognition 的 result 事件只保证暴露 resultIndex / results / sessionId，
//     官方参考未展开 results 内部结构
//
// 这三条不是猜测：前两条直接决定播报会不会出声、会不会念英文，第三条决定识别能不能拿到字。

const SENTENCE_END = '。！？；!?;';
const SOFT_BREAK = '，、,（）()';

// 中文女声。官方支持的 voice ID 里这是唯一纯中文女声，
// 另两个中文 ID 是 'Chinese (Mandarin)_News_Anchor' 和 '..._Radio_Host'（播音腔，偏生硬）。
export const VOICE_ZH = 'female-tianmei';

/** 按句号切句。不用正则 lookbehind：AIUI 端 JS 引擎版本未知，避免语法不支持。 */
function splitSentences(text) {
  const out = [];
  let cur = '';
  for (const ch of text) {
    cur += ch;
    if (SENTENCE_END.includes(ch)) {
      out.push(cur);
      cur = '';
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** 单句仍然过长时退到逗号处截断。截不出逗号就只能硬截——但绝不加省略号（TTS 会念出来）。 */
function clipAtComma(text, max) {
  let cut = -1;
  for (let i = 0; i < text.length && i < max; i += 1) {
    if (SOFT_BREAK.includes(text[i])) cut = i;
  }
  if (cut > 0) return text.slice(0, cut + 1);
  return text.slice(0, max);
}

/**
 * @param {string} text 完整结论
 * @param {object} opts
 * @param {number} opts.max 播报上限字符数
 * @param {string} opts.tail 必须保留的尾句（出处这类不能靠裁剪侥幸留下的内容必须传）
 * @returns {string} 可直接交给 TTS 的一到三句
 */
export function toBrief(text, { max = 40, tail = '' } = {}) {
  const full = String(text || '').trim();
  if (!full) return tail || '';

  const sentences = splitSentences(full);
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).length > max) break;
    out += s;
  }
  if (!out) out = sentences[0] || full;
  if (out.length > max) out = clipAtComma(out, max);

  if (tail && !out.includes(tail)) {
    // 去掉尾部任意标点再拼。只去句号/分号会念出「…有规定，。出处是…」——
    // 逗号被截断处留下的尾巴没被清掉，TTS 会把那个逗号当停顿念出来。
    out = out.replace(/[。；，、,;：:]$/, '') + '。' + tail;
  }
  return out;
}

/**
 * 从 SpeechRecognition 的 result 事件里取文字。
 *
 * 为什么必须单独抽出来：官方参考只保证 results / resultIndex 存在，没定义内部结构，
 * 也没定义 isFinal。这里按 W3C 与 AIUI 官方示例实际用到的形状解析
 * （results[resultIndex][0].transcript）。
 *
 * isFinal 缺失时**不猜**。按位置猜有两个方向，两个都是静默故障：
 *   · 猜成最终结果 → 用户还在说话就被提交，手牌只听到一半，答「还差 9 张」
 *   · 猜成中间结果 → 永远不提交，屏幕上一直显示听到的字但什么都不算
 * 所以这里只报「明确说了 final 的才算 final」，其余一律交给调用方在 onend 时兜底提交。
 * 识别结束是宿主一定会上报的事件，比任何字段名都可靠。
 *
 * @returns {{text: string, finalText: string, interim: string, final: boolean}}
 */
export function readSpeech(ev) {
  const results = ev && ev.results;
  if (!results || typeof results.length !== 'number' || results.length === 0) {
    return { text: '', finalText: '', interim: '', final: false };
  }

  const start = typeof ev.resultIndex === 'number' ? ev.resultIndex : 0;
  let finalText = '';
  let interim = '';
  let unknown = ''; // 没带 isFinal 字段的段——只有这一种情况需要兜底

  for (let i = start; i < results.length; i += 1) {
    const r = results[i];
    const alt = r && r[0];
    const t = alt && alt.transcript;
    if (!t) continue;
    if (r.isFinal === true) finalText += t;
    else if (r.isFinal === false) interim += t;
    else unknown += t;
  }

  return {
    text: finalText || unknown || interim,
    finalText,
    interim,
    final: Boolean(finalText),
  };
}

/**
 * 统一播报入口。
 *
 * 两条硬约束来自官方参考：
 * 1. 第一个参数必须是 SpeechSynthesisUtterance 实例。传裸字符串在部分实现里会静默不播——
 *    用户以为「它坏了」，其实是我们调用错了。
 * 2. lang 不生效，中文音色只能靠 voice。
 *
 * 降级：模拟器/部分设备上 speechSynthesis 或构造函数可能不存在，
 * 直接调会抛 ReferenceError 把整页脚本带走（用户看到白屏）。这里降级为「不念但返回文本」，
 * 调用方仍能把字显示在屏幕上。
 */
export function speak(text, { max = 40, tail = '', mode = 'enqueue', voice = VOICE_ZH } = {}) {
  const line = toBrief(text, { max, tail });
  const api = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const Ctor = typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null;

  if (!api || typeof api.speak !== 'function') {
    console.warn('[speech] 当前环境没有 speechSynthesis，只显示不播报');
    return line;
  }

  try {
    if (Ctor) {
      const u = new Ctor(line);
      // 不设 lang：官方明写当前不支持，设了只会让人以为生效了
      if (voice) u.voice = voice;
      // 'enqueue' 必须显式传：连续练习时，不传会把上一句掐掉
      api.speak(u, mode);
    } else {
      // 构造函数缺失时退一步，至少不整页崩
      api.speak(line, mode);
    }
  } catch (err) {
    console.error('[speech] 播报失败：', err && err.message);
  }
  return line;
}

let warnedNoCancel = false;

/**
 * 停掉当前播报。
 *
 * 官方参考明确列出 cancel / pause / resume 均未暴露，所以这里在 AIUI 上大概率是空操作。
 * 关键是**不能静默**：真需要打断时（用户按镜腿开口），如果停不掉，
 * 麦克风会把播报收进去，识别出一堆牌名/药名——这个症状必须能在日志里看出来，
 * 否则排查时只会怀疑「识别不准」。用 mode:'immediate' 播下一句是当前唯一能打断的手段。
 */
export function stopSpeak() {
  const api = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  if (api && typeof api.cancel === 'function') {
    try {
      api.cancel();
      return true;
    } catch (err) {
      console.error('[speech] 停止播报失败：', err && err.message);
      return false;
    }
  }
  if (!warnedNoCancel) {
    warnedNoCancel = true;
    console.warn('[speech] 当前运行时不提供 cancel()，无法中断播报；需要用 mode="immediate" 抢占');
  }
  return false;
}
