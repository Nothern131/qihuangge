// 域无关的响应流水线。
//
// 为什么需要这个文件：
// 原来一句话 -> 一个动作 -> 一句话，中间没有一站负责「我到底听清没有」。
// 校验、算法、措辞全挤在 viewXxx 里，改措辞会碰算法，加一种说法就要在路由表
// 再补一条关键词。真实场景里脏输入远多于干净输入，这条单跳链路会把「听错」
// 直接变成「答错」，而且错得很自信。
//
// 这里只放与麻将/中药无关的东西：清洗、计时、置信分档、自检调度、话术组装。
// 具体的「牌名怎么归一」「药名怎么归一」一律由域插件传入，骨架不认任何业务词。
//
// 三分档的用意：
//   answer  置信足够，按原路答
//   confirm 听到但不确定，先复述「我听到的是这些」再答，错了用户当场能纠
//   guide   根本没听清，不猜，只教怎么说
// guide 的存在是为了避免最糟的情况：为了显得聪明而硬猜一个答案。

const DEFAULT_THRESHOLDS = { answer: 0.72, confirm: 0.42 };

// 干净输入不该被拖慢。这些是 ASR 常见噪声，剥掉不丢信息。
const FILLER_HEAD = /^(?:那个|嗯|呃|哎|诶|我说|我想说|请问|帮我|帮忙|麻烦|你帮我|你能不能)+/;
const FILLER_TAIL = /(?:吧|啊|呢|呀|嘛|哦|呗|好吗|行吗|可以吗|怎么样)+[。！？!?…\s]*$/;

/**
 * 清洗：只做不会引入歧义的事。
 * 刻意不做的两件事：
 *   1. 不删句子中间的「那个」——「那个药」里的那个可能指代某味药。
 *   2. 不猜错字。错字纠正属于域插件的职责，它才知道「一尤」是不是「一万」。
 */
export function cleanText(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.normalize('NFKC').trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(FILLER_HEAD, '');
  // 尾巴上的语气词反复出现（「是吧可以吗」），剥到剥不动为止
  for (let i = 0; i < 3; i += 1) {
    const next = s.replace(FILLER_TAIL, '');
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

function nowMs() {
  // 眼镜端有 performance，Node 也有；都没有时退回 Date，只为计时不为精度
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}

/**
 * 建一条流水线。spec 里除 clean 之外都是域插件。
 *
 * @param {object} spec
 * @param {string} spec.name
 * @param {(ctx) => object} spec.normalize   文本 -> { tokens, notes, conf }
 * @param {(ctx) => object} spec.interpret    tokens -> { intent, slots, conf, why }
 * @param {(ctx) => object} [spec.execute]    answer 档才调；返回视图对象
 * @param {(ctx) => {issues: string[]}} [spec.verify]  结果自检
 * @param {(ctx) => string} [spec.describe]  confirm 档的复述话术
 * @param {(ctx) => string} [spec.guide]     guide 档的引导话术
 */
export function createPipeline(spec) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(spec.thresholds || {}) };

  function stage(ctx, name, fn) {
    const t0 = nowMs();
    let out;
    try {
      out = fn(ctx);
    } catch (err) {
      // 任何一站的异常都要落到 trace 里再抛，否则线上只看到「没反应」
      ctx.trace.push({ stage: name, ms: nowMs() - t0, error: err && err.message });
      err.stage = name;
      throw err;
    }
    ctx.trace.push({ stage: name, ms: nowMs() - t0 });
    return out || {};
  }

  /**
   * @param {string|object} raw  原始语音文本，或已带结构化字段的对象
   * @param {object} [carry]     上一轮的上下文（例如麻将的「刚才那手」）
   */
  function run(raw, carry = {}) {
    const ctx = {
      raw: typeof raw === 'string' ? raw : (raw && (raw.text || raw.hand)) || '',
      text: '',
      tokens: [],
      notes: [],
      intent: null,
      slots: {},
      conf: 1,
      result: null,
      issues: [],
      verdict: 'answer',
      speech: '',
      trace: [],
      carry,
    };

    ctx.text = cleanText(ctx.raw);
    ctx.trace.push({ stage: 'clean', ms: 0 });

    // 归一化：域插件说了算
    const norm = stage(ctx, 'normalize', () => (spec.normalize ? spec.normalize(ctx) : {}));
    if (norm.tokens) ctx.tokens = norm.tokens;
    if (norm.notes) ctx.notes = norm.notes;
    if (typeof norm.conf === 'number') ctx.conf *= norm.conf;

    // 判定：意图 + 槽位 + 置信
    const it = stage(ctx, 'interpret', () => (spec.interpret ? spec.interpret(ctx) : {}));
    if (it.intent) ctx.intent = it.intent;
    if (it.slots) ctx.slots = { ...ctx.slots, ...it.slots };
    if (typeof it.conf === 'number') ctx.conf *= it.conf;
    if (it.why) ctx.notes.push(it.why);
    // 为什么没把握的「原因」要单独带出来：同样是引导用户，字牌和闲聊不一样。
    // 「换成万筒条重说」和「你没说到麻将」是两种完全不同的下一步动作，
    // 页面需要据此显示不同提示，不能都写成「没听懂」。
    if (it.reason) ctx.reason = it.reason;

    // stop：听清了，但这件事本身做不了（例如「我碰了三万」——本版不算副露）。
    // 与 guide 的区别是用户该做的动作不同：guide 让他重说，stop 让他别白费劲。
    // 混成一句「没听清」是最差的处理——用户会一遍遍重说同一句话。
    if (it.stop) {
      ctx.verdict = 'stop';
      ctx.speech = it.speech || '这个现在还做不了';
      ctx.trace.push({ stage: 'gate', ms: 0, verdict: 'stop' });
      return ctx;
    }

    ctx.verdict = gate(ctx.conf, thresholds);

    if (ctx.verdict !== 'answer') {
      // 不执行算法。没有足够把握时算出来的东西，念出去就是误导。
      ctx.speech = buildSpeech(ctx, spec);
      ctx.trace.push({ stage: 'gate', ms: 0, verdict: ctx.verdict });
      return ctx;
    }

    // 执行失败不等于程序坏了：可能是某种手牌组合算法没覆盖到，也可能是输入
    // 看着合法其实不合法。这时候要给出「没算出来」并留退路，而不是把异常抛到
    // 壳层——壳层拿到异常只会显示一片空白，用户以为眼镜死机了。
    let exec;
    try {
      exec = stage(ctx, 'execute', () => (spec.execute ? spec.execute(ctx) : {}));
    } catch (err) {
      ctx.verdict = 'confirm';
      ctx.error = err && err.message;
      ctx.speech = spec.onError
        ? spec.onError(ctx, err)
        : '这次没算出来。把牌再说一遍，或者说「换一题」';
      return ctx;
    }
    ctx.result = exec.result !== undefined ? exec.result : exec;

    // 自检：结果和常识矛盾时，退回复述档而不是硬念
    if (spec.verify) {
      const v = stage(ctx, 'verify', () => spec.verify(ctx, ctx.result)) || {};
      ctx.issues = v.issues || [];
      if (ctx.issues.length > 0) {
        ctx.verdict = 'confirm';
        ctx.conf = Math.min(ctx.conf, thresholds.answer - 0.01);
      }
    }

    ctx.speech = buildSpeech(ctx, spec);

    // 个人化追加。域插件可以在这里补一句「和你有关」的话，
    // 例如「你记着在吃钙，钙和维生素D一起吃吸收更好」——
    // 这是「越用越懂你」唯一能被用户听见的地方。
    //
    // 只走 answer 档：反问和拒绝时再多说一句只会稀释重点，用户会以为结论变了。
    // 失败不抛出：这句是锦上添花，不该毁掉已经算对的主答案。
    if (spec.decorate && ctx.verdict === 'answer') {
      try {
        const extra = spec.decorate(ctx);
        if (extra && extra.say) ctx.speech = appendSay(ctx.speech, extra.say);
      } catch (err) {
        console.warn('[pipeline] 追加话术失败，已忽略：', err && err.message);
      }
    }
    return ctx;
  }

  return { name: spec.name, thresholds, run, spec };
}

