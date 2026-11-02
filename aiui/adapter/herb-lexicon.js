// 药材切词：把「甘草海藻能不能一起吃」切成 ['甘草','海藻']。
//
// 为什么需要：用户对眼镜说话不会加「和」。「甘草和海藻」这种规整说法是打字习惯，
// 语音识别出来的是「甘草海藻能不能一起吃」——按标点和连词切只能切出一个整体，
// 拿去配伍引擎查必然查不到，用户会以为「这个功能不会用」。
//
// 词表从哪来：全部取自引擎自己暴露的公开字段，不复制、不改写原引擎，也不新增医理知识。
//   ① InteractionEngine 的禁忌字段（ANTI_GROUP1/2/3、FEAR_PAIRS、PREGNANCY_*）——约 62 味
//   ② BencaoEngine.DB 的键——约 123 味常用药材
//
// 为什么必须合并两份（这是实测出来的，不是设计时想到的）：
//   只用 ① 时，「三七」「当归」这类**没有禁忌**的药材根本不在表里。
//   用户说「三七」，切词切不出来，校验又说它「不是药名」，
//   最后报「没听出药名」——用户会以为自己发音不准，其实系统只是词表没覆盖。
//   合并后覆盖常见药材，切词和校验都对得上。
//
// 覆盖面仍有边界：两库加起来不到 200 味，远不是全部中药。
// 表外的药名走整串匹配，不会被搞坏，但也不会被切开。

/**
 * 从引擎暴露的字段收集词表。引擎缺字段时返回空集，切词自动退化为不切。
 *
 * @param {object} InteractionEngine
 * @param {object} BencaoEngine
 * @param {Iterable<string>} extras 引擎里没有、但业务上必须认得的名词。
 *   目前是十九畏歌诀里的药名与别名（五灵脂、肉桂、官桂、赤石脂、犀角）。
 *   为什么必须单独传进来：这些名字在引擎表里本就没有（引擎那张表本身缺这两组），
 *   而本草库 123 味也没收录——不补的话，用户说「人参五灵脂」会被切成
 *   「人参」一味，然后得到「没有查到配伍禁忌」这种答复，而它恰恰是最该报禁忌的一对。
 */
export function buildLexicon(InteractionEngine, BencaoEngine = null, extras = null) {
  const words = new Set();
  if (extras) for (const w of extras) if (typeof w === 'string' && w) words.add(w);
  if (!InteractionEngine && !BencaoEngine) return words;

  if (InteractionEngine) {
    const groups = ['ANTI_GROUP1', 'ANTI_GROUP2', 'ANTI_GROUP3', 'PREGNANCY_Toxic', 'PREGNANCY_Mild'];
    for (const key of groups) {
      const arr = InteractionEngine[key];
      if (Array.isArray(arr)) for (const w of arr) if (typeof w === 'string') words.add(w);
    }
    const pairs = InteractionEngine.FEAR_PAIRS;
    if (Array.isArray(pairs)) {
      for (const pair of pairs) {
        if (!Array.isArray(pair)) continue;
        for (const w of pair) if (typeof w === 'string') words.add(w);
      }
    }
  }

  // 本草库的药名（DB 是引擎公开字段，只读不改）
  const db = BencaoEngine && BencaoEngine.DB;
  if (db && typeof db === 'object') {
    for (const name of Object.keys(db)) {
      if (typeof name === 'string' && name.length >= 2) words.add(name);
    }
  }
  return words;
}

const MIN_WORD = 2;   // 词表里没有单字药名，从 2 字起匹配可以少试一轮
const MAX_WORD = 6;   // 「雪上一枝蒿」5 字，留一档余量

/**
 * 最长匹配切词。长词优先是必须的：「白附子」不能被切成「白」+「附子」，
 * 「川乌」和「乌头」也不能互相吞并。
 *
 * @returns {string[]} 命中的药名（按出现顺序）；一个都没命中时返回空数组
 */
export function segmentHerbs(text, lexicon) {
  const src = String(text || '');
  if (!lexicon || lexicon.size === 0 || !src) return [];

  const hits = [];
  let i = 0;
  while (i < src.length) {
    let matched = null;
    const maxLen = Math.min(MAX_WORD, src.length - i);
    for (let len = maxLen; len >= MIN_WORD; len -= 1) {
      const candidate = src.slice(i, i + len);
      if (lexicon.has(candidate)) {
        matched = candidate;
        break;
      }
    }
    if (matched) {
      hits.push(matched);
      i += matched.length;
    } else {
      i += 1;
    }
  }
  return hits;
}

// ---------------------------------------------------------------- 营养素识别
//
// 为什么必须单独做一条：本草库只收中药材，而「维生素C」「钙片」「叶酸」
// 一个都不在药名词表里。不单独认，用户问「维生素C有什么作用」会被判成
// 「没听出药名」——这是养生场景里比中药更高频的问法，判错一次，
// 用户就认为这个作品只会查药，不会养生。
//
// 只做一件事：把人话对到引擎那 21 种营养素上。名单全部来自
// VitaminEngine.VITAMIN_LIST 的公开字段（nameCN / id / nameEN），
// 不新增任何营养学知识，也不改原引擎。
//
// 单字矿物质（钙铁锌镁硒铬钾）必须收紧：否则「铁皮石斛」会被认成「铁」、
// 「阳起石」会被认成……不会有，但「钾长石」就会被。收紧方式是要求它
// 落在「补/缺/摄入/片」这类词的邻近位置，或者整句就这一个字。

