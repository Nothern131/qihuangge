// 配伍禁忌的原因库：为什么这两味不能同用。
//
// 这个文件存在的前提是一个必须说清的事实：
//   **十八反、十九畏的歌诀里没有解释，只有口诀。**
//   「甘草反甘遂、大戟、海藻、芫花」——说了谁反谁，没说为什么。
//   《神农本草经·序录》给的是这一类关系的定义（「相反者」，合用产生或加剧毒副作用），
//   不是每一对的具体机理。
//
// 所以每一条原因都必须标来源，分两种，绝不混着写：
//   modern  —— 现代药理研究给的解释（含实验观察）
//   classic —— 传统本草/医家的说法，古人这么讲，但没有现代研究定论
//   none    —— 书里只列了禁忌，没给解释，现代也没有统一结论。这三个字要照实说。
//
// 为什么这条界线不能糊：
//   用户之前明确要求过「现代书籍引用一定要说清楚」。
//   把现代药理讲成古人说的，是伪造出处；把古人的说法讲成实验结论，是伪造证据。
//   两种都比不说更糟——用户按图索骥去翻书，翻不到，之后就不再信任何一句。
//
// 另一个必须保留的字段是 debate：这些禁忌**不是绝对禁令**。
//   《伤寒杂病论》《千金要方》等书里反药同用的方子数以百计，
//   海藻玉壶汤治瘿瘤就同时用了海藻和甘草。只讲禁令不讲争议，
//   等于把一条有讨论余地的经验说成了铁律。

import { SOURCES } from './sources.js';

/** 七情里「相反」的定义。所有十八反条目都落在这一条上。 */
export const FAN_DEFINITION =
  '《神农本草经·序录》把药与药的关系分为七情，其中「相反」指两药合用会产生或加剧毒副作用，'
  + '原文是「勿用相恶、相反者」。';

/** 歌诀里「畏」字与七情里「相畏」同字不同义，这个必须说清，否则概念是错的。 */
export const WEI_DEFINITION =
  '十九畏的「畏」是相忌之意，和七情里「相畏」（一药抑制另一药的毒性、可以同用）不是一回事。'
  + '同字不同义，容易混。';

/**
 * 十八反按组归类：同组内原因相同，逐条重复写会漂移——
 * 改了一条忘了另一条，同一组里就出现两种说法。
 */
// 藜芦组里「诸参」是歌诀的叫法，五味的补泻方向并不一样：
// 人参补气、沙参养阴、丹参活血、玄参滋阴、苦参清热燥湿。
// 原来是七味共用一句「人参、沙参、丹参、玄参这些是补益药」，
// 用户问细辛或芍药时，屏幕上会说他问的那味是补药——这不是措辞罗嗦，是说错了药。
// 所以这一组按「诸参」和「细辛、芍药」分两套说法。
const CAN = ['人参', '沙参', '丹参', '玄参', '苦参'];
// [全称, 单字（拼「一吐一X」）, 名词（拼「…的发散」）]
const NON_CAN = { 细辛: ['辛温发散', '散', '发散'], 芍药: ['酸收敛阴', '收', '收敛'] };

const splitCan = (ps) => ({
  can: ps.filter((p) => CAN.includes(p)),
  rest: ps.filter((p) => !CAN.includes(p)),
});

