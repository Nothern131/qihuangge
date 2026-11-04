// 岐黄阁的「听懂」层。
//
// 和麻将那边共用同一套流水线骨架，但阈值和自检规则完全不同——因为出错代价不同。
// 麻将算错：打错一张牌，输一局。
// 中药答错：把「查不到」说成「可以吃」，可能真出事。
// 所以这里宁可多问一句、多说一句免责，也不给一个利落的假结论。
//
// 这一层不碰 static/ 里的引擎，只调 adapter 暴露的 recognize 和 invoke，
// 「只加不改」的边界保持不变。

// 注意：core/pipeline.mjs 是麻将那边的同一份内核的副本。
// 两个作品各自打包成 .aix 独立上架，跨目录 import 在打包后必然断，所以只能各持一份。
// 代价是可能漂移——tests/parity.mjs 会逐字节比对两份，不一致就红。
import { createPipeline } from '../core/pipeline.js';
// 用药计划的解析与回显。「几点吃什么」是管家形态的入口，
// 没有它，记忆就只是「你在吃什么」，永远产生不了「到点提醒」。
import { parseMedPlans, humanTime, TIMING_LABEL } from './med-schedule.js';
// 个人状况 × 本草禁忌的匹配。只在库里写着「什么人忌服」时才说话，
// 不自己推「艾灸温热所以不能配寒凉」这类结论——那种推理的正确性要我们负责。
import { extractStates, cautionsFor, cautionSpeech, cautionLine } from './advice.js';
// 养生行为（艾灸这类）。它的禁忌依据是《伤寒论》原文，判定靠用户自述的状况，
// 两者都不是这套系统自己推出来的——这一点在 practice-canon.js 顶部写清了。
import { practiceOf, findPractices, practiceCautions } from './practice-canon.js';

// 本版明确不做的事。这些不是说错了，是根本不该由这个作品回答——
// 眼镜上一个只说三句话的助手给出剂量建议，比不给建议危险得多。
const DOSE_RE = /(吃多少|多少克|几克|几钱|几两|一天吃几次|一天几次|用量|剂量|每次用|怎么吃|服用多少)/;
const PRESCRIBE_RE = /(开个方|开方|配个方|开副药|处方|给我治|怎么治|吃什么药能治|我头疼|我咳嗽|我失眠|我胃疼|辨证|把脉)/;

// 安慰措辞。这些词出现在有风险项的结论里就是自相矛盾，必须拦住。
const REASSURE_RE = /(可以放心|放心吃|放心用|没问题|没事|安全|可以一起|能一起吃)/;

// 养生调理类问法。定位叫「养生助手」，用户一定会问「失眠怎么调理」。
// 答「没听懂」是最差的反应——听起来像不会，实际是不该答。
// 这两件事对用户的意义完全不同：前者他会换个说法再试，后者他会去找会编的人。
const WELLNESS_RE = /(调理|养生|怎么养|怎么预防|怎么缓解|怎么改善|如何改善|如何调理|能治好|能治吗|能治|怎么治|什么能治|吃什么能|吃什么好|有什么办法|食补|食疗|偏方)/;

// 「记一下我在吃钙片」——这是「越用越懂你」唯一的入口。
// 没有它，产品永远只能回答当下这一句，用户用三个月和用一天没有区别。
const MEMO_RE = /(记一下|记住|记下|帮我记|我在吃|我在用|我常吃|我一直在吃|我平时吃|在吃|吃着)/;
// 「上次那个」「刚才问的」——跨句指代。
// 只认这几种明确说法，不碰「它」「这个」：代词在语音里指代对象太模糊，
// 补错了比不补更糟——用户会以为系统记错了东西。
const ELLIPSIS_RE = /(上次|刚才)(那个|问的|说的|那味|那味药)/;
const MEMO_STRIP = /(帮我)?(记一下|记住|记下|我一直在吃|我平时吃|我在吃|我在用|我常吃|吃着|在吃|在用|还有)/g;

/** 从「记一下我在吃钙片」里取出「钙片」。取不出来就返回空串，交给上层的报错路径。 */
function extractMemoTarget(text) {
  return String(text || '')
    .replace(MEMO_STRIP, '')
    .replace(/[，。,.！!？?、\s]/g, '')
    .trim();
}

