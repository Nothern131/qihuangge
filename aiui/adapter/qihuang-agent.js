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
// 状况 → 食补建议。匹配用药典「用于」原文，排序用《素问》「寒者热之」，
// 推荐前必须先知道用户在吃什么——这条门槛在 food-advice.js 里，不在这一层。
import { adviseFor, adviceLine, adviceSource, RULES } from './food-advice.js';
import { pickShiliao, commonHow, pickDish } from './recipe.js';
import { formulasForState, YANGLAO_SOURCE, YANGLAO_NOTE } from './yanglao-canon.js';
import { careForState, careForSeason, CARE_SOURCE } from './care-canon.js';
import { SHELF, shelfSummary, totalEntries, booksOn } from './bookshelf.js';
import { visionHint, visionFallback, visionScope, parseNames, pickLookupName } from './vision.js';
import { FOODS } from './food-canon.js';

// 本版明确不做的事。这些不是说错了，是根本不该由这个作品回答——
// 眼镜上一个只说三句话的助手给出剂量建议，比不给建议危险得多。
// 「怎么吃」曾经在这个表里，导致用户问「酸枣仁怎么吃」被回
// 「用量我不给建议」——他问的是做法，不是克数。做法走 howto 意图。
const DOSE_RE = /(吃多少|多少克|几克|几钱|几两|一天吃几次|一天几次|用量|剂量|每次用|服用多少)/;
// 问做法：认出了药名就是「这味怎么弄着吃」，没认出药名会落到别处。
const HOWTO_RE = /(怎么吃|怎么弄着吃|怎么做着吃|怎么做|怎么用|怎么喝|怎么熬|怎么煮|怎么泡|咋吃|教我|做法|怎么服)/;

/**
 * 问「你凭什么答」：书目、数据来源、收录范围。
 *
 * 这类问题必须答得出来而且是真数字——产品是「查书」不是「背答案」，
 * 书架上有什么、各多少条，直接说。说不清就别声称有依据。
 */
const BOOKS_RE = /(能查什么|会查什么|有什么书|哪些书|收录了什么|收录哪些|资料来源|数据来源|数据从哪|依据是什么|凭什么|你懂什么|知识库)/;
const BOOK_ONE_RE = /(这本书|那本书|哪本书).{0,8}(讲|说|有|写)/;

/**
 * 「看看这个」——把镜头当输入。
 *
 * 眼镜的载体优势就在这里：手里拿着一包药材，不用掏手机、不用打字，
 * 看一眼就问。所以这句不是「拍照功能」，是**主入口之一**。
 * agent 只负责说「我要看」，真去调相机的是页面（它才有 wx 能力）。
 */
const LOOK_RE = /(这是什么|这什么|看看这个|看一下这个|帮我看|认一认|认得吗|这是什么药|这是啥|拍一下)/;
const LOOK_SCOPE_RE = /(能认什么|能识别什么|认得什么|能认出来)/;

/**
 * 从「X怎么吃」里取出 X。
 *
 * 不用识别层的药名：那一层只认药典 102 味和本草纲目 863 条，
 * 「萝卜」这种常见食材不在里面，可它确实有古籍菜谱。
 * 取出来之后由 pickDish 判断有没有——查不到再回「没听过这味」。
 */
function howtoSubject(text) {
  const t = String(text || '');
  const m = t.match(/^(.{1,8}?)(?:怎么弄着吃|怎么做着吃|怎么吃|怎么做|怎么用|怎么喝|怎么熬|怎么煮|怎么泡|咋吃|做法|怎么服)/);
  if (!m) return '';
  // 去掉句首口头语和代词：「请问山药怎么吃」「那个山药怎么吃」
  return m[1].replace(/^(请问|问一下|我想知道|那个|这个|帮我看看|教我|教我做)/, '').trim();
}
const PRESCRIBE_RE = /(开个方|开方|配个方|开副药|处方|给我治|怎么治|吃什么药能治|我头疼|我咳嗽|我胃疼|辨证|把脉)/;

// 安慰措辞。这些词出现在有风险项的结论里就是自相矛盾，必须拦住。
const REASSURE_RE = /(可以放心|放心吃|放心用|没问题|没事|安全|可以一起|能一起吃)/;

// 养生调理类问法。定位叫「养生助手」，用户一定会问「失眠怎么调理」。
// 答「没听懂」是最差的反应——听起来像不会，实际是不该答。
// 这两件事对用户的意义完全不同：前者他会换个说法再试，后者他会去找会编的人。
const WELLNESS_RE = /(调理|养生|怎么养|怎么预防|怎么缓解|怎么改善|如何改善|如何调理|能治好|能治吗|能治|怎么治|什么能治|吃什么能|吃什么好|有什么办法|食补|食疗|偏方)/;
// 问「吃什么」这一类。它比 WELLNESS_RE 窄，而且能真正回答——
// 只要知道他的身体状况、知道他在吃什么，药典里就写着什么情况适合吃什么。
const ADVICE_RE = /(吃什么|吃点什么|吃啥|食补|食疗|怎么补|补什么|怎么吃好|吃什么好|能吃什么|吃哪些)/;
// 「怎么调理/怎么改善」——诉求是方向，不是治疗。认出了状况时转食补给方向，
// 没认出状况（「我头疼怎么办」）落在后面的拒答。比只说「记下了」有用。
const TUNE_RE = /(怎么调理|如何调理|怎么改善|如何改善|怎么缓解|怎么办|有(没有)?什么(好的?|好)?办法|有啥(好的?|好)?办法|有什么方法)/;
// 「肚子胀，不消化」这类口语不适陈述：说出来就是在要方向，
// 不带「怎么办/吃什么」也要接食补，否则只回「记下了」等于答非所问。
const DISCOMFORT_RE = /(肚子胀|腹胀|肚子疼|肚子痛|不消化|消化不良|不舒服|难受|有点障碍)/;
// 用户回答「我在吃什么」这个问题时可能说「没在吃」。
// 不认这一句，用户会被卡在「先告诉我你在吃什么」那一问上下不来。
const NO_MED_RE = /(没在吃|没有在吃|没吃药|没有吃药|不吃药|什么都没吃|没吃任何|什么药都没)/;
// 「想补气」「滋阴」这类需求描述。用户没说自己气虚，但意思到了。
const TONIC_RE = [
  { re: /(补气|益气)/, key: 'qi-deficiency', label: '气虚' },
  { re: /(补阴|滋阴|养阴)/, key: 'yin-deficiency', label: '阴虚' },
  { re: /(补阳|壮阳|温阳)/, key: 'yang-deficiency', label: '阳虚' },
  { re: /(补血|养血)/, key: 'blood-deficiency', label: '血虚' },
];

