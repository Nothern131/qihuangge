// 状况 → 食补建议。
//
// 这个文件解决的是「我阴虚吃什么好」这一类问题。它只做一件事：
// 把用户说过的身体状况，和《中国药典》里**每味药自己写的「用于…」**对上，
// 然后把命中的那几味连同原文一起给出来。
//
// 依据分两层，都必须是真原文：
//
//   ① 匹配：用《中国药典》2025 年版一部「功能与主治」里「用于…」那一段。
//      比如麦冬写的是「养阴生津，润肺清心。用于肺燥干咳，阴虚痨嗽…」，
//      用户说「阴虚」，命中的是**药典自己写的「阴虚痨嗽」**，
//      不是我们推「麦冬能滋阴所以适合阴虚的人」。
//
//   ② 排序：用性味寒热，《素问·至真要大论篇第七十四》「寒者热之，热者寒之」。
//      阴虚偏热，先给偏凉的；阳虚偏寒，先给偏温的。
//      这一步是**排序**，不是筛选——方向相反的照样列出来并说明，
//      因为药典可能两种方向都写了（比如黄芪也写「内热消渴」，
//      但它是温的，所以排在阴虚榜的末尾并注明「性味偏温，不作首选」）。
//
// 三件不做的事：
//   · 不给剂量。理由和别处一样：分量要看体质、炮制、配伍。
//   · 不给孕妇推荐。孕期食补的风险远高于这几条通用建议能覆盖的范围，
//     只说「按产检医生的来」。
//   · 不把「药典没列禁忌」当成「可以放心吃」。推荐里附的是药典原话，
//     不是「安全」的背书。

import { FOODS } from './food-canon.js';
import { canonPair } from './pair-canon.js';

/** 《素问·至真要大论篇第七十四》原文，排序依据。 */
export const NATURE_RULE = '《素问·至真要大论篇第七十四》';

/**
 * 每个状况怎么匹配、往哪个方向排。
 *
 * fit 里的词必须原样出现在药典「用于…」段落里才算命中。
 * 措辞刻意用书里的原词，不用同义改写——改写一次，就可能把
 * 「气血两虚」说成「气虚」，而那两味药不是一回事。
 */
export const RULES = {
  // 审计脚本（tools/audit-food-coverage.js）与测试直接读这份，
  // 改了词表必须重跑审计：断裂点就是下一次的补数据清单。
  'yin-deficiency': {
    label: '阴虚',
    // 「内热消渴」「津伤口渴」是药典写阴虚时常用的完整表述，
    // 单独收「口渴」会命中一堆解表药。
    // 分两级：primary 是「阴虚」这件事本身，secondary 是阴虚常见的兼症。
    // 只有 secondary 命中的（比如人参叶的「津伤口渴」）排到最后——
    // 它是治气虚咳嗽的药，不是滋阴药。
    primary: ['阴虚', '阴伤', '阴虚火旺'],
    secondary: ['虚热', '内热消渴', '津伤口渴'],
    // 阴虚偏热，偏凉的排前面
    bias: 'cool',
    why: '阴虚偏热，偏凉的更对路',
  },
  'spleen-cold': {
    label: '脾胃虚寒',
    primary: ['脾胃虚寒', '胃寒', '脘腹冷痛'],
    secondary: ['食少便溏', '久泻', '呕吐泄泻'],
    bias: 'warm',
    why: '脾胃虚寒，偏温的更对路',
  },
  'qi-deficiency': {
    label: '气虚',
    primary: ['气虚', '中气下陷'],
    secondary: ['乏力', '体倦', '倦怠'],
    bias: 'warm',
    why: '补气的东西多半偏温，吃完感觉燥就减量',
  },
  'yang-deficiency': {
    label: '阳虚',
    primary: ['阳虚', '畏寒', '宫冷'],
    secondary: ['肢冷'],
    bias: 'warm',
    why: '阳虚偏寒，偏温的更对路',
  },
  damp: {
    label: '湿盛',
    // 湿有寒湿、湿热之分，方向相反的处理办法也相反，
    // 所以这一类**不设方向偏置**，只按药典写的适应证列出来。
    // 不收「水肿」也不收「湿痹」：白茅根、郁李仁都写「水肿尿少」（一个凉血止血、
    // 一个润肠通便），当归写「风湿痹痛」（那是关节痛，不是湿气重）。
    // 拿来做「湿气重」的食补建议，方向对不上。
    primary: ['痰饮', '湿浊', '湿阻'],
    secondary: ['脚气'],
    bias: null,
    why: '湿分寒湿和湿热，方向不定，这里只列药典写了适合的',
  },
  constipation: {
    label: '便秘',
    // 「便秘」16 味、「肠燥」13 味——都是药典适应证段的原文用词
    // （火麻仁「用于血虚津亏，肠燥便秘」）。偏置不设：热秘寒秘虚秘都有，
    // 排序只按药典写的贴切度。识别侧刻意不收「大便干结」——
    // 那是实热的指征，走 NO_ADVICE 拒答，同一个词不能既拒答又给建议。
    primary: ['便秘', '肠燥'],
    secondary: ['津亏'],
    bias: null,
    why: '便秘分寒热，这里只列药典写了适合的',
  },
  insomnia: {
    label: '失眠',
    // 只收药典写的「失眠/虚烦失眠/多梦」（龙眼肉、百合、酸枣仁等）。
    // 持续失眠可能是疾病信号，这里给的是「药典写了适合吃的方向」，
    // 不是解决失眠的方案——这句必须让用户听到（why 会进播报）。
    primary: ['失眠', '虚烦', '多梦'],
    secondary: ['心悸失眠'],
    bias: null,
    why: '老是睡不着要先看医生，这里只是药典写了适合吃的方向',
  },
  'food-stagnation': {
    label: '食积腹胀',
    // 「食积」6 味、「腹胀」9 味——山楂、麦芽、鸡内金、莱菔子全是
    // 食品级消导药，药典适应证原文背书。
    primary: ['食积', '腹胀', '脘腹胀'],
    secondary: ['泻痢'],
    bias: null,
    why: '消食的方向都差不多，按药典写的适应证列',
  },
  'blood-deficiency': {
    label: '血虚',
    // 「血虚」5 味（当归「用于血虚萎黄」）。「贫血」是西医概念、
    // 药典没写，不收——收了就是把西医词塞进中医证候，两头都不真实。
    primary: ['血虚', '面色萎黄'],
    secondary: [],
    bias: 'warm',
    why: '补血的东西多半偏温，吃了容易上火就减量',
  },
};