// 医疗语义词：出现任何一个，说明这句话是在问用药，不是在闲聊。
// 和「长度」一起用，是为了把「今天天气不错」和「三七」分开——
// 两者在系统眼里都是「一个不认识的词」，但一个是闲聊，一个是真药名。
const MEDICAL_RE = /(毒|吃|用|服|禁忌|孕妇|怀孕|哺乳|一起|同用|相克|副作用|功效|什么用|治|病|配伍|忌)/;

// 出处自检：结论必须说得出它从哪来。
//
// 原来这里查的是「有没有就医提示」。那句话有两个毛病：对用户没有信息量，
// 而且把所有结论压成同一种口吻——引《儒门事亲》的和引现代营养学的听起来一样，
// 可这两件事的可信度根本不是一回事。现在改查出处。
//
// 注意不能只查「有没有《》」：查不到的时候本来就没书可引，那种时候该说的是
// 「本草库没收录」这个边界句。两类都算合格，因为它们都在回答「凭什么」。
// 「没收录」必须算在内——把它当作不合格的后果实测过：
// 问「三七」会被自检判成「没说清出处」，然后降级成反问，
// 播报变成「我三七、未收录：三七不在本草库里」，比原来更难听懂。
const SOURCE_RE = /(《[^》]+》|药典|现代营养学|禁忌歌|本草库|营养素库|歌诀|没收录|没记录)/;