const FAN_GROUPS = {
  甘草: {
    partners: ['大戟', '甘遂', '芫花', '海藻'],
    whyKind: 'modern',
    // 「why」原来是整组名单写死在句子里（「大戟、甘遂、芫花、海藻都属利水逐饮药」）。
    // 后果是问「甘草海藻」时，屏幕上替他念了三味他没问的药，
    // 而这些字是拿屏幕空间换来的——屏幕只有那么大，多念一个无关药名就少一句有用的。
    // 改成只填用户真正问到的那几味，脚本由 mergeReasons 负责合并。
    // 「都」只在真的有两味以上时才加：问「甘草海藻」念成「海藻都属利水逐饮药」，
    // 单数配「都」是病句，一眼看得出是模板拼出来的。
    whyOf: (ps) => '甘草含甘草酸，有类似盐皮质激素的作用，会让身体潴留水钠、排钾增加；'
      + `${ps.join('、')}${ps.length > 1 ? '都' : ''}属利水逐饮药，作用方向正好相反。`
      + '动物实验里，甘草用量越大，合用后的毒性越强，肝、肾、心肌都可见损伤。',
    brief: '甘草会让身体潴留水钠，{partners}要利水排出去，方向正好相反',
    // 按对手分开写。原来这一组共用一句「古方有海藻玉壶汤」，
    // 可那张方子里只有海藻和甘草，没有大戟、甘遂、芫花——
    // 用户问大戟，回答里举一个不含大戟的方子，等于用错误的例子证明观点。
    //
    // 争议段是整屏里信息密度最低的一块，也是唯一可以压的地方：
    // 眼镜一屏约 8 行、170 字，追问模式要同时装结论、原因全文和争议，
    // 原来那版 56 字压到 40 字以内，才留得下出处那一行。
    debateFor: (ps) => (ps.includes('海藻')
      ? '这一条争议最大：古方确有同用者，如治瘿瘤的《外科正宗》海藻玉壶汤，海藻与甘草同方。'
      : '这一条更像严厉的告诫：历代医书里确有反药同用的方子，不是没人试过。'),
  },
  乌头: {
    partners: ['贝母', '瓜蒌', '半夏', '白蔹', '白及'],
    whyKind: 'modern',
    why: '乌头类（川乌、草乌、附子）含乌头碱，本身就是大毒之品，治疗量和中毒量很接近。'
      + '{partners}与它同用，历代都认为会使毒性增强；现代研究也观察到合用后毒性成分在体内蓄积、'
      + '排出变慢，但具体到每一味药的机制，各家结论并不完全一致。',
    brief: '乌头类含乌头碱、毒性大，和{partners}同用会让毒性成分蓄积',
    debateFor: () => '这一组风险最高，乌头碱本身就能致命；是否绝对禁忌仍有讨论，但前提是有医生控量。',
  },
  藜芦: {
    partners: ['人参', '沙参', '丹参', '玄参', '苦参', '细辛', '芍药'],
    whyKind: 'classic',
    whyOf: (ps) => {
      const { can, rest } = splitCan(ps);
      const segs = [];
      if (can.length) {
        segs.push(`${can.join('、')}属歌诀里的「诸参」。这一组有补气、养阴、活血之分，`
          + '但传统都认为它们的药性与藜芦的涌吐之性相反：想补进去的被吐出来，毒却留在身上。');
      }
      if (rest.length) {
        segs.push(`${rest.join('、')}走的是${rest.map((p) => NON_CAN[p][0]).join('、')}的路子，`
          + '跟涌吐之性正相反。'
          + `一吐${rest.map((p) => `一${NON_CAN[p][1]}`).join('')}，药性相悖，同用会加重毒副反应。`);
      }
      return `藜芦有毒，涌吐之力很强，专用来催吐、杀虫。${segs.join('')}`;
    },
    briefOf: (ps) => {
      const { can, rest } = splitCan(ps);
      const segs = [];
      if (can.length) segs.push(`藜芦涌吐力猛，${can.join('、')}是参类，药性相反`);
      if (rest.length) {
        segs.push(`藜芦涌吐，${rest.join('、')}的${rest.map((p) => NON_CAN[p][2]).join('、')}跟它相悖`);
      }
      return segs.join('；');
    },
    debateFor: () => '这段解释是后世医家按药性推的，古籍没明写，现代研究也没定论；禁忌本身来自歌诀。',
  },
};

/**
 * 十九畏逐对。这八对的机理各不相同，不能像十八反那样按组归——
 * 归了就会出现「硫黄和巴豆畏的是同一个道理」这种明显错误的话。
 */