/** 不给建议的状况。 */
export const NO_ADVICE = {
  pregnancy: '孕期和哺乳期的食补要按产检医生或儿科医生说的来，我不给这类建议',
  bleeding: '有出血倾向时吃什么，要先让医生看过再定，我不给这类建议',
  'excess-heat': '实热（正在发热、大便干结这类）先处理当下的问题，食补往后放',
  exterior: '感冒期间不宜进补，先把外感处理好',
};

const NATURE_DIR = (s) => {
  const t = String(s || '');
  if (/微寒|寒|凉/.test(t)) return 'cool';
  if (/微温|温|热/.test(t)) return 'warm';
  return 'neutral';
};

/** 药典「用于…」那一段。没有就返回空串——没写适应证的不参与匹配。 */
function usePart(food) {
  const fx = String(food.functions || '');
  const i = fx.indexOf('用于');
  if (i < 0) return '';
  // 只取第一段适应证。地黄、当归这类条目在药典里是分两段写的
  //（「鲜地黄…用于…。生地黄…用于…」），全取会把两段拼成一句，
  // 屏幕上像重复，也白占字数。
  const rest = fx.slice(i + 2);
  // 「；外治…」是药典正文的外用栏目，食补场景永不涉及；
  // 而「外治」二字进了播报听着像在宣称治疗。截掉它，
  // 内服段仍是逐字原文——这不是删改，是不念不相关的栏目。
  const stops = [rest.indexOf('。'), rest.indexOf('；')].filter((x) => x >= 0);
  if (!stops.length) return rest;
  return rest.slice(0, Math.min(...stops));
}

/** 去掉末尾句号，拼句子时不出现「…。，」。 */
const trimDot = (s) => String(s || '').trim().replace(/[。；，]+$/, '');

/**
 * 按状况给食补建议。
 *
 * @param {Array} states extractStates 的结果
 * @param {object} opts
 * @param {string[]} opts.eating 已记录在吃的东西（supplements + medPlans 的药名）
 * @param {number} opts.limit 最多给几条，默认 4
 * @returns {{ok:boolean, reason:string, picks:Array, skipped:Array, notes:string[]}}
 */