export function createQihuangAgent(pack, { store = null } = {}) {
  /**
   * 记住一样东西。
   *
   * 名字优先用引擎认出来的规范名而不是用户原话：用户说「钙片」，
   * 档案里存的应该是「钙」——不然下次问「维生素D」时对不上，
   * 交叉核对永远不会命中，「记住」就成了摆设。
   */
  function doMemo(ctx) {
    // 先说清一件事：带时间的「记一下早上八点吃二甲双胍」存的是**计划**，
    // 不带时间的「记一下我在吃钙片」存的是**在吃清单**。两条路分开：
    // 计划能被提醒，清单只能被交叉核对。混在一起就会出现
    // 「记了药但永远不会响」——而这种失效是静默的，用户以为设好了。
    const plans = parseMedPlans(ctx.text);
    if (plans.length > 0) return rememberPlans(plans);

    const target = extractMemoTarget(ctx.text);
    const n = (ctx.recog.nutrients || [])[0];
    const herb = (ctx.recog.known || [])[0];

    if (!n && !herb && !target) {
      const err = new Error('没听清要记什么');
      err.code = 'missing_item';
      throw err;
    }

    const name = n ? n.name : (herb || target);
    const kind = n ? 'nutrient' : (herb ? 'herb' : 'other');
    const ref = n ? n.id : (herb || null);

    // rememberItem 在存储写失败时会抛，交给 pipeline 的 onError 处理。
    // 这里不做 try：捕获了就只能「假装记下了」，那是最坏的结果。
    const r = store.rememberItem(name, kind, ref);
    return {
      found: true,
      intent: 'memo',
      name,
      kind,
      added: r.added,
      total: r.profile.supplements.length,
      items: store.listItems(),
      speech: r.added
        ? `记下了：${name}。以后你问到它，我会先看一眼有没有冲突。`
        : `${name}已经记着了`,
    };
  }

  /**
   * 把「用户说过的状况」和「用户做过的养生行为」对一遍，找出该提醒的。
   *
   * 两个方向都要查：先记艾灸后说阴虚、先说阴虚后记艾灸，都得提醒。
   * 所以这个函数不关心调用顺序，只看档案里现在有什么。
   *
   * 措辞上的分界：说「你做艾灸，这条要看一下」，不说「你不能艾灸」。
   * 依据是《伤寒论》的原文，但原文判的是脉象，我们只有用户的自述——
   * 中间差一层，措辞就得把这层差露出来。
   */
  function practiceWarnings(extraStates) {
    if (!store) return [];
    let states = [];
    try {
      states = store.getConcerns().flatMap((c) => extractStates(c.text));
    } catch (err) {
      console.warn('[qihuang] 读状况失败，本次不做对照：', err && err.message);
      return [];
    }
    // 刚记下的状况还没进档案（或者调用方想临时算一遍），一起并进来
    if (Array.isArray(extraStates) && extraStates.length) {
      const seen = new Set(states.map((x) => x.key));
      for (const st of extraStates) if (!seen.has(st.key)) states.push(st);
    }
    if (!states.length) return [];

    let practices = [];
    try {
      practices = store.listPractices();
    } catch (err) {
      console.warn('[qihuang] 读养生行为失败，本次不做对照：', err && err.message);
      return [];
    }

    const out = [];
    for (const item of practices) {
      const pr = practiceOf(item.ref || item.name);
      if (!pr) continue;
      for (const hit of practiceCautions(pr, states)) {
        // 不再重复「你说过阴虚」——前半句「阴虚火旺的人慎灸」已经把因果说清了，
        // 再加一句只是把播报撑长，而播报是有字数上限的。
        out.push(`${pr.name}：${hit.plain}（出自${hit.source}）`);
      }
    }
    return out;
  }

  /**
   * 记下用户的状况（脾胃虚寒、怀孕、湿气重……）。
   *
   * 存的是**他的原话**，不是我们归一后的术语：下次复述时「喝凉的不舒服」
   * 比「脾胃虚寒」更像他自己说的话。匹配时再统一抽术语，两边不冲突。
   */
  function doConcern(ctx) {
    const states = extractStates(ctx.text);
    if (!states.length) {
      const err = new Error('没听出是哪方面的状况');
      err.code = 'missing_item';
      throw err;
    }
    let added = 0;
    for (const st of states) {
      const r = store.addConcern(st.raw);
      if (r.added) added += 1;
    }
    const names = states.map((x) => x.tags[0]).join('、');
    // 记完状况立刻回头看一眼：有没有正在做的养生行为和这条冲突。
    // 这个时机最好——用户刚说完自己的情况，正是他愿意听一句相关提醒的时候。
    // 等到下次问药才说，前面那句话早就过去了。
    const warns = practiceWarnings(states);
    const base = added
      ? `记下了：${names}。以后你问药的禁忌，我会先看一眼和你这条对不对得上`
      : `${names} 已经记着了`;
    // 前缀只用一次「另外要看一下」，不提「这一条要看」——那半句在
    // practiceWarnings 拼出来的每一句里已经有了，重复两次就成了绕口令。
    return {
      found: true,
      intent: 'concern',
      states: states.map((x) => x.key),
      // states 里存的是英文 key（yin-deficiency），那个东西只该给程序用。
      // 屏幕上直接显示 key 会变成「yin-deficiency 已记在档案里」，
      // 用户看到的是一串代码。
      stateNames: states.map((x) => x.tags[0]),
      warnings: warns,
      // 播报默认上限是 32 字，装不下「记下了什么 + 那一句提醒」。
      // 提醒里带着出处，被截掉就等于只说了半句禁忌——这半句比不说更糟。
      sayMax: warns.length ? 140 : 80,
      speech: warns.length ? `${base}。另外要看一下——${warns.join('；')}` : base,
    };
  }

  /**
   * 记一个养生行为（艾灸）。
   *
   * 存两个字段的理由见 profile-store：name 是原话，ref 是规范名。
   * 这里额外做一件事——记完马上和已知的状况对一遍。
   * 用户说「我在做艾灸」，如果档案里早就有「阴虚」，那这句话必须当场说，
   * 而不是等他下次问药。
   */
  function doPractice(practice) {
    // 存规范名（艾灸），不存原话（「我在做艾灸」）。
    // 存原话的话，档案里会多出「我在做／」这种半截动词，
    // 下次复述就变成「你在做我在做艾灸」。
    const r = store.addPractice(practice.name, practice.name);
    const warns = practiceWarnings();
    const base = r.added
      ? `记下了：你在做${practice.name}。它偏${practice.nature}，作用是${practice.uses}`
      : `${practice.name} 已经记着了`;
    return {
      found: true,
      intent: 'practice',
      practice: practice.name,
      added: r.added,
      warnings: warns,
      // 播报默认上限是 32 字，装不下「记下了什么 + 那一句提醒」。
      // 提醒里带着出处，被截掉就等于只说了半句禁忌——这半句比不说更糟。
      sayMax: warns.length ? 140 : 80,
      speech: warns.length ? `${base}。另外要看一下——${warns.join('；')}` : base,
    };
  }

  /**
   * 存用药计划，并把「记下了什么」说回去。
   *
   * 说回去这一步不能省：时间是这一层的风险点，用户说「八点」被理解成「晚上八点」，
   * 只有让他听见「早上 8 点」才会当场发现。这是唯一一次能纠错的机会。
   */
  function rememberPlans(plans) {
    const added = [];
    const dup = [];
    let err = null;
    for (const p of plans) {
      try {
        const r = store.addMedPlan(p.name, p.time, p.timing);
        (r.added ? added : dup).push({ ...p, id: r.plan.id });
      } catch (e) {
        if (!err) err = e;
      }
    }
    if (err && added.length === 0 && dup.length === 0) throw err;

    const say = (list) => list.map((p) => {
      const when = p.time ? humanTime(p.time) : (TIMING_LABEL[p.timing] || '');
      return `${when} ${p.name}`.trim();
    }).join('，');

    let speech;
    if (added.length && dup.length) {
      speech = `记下了 ${say(added)}；${say(dup)} 已经记着了`;
    } else if (added.length) {
      speech = added.length === 1
        ? `记下了：${say(added)}。到点我会提醒你`
        : `记下了 ${added.length} 条：${say(added)}。到点我会提醒你`;
    } else {
      speech = `${say(dup)} 已经记着了`;
    }

    // 部分失败必须说出来。
    // 原来这里只判「一条都没成功才抛」，于是「记满 20 条后第 21 条失败」被吞掉——
    // 用户听到「记下了 20 条」，以为全记上了，明天那一顿药不会响。
    // 这是静默失败，而且发生在要吃药的事上。
    if (err) speech += `。${err.message}，后面没记上的那些请你再说一次`;

    return {
      found: true,
      intent: 'memo',
      kind: 'plan',
      added: added.length,
      plans: store.listMedPlans(),
      speech,
    };
  }

  /**
   * 「上次那个有毒吗」——把指代换成上次说过的药名。
   *
   * 记忆有两种价值：一种是记住你吃什么（跨天），一种是记住你刚才问什么（跨句）。
   * 后者看起来小，但它是最容易被听见的那一种：问完甘草，补一句「上次那个和海藻能一起用吗」，
   * 能答上来和答不上来是两种产品。
   *
   * 只在真能补全时替换。找不到就原句不动，让下游照常答「没听出药名」——
   * 补错了比不补更糟。
   */
  function resolveEllipsis(ctx) {
    if (!store || !ELLIPSIS_RE.test(ctx.text)) return;
    const herb = findLastHerb();
    if (!herb) {
      // 找不到历史，而且这句话去掉指代之后几乎没剩什么内容 —— 那就是纯指代。
      // 不说的话，切词会把「上次那个」当成一味药名，回答「本草库没收录上次那个」：
      // 听起来像这味药没收录，实际是它没听懂你在指哪一味。两件事对用户的意义完全不同。
      const rest = String(ctx.text).replace(ELLIPSIS_RE, '')
        .replace(/[吗呢吧啊呀的？?，,。！!\s]/g, '');
      if (rest.length <= 2) ctx.ellipsisFailed = true;
      return;
    }
    ctx.text = String(ctx.text).replace(ELLIPSIS_RE, herb);
    ctx.ellipsis = { resolvedTo: herb };
  }

  /** 从历史里倒着找最近一条能认出药名的问法。认不出就继续往前，最多看 5 条。 */
  function findLastHerb() {
    let hist = [];
    try {
      hist = store.getHistory() || [];
    } catch (err) {
      console.warn('[qihuang] 读历史失败，本次不做指代补全：', err && err.message);
      return null;
    }
    let looked = 0;
    for (let i = hist.length - 1; i >= 0 && looked < 5; i -= 1) {
      const q = hist[i].q;
      if (!q || ELLIPSIS_RE.test(q)) continue;
      looked += 1;
      const r = pack.recognize(q);
      if (r && Array.isArray(r.herbs) && r.herbs.length) return r.herbs[0];
    }
    return null;
  }

  return createPipeline({
    name: 'qihuang',
    // 和麻将的 0.75/0.4 不同：这里 lower 档位意味着「先反问」，
    // 而反问在用药场景里成本极低（用户再说一句），漏答风险却很高。
    thresholds: { answer: 0.75, confirm: 0.5 },

    normalize(ctx) {
      // 「上次那个」这类指代，先换成上次说过的药名再识别。
      // 这是记忆唯一能被**听见**的另一条路：不是记住你吃什么，是记住你刚才问什么。
      // 放在 normalize 而不是 interpret：后面每一站都读 ctx.text，
      // 在这里换掉，等于整条链路都拿到了补全后的问题。
      resolveEllipsis(ctx);
      const r = pack.recognize(ctx.text);
      ctx.recog = r;
      // tokens 在中药域是药名（字符串），不是牌索引。
      // 骨架不关心类型，只关心「这一站产出了什么结构」。
      return { tokens: r.herbs, notes: r.unknown };
    },

    interpret(ctx) {
      // 指代没补上：说清是「没有记录」，不是「没听懂」，也不是「没收录」。
      if (ctx.ellipsisFailed) {
        return {
          stop: true,
          speech: '我这边没有上次的记录，不知道你指的是哪一味。直接说药名就行，比如「甘草有毒吗」',
        };
      }
      // 能力边界优先于一切：这几类问题听懂了也不能答。
      if (DOSE_RE.test(ctx.text)) {
        return {
          stop: true,
          speech: '用量我不给建议。同一个药不同的人、不同的炮制方式用量差很多，'
            + '说错比不说危险。这里只能告诉你它有什么禁忌和毒性',
        };
      }
      if (PRESCRIBE_RE.test(ctx.text)) {
        return {
          stop: true,
          speech: '这个作品只查资料，不辨证也不开方。可以说药名问我它的禁忌、毒性，'
            + '或者两味药能不能一起用',
        };
      }

      // 「记一下」优先于查询：用户在交代一件事，不是在提问。
      // 没有 store 时必须明说存不了，不能装作记住了——
      // 用户以为记下了，明天再问「我记的都有什么」会得到空，这种失望比当场报错重得多。
      // 判据扩过一次：除了「记一下 / 我在吃」这类明说的，**能解析出「几点吃什么」的也算**。
      // 因为交代用药时用户经常不重复动词——「早上八点吃二甲双胍，晚上八点吃阿托伐他汀」，
      // 后半句没有「记一下」，但它显然还在同一次交代里。
      // 不扩的话，后半句会掉进查询，回一句「这句没听懂」，用户得把整句重说一遍。
      // 纯状况陈述（「我脾胃虚寒」「我在备孕」）记成档案，不走向查询。
      // 判据要窄：带药名的（「我胃寒能吃黄连吗」）必须放去查询——
      // 那是他真正想问的事，只记个状况等于没回答。
      const states = extractStates(ctx.text);
      // 判据用 known（库里认得的药名）而不是 herbs（切词切出来的）：
      // 切词有个兜底，会把「脾胃虚寒」整串当成一味药名，herbs 就不为空了，
      // 这条分支永远进不去——而这正是最常见的一句。
      if (states.length && (!ctx.recog.known || ctx.recog.known.length === 0) && !/[?？]|吗|能不能|可不可以/.test(ctx.text)) {
        if (!store) {
          return {
            stop: true,
            speech: '这台设备上没法保存记录，我只能当场回答，记不住你的情况',
          };
        }
        return { intent: 'concern', conf: 1 };
      }

      // 养生行为：「我在做艾灸」。
      // 判据要排除问句——「艾灸有什么好处」是在问，不是在交代，
      // 把它记进档案会让用户莫名其妙多了一条记录。
      const pracs = findPractices(ctx.text);
      if (pracs.length && !/[?？]|吗|好处|作用|效果|能不能|可不可以|适合/.test(ctx.text)) {
        if (!store) {
          return {
            stop: true,
            speech: '这台设备上没法保存记录，我只能当场回答，记不住你在做什么',
          };
        }
        // 存进 ctx，execute 阶段直接用，不再从原句里认第二遍——
        // 认两遍就有两次判断不一致的机会。
        ctx.practice = pracs[0];
        return { intent: 'practice', conf: 1 };
      }

      const looksLikePlan = parseMedPlans(ctx.text).length > 0;
      if (MEMO_RE.test(ctx.text) || looksLikePlan) {
        if (!store) {
          return {
            stop: true,
            speech: '这台设备上没法保存记录，我只能当场回答，记不住你之前说过什么',
          };
        }
        return { intent: 'memo', conf: 1 };
      }

      const { herbs, known, plausible } = ctx.recog;

      // 药名优先，营养素兜底——顺序不能反。
      // 「铁皮石斛」里有个「铁」，先认营养素就会去查铁元素，而用户问的是一味药。
      // 反过来漏掉的代价更大：维生素和矿物质是养生场景里最高频的问法，
      // 认不出来就变成「没听出药名」，用户会认为这个作品只会查中药。
      const nutrients = ctx.recog.nutrients || [];
      if (known.length === 0 && nutrients.length > 0) {
        ctx.nutrients = nutrients;
        // 认出两样以上就走搭配，否则只答第一样——「钙和铁能一起吃吗」
        // 只答钙的功效，等于没回答他问的问题。
        const intent = nutrients.length >= 2 ? 'nutrient-mix' : 'nutrient';
        return { intent, conf: 1, why: `营养素：${nutrients.map((n) => n.name).join('、')}` };
      }

      // 注意判据是「没认出明确药名」（known 为空），不是「一个词都没切出来」。
      // 「我最近失眠怎么调理」会被整串保留成一块（9 个字），
      // 用 herbs.length===0 判就永远命中不了。
      if (known.length === 0 && WELLNESS_RE.test(ctx.text)) {
        // 放在营养素之后：先把「补钙怎么补」这类能答的捞走，
        // 剩下的「失眠怎么调理」才落到这条边界上。
        return {
          stop: true,
          speech: '调理和诊断这类我不做，涉及辨证，说错要负责。'
            + '可以问我某味药有什么禁忌，或者两样东西能不能一起用',
        };
      }

      if (herbs.length === 0) {
        // 一个字都没认出来：不猜，也不拿「没查到」冒充结论
        return { intent: null, conf: 0 };
      }
      // 连一个像药名的都没有，就是把闲聊当药名了。这种不答比答好——
      // 「本草库还没收录今天天气不错」看着像在工作，其实是在复读用户的话。
      if (known.length === 0 && plausible.length === 0) {
        return { intent: null, conf: 0, why: '没有一个像药名' };
      }
      // 库里没有，且既不像药名（≤4 字）也没问用药 → 当闲聊。
      // 长度这条不是拍脑袋：常用药材名两到四个字（附子/夏枯草/五指毛桃），
      // 五个字以上的多半是整句被切词器兜住了。
      if (known.length === 0) {
        const shortEnough = plausible.some((h) => h.length <= 4);
        if (!shortEnough && !MEDICAL_RE.test(ctx.text)) {
          return { intent: null, conf: 0, why: '不认识的闲聊' };
        }
      }
      // 认出了药名就算有把握——哪怕库里没收录，「没收录」本身也是准确答案，
      // 不需要反问。这类情况交给 verify 检查措辞是否把「没收录」说成了「没问题」。
      return { intent: 'ask', conf: 1, why: ctx.recog.unknown.length ? `未收录：${ctx.recog.unknown.join('、')}` : '' };
    },

    execute(ctx) {
      if (ctx.intent === 'memo') return { result: doMemo(ctx) };
      if (ctx.intent === 'concern') return { result: doConcern(ctx) };
      if (ctx.intent === 'practice') return { result: doPractice(ctx.practice) };

      // 营养素走独立动作：下游的 vitamin 分支只认单味营养素名，
      // 把整句「维生素C有什么作用」丢进去它只会答「库里没有这句话」。
      if (ctx.intent === 'nutrient' && ctx.nutrients && ctx.nutrients.length) {
        return { result: pack.invoke('vitamin', { name: ctx.nutrients[0].name, text: ctx.text }) };
      }
      if (ctx.intent === 'nutrient-mix' && ctx.nutrients && ctx.nutrients.length >= 2) {
        return { result: pack.invoke('vitamin-mix', { nutrients: ctx.nutrients.map((n) => n.name) }) };
      }
      // 把上游切好的药名一并交给下游。不传的话下游会拿原句重新切一遍，
      // 而两边的前置处理不同，就会出现「我认出附子，它答没听出药名」。
      const result = pack.invoke('ask', {
        text: ctx.text,
        query: ctx.text,
        herbs: ctx.recog.herbs,
      });
      return { result };
    },

    /**
     * 中药的自检不看数字，看「话和数据对不对得上」。
     * 这些规则都是从真实危险场景倒推的：用户只会记住最后听到的那半句。
     */
    verify(ctx, r) {
      const issues = [];
      if (!r) return { issues: ['无结果'] };

      // 记住一件事不是查询结论：它没给任何健康建议，也就不需要就医提示。
      // 不豁免的话，每次「记一下」都会被自检判成「结论缺少就医提示」，
      // 然后降级成反问——用户会觉得这个助手连记东西都记不住。
      if (r.intent === 'memo' || r.intent === 'concern' || r.intent === 'practice') return { issues: [] };

      const speech = String(r.speech || '');

      const risky = Boolean(
        r.hasWarning
        || (Array.isArray(r.entries) && r.entries.length > 0)
        || (Array.isArray(r.toxicity) && r.toxicity.some((t) => t.level && t.level !== '无毒'))
        || (Array.isArray(r.fans) && r.fans.length > 0)
        || (Array.isArray(r.weis) && r.weis.length > 0)
        || (Array.isArray(r.pregnancy) && r.pregnancy.length > 0),
      );

      // 最危险的一条：结果里明明有风险，措辞却让人放心
      if (risky && REASSURE_RE.test(speech) && !/不等于|不代表/.test(speech)) {
        issues.push('有风险项却用了安慰措辞');
      }

      // 查不到时说成「安全」，是把假阴性包装成结论。
      // 措辞有多种（「没收录」「库里没有」「查不到」），这里只要求出现其中一种，
      // 不锁死某一句——锁死措辞的测试会在改文案时全红，那是测试在拖后腿。
      if (r.found === false && !/(没收录|没有收录|查不到|没查到|没听出|库里没有|没有「)/.test(speech)) {
        issues.push('查不到却没有说明查不到');
      }

      // 结论必须能说出出处。少了这一步，产品就从「引书」越界成了「给建议」——
      // 差别很小但在审核和信任上很关键：引书可以核对，建议只能相信。
      //
      // 查的是 r.source 而不是 speech：出处作为播报尾巴单独传（见 ui/qihuang-view.js），
      // 不在 speech 里。在这里查 speech 会全部报错，然后每条结论都被降级成反问——
      // 表面上「更谨慎」，实际上是助手什么都不肯答了。
      const source = String(r.source || '');
      if (!SOURCE_RE.test(source)) {
        issues.push('结论没说清出处');
      }

      // 用户问的是配伍，却只认出一味药——这时候的配伍结论没有意义。
      // 但「一味都认不出」不在此列：那种情况答复本身就是「没收录」，是准确答案。
      if (r.intent === 'check' && r.recognized !== false
        && Array.isArray(r.herbs) && r.herbs.length < 2) {
        issues.push('问配伍但只认出一味药');
      }

      return { issues };
    },

    describe(ctx) {
      const { herbs, unknown } = ctx.recog;
      if (herbs.length === 0) return `我听到「${ctx.text}」，但没听出药名`;
      const known = herbs.filter((h) => !unknown.includes(h));
      const parts = [];
      if (known.length) parts.push(`认出${known.join('、')}`);
      if (unknown.length) parts.push(`${unknown.join('、')}不在本草库里`);
      return `我${parts.join('，')}`;
    },

    confirm(ctx) {
      const { herbs, unknown } = ctx.recog;
      if (herbs.length === 0) {
        return '没听出药名。请直接说药名，比如「附子」或者「甘草 海藻」';
      }
      if (unknown.length === herbs.length) {
        return `本草库里还没有${herbs.join('、')}，查不了禁忌和毒性。`
          + '换个收录过的药名，或者说「换一个」';
      }
      return `我听到的是${herbs.join('、')}，是这个意思吗`;
    },

    guide(ctx) {
      if (ctx.recog && ctx.recog.herbs.length === 0) {
        return '没听出药名。可以问「附子有毒吗」「孕妇能吃桃仁吗」「甘草和海藻能一起吃吗」';
      }
      return '这句没听懂，可以说药名，或者问两味药能不能一起用';
    },

    /**
     * 结论后补一句与用户有关的话。这是「越用越懂你」唯一能被听见的地方，
     * 所以规则要严：只在本问没提到、且确实有数据支持时才说。
     * 没数据就不说——为了显得聪明硬凑一句，比不说更糟。
     */
    decorate(ctx) {
      if (!store) return null;

      // 每一问都记进历史，指代（「上次那个」）才有东西可查。
      // 在这之前 history 只写不读——profile-store 里实现了读写，但整个应用一次都没调用过，
      // 等于挂着一个永远空的字段。写失败不影响本次回答，所以这一处可以吞（存储层会记 warn）。
      if (ctx.intent !== 'memo') store.pushHistory(ctx.text);

      if (ctx.intent === 'memo' || ctx.intent === 'concern') return null;

      // ① 状况 × 本草禁忌，排在「你记着在吃 X」之前。
      // 前者是「这一条你可能不该用」，后者是「你还有别的在吃」——
      // 一起出现时先说更急的那条。
      // 依据全部来自本草条目的 tabi 原文，一个字都没改；命中就念原话，没命中就闭嘴。
      const avoid = ctx.result && ctx.result.avoid;
      const states = store.getConcerns().flatMap((c) => extractStates(c.text));
      if (avoid && states.length) {
        const hits = cautionsFor(avoid, states);
        if (hits.length) {
          const herb = ctx.result.name || '';
          // 屏幕也要有一行。只进播报的话，用户看到的是「黄连：性味苦寒…」，
          // 而「你说过脾胃虚寒」这句只在语音里飘过去，回头屏幕上找不到。
          if (ctx.result && typeof ctx.result.screenText === 'string') {
            ctx.result.screenText += `\n${cautionLine(herb, hits)}`;
          }
          return { say: cautionSpeech(herb, hits) };
        }
      }

      const items = store.listItems();
      if (items.length === 0) return null;

      const askedIds = new Set((ctx.nutrients || []).map((n) => n.id).filter(Boolean));
      const askedHerbs = new Set((ctx.recog && ctx.recog.known) ? ctx.recog.known : []);

      // ① 营养素：记着在吃 A，这次问 B，去看 A 和 B 之间有没有记录。
      for (const it of items) {
        if (!it.ref || askedIds.has(it.ref)) continue;
        for (const n of (ctx.nutrients || [])) {
          if (!n.id) continue;
          let r = null;
          try {
            r = pack.invoke('vitamin-mix', { nutrients: [n.id, it.ref] });
          } catch (err) {
            continue; // 查不了不算错，这次就是没什么可提醒的
          }
          if (r && r.found && r.hasWarning) {
            return { say: `你记着在吃${it.name}：${r.entries[0].advice}` };
          }
        }
      }

      // ② 药材：记着在吃某味药，这次问的是另一味。
      // 这里**不替用户下禁忌结论**——两味药之间有没有问题，要认全两味才有资格说，
      // 而用户嘴里只说了一味。所以只提醒「可以做这件事」，把判断交回给查询。
      for (const it of items.filter((x) => x.kind === 'herb')) {
        for (const a of askedHerbs) {
          if (a === it.name) continue;
          return { say: `你记着在吃${it.name}。如果打算一起用，建议先问「${a}和${it.name}能不能一起用」` };
        }
      }

      return null;
    },

    onError(ctx, err) {
      if (err && err.code === 'missing_item') {
        return '没听清要记什么。可以说「记一下我在吃钙片」这样';
      }
      // 存储写失败走到这里。必须说清是「没存上」，不能说「记下了」。
      return `这次没记上（${err && err.message}）。可以再说一次，或者检查设备的存储空间`;
    },
  });
}

export function askQihuang(agent, text, carry) {
  const ctx = agent.run(text, carry);
  return {
    verdict: ctx.verdict,
    intent: ctx.intent,
    conf: Number(ctx.conf.toFixed(2)),
    speech: ctx.speech,
    recognized: ctx.recog ? ctx.recog.herbs : [],
    result: ctx.result || null,
    issues: ctx.issues,
    trace: ctx.trace,
  };
}
