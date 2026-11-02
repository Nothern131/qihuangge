// 十九畏的权威口径，以及引擎表跟它不一致时怎么办。
//
// 为什么要单开一层：`static/js/engines/interaction-engine.js` 里的 `FEAR_PAIRS`
// 与歌诀原文有出入——**2 组错、2 组缺**（逐条对照见文件末尾 DIFF）。不改 `static/`
// 是铁律，所以校正只能落在适配层。
//
// 但「静默纠正」和静默降级是同一种错：用户问「川乌草乌」如果只听到一句
// 「没查到禁忌」，他会以为系统没这个知识；实情是这两味常同用（小活络丹），
// 拿十九畏去挡他是错的。所以校正必须说出来——`reconcileWei` 回传 `removed`，
// 由 pack 层翻译成人话。
//
// 还有一个常见的数错：「十九畏」的名字来自**19 味药**，不是 19 组。
// 歌诀里 19 味药、配成 9 组（川乌、草乌共畏犀角，所以 19 味只成 9 对）。
// 把它当成「19 条禁忌」去补，会补出根本不存在的组合。

/**
 * 歌诀原文。这是这一层的唯一事实来源，下游的配对、别名、解释全部从它派生。
 *
 * 出处核对过三个独立来源（中国经济网转《老中医》科普稿、科普中国词条、
 * 北京市中医药管理局《中药歌诀》），文字一致；最早见于明·刘纯《医经小学》。
 * 各家断句、个别字有异（「若逢石脂使相欺」/「便相欺」、「牙硝难合京三棱」/「荆三棱」），
 * 不影响药对。
 */
export const WEI_SONG = {
  book: '医经小学',
  author: '明·刘纯',
  text: '硫黄原是火中精，朴硝一见便相争；水银莫与砒霜见，狼毒最怕密陀僧；'
    + '巴豆性烈最为上，偏与牵牛不顺情；丁香莫与郁金见，牙硝难合京三棱；'
    + '川乌草乌不顺犀，人参最怕五灵脂；官桂善能调冷气，若逢石脂便相欺。',
  // 逐句对应的药对，screen 上要给用户看到「这一条出自哪一句」
  lines: [
    { line: '硫黄原是火中精，朴硝一见便相争', pair: ['硫黄', '朴硝'] },
    { line: '水银莫与砒霜见', pair: ['水银', '砒霜'] },
    { line: '狼毒最怕密陀僧', pair: ['狼毒', '密陀僧'] },
    { line: '巴豆性烈最为上，偏与牵牛不顺情', pair: ['巴豆', '牵牛'] },
    { line: '丁香莫与郁金见', pair: ['丁香', '郁金'] },
    { line: '牙硝难合京三棱', pair: ['牙硝', '三棱'] },
    // 这一句的主语是两味药、畏的是一味：川乌和草乌，共同畏犀角。
    // 引擎把它读成「川乌畏草乌」，等于把并列的两个主语配成了一对。
    { line: '川乌草乌不顺犀', pair: ['川乌', '犀角'] },
    { line: '川乌草乌不顺犀', pair: ['草乌', '犀角'] },
    { line: '人参最怕五灵脂', pair: ['人参', '五灵脂'] },
    // 「官桂」是肉桂的规格名（老树近根去粗皮的肉桂），不是另一种药。
    // 表里统一记作「肉桂」，别名在 ALIASES 里归口。
    { line: '官桂善能调冷气，若逢石脂便相欺', pair: ['肉桂', '赤石脂'] },
  ],
};

/**
 * 名字归口。只收「同一个东西的不同叫法」，不收近似药——
 * 附子与川乌同源但不通用，前者不在歌诀里，归过来就等于凭空加一条禁忌。
 */
export const ALIASES = {
  官桂: '肉桂',
  桂心: '肉桂',
  肉桂: '肉桂',
  五灵脂: '五灵脂',
  犀角: '犀角',
  犀牛角: '犀角',
};

/** 歌诀里的 19 味药（去重后正好 19，这解释了「十九畏」这个名字）。 */
export const CANON_HERBS = [...new Set(WEI_SONG.lines.flatMap((l) => l.pair))];

/** 歌诀里的 9 组药对（上方已按句拆好，这里只是换个名字，避免调用方重复推导）。 */
export const CANON_PAIRS = WEI_SONG.lines.map((l) => l.pair);

/** 把别名归到表里的正名；表外的名字原样返回。 */
export function normalizeHerb(name) {
  const h = String(name || '');
  return ALIASES[h] || h;
}