function gate(conf, thresholds) {
  if (conf >= thresholds.answer) return 'answer';
  if (conf >= thresholds.confirm) return 'confirm';
  return 'guide';
}

/**
 * 在结论后追加一句。防两件事：
 *   ① 重复——用户连着问同一件事时，同一句提示会被念两遍；
 *   ② 粘句——主结论没句号时直接拼会变成「…吸收更好你记着在吃钙」。
 */
function appendSay(base, extra) {
  const b = String(base || '');
  const e = String(extra || '').trim();
  if (!e || b.includes(e)) return b;
  if (!b) return e;
  return `${b}${/[。！？.!?]$/.test(b) ? '' : '。'}${e}`;
}

function buildSpeech(ctx, spec) {
  if (ctx.verdict === 'guide') {
    if (spec.guide) return spec.guide(ctx);
    return '没听清，请再说一遍';
  }
  if (ctx.verdict === 'confirm') {
    // 自检失败时说的是「结果对不上」，不是「没听清」——两者用户要做的动作不同。
    // 措辞必须域无关：这里曾经写成「这手牌算出来的结果自相矛盾」，
    // 中药那边念出来就是「这手牌」——骨架里不该出现任何一个域的词。
    if (ctx.issues.length > 0) {
      const said = spec.describe ? spec.describe(ctx) : `我听到的是「${ctx.text}」`;
      return `${said}。但这个结果自相矛盾，先不给你结论`;
    }
    // 域的 confirm 话术优先：「我听到 11 张，还差 2 张」和「是这样吗」不是一回事，
    // 前者能直接让用户把话补全，后者只会让他点头。
    if (spec.confirm) return spec.confirm(ctx);
    const said = spec.describe ? spec.describe(ctx) : `我听到的是「${ctx.text}」`;
    return `${said}，是这个意思吗`;
  }
  if (spec.speak) return spec.speak(ctx);
  return (ctx.result && ctx.result.speech) || '';
}

export { DEFAULT_THRESHOLDS };