const WEI_PAIRS = [
  {
    pair: ['硫黄', '朴硝'],
    whyKind: 'modern',
    why: '硫黄内服后在肠道生成硫化物，刺激肠壁引起泻下；朴硝是盐类泻药，靠硫酸钠在肠内吸水。'
      + '两者同用泻下过猛，可能引起剧烈腹泻和肠痉挛。',
    brief: '两味都是泻下药，同用泻得太猛，会引起肠痉挛',
    debate: '',
  },
  {
    pair: ['水银', '砒霜'],
    whyKind: 'modern',
    why: '水银是汞，砒霜是三氧化二砷，两者本身都是剧毒。同用等于把两种毒物的毒性叠加，'
      + '没有任何可以抵消的环节。',
    brief: '两味都是剧毒，同用毒性直接叠加',
    debate: '',
  },
  {
    pair: ['狼毒', '密陀僧'],
    whyKind: 'modern',
    why: '狼毒本身有毒，密陀僧是氧化铅、同样属有毒之品。两味有毒药同用，毒性叠加，'
      + '而且铅在体内排出很慢。',
    brief: '两味都有毒，密陀僧还含铅，排出很慢',
    debate: '',
  },
  {
    pair: ['巴豆', '牵牛'],
    whyKind: 'classic',
    why: '巴豆含巴豆油，是峻下药，泻下猛烈；牵牛子含牵牛子苷，也是峻下逐水药。'
      + '两味猛药同用，泻下太过，容易伤津耗气。',
    brief: '两味都是峻下猛药，同用泻下太过',
    debate: '这个说法来自传统本草对两味药峻烈程度的判断，现代研究没有专门验证这一对。',
  },
  {
    pair: ['丁香', '郁金'],
    whyKind: 'modern',
    why: '研究认为丁香油酚会抑制郁金中姜黄素的吸收利用，使郁金的利胆作用明显下降。'
      + '这属于药效拮抗，不是产生新毒。',
    brief: '丁香油酚会抑制郁金有效成分吸收，药效被抵消',
    debate: '这一条的实验结果并不一致，也有研究认为配伍后未见明显拮抗。',
  },
  {
    pair: ['川乌', '草乌'],
    whyKind: 'modern',
    why: '两味同属乌头类，都含乌头碱，只是炮制方法和毒性强弱不同。同用等于把同一种毒性加了一倍。',
    brief: '两味都含乌头碱，同用等于把毒性加了一倍',
    debate: '',
  },
  {
    pair: ['牙硝', '三棱'],
    // 原来是 none（「没给解释」），但下面这两句其实就是解释——
    // 标成 none 而内容里有推断，是自相矛盾：屏幕会写「古籍未给解释」，
    // 紧接着又给出解释。有传统推断就标 classic，把「这是后人按药性推的」说清楚。
    whyKind: 'classic',
    why: '古籍只列了这条禁忌，没有写机理。后世的推断是：牙硝泻下软坚，三棱破血消积，'
      + '两味攻伐之力都强，同用容易伤正气。这个说法现代研究没有专门验证。',
    brief: '两味攻伐都强，后世认为同用容易伤正气',
    debate: '',
  },
  {
    pair: ['人参', '赤石脂'],
    whyKind: 'classic',
    why: '赤石脂是收涩药，能吸附、固涩肠道。传统认为它会把人参的补气之力一并困住，'
      + '使补力发挥不出来。',
    brief: '赤石脂涩肠，传统认为会困住人参的补力',
    debate: '这类「补药被收涩药牵制」的说法，现代研究没有结论。',
  },
];

/** whyKind 的呈现文案。屏幕要标出来，用户才知道这句话是谁说的。 */
export const WHY_KIND_TAG = {
  modern: '现代药理研究',
  classic: '传统医家解释',
  none: '古籍未给解释',
};

const EMPTY = {
  key: '',
  partner: '',
  why: '',
  brief: '',
  whyKind: 'none',
  whyKindTag: WHY_KIND_TAG.none,
  debate: '',
};

// 组内的句子是模板：{partners} 由合并层填成「用户真正问到的那几味」。
// 不填整组名单的理由见 FAN_GROUPS 里甘草那一条的注释。
function buildWhy(def, partners) {
  if (!def) return '';
  if (def.whyOf) return def.whyOf(partners);
  return String(def.why || '').replace(/\{partners\}/g, partners.join('、'));
}

function buildBrief(def, partners) {
  if (!def) return '';
  if (def.briefOf) return def.briefOf(partners);
  return String(def.brief || '').replace(/\{partners\}/g, partners.join('、'));
}

const groupOf = (key) => (key && Object.prototype.hasOwnProperty.call(FAN_GROUPS, key) ? FAN_GROUPS[key] : null);

/**
 * 查一对药为什么不能同用。
 *
 * @param {string} a
 * @param {string} b
 * @param {'十八反'|'十九畏'} type 引擎给出的分类，用它决定去哪张表查
 * @returns {{key:string, partner:string, why:string, brief:string, whyKind:string, whyKindTag:string, debate:string}}
 */
export function reasonFor(a, b, type) {
  // 引擎里乌头组会按实际出现的药改名（川乌/草乌），查表时归回「乌头」。
  const norm = (h) => (h === '川乌' || h === '草乌' || h === '附子' ? '乌头' : h);

  if (type === '十八反') {
    for (const [head, g] of Object.entries(FAN_GROUPS)) {
      const inGroup = (h) => (head === '乌头' ? norm(h) === '乌头' : h === head);
      // 原因句里要说出「谁和谁」，所以得把对手药名带进去。
      // 只说「和它同用」的话，用户听完不知道说的是哪一味——尤其是三味药的问法。
      if (inGroup(a) && g.partners.includes(b)) return pack(head, g, b);
      if (inGroup(b) && g.partners.includes(a)) return pack(head, g, a);
    }
  } else if (type === '十九畏') {
    const hit = WEI_PAIRS.find((w) => (w.pair[0] === a && w.pair[1] === b) || (w.pair[0] === b && w.pair[1] === a));
    // 十九畏句子里没有药名占位，key 只用来分组，不必回表。
    if (hit) return pack(hit.pair.join('+'), hit, '');
  }

  // 表里没有这一对时不能编，也不能沉默。
  // 沉默会让「没有解释」和「没有这条禁忌」听起来一样。
  // key 取这一对本身，避免两个互不相干的未知组合被并成一组。
  return {
    ...EMPTY,
    key: `${a}|${b}`,
    why: '这一对书里只列了禁忌，没有给解释。',
  };
}