// 「记一下我在吃钙片」——这是「越用越懂你」唯一的入口。
// 没有它，产品永远只能回答当下这一句，用户用三个月和用一天没有区别。
//
// 判据原来只有一个宽正则，把「怎么泡水喝」判成了记档——因为「泡水喝」在里面。
// 那个词是为了接住「我泡着黄芪」，可它单独出现时是问句，不是交代。
// 用户听到「记下了：怎么泡水喝」会直接判定这产品坏了。
// 所以拆成三档：强触发优先，疑问优先于弱触发。
const MEMO_STRONG = /(记一下|记住|记下|帮我记)/;
// 疑问特征：带这些词就是在问，不是在交代。
const ASK_MARK = /(怎么|怎样|如何|多少|能不能|可不可以|可以吗|行不行|吗|呢|什么|哪些|哪个|要不要|是不是|有没有|多久|几次)/;
// 弱触发：没有「记」这个动作，但有「我」+ 持续状态。泡水的东西一样入口、一样会撞。
const MEMO_WEAK = /(我在吃|我在用|我在喝|我常吃|我一直在吃|我平时吃|我平时喝|我吃着|我喝着|在吃|吃着|在喝|喝着|泡水喝|泡着)/;

function isMemoIntent(text) {
  const t = String(text || '');
  if (MEMO_STRONG.test(t)) return true;   // 「记一下…」一定是交代
  if (ASK_MARK.test(t)) return false;     // 带疑问词就是在问
  return MEMO_WEAK.test(t);
}
// 「上次那个」「刚才问的」——跨句指代。
// 只认这几种明确说法，不碰「它」「这个」：代词在语音里指代对象太模糊，
// 补错了比不补更糟——用户会以为系统记错了东西。
const ELLIPSIS_RE = /(上次|刚才)(那个|问的|说的|那味|那味药)/;
// 省了主语的追问：「怎么泡水喝」「放多少」「能天天喝吗」。
// 语音里省略主语是常态——刚问完枸杞，下一句只说「怎么泡水喝」。
// 只认问吃法/用法/用量/频率的说法，不认「这个」「它」这类代词：指代太模糊，补错了更糟。
// 用户实测补的两类：
//   「主要是治什么的」——问用途，完全不含原表的词，于是整句被当药名去查，
//     回「没查到是治什么这味药」。这句是最典型的追问，不能漏。
//   「管什么用」「起什么作用」「干什么用的」同理。
// 「我是不是肾虚」「这算不算上火」——在要一个诊断结论。
//
// 这类和「我最近老失眠」不一样：后者是自述，我们按药典给方向是合法的；
// 前者是要我们下判断，而下判断必须望闻问切，说错要负责。
// 但也不能只回「不知道」——用户问这句时多半已经在担心了，
// 给一个具体的出口（说说哪儿不舒服、什么时候开始的）比一句拒绝有用。
const DIAGNOSE_ASK_RE = /(我|这|这个|我这样|我这).{0,5}(是不是|算不算|会不会是|有没有可能|是不是得了).{0,8}(虚|病|炎|寒|热|湿|火|亏|不足|瘀|堵)/;