export function adviseFor(states, opts = {}) {
  const list = Array.isArray(states) ? states : [];
  const limit = opts.limit || 4;

  // 这道门是这个功能的核心，也是它和「通用 AI 给一堆养生清单」的分界。
  //
  // eating 为 null = 档案里什么都没记，我们不知道他在吃什么；
  // eating 为 []   = 明确知道他现在没在吃任何药或保健品。
  // 两者必须分开：前者不能给建议（推荐的东西可能和他没说的药相冲），
  // 后者可以。把它们都当成空数组，等于假装知道。
  if (!Array.isArray(opts.eating)) {
    return {
      ok: false,
      code: 'no-history',
      reason: '我还不知道你在吃什么药或保健品，这种时候给食补建议是瞎给——'
        + '万一和你正在吃的相冲，比不给更糟。可以说「记一下我在吃二甲双胍」，我记着了再给建议',
      picks: [],
      skipped: [],
      notes: [],
    };
  }

  if (!list.length) {
    return {
      ok: false,
      code: 'no-state',
      reason: '我还不知道你是什么情况，给不了针对性的建议。可以说「我阴虚火旺」「我脾胃虚寒」这种',
      picks: [],
      skipped: [],
      notes: [],
    };
  }

  // 孕妇和出血倾向优先拦截：这两类即使有其它状况也不给建议，
  // 因为最容易出事的就是它们，而它们恰恰是「多喝点 xx」这种话最危险的场景。
  const blocked = list.find((s) => NO_ADVICE[s.key]);
  if (blocked) {
    return {
      ok: false,
      code: 'no-advice-state',
      reason: NO_ADVICE[blocked.key],
      picks: [],
      skipped: [],
      notes: [],
    };
  }

  const usable = list.filter((s) => RULES[s.key]);
  if (!usable.length) {
    return {
      ok: false,
      code: 'unmapped',
      reason: `你说的这个情况（${list.map((s) => s.tags[0]).join('、')}）我没有对应的食补条目，不乱给`,
      picks: [],
      skipped: [],
      notes: [],
    };
  }

  // 已经推荐过的别重复（阴虚 + 气虚 会同时命中大枣、黄精这类）
  const picked = new Map();
  const skipped = [];

  for (const st of usable) {
    const rule = RULES[st.key];
    const hits = [];
    for (const [name, food] of Object.entries(FOODS)) {
      const use = usePart(food);
      if (!use) continue;
      const p1 = rule.primary.find((x) => use.includes(x));
      const p2 = p1 ? '' : rule.secondary.find((x) => use.includes(x));
      const w = p1 || p2;
      if (!w) continue;
      hits.push({ name, food, matched: w, tier: p1 ? 0 : 1, dir: NATURE_DIR(food.nature), pos: use.indexOf(w) });
    }

    // 排序：方向合的先，平性的次，反向的最后。
    // 反向的**不剔除**——药典确实写了它用于这个证，剔掉等于改书。
    const dirRank = (d) => {
      if (!rule.bias) return 0;
      if (d === rule.bias) return 0;
      if (d === 'neutral') return 1;
      return 2;
    };
    // 先按「命中主要适应证还是兼症」排，再按命中位置排，再按寒热方向排。
    // 位置这条不是拍脑袋：药典把主打的适应证写在「用于」后面第一段，
    // 越靠后越像附带提一句——同为命中，靠前的更贴切。
    // 顺序不能反：方向只是排序偏好，适应证对不对是硬条件。
    hits.sort((a, b) => a.tier - b.tier
      || a.pos - b.pos
      || dirRank(a.dir) - dirRank(b.dir)
      || a.name.localeCompare(b.name, 'zh'));

    for (const h of hits) {
      const key = h.name;
      if (picked.has(key)) continue;
      // 已经记着在吃的东西，不再推荐——那不是「建议」，那是复述他已经在做的。
      const eating = opts.eating.some((x) => x === key || key.includes(x) || x.includes(key));
      if (eating) {
        skipped.push({ name: key, why: `你记着已经在吃${key}` });
        continue;
      }
      // 和你正在吃的东西查一遍药典的配伍禁忌。
      // 命中就不推——推荐一个和你正在吃的药相冲的东西，
      // 比不给建议危害大得多，而这恰恰是「先问清在吃什么」的全部意义。
      const clash = opts.eating
        .map((x) => ({ with: x, pair: canonPair(key, x) }))
        .filter((c) => c.pair);
      if (clash.length) {
        skipped.push({
          name: key,
          why: `和你记着在吃的${clash[0].with}相冲（药典写${clash[0].pair.from}${clash[0].pair.clause}）`,
          blocked: true,
        });
        continue;
      }
      picked.set(key, {
        name: key,
        nature: trimDot(h.food.nature),
        dir: h.dir,
        matched: h.matched,
        tier: h.tier,
        // 功效只取「用于」之前那半句。后面那串主治容易被当成诊断，
        // 而这里要说的是「什么情况适合」，不是「治什么病」。
        effect: trimDot(String(h.food.functions || '').split('用于')[0]),
        use: trimDot(usePart(h.food)),
        tabi: trimDot(h.food.tabi),
        forState: rule.label,
        contrary: Boolean(rule.bias) && h.dir !== rule.bias && h.dir !== 'neutral',
      });
      if (picked.size >= limit) break;
    }
    if (picked.size >= limit) break;
  }

  const picks = [...picked.values()];
  if (!picks.length) {
    return {
      ok: false,
      code: 'no-pick',
      reason: '药典里没有匹配到适合你这个情况的药食同源品种，我不硬凑',
      picks: [],
      skipped,
      notes: [],
    };
  }

  const notes = usable.map((s) => RULES[s.key].why).filter((v, i, a) => a.indexOf(v) === i);
  return { ok: true, code: '', reason: '', picks, skipped, notes };
}

/**
 * 把一条建议说成一句话。播报和屏幕共用这一份，屏幕在后面再补原文。
 *
 * 措辞要点：主语是「药典」，不是「我建议」。前者交依据，后者是下判断。
 */
export function adviceLine(p) {
  const cor = p.contrary ? '；性味偏' + (p.dir === 'warm' ? '温' : '凉') + '，不作首选' : '';
  return `${p.name}（${p.nature}）：药典写用于${p.use}${cor}`;
}

/** 一句话概括这次建议的依据，放在结尾。 */
export function adviceSource() {
  return `匹配依据：《中国药典》2025 年版一部「用于」原文；排序依据：${NATURE_RULE}「寒者热之，热者寒之」`;
}