const MINERALS = new Set(['钙', '铁', '锌', '镁', '硒', '铬', '钾']);
// 上下文收紧。注意「一起」必须在里面：不写它，「钙和铁能一起吃吗」里
// 两个矿物质都判成「不像在问营养素」，整句退化成「没听懂」——
// 而这是这块能力最核心的问法。它也不会误伤「铁皮石斛能不能吃」，
// 因为那种句子不含「一起」。
const MINERAL_CTX = /(补|缺|不足|摄入|需要|片|剂|胶囊|口服液|什么用|好处|作用|食物|含|多吃|少吃|一起|同吃|同用|同服|同补|搭配|间隔|分开)/;

// 俗称 → 库内正式名。这不是营养学知识，只是同一个东西的两种叫法：
// 用户不会说「Omega-3脂肪酸」，只会说「鱼油」；不说这一层，
// 他就得到「本草库还没收录鱼油」，而库里明明有。
const ALIASES = [
  { re: /(深海)?鱼油/, id: 'omega-3' },
  { re: /钙片/, id: 'calcium' },
  { re: /铁剂|补血(铁)?/, id: 'iron' },
  { re: /锌片/, id: 'zinc' },
];

/** 「维他命C」「维C」「维生素c」统一成「维生素C」 */
function normalizeNutrientWord(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/维他命/g, '维生素')
    .replace(/维(?=[ABCDEK]\d{0,2}(?!\d))/g, '维生素')
    .toUpperCase();
}

/** 「叶酸（维生素B9）」→「叶酸」，括号里的别名不参与匹配 */
function mainName(nameCN) {
  return String(nameCN || '').replace(/[（(].*?[）)]/g, '').trim();
}

/**
 * 从一句话里找出被问到的营养素。找不到返回空数组。
 *
 * 药名优先由调用方保证：agent 在认到药材时不会走这里。
 * 这里只回答「这句话里有没有明确在问某个营养素」。
 *
 * 返回多个而不是只返回第一个，是因为「钙和铁能一起吃吗」是真实问法，
 * 而引擎里有 44 条营养素相互作用数据——只认一个就等于把这块能力废掉。
 */
export function findNutrients(text, VitaminEngine) {
  const body = normalizeNutrientWord(text);
  if (!body || !VitaminEngine) return [];
  const list = Array.isArray(VitaminEngine.VITAMIN_LIST) ? VitaminEngine.VITAMIN_LIST : [];

  // 名称长的先匹配：「维生素B12」不能被「维生素B1」抢走。
  const candidates = [];
  for (const v of list) {
    const main = mainName(v.nameCN);
    if (!main) continue;
    candidates.push({ id: v.id, name: main, key: normalizeNutrientWord(main) });
    // 英文名也认：「vitamin c」是语音识别常见的输出形态
    if (v.nameEN) candidates.push({ id: v.id, name: main, key: normalizeNutrientWord(v.nameEN) });
  }
  candidates.sort((a, b) => b.key.length - a.key.length);

  const hits = [];
  const push = (h) => {
    if (h.id && hits.some((x) => x.id === h.id)) return;
    hits.push(h);
  };

  // 命中的键要从文本里挖掉，否则「维生素B12」会被「维生素B1」再命中一次。
  let rest = body;
  for (const c of candidates) {
    if (hits.length >= 3) break;
    if (c.key.length < 2) continue;
    if (!rest.includes(c.key)) continue;
    rest = rest.split(c.key).join('');
    push({ word: c.key, name: c.name, id: c.id });
  }

  // 单字矿物质走上下文收紧。判断用的是挖掉已知营养素之后的剩余文本，
  // 否则「维生素C和铁」里的「维生素C」会把上下文词一起带走。
  for (const m of MINERALS) {
    if (hits.length >= 3) break;
    if (!rest.includes(m)) continue;
    const left = rest.replace(new RegExp(m, 'g'), '');
    if (left.length <= 2 || MINERAL_CTX.test(body)) {
      const hit = list.find((v) => mainName(v.nameCN) === m);
      if (hit) {
        rest = left;
        push({ word: m, name: m, id: hit.id });
      }
    }
  }

  // 俗称
  for (const a of ALIASES) {
    if (hits.length >= 3) break;
    if (!a.re.test(text)) continue;
    const hit = list.find((v) => v.id === a.id);
    if (hit) push({ word: a.re.source, name: mainName(hit.nameCN), id: hit.id });
  }

  if (hits.length > 0) return hits;

  // 最后一条兜底：说的是「维生素X」，但库里没有这个（B5、B8、H…）。
  // 必须落到「库里没有」，不能落到「没听懂」——后者会让用户以为是自己发音不准，
  // 对着眼镜反复重说同一句。真实存在的营养素查不到时，说清查不到才是准确答复。
  const missing = body.match(/维生素([A-Z]\d{0,2})/);
  if (missing) return [{ word: missing[0], name: missing[0], id: null, missing: true }];

  return [];
}

/**
 * 把一句口语拆成药材名数组。
 *
 * 两步走，缺一不可：
 *   ① 先按标点/连词切块——「甘草 海藻」这种规整说法靠它；
 *   ② 再对每一块做词表切词——「甘草海藻能不能一起吃」这种口语靠它，
 *      第二块切出来是「海藻」，后面的「能不能一起吃」被丢掉。
 * 词表没覆盖的药名（当归、黄芪…）原样保留，不会被这一步搞坏。
 * 最后去重：「甘草和甘草」是口误，不该当成两味。
 */
export function splitHerbList(text, lexicon) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const chunks = raw.split(/[\s,，、/|和与跟同及加配]+/).filter(Boolean);
  const out = [];
  for (const chunk of chunks) {
    const seg = segmentHerbs(chunk, lexicon);
    if (seg.length > 0) out.push(...seg);
    else out.push(chunk);
  }
  return [...new Set(out)];
}