function pack(key, def, partner) {
  const partners = partner ? [partner] : [];
  return {
    // key 是分组的唯一依据，不是 why。
    // 原来按 why 归并，在有 {partners} 占位之前是对的；现在 why 里带着药名，
    // 甘草配大戟和甘草配甘遂的 why 不再相等，按 why 归并就失效了——
    // 症状是播报把同一段机理念两遍，屏幕上还占了两个名额把别的内容挤掉。
    key,
    // partner 单独回传，不只是拼进句子一次：
    // 三味药同属一组时（甘草配大戟、甘遂），调用方要把对手药名合并起来，
    // 才能说出「大戟、甘遂是利水药」，而不是只说其中一味。
    partner: partner || '',
    why: buildWhy(def, partners),
    brief: buildBrief(def, partners),
    whyKind: def.whyKind,
    whyKindTag: WHY_KIND_TAG[def.whyKind] || WHY_KIND_TAG.none,
    debate: def.debateFor ? def.debateFor(partners) : (def.debate || ''),
  };
}

/**
 * 把逐对的原因按组折起来，组内把对手药名并齐。
 * 播报与屏幕共用这一步：分开算的话，两边对「哪些算同组」会有两套理解，
 * 一处改了另一处忘了，就会出现「播报合并了、屏幕没合并」。
 */
function foldByGroup(reasons) {
  const folded = [];
  for (const r of reasons || []) {
    if (!r) continue;
    const key = r.key || r.why || '';
    const hit = folded.find((g) => g.key === key);
    if (hit) {
      if (r.partner && !hit.partners.includes(r.partner)) hit.partners.push(r.partner);
      continue;
    }
    folded.push({ key, partners: r.partner ? [r.partner] : [], sample: r });
  }
  return folded.map((g) => {
    const def = groupOf(g.key);
    return {
      ...g,
      why: def ? buildWhy(def, g.partners) : g.sample.why,
      brief: def ? buildBrief(def, g.partners) : g.sample.brief,
    };
  });
}

/**
 * 把多条原因合并成「一句原因」（播报用）。
 *
 * 同一组内的原因本来就是一句话（甘草反对四味，理是同一个理），
 * 逐条念会变成复读；只取第一条又会让用户以为只解释了其中一对。
 * 所以按组归并，把对手药名合起来。
 *
 * @param {Array} reasons 已收集的原因
 * @returns {string[]} 去重后的短原因
 */
export function mergeBriefs(reasons) {
  return foldByGroup(reasons).filter((g) => g.brief).map((g) => g.brief);
}

/**
 * 把多条原因合并成屏幕上的全文条目（每组一条）。
 *
 * 屏幕用这个而不是直接用逐对的 reasons：逐对的话，甘草配大戟、甘遂会出两行，
 * 每行都说一遍同一段机理，把别的内容挤出可视区；而用户读到的信息量并没增加。
 *
 * @param {Array} reasons
 * @returns {Array<{key:string, partners:string[], why:string, whyKind:string, whyKindTag:string, debate:string}>}
 */
export function mergeReasons(reasons) {
  return foldByGroup(reasons)
    .filter((g) => g.why)
    .map((g) => {
      const def = groupOf(g.key);
      return {
        key: g.key,
        partners: g.partners,
        why: g.why,
        whyKind: g.sample.whyKind,
        whyKindTag: g.sample.whyKindTag,
        // 合并之后的争议要按整组的药名重新取：
        // 甘草组里只有问到海藻才该举海藻玉壶汤，否则例子和问题对不上。
        debate: def && def.debateFor ? def.debateFor(g.partners) : g.sample.debate,
      };
    });
}

/** 屏幕上的机理标签：`机理（现代药理研究）` / `机理（传统医家解释）` */
export function whyLabel(kind) {
  return `机理（${WHY_KIND_TAG[kind] || WHY_KIND_TAG.none}）`;
}

/** 出处：机理说得出处才单列一行，说不出就并入禁令条目。 */
export function reasonSource(kind) {
  if (kind === 'modern') return '现代药理研究文献';
  if (kind === 'classic') return '传统本草与医家论述';
  return '';
}

export { FAN_GROUPS, WEI_PAIRS, SOURCES };