const FOLLOWUP_RE = /(怎么泡|怎么喝|怎么吃|怎么用|怎么弄|咋吃|咋用|放多少|多少克|几克|能天天|天天喝|能天天喝|什么时候喝|什么时候吃|煮汤|能泡|泡几次|多久喝|连着喝|长期喝|一天喝|一天吃|还能怎么|治什么|治啥|主治|管什么|有什么用|有啥用|干什么用|干嘛用|起什么作用|主要治|治哪|对什么好|有什么好处|哪些人不能|什么人不能|谁不能吃|谁不适合|忌什么|什么情况不能|能不能常吃)/;
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
    const herbs = ctx.recog.known || [];

    if (!n && !herbs.length && !target) {
      const err = new Error('没听清要记什么');
      err.code = 'missing_item';
      throw err;
    }

    // 多味一起记：泡水常是几味配着（「枸杞菊花茶」），只记第一味
    // 后面核对就是漏的——用户以为交代过了，其实只交代了一半。
    const names = n ? [n.name] : (herbs.length ? herbs : [target]);
    const kind = n ? 'nutrient' : (herbs.length ? 'herb' : 'other');

    // rememberItem 在存储写失败时会抛，交给 pipeline 的 onError 处理。
    // 这里不做 try：捕获了就只能「假装记下了」，那是最坏的结果。
    let added = false;
    let profile = null;
    for (const nm of names) {
      const ref = n ? n.id : (herbs.length ? nm : null);
      const r = store.rememberItem(nm, kind, ref);
      added = added || r.added;
      profile = r.profile;
    }
    const label = names.join('、');
    return {
      found: true,
      intent: 'memo',
      name: label,
      kind,
      added,
      total: profile ? profile.supplements.length : 0,
      items: store.listItems(),
      speech: added
        ? `记下了：${label}。以后你问到它，我会先看一眼有没有冲突。`
        : `${label}已经记着了`,
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
      // 用 active 而不是全部：冷掉的状况（60 天没提）不该再触发行为提醒。
      // 数据还在，用户明确问起仍能查到——冷的只是「主动提」的资格。
      states = store.activeConcerns().flatMap((c) => extractStates(c.text));
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
  /**
   * 用户明确说了「没在吃」。存的不是记录，是知情本身（见 declareNoMeds 注释）。
   */
  function doNoMeds() {
    store.declareNoMeds();
    // 接着把被「不知道在吃什么」挡下的那一问答完——这是用户视角的关键一步：
    // 他答了「没在吃」，等的是答案，不是再问一遍。
    let pending = null;
    try {
      pending = store.getPendingAdvice();
      if (pending) store.clearPendingAdvice();
    } catch (err) {
      console.warn('[qihuang] 读 pendingAdvice 失败：', err && err.message);
    }
    if (pending) {
      const out = doAdvice({ text: pending });
      return {
        ...out,
        speech: `好，记着你现在没在吃药。${out.speech || ''}`,
        sayMax: Math.max(140, out.sayMax || 0),
      };
    }
    return {
      found: true,
      intent: 'no-meds',
      // 不教句式（「说『我脾胃虚寒』这种」读起来像在使用手册），
      // 直接举例——用户听到「睡不好、胃胀」就知道自己能说什么。
      speech: '好，记住了。以后哪儿不舒服直接说就行——睡不好、胃胀，都能问。',
    };
  }

  function doConcern(ctx) {
    const states = extractStates(ctx.text);
    if (!states.length) {
      const err = new Error('没听出是哪方面的状况');
      err.code = 'missing_item';
      throw err;
    }
    // 告诉 doAdvice「这轮的状况已经记过了」——它内部也有一次 addConcern，
    // 不打招呼就会重复记，importance 直接 +1。
    ctx.concernLogged = true;
    let added = 0;
    let reinforced = 0;
    for (const st of states) {
      // 孕期和出血倾向是 core：衰减率只有普通的 1/10，半年不提也不会冷掉。
      // 依据写在 profile-store 的 addConcern 注释里——这两类漏提醒的代价最高。
      const r = store.addConcern(st.raw, { core: st.key === 'pregnancy' || st.key === 'bleeding' });
      if (r.added) added += 1;
      else if (r.reinforced) reinforced += 1;
    }
    const names = states.map((x) => x.tags[0]).join('、');
    // 记完状况立刻回头看一眼：有没有正在做的养生行为和这条冲突。
    // 这个时机最好——用户刚说完自己的情况，正是他愿意听一句相关提醒的时候。
    // 等到下次问药才说，前面那句话早就过去了。
    const warns = practiceWarnings(states);

    // 记完**直接往下答**，不再只说「记下了」。
    //
    // 原来这里只回一句收据：
    //   「记下了：失眠。想知道吃什么，问「失眠吃什么好」」
    // 用户刚说完「我最近失眠」，要的是「那我吃什么」，得到的是一张收据 +
    // 一句「请再问一遍」。用户原话：「它没有延续性，上下文过了就是直接过了」，
    // 以及「再说失眠，它能很明显的说又记了一遍」——记住得越清楚，越显得没在帮他。
    //
    // doAdvice 里已经有完整的门槛（不知道在吃什么就先给方向预告、再问用药），
    // 直接复用，不另写一套。记档是静默完成的：答案里说了「失眠的话，药典里
    // 写着龙眼肉、百合适合」，本身就证明它知道你说的是什么，不需要再报一遍收据。
    const out = doAdvice(ctx);

    return {
      ...out,
      found: true,
      intent: 'concern',
      states: states.map((x) => x.key),
      // states 里存的是英文 key（yin-deficiency），那个东西只该给程序用。
      // 屏幕上直接显示 key 会变成「yin-deficiency 已记在档案里」，
      // 用户看到的是一串代码。
      stateNames: states.map((x) => x.tags[0]),
      warnings: warns,
      // 播报默认上限是 32 字，装不下「答案 + 那一句提醒」。
      // 提醒里带着出处，被截掉就等于只说了半句禁忌——这半句比不说更糟。
      sayMax: warns.length ? Math.max(150, out.sayMax || 0) : (out.sayMax || 90),
      speech: warns.length
        ? `${out.speech || ''}另外要看一下——${warns.join('；')}`
        : (out.speech || `记着了：${names}`),
    };
  }

  /**
   * 档案里正在吃的东西。返回 null 表示「不知道」，[] 表示「确实没在吃」。
   * 这两个必须分开——见 food-advice.js 里那句注释。
   */
  /** 档案里有没有身体状况记录。读失败当作没有，不阻断回答。 */
  function hasConcern() {
    if (!store) return false;
    try {
      return store.getConcerns().length > 0;
    } catch (err) {
      console.warn('[qihuang] 读状况失败：', err && err.message);
      return false;
    }
  }

  function eatingList() {
    if (!store) return null;
    let items = [];
    let plans = [];
    try {
      items = store.listItems() || [];
      plans = store.listMedPlans() || [];
    } catch (err) {
      console.warn('[qihuang] 读用药记录失败，本次不给建议：', err && err.message);
      return null;
    }
    if (!items.length && !plans.length) {
      // 档案里没有记录，但他明确说过「没在吃」——那就是知道，
      // 只是知道的是「没有」。这个知情是跨轮的（见 declareNoMeds）。
      return store.noMedsDeclared() ? [] : null;
    }
    // ref 是规范名（calcium），name 是原话（钙片）。查配伍用规范名。
    return [...new Set([
      ...items.map((x) => x.ref || x.name),
      ...plans.map((x) => x.name),
    ].filter(Boolean))];
  }

  /**
   * 状况 → 食补建议。这是整套东西里唯一一条**正向**建议：
   * 别处都在说「这个别吃」，只有这里说「照你的情况，药典里写着这几样适合」。
   *
   * 三道门，缺一道就不给：
   *   ① 知道身体情况（这次说的，或者档案里记着的）
   *   ② 知道在吃什么（档案里有记录，或者他明确说了没在吃）
   *   ③ 推荐的每一条都和 ② 交叉核对过，相冲的剔除
   *
   * 第 ② 道是核心。通用 AI 会直接甩一份「阴虚吃什么」的清单，
   * 不管你在吃二甲双胍还是华法林；而这里推荐哪几味，取决于你的用药记录。
   */
  /**
   * 「这味怎么弄着吃」。
   *
   * 用户问的是**做法**，不是克数。药典只写「10~15g」，食疗专著才写
   * 「熟煮和蜜，或为汤煎，或为粉，并佳」。所以答案按可靠度分三层排：
   *   ① 药典【用法与用量】原文——一定有，但常常只有克数
   *   ② 《食疗本草》原文一句——有就给，没有不强凑
   *   ③ 按入口形态的常见吃法——生活常识，措辞上必须和上面两层分开说
   *
   * 三层各标各的来源，不许混着说成「药典说这样吃」。
   */
  /**
   * 「你能查什么」——直接把书架报出来。
   *
   * 这不是炫技：产品的主张是「答案从这几本书来」，那用户就有权知道
   * 是哪几本、各多少条。数字取自数据模块本身，不是写死的宣传语。
   */
  /**
   * 收到「看看这个」：让页面去拍照。
   *
   * needCamera 是给页面看的指令，不是给用户的话——用户听到的是「我看一眼」。
   * 页面拍完把识别出的名字再喂回来（「黄芪怎么吃」），走现有链路，
   * 所以识别之后不用另写一套答题逻辑。
   */
  function doLook() {
    return {
      found: true,
      intent: 'look',
      needCamera: true,
      speech: '好，我看一眼',
      screenTitle: '正在看',
      screenText: '对准要查的东西，保持两秒',
      sourceTag: '识别只判断「是什么」，不判断「能不能吃」',
    };
  }

  function doLookScope() {
    return {
      found: true,
      intent: 'look-scope',
      speech: visionScope(),
      screenTitle: '能认出什么',
      screenText: `${visionScope()}。\n做法：说「看看这个」，对着它停两秒`,
      sourceTag: '按各书条目索引比对',
    };
  }

  function doBooks() {
    const lines = SHELF.map((b) => `${b.name}（${b.count} 条）：${b.ask}`);
    return {
      found: true,
      intent: 'books',
      sayMax: 140,
      speech: `我查的是 ${SHELF.length} 本古籍，一共 ${totalEntries()} 条：`
        + SHELF.map((b) => b.name).join('、')
        + '。想知道某一本收什么，问我就行',
      screenTitle: `书架 · ${SHELF.length} 本 ${totalEntries()} 条`,
      books: SHELF.map((b) => ({ name: b.name, era: b.era, count: b.count, ask: b.ask })),
      lines,
      sourceTag: '书目与条数来自数据模块本身',
    };
  }

  /** 「山药在哪本书里有」——跨书查一本。 */
  function doBooksOn(ctx) {
    const name = (ctx.recog && ctx.recog.known && ctx.recog.known[0]) || '';
    const hits = booksOn(name);
    if (!hits.length) {
      return {
        found: false,
        intent: 'books-on',
        speech: `这五本书里没有查到${name}。收录的是药食同源和常见食疗品种，太偏的没有`,
      };
    }
    return {
      found: true,
      intent: 'books-on',
      sayMax: 120,
      speech: `${name}在${hits.length}本书里有：${hits.map((h) => h.name).join('、')}`,
      screenTitle: `${name} 在 ${hits.length} 本书里`,
      hitBooks: hits.map((h) => h.name),
      sourceTag: '按各书条目索引查得',
    };
  }

  function doHowto(ctx) {
    // 优先用识别层的规范名（能把「桂圆」对上龙眼肉），
    // 认不出时用原句里取出的词——萝卜这种不在药典词表的食材靠这条路。
    const known = (ctx.recog && ctx.recog.known && ctx.recog.known[0]) || '';
    const name = known || howtoSubject(ctx.text);
    if (!name) {
      return {
        found: false,
        intent: 'howto',
        speech: '没听出是哪一味。直接说名字再问怎么吃，比如「山药怎么吃」',
      };
    }
    const food = FOODS[name] || {};
    // 三层来源，按「离用户要的东西有多近」排：
    //   ① 古籍菜谱（一整道菜，有原料有下锅顺序）— 用户问「怎么做」最想要这个
    //   ② 食疗本草（单味吃法：「熟煮和蜜」）
    //   ③ 形态常见吃法（生活常识兜底）
    const dish = pickDish(name);
    const rec = pickShiliao(name);
    const how = commonHow(name, { tabi: food.tabi });
    const dosage = String(food.dosage || '').split(/[。；]/)[0];
    const nature = String(food.nature || '').split('。')[0];

    // 播报：先用药典用法打底（可靠），再补古籍或常见吃法。
    // 都不长，但合起来会超默认 32 字，所以给足 sayMax。
    // 每一段自己可能已经带句号（古籍原文截的），拼接前统一剥掉再补，
    // 否则播报里会出现「…疗不能眠。。常见吃法…」这种双句号。
    const clean = (t) => String(t || '').replace(/[。；]+$/, '');
    const parts = [];
    if (dosage) parts.push(`药典写的用法是${clean(dosage)}`);
    if (dish) parts.push(`《山家清供》里有一道${dish.dish}：${clean(dish.text)}`);
    else if (rec) parts.push(`《食疗本草》记：${clean(rec.text)}`);
    if (how) parts.push(`常见吃法是${how}`);
    // 有禁忌/毒性的必须先说：苦杏仁这类「怎么吃」问得越具体，
    // 照着做的人越多，只讲做法不讲禁忌是最危险的答法。
    const tabi = clean(food.tabi);
    const body = parts.length ? parts.join('。') : '资料里没有它的具体做法';
    // 三层全空说明库里根本没有这味，不能假装查过
    if (!parts.length) {
      return {
        found: false,
        intent: 'howto',
        speech: `库里没有${name}的做法记录。常见药食同源的品种我都能查，比如山药、百合、山楂`,
      };
    }
    const speech = `${name}。${tabi ? `${tabi}。` : ''}${body}。用量按药典，个人用量遵医嘱`;

    return {
      found: true,
      intent: 'howto',
      name,
      nature,
      dosage,
      dish,
      recipe: rec,
      commonHow: how,
      tabi: String(food.tabi || ''),
      sayMax: 150,
      speech,
      screenTitle: `${name}怎么吃`,
      sourceTag: '《中国药典》2025年版一部',
    };
  }

  /**
   * 在标点处截断，避免把句子切成半句。
   * 找不到合适标点时退回硬截——总比留半句强。
   */
  /**
   * 这首方子在家做起来费不费劲。
   *
   * 用户的原话：「做起来现实中比较复杂的，可以给他们提一嘴，但是不建议去做」。
   * 判据不是玄学，看两样：
   *   · 要不要处理整只/内脏（猪肚、羊头、猪脾、鸡）——这是最费工的一步
   *   · 工序词数（缝、蒸、捣、研、炒、煨…）≥3 步
   * 复杂的照样把食材说出来（用户有权知道古人用了什么），
   * 但话术改成「偏麻烦，想做再问我」，不催着他动手。
   */
  function formulaHard(f) {
    const ing = (f.ing || []).join('');
    const method = String(f.method || '');
    if (/猪肚|羊头|羊脊|猪脾|猪肪|鸡|鸭|鱼|肚|肠/.test(ing)) return true;
    const steps = (method.match(/缝|蒸|煮|捣|研|炒|煨|浸|晒|焙|去骨|擘/g) || []).length;
    return steps >= 3;
  }

  function cutAtPunct(text, max) {
    const t = String(text || '').replace(/[。；]+$/, '');
    if (t.length <= max) return t;
    const head = t.slice(0, max);
    const i = Math.max(head.lastIndexOf('。'), head.lastIndexOf('，'), head.lastIndexOf('；'), head.lastIndexOf('、'));
    return i > max * 0.55 ? head.slice(0, i) : head;
  }

  function doAdvice(ctx) {
    const states = [];
    const seen = new Set();
    const push = (st) => {
      if (st && st.key && !seen.has(st.key)) { states.push(st); seen.add(st.key); }
    };

    const here = extractStates(ctx.text);
    for (const st of here) push(st);

    if (store) {
      try {
        // 食补同 decorate：查询触发的核对用全量。用户半年前说阴虚，
        // 今天问「吃什么好」，按阴虚给方向是核对记忆，不是猜。
        for (const c of store.getConcerns()) for (const st of extractStates(c.text)) push(st);
      } catch (err) {
        console.warn('[qihuang] 读状况失败，本次只用这句话里说的：', err && err.message);
      }
    }
    // 「想补气」「滋阴」这类需求，用户没说自己气虚，但意思到了。
    for (const t of TONIC_RE) if (t.re.test(ctx.text)) push({ key: t.key, tags: [t.label] });

    // 这轮新说的状况顺手记下来——他既然说了，下次问别的也该用得上。
    //
    // 但 doConcern 进来的时候已经记过了（而且它带 core 参数：孕期和出血倾向
    // 衰减慢 10 倍）。再记一次会让 importance 从 3 变 4，
    // 表现是「记一次等于说两次」——衰减测试就是这么抓出来的（20/29）。
    if (store && !ctx.concernLogged) {
      for (const st of here) {
        try {
          store.addConcern(st.raw);
        } catch (err) {
          // 存不上不影响这一轮回答，但要说清是「没记住」而不是「记住了」。
          console.warn('[qihuang] 状况没存上：', err && err.message);
        }
      }
    }

    let eating = eatingList();
    // 档案里没有记录，但他明确说了「我没在吃」——那就是知道，只是知道的是「没有」。
    // 当轮生效的同时持久化：下次再问，不再重问一遍「你在吃什么」。
    if (eating === null && NO_MED_RE.test(ctx.text)) {
      eating = [];
      try {
        store.declareNoMeds();
      } catch (err) {
        console.warn('[qihuang] 没在吃的声明没存上：', err && err.message);
      }
    }

    // 标题只说这轮问的：档案全量参与候选与核对（半年前说的阴虚今天问也是核对记忆），
    // 但话术主语对准本轮主题——否则问什么都是「全家桶」标题，
    // 用户第三次听就不知道系统在回答谁的问题。
    const topicLabels = (here.length ? here : states).map((x) => x.tags[0]);

    // 古籍方：按本轮主题的病类查《养老奉亲书》。
    // 这是唯一从「病」出发的一层——前三本都只能从「东西」出发。
    //
    // **只在「有对证方」的证候上查**。失眠、气虚、血虚、阴虚、阳虚、湿盛
    // 属调理类：古籍里对证的方（酸枣仁汤这类）是治病的，有剂量有配伍，
    // 让普通人照做要出事。这类只给方向——药典写适合什么、古籍写怎么吃。
    // 用户原话：「有的只能调理，比方说失眠」。
    const stateKeys = (here.length ? here : states).map((x) => x.key);
    const allRemedy = stateKeys.length > 0
      && stateKeys.every((k) => RULES[k] && RULES[k].mode === 'remedy');
    const formulas = allRemedy
      ? stateKeys
        .flatMap((k) => formulasForState(k))
        .filter((x, i, a) => a.findIndex((y) => y.name === x.name) === i)
      : [];
    // 挑一条：食材少、做法短的更容易照着做
    // 挑方规则：食材多的优先（≥3 样才像一道配起来的膳，单味的不是），
    // 同档里选做法短的（屏幕放得下）。实测按「食材最少」挑会挑到
    // 「煎猪肪方（猪肪+葱白）」——食材最少但什么也没配。
    const formula = formulas
      .slice()
      .sort((a, b) => {
        const rank = (x) => (x.ing.length >= 4 ? 0 : x.ing.length >= 3 ? 1 : 2);
        return rank(a) - rank(b) || a.method.length - b.method.length;
      })[0] || null;

    // 有古籍方时药味只列 2 味：屏幕就 160 字，方子（食材+做法）比
    // 第三味药更值钱。用户要的是「怎么配起来做」，不是药名清单。
    // 调护：不吃药的那部分方法。目标人群是「忙到没条件看医生、想调理舒服点」
    // 的人（程序员一类），对这类人只给「吃什么」不够——进食节奏、当季怎么吃，
    // 才是明天就能改的事。
    // 优先证候相关（脾胃→温热熟软），没有再取当季（秋→减辛增酸）。
    const care = stateKeys.map((k) => careForState(k)).find(Boolean) || careForSeason();

    const r = adviseFor(states, { eating, limit: formula ? 2 : 3 });

    if (!r.ok) {
      // 第二道门（不知道在吃什么）不给完整清单，但**先让用户闻到方向**——
      // 干巴巴的「我不给」是拒绝，「药典里写着酸枣仁这些适合，先确认你在吃什么」
      // 是负责。这是用户实测后明确要的范式：先给方法层预告，再问用药，再给全量。
      let reason = r.reason;
      let screenReason = '';
      if (r.code === 'no-history') {
        // 记住被挡下的这一问：用户交代完「在吃什么」后直接续答，不让他重说一遍。
        try {
          store.setPendingAdvice(ctx.text);
        } catch (err) {
          console.warn('[qihuang] pendingAdvice 没存上：', err && err.message);
        }
        const preview = [...new Set(states.filter((x) => RULES[x.key])
          .flatMap((x) => RULES[x.key].primary)
          .map((w) => Object.entries(FOODS).find(([, f]) => {
            const u = String(f.functions || '');
            const i = u.indexOf('用于');
            return i >= 0 && u.slice(i + 2, i + 40).includes(w);
          }))
          .filter(Boolean)
          .map(([n]) => n))].slice(0, 2);
        const head = preview.length
          ? `${topicLabels.join('、')}的话，药典里写着${preview.join('、')}适合。`
          : '';
        // 屏幕和播报**分开写**。
        //
        // 原来两者共用一句，结果为了「能一口气念完」把屏幕也压成了规则腔：
        // 「在吃在泡的说『记一下我在喝XX』」——那个 XX 是占位符，
        // 用户看到只会愣一下（这是要我填吗？）。「在吃在泡的」「都没有」
        // 省略主语又像规章条文。整段还挤成一块，480×400 屏上糊成一片。
        //
        // 用户原话：「我希望的是那种 deepseek 对话、豆包对话那种
        // 不是硬编码的感觉，这个感觉有点像硬编码」。
        //
        // 改法：屏幕给三段、每段一件事，问句用「你在吃什么」而不是「得先知道」；
        // 例子换成真东西（菊花茶），把「只问这一次」说出来——用户才不会觉得被盘问。
        // 播报仍是单段，去掉分段符（TTS 念不出换行），句子压到 70 字能一口气说完。
        reason = `${head}不过得先知道你在吃什么，药或者泡水的东西都可能撞。`
          + '有就说记一下在喝什么，没有就说我都没在吃。';
        screenReason = `${head}`
          + '\n\n不过得先知道你在吃什么——药，或者平时泡的东西，都可能和它撞。'
          + '\n\n有就说「记一下我在喝菊花茶」这样；没有就说「我都没在吃」，问过这一次就不再问。';
      }
      return {
        found: true,
        intent: 'advice',
        ok: false,
        code: r.code,
        states: topicLabels,
        stateNames: topicLabels,
        // 拒答话术必须能念完：默认 32 字会把「为什么」和「怎么办」全裁掉
        // （实测只念出「我还不知道你在吃什么药或保健品，」半句）。
        sayMax: 120,
        speech: reason,
        // 屏幕版：分段、带具体例子。没有就退回播报词，不让屏幕空着。
        screen: screenReason || reason,
      };
    }

    const stateLabel = topicLabels.join('、');
    const names = r.picks.map((p) => p.name).join('、');
    // 播报只念前两条的适应证：第三条念完就超了，而用户听完最想知道的是
    // 「为什么是这几样」，不是把七条适应证都听一遍。屏幕上是全的。
    const brief = r.picks.slice(0, 2)
      .map((p) => `${p.name}用于${p.use.split('，')[0]}`)
      .join('，');

    // 被剔除的单独说一句。不说不等于没发生——用户可能正奇怪
    // 「我明明记得党参也补气，怎么没提」。
    const blocked = r.skipped.filter((x) => x.blocked);
    const blockNote = blocked.length
      ? `另：${blocked.map((b) => b.name).join('、')}和你记着在吃的${blocked[0].why.match(/在吃的(.+?)相冲/) ? blocked[0].why.match(/在吃的(.+?)相冲/)[1] : '药'}相冲，没有列进来`
      : '';

    // 就医提醒只针对**本轮主题**，不是档案全家桶。
    // 实测踩到的：先问过失眠、再问便秘，播报里仍然念「老失眠要先看医生」——
    // 用户问的是便秘，听到这句只会以为系统答错了题。
    // （r.notes 是全档案累积的，这里按本轮 states 重新取。）
    const topicKeys = (here.length ? here : states).map((x) => x.key);
    const medNote = topicKeys
      .map((k) => (RULES[k] ? RULES[k].why : ''))
      .find((w) => /看医生/.test(w)) || '';

    // 调理类要把「为什么不给方」说出来。沉默不给，用户会当成系统没本事；
    // 说明白「这类只能调，对证的方是治病的不能照做」，才是负责。
    const regulateNote = !formula && topicKeys.some((k) => RULES[k] && RULES[k].mode === 'regulate')
      ? '这类靠日常调理，对证的方是治病的，不能照着抓'
      : '';

    // 用法是「用法断层」的答案：用户拿到方向后下一个问题一定是怎么入口。
    // 只念第一条的用法（字数约束），屏幕上每条都有。
    // 措辞边界：念药典【用法与用量】原文是引用国标，不是给个人剂量建议——
    // 「遵医嘱」四个字必须跟在后面，两者缺一不可。
    const usage0 = r.picks[0] && r.picks[0].usage
      ? `药典写${r.picks[0].name}的用法是${String(r.picks[0].usage).split(/[。；]/)[0]}，`
      : '';

    // 核对不了就要说核对不了：在吃的西药/保健品不在药食同源数据里时，
    // 逐味跳过会被理解成「已经核对过、没问题」——把查不到的明说出来，
    // 并指向真正的判断人（医生/药师）。这句比「不是方子」重要，排在它前面。
    const unverified = (r.unverifiable || []);
    const unverifiedNote = unverified.length
      ? `${unverified.join('、')}查不了和它的冲突，同服前问医生`
      : '';

    // 「怎么做」优先于「多少克」：用户拿到药名后第一个问题是蒸它煮它，
    // 不是精确到克。有食疗本草的做法就念做法，没有才退回药典用量。
    // 两者不并列——并列会挤掉「不是方子」这类必须说的边界。
    // 有古籍方就先说方：用户要的是「几样东西配起来做」，不是单味药名。
    const formulaNote = formula
      ? (formulaHard(formula)
        // 复杂方：报名字、报食材、说清楚麻烦在哪，不报工序。
        // 用户「提一嘴但不建议去做」，真想做了会追问，那时再给细节。
        ? `${YANGLAO_SOURCE.replace('（宋·陈直，约 1085 年）', '')}里有个${formula.name}，`
          + `用${formula.ing.join('、')}，不过做起来麻烦，想做的话再问我详细步骤`
        // 简单方：食材 + 做法都说
        : `${YANGLAO_SOURCE.replace('（宋·陈直，约 1085 年）', '')}里有${formula.name}：`
          + `${formula.ing.join('、')}，${cutAtPunct(formula.method, 40)}`)
      : '';
    const cook = r.picks.map((pk) => ({ name: pk.name, rec: pickShiliao(pk.name) }))
      .find((x) => x.rec && x.rec.cookable);
    // 古籍没写到做法时退到「常见吃法」——但必须说清这是常见吃法，
    // 不能让人以为本草纲目或药典写了这句。
    const howFallback = r.picks
      .map((pk) => ({ name: pk.name, how: commonHow(pk.name, { tabi: pk.tabi }) }))
      .find((x) => x.how);
    // 调护**不进播报**：文言句子念出来听不懂（「其枕宜用夹熟色帛」），
    // 屏幕上看得懂。播报的字数留给「怎么做着吃」——那才是用户当下要的。
    const cookNote = formulaNote || (cook
      ? `《食疗本草》记${cook.rec.asked || cook.name}：${cook.rec.text}`
      : (howFallback ? `${howFallback.name}常见吃法是${howFallback.how}` : ''));

    // 顺序即优先级：toBrief 超长时从尾部截。未核对与相冲声明是高危信息，
    // 必须排在「不是方子」这类免责声明之前，否则超长时先被裁掉。
    const speech = `${stateLabel}的话，药典里写着适合的有${names}。${brief}。`
      + (medNote ? `${medNote}。` : '')
      + (regulateNote ? `${regulateNote}。` : '')
      + (unverifiedNote ? `${unverifiedNote}。` : '')
      + (cookNote || `${usage0}个人用量遵医嘱`)
      // 给了方还说「不是方子」是自相矛盾。有方时的边界是「原文含用量，别照抓」。
      + (formula
        ? '。方是古籍原文，带用量和炮制，别照着抓'
        : '，这些只是方向，不是方子')
      + (blockNote ? `。${blockNote}` : '');

    return {
      found: true,
      intent: 'advice',
      ok: true,
      // 只给本轮主题（标题/播报主语），不是档案全家桶——理由见 topicLabels。
      states: topicLabels,
      stateNames: topicLabels,
      picks: r.picks.map((pk) => ({
        ...pk,
        // 性味只留到归经之前。屏幕上一条只有一行，
        // 「甘，微温。归肺、脾经」里归经那 6 个字帮不上「该不该吃」的判断。
        nature: String(pk.nature || '').split('。')[0],
        // 「怎么做着吃」——取《食疗本草》原文一句。查不到就是 null，
        // 不拿别的书顶替（本草纲目附方多是治病方剂，见 recipe.js 注释）。
        shiliao: pickShiliao(pk.name),
        // 古籍没这味时的兜底：按入口形态给常见吃法。
        // 措辞必须区分来源——这是生活常识，不是药典也不是古籍。
        commonHow: commonHow(pk.name, { tabi: pk.tabi }),
      })),
      blocked,
      care: care ? { text: care.text, tag: care.tag, book: CARE_SOURCE } : null,
      formula: formula
        ? {
          name: formula.name, effect: formula.effect, ing: formula.ing, method: formula.method,
          hard: formulaHard(formula), book: YANGLAO_SOURCE, note: YANGLAO_NOTE,
        }
        : null,
      unverifiable: unverified,
      // 播报比默认 32 字长得多：三条药名加一句依据，压到 32 就只剩半句结论。
      // 但也不能无限长——120 字大约是念 8 秒。
      sayMax: 160,
      // 出处分两段：适应证是药典的，排序是按《素问》的。
      // 只写药典的话，「为什么偏凉的排前面」这件事就没主了。
      source: adviceSource(),
      sourceTag: '《中国药典》2025年版一部；排序依《素问》寒者热之',
      speech,
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
      sayMax: warns.length ? 150 : 90,
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
      // 唤醒词剥离：真机上唤醒词由系统层吃掉，但用户习惯带出来说
      //（「你好乐奇，我最近睡眠有点障碍」），模拟输入和部分机型也会把它
      // 转成文字送进来。不剥的后果是把「你好乐奇」当药名去查——
      // 实测输出过「本草库里还没有收录你好乐奇」，用户看到的是系统连门都没入。
      // 只剥句首的整词，不动句中任何字。
      ctx.text = String(ctx.text || '').replace(/^(你好|嗨|嘿)?[，,\s]*乐奇[，,\s]*/u, '').trim();
      // 「上次那个」这类指代，先换成上次说过的药名再识别。
      // 这是记忆唯一能被**听见**的另一条路：不是记住你吃什么，是记住你刚才问什么。
      // 放在 normalize 而不是 interpret：后面每一站都读 ctx.text，
      // 在这里换掉，等于整条链路都拿到了补全后的问题。
      resolveEllipsis(ctx);
      let r = pack.recognize(ctx.text);

      // 省了主语的追问，接上一次查的那味药。
      //
      // 必须在这一步做：先确认这句话自己认不出药名（认出了就不能覆盖），
      // 再补，补完立刻重认——不然带着旧结果往下走，等于白补。
      // 不补的后果很具体：切词把「怎么泡水喝」当整体去查，
      // 回一句「本草库还没收录怎么泡水喝」，用户听到的是这应用不认识中国话。
      // 判断依据必须是 known（真在库里的药），不能用 herbs——
      // 切词器会把「怎么泡水喝」整句当成一味药塞进 herbs，
      // 拿 herbs 判空就永远判不出「这句话没提药名」。
      // 代词开头也算「省了主语」：「这个能吃吗」「那它有毒吗」。
      // FOLLOWUP_RE 管的是问法（怎么泡/治什么），管不到「这个」这种指代。
      const PRONOUN_ASK = /^(这个|那个|它|这|那)(东西)?(能|可以|会不会|有没有|是|怎么|咋)/;
      const knownFirst = Array.isArray(r.known) ? r.known : [];
      if (knownFirst.length === 0 && (FOLLOWUP_RE.test(ctx.text) || PRONOUN_ASK.test(ctx.text))) {
        const lastHerb = findLastHerb();
        if (lastHerb) {
          ctx.text = `${lastHerb}${ctx.text}`;
          ctx.followup = { resolvedTo: lastHerb };
          r = pack.recognize(ctx.text);
        }
      }

      // 「这个」「那个」「它」不是药名，是代词。
      //
      // 切词器不认识代词，会把它当成一味没收录的药，于是答
      // 「本草库还没收录这个」——用户听到的是这产品在装傻：
      // 明明手里拿着东西问「这个能吃吗」，它回「没收录这个」。
      // 实测（2026-11-09 场景测试）：「这个能吃吗」→「本草库还没收录这个」。
      //
      // 过滤掉之后如果还有上文，下面的补主语逻辑会把它接上一次问的药；
      // 没上文就落到「没听出」，让用户说个名字，比硬查一个代词强。
      const PRONOUN = /^(这个|那个|它|这|那|这种|那种|这个东西|那个东西|这样|那样)$/;
      for (const k of ['herbs', 'known', 'plausible']) {
        if (Array.isArray(r[k])) r[k] = r[k].filter((x) => !PRONOUN.test(String(x).trim()));
      }
      if (Array.isArray(r.unknown)) r.unknown = r.unknown.filter((x) => !PRONOUN.test(String(x).trim()));

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
      // 问「这味怎么做着吃」：不能落到下面的剂量拒答。
      // 位置必须在 DOSE_RE 之前——两者都含「怎么吃」时，做法优先。
      //
      // 不要求先认出药典词表里的药名：用户问「萝卜怎么吃」，
      // 萝卜不在药食同源 102 味里，但《山家清供》里有它的菜谱（玉糁羹）。
      // 从原句里直接取「X怎么吃」的 X，取不到再交给下游判。
      if (LOOK_SCOPE_RE.test(ctx.text)) {
        return { intent: 'look-scope', conf: 1 };
      }
      // 「看看这个」要在药名识别之前判：这时候用户还没说是什么，
      // 让切词层去猜只会猜出个奇怪的东西。
      if (LOOK_RE.test(ctx.text)) {
        return { intent: 'look', conf: 1 };
      }
      if (BOOKS_RE.test(ctx.text)) {
        return { intent: 'books', conf: 1 };
      }
      // 「山药在哪本书里有」——先认药名，再读书架
      if (BOOK_ONE_RE.test(ctx.text) && ctx.recog && ctx.recog.known && ctx.recog.known.length) {
        return { intent: 'books-on', conf: 1 };
      }

      if (HOWTO_RE.test(ctx.text) && howtoSubject(ctx.text)) {
        return { intent: 'howto', conf: 1 };
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

      // 问「吃什么」这一类，必须排在最前面判。
      //
      // 排在「状况陈述」后面时，这句会先被当成陈述吞掉：
      // 实测「我阴虚吃什么好」得到的是「阴虚 已经记着了」——
      // 用户问的是吃什么，答复是"记着了"，答非所问，而且看起来像系统在复读。
      //
      // 排在 memo 前面也是必须的：「我在吃」这个短语会命中记忆意图，
      // 而「我没在吃什么药」恰恰是在**否认**在吃，不是要记东西。
      //
      // 两个入口：
      //   ① 直接问「吃什么好」「食补」「想补气」
      //   ② 他回答上一轮那句「你在吃什么」时说「我没在吃」，且档案里有状况
      // 排掉认出了营养素的句子：「补钙怎么补」含「怎么补」，
      // 但它问的是钙怎么补，该走营养素那条路。被食补抢走的话，
      // 用户会得到一句「我还不知道你在吃什么」——完全答非所问。
      const hasNutrient = (ctx.recog.nutrients || []).length > 0;
      if (!hasNutrient
        && (!ctx.recog.known || ctx.recog.known.length === 0) && (ADVICE_RE.test(ctx.text)
        || ((TUNE_RE.test(ctx.text) || DISCOMFORT_RE.test(ctx.text)) && extractStates(ctx.text).length > 0)
        || (NO_MED_RE.test(ctx.text) && hasConcern()))) {
        return { intent: 'advice', conf: 1 };
      }

      // 单独一句「我什么都没在吃」：不是要记东西（记不出条目），
      // 是在回答「你在吃什么」这类追问。把「没在吃」本身当知情存下来，
      // 否则按拒答话术交代的用户，下一问还是被拒——被话术耍一圈。
      if (!hasNutrient
        && (!ctx.recog.known || ctx.recog.known.length === 0)
        && NO_MED_RE.test(ctx.text)
        && !/[?？]|吗|能不能|可不可以/.test(ctx.text)) {
        return { intent: 'no-meds', conf: 1 };
      }

      // 纯状况陈述（「我脾胃虚寒」「我在备孕」）记成档案，不走向查询。
      // 判据要窄：带药名的（「我胃寒能吃黄连吗」）必须放去查询——
      // 那是他真正想问的事，只记个状况等于没回答。
      const states = extractStates(ctx.text);
      // 判据用 known（库里认得的药名）而不是 herbs（切词切出来的）：
      // 切词有个兜底，会把「脾胃虚寒」整串当成一味药名，herbs 就不为空了，
      // 这条分支永远进不去——而这正是最常见的一句。
      if (states.length && (!ctx.recog.known || ctx.recog.known.length === 0)
        && !ADVICE_RE.test(ctx.text)
        && !/[?？]|吗|能不能|可不可以/.test(ctx.text)) {
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

      // 「记一下」优先于查询：用户在交代一件事，不是在提问。
      // 没有 store 时必须明说存不了，不能装作记住了——
      // 用户以为记下了，明天再问「我记的都有什么」会得到空，这种失望比当场报错重得多。
      // 判据扩过一次：除了「记一下 / 我在吃」这类明说的，**能解析出「几点吃什么」的也算**。
      // 因为交代用药时用户经常不重复动词——「早上八点吃二甲双胍，晚上八点吃阿托伐他汀」，
      // 后半句没有「记一下」，但它显然还在同一次交代里。
      // 不扩的话，后半句会掉进查询，回一句「这句没听懂」，用户得把整句重说一遍。
      // 疑问句不当作交代：「早上八点吃什么好」能被解析出时间，但它是在问，不是在交代。
      const looksLikePlan = !ASK_MARK.test(ctx.text) && parseMedPlans(ctx.text).length > 0;
      if (isMemoIntent(ctx.text) || looksLikePlan) {
        if (!store) {
          return {
            stop: true,
            speech: '这台设备上没法保存记录，我只能当场回答，记不住你之前说过什么',
          };
        }
        return { intent: 'memo', conf: 1 };
      }

      // 「我是不是肾虚」这类先拦下来。
      //
      // 位置很关键：必须在药名处理之前。因为「肾虚」会被切词器当成一味药，
      // 走到下面就成了「本草库还没收录肾虚」——听着像这味药没收录，
      // 实际是用户要一个诊断，我们给不了。两件事不能让用户分不清。
      //
      // 但如果句子里还问了「吃什么」（「我是不是肾虚，吃什么好」），
      // 就不拦——他要的是方向，方向可以给。
      if (DIAGNOSE_ASK_RE.test(ctx.text) && !ADVICE_RE.test(ctx.text)) {
        return {
          stop: true,
          speech: '是不是，我不能判——那要望闻问切，我随口说是对你不负责。'
            + '但你可以说说哪儿不舒服、什么时候开始的，我按药典给食补方向。'
            + '要确诊还是得看医生。',
        };
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
        // 拒答要给出口：食补方向（吃什么好）是能做的，这里告诉用户怎么问。
        return {
          stop: true,
          speech: '调理和诊断这类我不做，涉及辨证，说错要负责。'
            + '想知道吃什么，可以说「我失眠吃什么好」这种，我按药典给方向',
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
      if (ctx.intent === 'no-meds') return { result: doNoMeds() };
      if (ctx.intent === 'concern') return { result: doConcern(ctx) };
      if (ctx.intent === 'advice') return { result: doAdvice(ctx) };
      if (ctx.intent === 'howto') return { result: doHowto(ctx) };
      if (ctx.intent === 'books') return { result: doBooks() };
      if (ctx.intent === 'look') return { result: doLook() };
      if (ctx.intent === 'look-scope') return { result: doLookScope() };
      if (ctx.intent === 'books-on') return { result: doBooksOn(ctx) };
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
      if (r.intent === 'memo' || r.intent === 'no-meds' || r.intent === 'concern' || r.intent === 'practice'
        || r.intent === 'advice' || r.intent === 'howto'
        || r.intent === 'books' || r.intent === 'books-on'
        || r.intent === 'look' || r.intent === 'look-scope') return { issues: [] };

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

      if (ctx.intent === 'memo' || ctx.intent === 'no-meds' || ctx.intent === 'concern' || ctx.intent === 'practice'
        || ctx.intent === 'advice') return null;

      // ① 状况 × 本草禁忌，排在「你记着在吃 X」之前。
      // 前者是「这一条你可能不该用」，后者是「你还有别的在吃」——
      // 一起出现时先说更急的那条。
      // 依据全部来自本草条目的 tabi 原文，一个字都没改；命中就念原话，没命中就闭嘴。
      const avoid = ctx.result && ctx.result.avoid;
      // 查询核对用**全量**，不看冷热——这是上一版改错的地方，值得写清为什么。
      //
      // 用户问「黄连能吃吗」，核对黄连禁忌 vs 他说过的所有状况，
      // 是回答这个问题所必需的，不是主动打扰。半年前说的脾胃虚寒
      // 碰上黄连的「脾胃虚寒者慎用」，恰恰是最该提的时刻。
      // 冷热只该管「没人问也凑上去说」的主动提醒（见 practiceWarnings）。
      //
      // 冷记忆在这里被命中时还要热回来（reheatConcern）：不然用户的感知是
      // 「上次它记得，这次忘了」——比从来记不住更伤信任。
      const states = store.getConcerns().flatMap((c) => extractStates(c.text));
      if (avoid && states.length) {
        const hits = cautionsFor(avoid, states);
        if (hits.length) {
          const herb = ctx.result.name || '';
          // 命中就把相关的那几条热回来。
          // cautionsFor 的每项是 {state: 标签, line: 原文}，state 是单个字符串，
          // 和状况的 tags（「脾胃虚寒」「虚寒」这些词）比对——第一次写成
          // h.states.some(...)，那个字段不存在，整段被 pipeline 的 catch 吞掉，
          // 表面症状是「冷记忆没热回来」，报错只在日志里。
          const hitTags = new Set(hits.map((h) => h.state));
          for (const c of store.getConcerns()) {
            const tags = extractStates(c.text).flatMap((x) => x.tags);
            if (tags.some((t) => hitTags.has(t))) store.reheatConcern(c.text);
          }
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
