// 养生行为的记录与禁忌。
//
// 这个文件解决的问题：通用 AI 不知道你在做艾灸，所以它永远查不出
// 「你在艾灸 + 你是阴虚体质」这类冲突。而这件事恰好是「私人」两个字的落点——
// 不是知道得更多，是知道你正在做什么。
//
// 只做**有出处**的行为。目前只有艾灸一条，因为它的禁忌在《伤寒论》里有明文，
// 而且不止一条。拔罐、刮痧、泡脚暂时没有收——不是它们没有禁忌，
// 是我找不到能和《伤寒论》同等分量的原文。宁缺，不凑。
//
// 判定方式（这一点必须说清）：
//   经典里的禁忌判据是**脉象**——「微数之脉」「脉浮热甚」。
//   系统拿不到脉象，只能用用户自己说过的状况去近似。
//   近似不等于诊断：用户说「我阴虚」，我们说「你在艾灸，这条要看一下」，
//   而不是说「你不能艾灸」。措辞上的差别就是责任上的差别。

/**
 * 每一条禁忌都对应一个或多个状况标签（见 advice.js 的 STATE_TERMS）。
 * 标签对不上就不提——宁可漏，不可错报。
 */
export const PRACTICES = {
  艾灸: {
    name: '艾灸',
    // 用户可能的说法。只收不会歧义的：单独的「灸」会和「针灸」混，
    // 而针灸包含针法，禁忌并不相同。
    aliases: ['艾灸', '艾条', '艾柱', '艾绒', '做艾灸', '灸疗'],
    nature: '温热',
    uses: '温经散寒、行气通络、扶阳固脱',
    tabi: [
      {
        states: ['yin-deficiency'],
        level: 'strong',
        // 原文照抄，不改一个字。下面的 plain 是给人看的白话，与原文分开字段存，
        // 免得把白话当成引文。
        text: '微數之脈，慎不可灸。因火為邪，則為煩逆，追虛逐實，血散脈中，'
          + '火氣雖微，內攻有力，焦骨傷筋，血難復也。',
        plain: '阴虚火旺的人慎灸——艾火会加重内热',
        source: '《伤寒论·辨太阳病脉证并治中》',
      },
      {
        states: ['excess-heat'],
        level: 'strong',
        text: '脈浮，熱甚，而反灸之，此為實，實以虛治，因火而動，必咽燥吐血。',
        plain: '实热的人不宜艾灸',
        source: '《伤寒论·辨太阳病脉证并治中》',
      },
      {
        states: ['exterior'],
        level: 'moderate',
        text: '太陽病，以火熏之，不得汗，其人必躁，到經不解，必清血，名為火邪。',
        plain: '外感期间用火法取汗，汗出不来反而添病',
        source: '《伤寒论·辨太阳病脉证并治中》',
      },
    ],
  },
};

/** 俗称 → 正名。 */
const ALIAS = {};
for (const [name, p] of Object.entries(PRACTICES)) {
  ALIAS[name] = name;
  for (const a of p.aliases || []) ALIAS[a] = name;
}

/**
 * 认一个养生行为。认不出返回 null——不猜。
 *
 * @param {string} name
 * @returns {{name:string, nature:string, uses:string, tabi:Array}|null}
 */
export function practiceOf(name) {
  const k = String(name || '').trim();
  if (!k) return null;
  const real = ALIAS[k];
  if (!real) return null;
  return { ...PRACTICES[real], name: real };
}

/** 从一句话里认出用户提到的养生行为。可能不止一个。 */
export function findPractices(text) {
  const src = String(text || '');
  if (!src) return [];
  const hits = [];
  for (const [alias, real] of Object.entries(ALIAS)) {
    if (src.includes(alias) && !hits.includes(real)) hits.push(real);
  }
  return hits.map((n) => practiceOf(n));
}

/**
 * 拿用户说过的状况，去对某个行为的禁忌。
 *
 * @param {object} practice practiceOf() 的返回
 * @param {Array} states   extractStates() 的返回
 * @returns {Array} 命中的禁忌，没命中就是空数组
 */
export function practiceCautions(practice, states) {
  if (!practice || !Array.isArray(states) || states.length === 0) return [];
  const keys = new Set(states.map((s) => s.key));
  return (practice.tabi || []).filter((t) => (t.states || []).some((s) => keys.has(s)));
}

/** 所有可识别的说法，给词表用。 */
export function practiceWords() {
  return Object.keys(ALIAS);
}

/** 出处说明。 */
export const PRACTICE_SOURCE = '《伤寒论》';