const keyOf = (a, b) => [normalizeHerb(a), normalizeHerb(b)].sort().join('+');

const CANON_INDEX = new Map();
for (const l of WEI_SONG.lines) CANON_INDEX.set(keyOf(l.pair[0], l.pair[1]), l);

/**
 * 引擎的十九畏结果 + 歌诀口径 → 最终结果。
 *
 * 三件事：
 *   1. 丢掉歌诀里没有的（`removed`）。引擎多报的每一对都要能说出为什么不算，
 *      否则用户听到的只是「系统改口了」。
 *   2. 补上歌诀里有、引擎没给的（`added`）。这些是真正的**假阴性**：
 *      「人参五灵脂」现在查不到，屏幕上只剩「妊娠慎用：五灵脂」——
 *      用户会理解成「没有配伍禁忌」。
 *   3. 剩下的沿用引擎的原始条目（`msg` 等字段格式不变，下游不用改）。
 *
 * @param {Array<{herbs:string[], type:string, level:string, msg:string}>} engineWeis
 * @param {string[]} herbs 用户这次问到的药名（含别名，未归口）
 * @returns {{weis:Array, removed:Array<{pair:string[], line:string, song:string}>, added:Array<string[]>}}
 */
export function reconcileWei(engineWeis, herbs) {
  const asked = new Set((herbs || []).map(normalizeHerb));

  // 1. 引擎给的，逐条对歌诀
  const weis = [];
  const removed = [];
  for (const w of engineWeis || []) {
    const [a, b] = w.herbs || [];
    const hit = CANON_INDEX.get(keyOf(a, b));
    if (hit) {
      // 歌诀有这一对。药名换成正名（用户说「官桂」时要按「肉桂」归口，
      // 否则原因库查不到），消息里的「畏」字也跟着正名走。
      const [na, nb] = [normalizeHerb(a), normalizeHerb(b)];
      weis.push({ ...w, herbs: [na, nb], msg: `${na}畏${nb}` });
    } else {
      removed.push({ pair: [a, b], song: '', line: '' });
    }
  }

  // 2. 歌诀有、引擎没给的。只补「用户这次真的同时问到了这两味」的组合，
  //    不把整张表都塞进结果——用户没问的药出现，是在偷结论的空间。
  const added = [];
  for (const l of WEI_SONG.lines) {
    const [a, b] = l.pair.map(normalizeHerb);
    if (!asked.has(a) || !asked.has(b)) continue;
    if (weis.some((w) => keyOf(w.herbs[0], w.herbs[1]) === keyOf(a, b))) continue;
    weis.push({ herbs: [a, b], type: '十九畏', level: 'moderate', msg: `${a}畏${b}` });
    added.push([a, b]);
  }

  // 3. 被丢掉的那几对要带上歌诀原句，pack 层才能说清「为什么不算」。
  for (const r of removed) {
    const dup = WEI_SONG.lines.find((l) => l.pair.includes(r.pair[0]) || l.pair.includes(r.pair[1]));
    if (dup) {
      r.line = dup.line;
      r.song = dup.line;
    }
  }

  return { weis, removed, added };
}

/**
 * 引擎表 vs 歌诀的逐条差异。测试直接拿它当断言依据，
 * 也方便以后有人问「到底哪几处不一样」时不用再算一遍。
 */
export const DIFF = {
  // 引擎写了、歌诀里没有的（会被 reconcileWei 丢掉）
  extra: [
    { pair: ['川乌', '草乌'], why: '歌诀原文「川乌草乌不顺犀」：这两味是并列的主语，畏的是犀角，不是互相畏。' },
    { pair: ['人参', '赤石脂'], why: '歌诀「人参最怕五灵脂」「若逢石脂便相欺」——人参畏五灵脂，畏赤石脂的是官桂（肉桂）。' },
  ],
  // 歌诀里有、引擎没给的（会被 reconcileWei 补上）
  missing: [
    { pair: ['人参', '五灵脂'], why: '歌诀「人参最怕五灵脂」。这是十九畏里最常被引到的一对。' },
    { pair: ['肉桂', '赤石脂'], why: '歌诀「官桂善能调冷气，若逢石脂便相欺」。官桂即肉桂。' },
    { pair: ['川乌', '犀角'], why: '歌诀「川乌草乌不顺犀」。' },
    { pair: ['草乌', '犀角'], why: '歌诀「川乌草乌不顺犀」。' },
  ],
};
