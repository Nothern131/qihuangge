// 岐黄阁 → AIUI 适配层（技能包）
//
// 铁律：本文件只「调用」原始引擎，不重复实现任何业务逻辑，
// 也不修改 static/js 下的任何文件。原始引擎是唯一事实来源，
// 这样上架版和网页版永远算的是同一件事。
//
// 为什么不把辨证/方剂接进来：
// 这不是技术限制，是合规边界。辨证=诊断、方剂=开方，属医疗行为，
// 应用商店审核过不去，也不是一个比赛项目该扛的责任。
// 所以商店版只做「查资料」和「查禁忌」，不给结论、不给处方。

import { buildLexicon, findNutrients, splitHerbList } from './herb-lexicon.js';
// 经典原文由 tools/vendor-data.js 内嵌（源文件 static/data/ancient_texts.json 只读未改）
import { ANCIENT_TEXTS } from '../vendor/ancient-texts.js';
import { citeLine, citeTag, citeLong, citeScope, ancientLine, NOT_RECORDED } from './sources.js';
// 原因库：为什么这两味不能同用。古籍只给口诀不给解释，所以每条原因都标来源
// （现代药理研究 / 传统医家解释 / 古籍未给解释），不混着写。
import { reasonFor, mergeBriefs, mergeReasons, whyLabel, reasonSource, WEI_DEFINITION } from './reasons.js';
// 十九畏的配对以歌诀原文为准。引擎 FEAR_PAIRS 有两组读错（川乌草乌、
// 人参赤石脂），这里做校正并把「改了什么」回传给用户，不做静默纠正。
import { reconcileWei, CANON_HERBS, ALIASES } from './wei-canon.js';
// 毒性分级以《中国药典》83 种名单为准。引擎那张表两个方向都错（半夏被判无毒、
// 野菊花被判有毒），详见 toxicity-canon.js 顶部的对照结论。
import { toxicityOf, NOT_LISTED, CANON_HERBS as TOX_HERBS, normalizeToxin } from './toxicity-canon.js';

// 出处不再手写在每个分支里，而是作为 source 字段回传，由页面挂到播报尾巴上。
// 这么改是因为手写 19 处的结果必然是「改了 18 处，漏掉的那处静默地说了一句
// 和别处不一致的话」——静默比少说严重。
// 挂在 tail 上还有第二个理由：播报会被 toBrief 按句截断，
// 出处拼在 speech 里就有被截掉的可能，而截掉之后听起来像结论没有来源。

export const SAFE_ACTIONS = ['check', 'herb', 'toxicity', 'vitamin', 'vitamin-mix', 'pregnancy', 'safety', 'ask'];

/**
 * 把若干段话拼成一句。
 * 为什么不能直接 join('。')：引擎里的字段本身常常带句号
 *（维生素的「功效」就是「…；参与伤口愈合。」），再补一个就变成「。。」。
 * 这个 bug 是实测撞出来的，不是设计时想到的。
 */
function joinSentences(parts) {
  const cleaned = parts
    .map((p) => String(p || '').trim().replace(/[。；;]+$/, ''))
    .filter(Boolean);
  return cleaned.length === 0 ? '' : cleaned.join('。') + '。';
}

// 妊娠条目按「最严」收敛时用的等级权重。引擎自己的 level 字段取值有限，
// 这里只做排序，不新增任何医学判断。
const LEVEL_RANK = { strong: 3, moderate: 2, mild: 1, unknown: 0 };

/**
 * 按档位把条目合并成一句话，比如「禁用：大戟、甘遂」或「大戟、甘遂（有毒）」。
 *
 * 为什么合并：逐条念会把同一句话重复 N 遍——三味药就是三十多字，
 * 其中只有三个药名是信息。播报听不完，屏幕也装不下。
 *
 * @param {Array} items 条目
 * @param {(x) => string} levelOf 取档位
 * @param {string} sep 档位之间的分隔符（妊娠用「；」，毒性用「、」）
 */
function groupByLevel(items, levelOf, sep = '；') {
  const buckets = [];
  for (const it of items) {
    const lv = levelOf(it) || '';
    const herb = it.herb || '';
    const hit = buckets.find((b) => b.lv === lv);
    // 同一味药只留一次：引擎的毒性表里有重复项（吴茱萸出现过两次）
    if (hit) {
      if (herb && !hit.herbs.includes(herb)) hit.herbs.push(herb);
    } else {
      buckets.push({ lv, herbs: herb ? [herb] : [] });
    }
  }
  return buckets
    .map((b) => {
      if (!b.herbs.length) return '';
      // 妊娠：档位在前（「妊娠禁用：大戟、甘遂」）
      // 毒性：档位在后（「大戟、甘遂（有毒）」）
      if (b.lv === '禁用' || b.lv === '慎用') return `${b.lv}：${b.herbs.join('、')}`;
      if (b.lv) return `${b.herbs.join('、')}（${b.lv}）`;
      return b.herbs.join('、');
    })
    .filter(Boolean)
    .join(sep);
}

/**
 * 同一味药只留最严的一条妊娠提示。
 *
 * 为什么需要：InteractionEngine 内部把「桃仁」同时放进了 PREGNANCY_Toxic 和 PREGNANCY_Mild，
 * checkPregnancy() 就把两条都吐出来。直接念给用户是
 * 「桃仁 — 妊娠禁忌（禁用）；桃仁 — 妊娠慎用」——同一味药两个结论，
 * 用户只会记住后面那个「慎用」，而实际上前者更严。这不是引擎的错，
 * 是它的数据本来就是分层标注的，适配层负责收敛成一句给人听的话。
 */
function collapseByHerb(entries) {
  const best = new Map();
  for (const e of entries || []) {
    const key = e.herb || '';
    const prev = best.get(key);
    if (!prev || (LEVEL_RANK[e.level] || 0) > (LEVEL_RANK[prev.level] || 0)) best.set(key, e);
  }
  return [...best.values()];
}

/**
 * 看起来像不像一味药名。
 * 用途只有一个：把「系统没这个数据」和「用户没说出药名」分开。
 * 用户说「三七」时，回「没听出药名」会让 ta 以为是自己发音问题；
 * 实际是本草库只有 123 味，本来就没收。归因错了，用户会反复重说同一句话。
 */
function isHerbLike(name) {
  return typeof name === 'string' && /^[\u4e00-\u9fa5]{2,6}$/.test(name);
}

/**
 * 引擎表里有、歌诀里没有的药对，怎么跟用户交代。
 *
 * 两种说法，不是一个。屏幕只有 160 字的预算，而这两种场合的信息价值不一样：
 *   - 这一对是**唯一结论**时（问「川乌草乌能一起用吗」），用户要的就是这个判断，
 *     必须说清「为什么不算」，还要把真实存在的风险补回去（毒性叠加）。
 *   - 同一句答复里**已经另有禁忌**时（问「川乌草乌半夏」），用户问的那件事已经答了
 *     （草乌反半夏，不可同用）。此时展开讲「川乌草乌不算十九畏」要花 85 字，
 *     恰好把原因和出处挤出屏幕——83 字不算长，但它是从这个场景里最不该让位的
 *     那两样东西上抢来的。
 *
 * 短版只给判断（「不属十九畏」），不给理由。理由是用户追问时才需要的东西，
 * 而「不算」这个结论本身必须说——不说的话，他若从别处听过「川乌畏草乌」，
 * 会以为系统漏了。
 *
 * 返回 null 表示这一对没有现成说法。宁可不说，也不编。
 */
function explainRemoved(pair) {
  const key = [pair[0], pair[1]].sort().join('+');
  if (key === '川乌+草乌') {
    return {
      short: '川乌草乌不属十九畏',
      long: '川乌和草乌不属十九畏。歌诀原文是「川乌草乌不顺犀」，畏的是犀角，'
        + '这两味本来就常在同一个方子里。但两味都含乌头碱，毒性会叠加，用量要按医生开的来。',
    };
  }
  if (key === '人参+赤石脂') {
    return {
      short: '人参畏的是五灵脂',
      long: '人参畏的不是赤石脂。歌诀里「人参最怕五灵脂」说的是五灵脂，'
        + '「若逢石脂便相欺」说的是官桂（也就是肉桂），两副对手配错了。',
    };
  }
  return null;
}

/**
 * @param {object} engines 沙箱/全局里的引擎对象
 *   { InteractionEngine, BencaoEngine, VitaminEngine }
 */
export function createQihuangPack(engines) {
  const { InteractionEngine, BencaoEngine, VitaminEngine } = engines || {};
  // 词表从引擎公开字段取（见 herb-lexicon.mjs）。
  // 必须同时给 BencaoEngine：只用禁忌库会导致「三七」「当归」这类无禁忌的药材不在表里，
  // 用户说了真实药名却被判成「没听出药名」。引擎没加载时是空集，切词自动退化为不切。
  //
  // 第三份是歌诀里的药名与别名：引擎表和本草库都没有「五灵脂」「肉桂」「赤石脂」，
  // 而「人参五灵脂」正是十九畏里最常被问到的一对。不补这三个词，
  // 用户说「人参五灵脂能一起用吗」会被切成只剩「人参」，答复变成「没查到禁忌」。
  //
  // 第四份是药典毒性名单：山豆根、白屈菜、金铁锁这些既不在引擎表也不在本草库，
  // 不补的话「山豆根有毒吗」会被切成一味不认识的药，答「本草库还没收录」——
  // 而它的毒性恰恰是药典里写着的。
  const LEXICON = buildLexicon(InteractionEngine, BencaoEngine, [
    ...CANON_HERBS, ...Object.keys(ALIASES), ...TOX_HERBS,
  ]);

  /**
   * 意图分流表。
   *
   * 眼镜上没有输入框，用户说的话一定是一整句：「附子有毒吗」「孕妇能吃桃仁吗」
   *「维生素C和当归能一起吃吗」。没有一个字是「动作名」。
   * 分流放在适配层而不是页面，是为了能写测试——页面的 SpeechRecognition 在本地跑不了。
   *
   * 顺序有讲究：
   *   ① 配伍  —— 出现「能不能一起」时，用户要的是配伍结论，
   *               哪怕句子里还有「孕妇」，也得先把配伍答了
   *   ② 妊娠  —— 「孕妇」「怀孕」是硬信号，优先于毒性
   *   ③ 毒性  —— 「有毒吗」「副作用」
   *   ④ 营养素 —— 「维生素C」
   *   ⑤ 默认当本草条目查询
   * 判错的代价：问毒性却答了性味功效，用户会以为「这药有毒但系统说没事」。
   *
   * 注意：必须声明在这里，不能放到 createQihuangPack 末尾。
   * 函数体中间的 return 会提前退出，块级 const 就不会初始化，
   * 之后调用时才炸「Cannot access 'INTENT' before initialization」。
   */
  const INTENT = [
    { name: 'check', re: /能不能(一起|同时|同)|可以(一起|同时)|相克|相反|配伍|忌讳|禁忌|一起吃|一起用|同吃|同用|同服/ },
    { name: 'pregnancy', re: /孕妇|怀孕|妊娠|备孕|哺乳|喂奶|月子/ },
    // 「能不能吃」「安全吗」是最常见的一句话问法。不能落到本草条目那一档：
    // 用户问「桃仁能不能吃」，ta 想知道的是「孕妇禁用、有毒」，
    // 而不是「性味苦甘、有小毒」。答错这一档，等于把风险提示漏掉。
    { name: 'safety', re: /能不能吃|可以吃吗|可以吃么|能吃吗|能吃么|能不能用|能服用|安全吗|有没有问题|要紧吗/ },
    { name: 'toxicity', re: /有毒|毒性|中毒|毒吗|毒么|副作用|不良反应/ },
    { name: 'vitamin', re: /维生素|维他命|维\s*[ABCDEK]\b|营养素/ },
  ];

  /**
   * 用户在问「为什么」，不是问「能不能」。
   * 这个区分不是为了多给内容，而是两句话的用途不同：
   * 「能不能」要一句结论，说多了他听不完；「为什么」要一套解释，说少了等于没答。
   */
  const WANT_REASON = /(为什么|为啥|凭什么|什么道理|原因|原理|道理)/;

  function detectIntent(text) {
    for (const it of INTENT) if (it.re.test(text)) return it.name;
    return 'herb';
  }

  function need(name, obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`引擎 ${name} 未加载，检查 manifest.json 的 scripts 顺序`);
    }
    return obj;
  }

  return {
    name: 'qihuang',
    title: '岐黄阁 · 本草速查',

    actions() {
      return SAFE_ACTIONS;
    },

    invoke(action, payload = {}) {
      if (!SAFE_ACTIONS.includes(action)) {
        const err = new Error(`不支持的查询：${action}（本版只做查资料，不做辨证与开方）`);
        err.code = 'unsupported_action';
        throw err;
      }

      switch (action) {
        case 'ask':
          // ask 是唯一的「自然语言入口」：眼镜上用户不会说「查配伍」，
          // 只会说「甘草海藻能不能一起吃」。分流规则放在适配层而不是页面，
          // 因为只有这里能手写测试（见 tests/smoke.js 的意图分流用例）。
          return viewAsk(payload);
        default: {
          // 每个动作都补一个 intent。视图模型靠它决定屏幕怎么排，
          // 而直接 invoke('vitamin-mix') 拿到的是没有 intent 的结果——
          // 实测表现是「钙和铁能一起吃吗」的屏幕上写着一个「本草」。
          const views = {
            check: viewCheck,
            herb: viewHerb,
            toxicity: viewToxicity,
            pregnancy: viewPregnancy,
            safety: viewSafety,
            vitamin: viewVitamin,
            'vitamin-mix': viewNutrientMix,
          };
          const fn = views[action];
          // 动作名叫 vitamin-mix，但语义上的意图名是 nutrient-mix；
          // 两套名字混用会让视图模型漏掉一个分支（屏幕上是「本草」那种错）。
          // 这里统一成意图名，动作名只留在 SAFE_ACTIONS 这一层。
          const intent = action === 'vitamin-mix' ? 'nutrient-mix' : action;
          return fn ? { ...fn(payload), intent } : viewAsk(payload);
        }
      }
    },

    /**
     * 只暴露「听出了哪些药、哪些在库里」这一件事，供上层流水线判定置信度。
     * 不改变任何查询行为——查配伍、查毒性仍然走 invoke。
     * 单独立一个接口的理由：置信度要在「执行之前」算出来，而 invoke 一进去就开查了。
     */
    recognize(text) {
      const herbs = splitHerbList(stripQuestionWords(String(text || '')), LEXICON);
      const known = herbs.filter(isKnownHerb);
      return {
        herbs,
        known,
        unknown: herbs.filter((h) => !known.includes(h)),
        // 像不像药名。区分这两种情况是必要的：
        //   「三七」——真药名，只是本草库 123 味没收，该说「没收录」
        //   「今天天气不错」——根本不是药名，该说「没听出药名」
        // 混成一种会说「本草库还没收录今天天气不错」，等于把闲聊当成药念回去。
        plausible: herbs.filter(isHerbLike),
        // 营养素单独认：它不在药名词表里，靠药名那条路永远认不出来。
        // 只在调用方判断「没认出药名」时才该用它，药名优先。
        nutrients: findNutrients(text, VitaminEngine),
      };
    },
  };

  // ---------------------------------------------------------------- 配伍禁忌

  function viewCheck(payload) {
    const I = need('InteractionEngine', InteractionEngine);
    const herbs = readHerbList(payload);
    // 追问「为什么」时要给完整机理和争议，默认只给一句。
    // 判断放在这里而不是在播报层：播报层拿不到用户原话。
    const wantsReason = Boolean(payload.wantsReason || payload.wantReason);

    // 先确认「这些到底是不是药名」。
    // 为什么这一步不能省：查不到禁忌时如果直接说「没查到禁忌」，
    // 用户会把它当成「可以一起吃」——在用药场景里，把「没听懂」说成「没问题」
    // 是最危险的一种假阴性。所以认不出来的药名必须单独说出来。
    const unrecognized = findUnrecognized(herbs);
    if (unrecognized.length === herbs.length) {
      // 全部认不出来时也要区分两种原因：
      //   「三七」——像药名，只是本草库只有 123 味没收录
      //   「★☆※」——根本不是药名
      // 不区分的话两种情况都念「没听出药名」，说「三七」的用户会一直重说。
      const herbLike = unrecognized.filter(isHerbLike);
      const speech = herbLike.length > 0
        ? `本草库里还没有收录${herbLike.join('、')}，查不了它的配伍禁忌。`
        : '没听出药名。请说两味药，比如「甘草 海藻」。';
      return {
        herbs,
        recognized: false,
        notRecorded: herbLike,
        hasWarning: false,
        totalWarnings: 0,
        fans: [],
        weis: [],
        pregnancy: [],
        toxicity: [],
        unknown: unrecognized,
        // 这一档没有结论，也就没有出处可引。给的是边界句，不是免责话术：
        // 「没收录」和「能用」是两件事，不说清这一点，用户会把安静当成安全。
        source: NOT_RECORDED.herb,
        sourceTag: '',
        speech,
      };
    }

    const r = I.check(herbs);

    // 坑：check() 返回的 pregnancy 字段在单味药时是空的，
    // 妊娠禁忌必须单独调 checkPregnancy()。只用 check() 会漏掉「桃仁」这类——
    // 而妊娠禁忌恰恰是这个功能最不能漏的一项。两路结果合并去重。
    let pregnancy = Array.isArray(r.pregnancy) ? r.pregnancy.slice() : [];
    if (typeof I.checkPregnancy === 'function') {
      try {
        const extra = I.checkPregnancy(herbs) || [];
        const seen = new Set(pregnancy.map((p) => `${p.herb}|${p.msg}`));
        for (const e of extra) {
          const key = `${e.herb}|${e.msg}`;
          if (!seen.has(key)) {
            seen.add(key);
            pregnancy.push(e);
          }
        }
      } catch (err) {
        // 引擎这一路挂了不能把整个查询拖崩：已经拿到的配伍/毒性结果仍然有效，
        // 但必须如实标注「妊娠禁忌这一项没查成」，不能让用户以为查过了。
        console.error('[qihuang] checkPregnancy 失败：', err.message);
        pregnancy = pregnancy.concat([{ herb: '(未知)', level: 'unknown', msg: '妊娠禁忌这一项查询失败，请人工确认' }]);
      }
    }
    // 同一味药只留最严一条（桃仁会同时命中「禁用」和「慎用」两档）
    pregnancy = collapseByHerb(pregnancy);

    const speechParts = [];
    // 附带的妊娠、毒性提示单独放，播报里排在原因之后。
    const noticeParts = [];
    const cites = [];
    // 每条命中都带上「为什么」。这不只是为了丰富：
    // 只说「不可同用」而不说原因，用户没法判断这条规则对他当前的情况意味着什么，
    // 最后要么全信要么全不信——两种都是把判断权丢了。
    const reasons = [];

    function collect(pairs, type) {
      for (const item of pairs) {
        const [a, b] = item.herbs || [];
        const rs = reasonFor(a, b, type);
        reasons.push({ pair: [a, b], type, ...rs });
      }
    }

    if (r.fans && r.fans.length) {
      // 不写「配伍禁忌：」这个前缀。理由不是字数，是它挤掉了出处的位置：
      // 屏幕一行 20 字左右，加上这四个字正好把「出处：」顶到行尾、书名断到下一行，
      // 看上去像「出处」后面什么都没有。这个标签改由屏幕上方那行承担。
      // 「十九畏」那种前缀不能省——不说名字，用户听到「巴豆畏牵牛」不知道是哪一类规则。
      //
      // 「两药」只在真的只涉及两味药时才对。三味药同时出现两对反，
      // 说「两药不可同用」会让用户以为只有其中一对有问题，那种时候用「均」覆盖全部。
      const involved = new Set();
      for (const f of r.fans) for (const h of f.herbs || []) involved.add(h);
      const which = involved.size <= 2 ? '两药' : '均';
      speechParts.push(`${r.fans.map((f) => f.msg).join('；')}。${which}属十八反，不可同用`);
      collect(r.fans, '十八反');
      cites.push('shibaFan');
    }
    // 十九畏的配对以歌诀原文为准（见 wei-canon.js 的 DIFF）：
    // 引擎 FEAR_PAIRS 里「川乌畏草乌」「人参畏赤石脂」两组是读错歌诀得来的，
    // 而真正的那两对（人参畏五灵脂、官桂畏赤石脂）引擎表里没有。
    const wei = reconcileWei(r.weis || [], herbs);
    if (wei.weis.length) {
      // 原来只说「十九畏：丁香畏郁金」，没有「所以不能同用」这句。
      // 「畏」字在七情里另有含义（一药抑制另一药毒性、是可以同用的），
      // 不把结论说出来，用户听到的是一条不知道该怎么用的信息。
      // 用「不宜同用」而不用「不可同用」：十九畏的忌惮程度历来低于十八反。
      const involvedWei = new Set();
      for (const w of wei.weis) for (const h of w.herbs || []) involvedWei.add(h);
      const whichWei = involvedWei.size <= 2 ? '两药' : '均';
      speechParts.push(`十九畏：${wei.weis.map((w) => w.msg).join('；')}。${whichWei}属十九畏，不宜同用`);
      collect(wei.weis, '十九畏');
      cites.push('shijiuWei');
    }
    // 被歌诀否掉的那几对，不能只是「不报了」。
    // 沉默等于让用户自己去猜「是没这条，还是系统不知道」——
    // 而这两种情况他都会当成「没这条」，也就是「可以一起吃」。
    //
    // 长短两版按场合选：这句话是唯一结论时讲全（连同真实风险），
    // 已经另有禁忌时只给判断——细节见 explainRemoved 的注释。
    const corrections = wei.removed
      .map((rm) => explainRemoved(rm.pair))
      .filter(Boolean)
      .map((c) => (speechParts.length > 0 ? c.short : c.long));
    // 妊娠与毒性是「附带提示」，不是结论本身。
    // 必须排在原因之后：原来它们夹在结论和原因之间，
    // 一句「妊娠禁忌」横插进来，把「为什么不能同用」和它的结论隔开了两行。
    if (pregnancy.length) {
      // 按档位合并，不逐味重复「— 妊娠禁忌（禁用）」。
      // 原来三味药会念成「A — 妊娠禁忌（禁用）；B — 妊娠禁忌（禁用）；C — 妊娠禁忌（禁用）」，
      // 三十多个字里只有三个药名是信息，其余全是复读，还把原因挤出屏幕。
      noticeParts.push(`妊娠${groupByLevel(pregnancy, (p) => (/禁用/.test(p.msg) ? '禁用' : (/慎用/.test(p.msg) ? '慎用' : '')))}`);
      cites.push('pregnancy');
    }
    // 毒性提示也按药典名单算，不再用 r.toxicity。
    // r.toxicity 来自引擎的 getToxicity，而那张表缺半夏、白果、山豆根这些
    // 药典明列的有毒品——「甘草、半夏」这种问法会漏掉半夏的毒性提示。
    const toxic = herbs
      .filter((h) => !unrecognized.includes(h))
      .map((h) => {
        const t = toxicityOf(h);
        return { herb: h, toxicity: t ? (t.level || '已取消药用标准') : null };
      })
      .filter((t) => t.toxicity);
    if (toxic.length) {
      // 同级的药名合在一起，级别只写在末尾一次：「大戟、甘遂（有毒）」。
      noticeParts.push(`毒性：${groupByLevel(toxic, (t) => t.toxicity, '、')}`);
      cites.push('toxicity');
    }

    const totalWarnings = (r.fans || []).length + wei.weis.length + pregnancy.length;
    // 部分药名认不出来时必须说出来，否则「没查到禁忌」会被听成「可以一起吃」。
    const unknownNote = unrecognized.length > 0
      ? (unrecognized.some(isHerbLike)
        ? `${unrecognized.join('、')}本草库没收录，只查了认识的药`
        : `${unrecognized.join('、')}没听出是药名，只查了认识的药`)
      : '';
    // 结论只针对「认出来的药」说。把「乱说的东西」也念进结论里，
    // 用户会以为自己那味药查过了——那是另一种形式的假阴性。
    const known = r.herbs.filter((h) => !unrecognized.includes(h));
    // 没有配伍禁忌时，正文要正面回答「能不能同用」——这是用户问的那件事。
    //
    // 原来只要 noticeParts 非空就留空正文，判据太宽：细辛配芍药之间有毒性提示
    // （细辛小毒）但确实没有配伍禁忌，屏幕就只剩「毒性：细辛（小毒）」一行，
    // 用户问的是「能同用吗」，屏幕上没人回答。
    //
    // 真正会自相矛盾的只有妊娠：妊娠禁忌本身就是这三类检查之一，
    // 前一句「妊娠禁用：大戟」、后一句「没查到妊娠禁忌」，自己打自己。
    // 毒性不在这三类里——一味药有毒，不等于两味药之间有配伍禁忌，两句可以并存。
    // 校正说明算结论的一部分，不是附带提示。
    // 它解释的正是「你问的这一对到底算不算禁忌」，所以必须站在结论的位置上，
    // 排在原因之前——把它往后放，用户先读到一大段机理，才发现机理讲的那条禁忌不成立。
    // 只有它、没有别的结论时（问「川乌草乌」），正文就是它：
    // 此时说「没查到禁忌」是错的，禁忌查到了，只是歌诀说不是这一对。
    const bodyParts = [...speechParts, ...corrections];
    // 有妊娠提示时，正文只回答「配伍禁忌」这一项，不再提妊娠。
    // 原来这种情况正文整个留空，理由是「妊娠禁用」后面接「没查到妊娠禁忌」自相矛盾——
    // 但留空本身也是错的：「甘草和半夏能一起吃吗」屏幕上只剩「妊娠禁用：半夏」
    // 和「毒性：半夏」，用户问的那件事（这两味能不能配）没有一句话回答。
    // 矛盾的根源是句子把三类检查捆在一句里说，拆开就没有矛盾了。
    const noConflict = known.length === 1
      // 单味药说「之间」是病句，质检最容易挑出来的那种
      ? `没有查到${known[0]}相关的十八反、十九畏`
      : `${known.join('、')}之间没有十八反、十九畏`;
    const body = bodyParts.length > 0
      ? bodyParts.join('。')
      : (pregnancy.length > 0 || toxic.length > 0
        ? noConflict
        : `${noConflict}或妊娠禁忌`);
    // 一条都没命中时也要交代「拿什么核的」，否则「没查到」等于没依据的安静。
    // 这不是免责，是让用户知道这次是翻了三本书没翻到，不是我没查。
    // 有结论走 citeLine（说「出处」），没结论走 citeScope（说「按…核对」）——
    // 这两种情况必须用两种说法，混用会让「没查到」听起来像「查到了」。
    const SCOPE = ['shibaFan', 'shijiuWei', 'pregnancy'];
    const source = cites.length > 0 ? citeLine(cites) : citeScope(SCOPE);

    // 原因句。
    //
    // 默认只说一条：播报一遍就过去了，两句以上的原因会挤掉结论本身，
    // 用户记住的是「说了很多」而不是「不能用」。想听全的可以追问。
    // 追问「为什么」时才把每条原因和争议一并给出来——那时候用户要的是解释，不是答案。
    // 同组的多对药合并成一句原因（甘草配大戟、甘遂 → 「大戟、甘遂是利水药」）。
    // 不合并的话，播报要么复读同一段原因，要么只说其中一味，
    // 而用户问了五味药，只解释两味，剩下三味等于没查。
    const uniqBrief = mergeBriefs(reasons).slice(0, wantsReason ? 3 : 1);
    let whyLine = '';
    if (uniqBrief.length) {
      whyLine = `原因：${uniqBrief.join('；')}`;
      if (wantsReason) {
        const debate = [...new Set(reasons.map((x) => x.debate).filter(Boolean))][0];
        if (debate) whyLine += `。需要说明的是：${debate}`;
      }
    }

    // 顺序：结论 → 原因 → 附带提示。
    // 原因紧跟结论，中间不插妊娠或毒性提示——那是两件事，
    // 隔开之后用户听到的是「不能用、孕妇禁用、原因是什么」，因果被打断了。
    const speech = joinSentences([unknownNote, body, whyLine, noticeParts.join('。')]);

    return {
      herbs: r.herbs,
      recognized: true,
      unknown: unrecognized,
      hasWarning: totalWarnings > 0 || (r.toxicity || []).some((t) => t.toxicity && t.toxicity !== '无毒'),
      totalWarnings,
      fans: r.fans,
      weis: wei.weis,
      // 引擎报了、歌诀不认的那几对，单独回传。
      // 不并进 weis：它们在语义上是「被否掉的」，混在一起会让
      // hasWarning / totalWarnings 把不存在的禁忌算进去。
      weiRemoved: wei.removed,
      pregnancy,
      toxicity: r.toxicity,
      // 逐对的原因，保留给需要追溯「哪一对」的调用方与测试。
      reasons,
      // 屏幕真正要渲染的是这一份：同组的几对折成一条，药名只留用户问到的那几味。
      // 直接用 reasons 的话，甘草配大戟、甘遂会出两行同一段机理
      //（屏幕上没有新信息，只把别的内容挤出可视区），
      // 而甘草配海藻时又会替他念大戟、甘遂、芫花三个没问的药名。
      reasonGroups: mergeReasons(reasons),
      // 屏幕正文：结论 + 附带提示，**不含**播报里那句浓缩原因。
      // 屏幕下面紧接着就是原因的全文，第一行再带一句浓缩版
      // 会变成「原因：…」然后又是「原因：…」，同一件事说两遍。
      screenText: joinSentences([unknownNote, body, noticeParts.join('。')]),
      source,
      sourceTag: citeTag(cites.length > 0 ? cites : SCOPE),
      // 播报长度按内容给，不再是全应用一个 32。
      // 32 字装不下「结论 + 原因」，而原因被截掉就只剩一句禁令，
      // 用户听到的是「不能吃」却不知道为什么——那和查字典没区别。
      // 追问为什么时放宽到 140，那时候用户要的就是全文。
      //
      // 校正说明也必须放宽：那句「川乌和草乌不属十九畏，歌诀畏的是犀角」本身就是结论，
      // 按 32 字截它就断在「这两味本来就常在同一个方子里」后面，听着像没说完。
      ...((reasons.length > 0 || corrections.length > 0)
        ? { sayMax: wantsReason ? 140 : 72 }
        : {}),
      speech,
    };
  }

  /**
   * 把「甘草海藻能不能一起吃」里的问句成分剥掉，只留药名部分。
   *
   * 为什么必须剥：不剥的话整句会被当成**一味**药名，
   * 于是「乱说的东西能不能一起吃」的未识别项变成「乱说的东西能不能一起吃」，
   * 屏幕上就把用户的原话当成药名念回去了，看起来像系统在复读。
   * 药名里不会出现「能不能」「一起吃」这些词，剥掉是安全的。
   */
  function stripQuestionWords(text) {
    return String(text || '')
      .replace(/(能不能|可不可以|能否|会不会)(一起|同时|同)?(吃|用|服|喝|服用|泡水)?/g, '')
      .replace(/(可以|能)(一起|同时|同)(吃|用|服|喝)/g, '')
      .replace(/(相克|相反|配伍|忌讳|禁忌|冲突|十八反|十九畏|相冲|相忌|打架)/g, '')
      // 「X 有毒吗」是毒性查询的标准问法，不剥掉就剩「全蝎有毒」四个字，
      // 连「像不像药名」都过不了，最后答「本草库还没收录全蝎有毒」——
      // 把用户自己的问句当成药名念回去了，看起来像系统在复读。
      // 药名里没有「毒」字（密陀僧、七叶一枝花都没有），剥掉是安全的。
      .replace(/(有没有毒|有无毒|有毒|无毒|小毒|大毒|毒性|毒不毒)/g, '')
      // 追问用语。「为什么甘草反海藻」里「为什么」和「反」都不是药名，
      // 不剥掉会剩下整整八个字，连「像不像药名」都过不了，
      // 最后答「没听出药名」——用户明明说得很清楚，却被告知没听懂。
      // 不剥「怎么」：它属于「怎么用/怎么吃」这类问法，下面那一行整词处理更准，
      // 这里先剥会留下一个孤零零的「用」，被当成没听出的药名。
      .replace(/(为什么|为啥|凭什么|什么道理|原因|原理|道理)/g, '')
      // 「反」单独剥，放在「相反」「十八反」之后：整词已经处理过，
      // 剩下的「反」只会出现在「A反B」这种句式里，不可能是药名的一部分。
      .replace(/反/g, ' ')
      // 「XX有什么功效」「XX是什么」「XX能不能吃」是最常见的三种问法。
      // 不剥掉，整句会被当成一个药名（「铁皮石斛有什么功效」七个字），
      // 连「像不像药名」都过不了，最后答「没听出药名」——
      // 用户会以为是自己没说清楚，其实只是尾巴没切掉。
      .replace(/(有什么|有哪些|有啥|有何)?\s*(功效|作用|效果|用处|好处|禁忌|副作用)/g, '')
      .replace(/(是什么|是啥|怎么样|好不好|能不能吃|能吃吗|可以吃吗|能不能用|怎么用|怎么吃)/g, '')
      .replace(/[吗呢吧啊呀？?！!。，,、\s]+/g, ' ')
      .trim();
  }

  /**
   * 把「甘草 海藻」「甘草海藻能不能一起吃」「甘草、海藻」都拆成药材名数组。
   * 拆法见 herb-lexicon.mjs：规整说法走分隔符，口语走词表最长匹配。
   */
  function readHerbList(payload) {
    const raw = payload.herbs || payload.text || payload.query;
    if (!raw) {
      const err = new Error('请告诉我哪几味药，比如「甘草 海藻」');
      err.code = 'missing_herbs';
      throw err;
    }
    const list = Array.isArray(raw)
      ? raw
      : splitHerbList(stripQuestionWords(raw), LEXICON);
    if (list.length === 0) {
      const err = new Error('没听清是哪几味药');
      err.code = 'missing_herbs';
      throw err;
    }
    return list;
  }

  /**
   * 是不是「系统认识的一味药」。
   * 判据是禁忌词表或本草库里有它——两处都是引擎自己的数据，不新增知识。
   * 这个判断存在的唯一理由：引擎的 getToxicity 对未知输入返回「无毒」，
   * 必须有一道门先拦住「拿不存在的东西去问毒性」。
   */
  function isKnownHerb(name) {
    if (!name) return false;
    if (LEXICON.has(name)) return true;
    // 药典毒性名单里有的，当然认识。
    // 引擎的 TOXICITY 表没有导出（只导出了 FEAR_PAIRS 等六个字段），
    // 所以词表收不到它里面的药名——「全蝎」「斑蝥」这些既不在词表也不在本草库里，
    // 「全蝎有毒吗」会被判成不认识这味药，而它明明是药典的有毒品。
    // 现在判据换成药典名单，比引擎那张错表可靠：名单是权威的，引擎表不是。
    if (toxicityOf(name)) return true;
    const B = BencaoEngine;
    if (B && typeof B.search === 'function') {
      try {
        return (B.search(name) || []).length > 0;
      } catch (err) {
        // 搜索挂了不能把已有药材判成不认得，回落到本草库键名判断
        console.error('[qihuang] search 失败：', err.message);
        return Boolean(B.DB && Object.prototype.hasOwnProperty.call(B.DB, name));
      }
    }
    return false;
  }

  /**
   * 从一句话里抽出唯一一味药名。
   * 抽不到返回 null（由调用方回落成原串）。
   * 为什么用词表而不是正则：药名长短不一，「雪上一枝蒿」和「人参」都要能命中，
   * 词表最长匹配是唯一不写死长度的做法（实现见 herb-lexicon.mjs）。
   */
  function extractOne(text) {
    // 用 splitHerbList 而不是 segmentHerbs：前者带分隔符切分和去重，
    // 「三七和三七」这种口误能收敛成一味，「查一下当归」能剥掉前缀。
    const list = splitHerbList(text, LEXICON);
    return list.length > 0 ? list[0] : null;
  }

  /**
   * 哪些「药名」其实认不出来。
   * 判定顺序：禁忌词表里有 → 算认识；本草库 search 有结果 → 算认识；两者都没有 → 认不出来。
   * BencaoEngine 没加载时跳过这项判定——不能因为缺一个引擎就把所有查询都拦下来。
   */
  function findUnrecognized(herbs) {
    const B = BencaoEngine;
    if (!B || typeof B.search !== 'function') return [];
    const out = [];
    for (const h of herbs) {
      if (LEXICON.has(h)) continue;
      let hits = [];
      try {
        hits = B.search(h) || [];
      } catch (err) {
        // 搜索这条路挂了不能把整个查询判成「认不出来」，只记日志
        console.error('[qihuang] search 失败：', err.message);
        continue;
      }
      if (!Array.isArray(hits) || hits.length === 0) out.push(h);
    }
    return out;
  }

  // ---------------------------------------------------------------- 本草条目

  /**
   * 取这味药在经典里的原文，**只取真正讲这味药的**。
   *
   * 数据里 110 条经典条文，绝大多数是方论——「太阳病，头痛发热…桂枝汤主之」
   * 确实提到了甘草，但它讲的是方，不是甘草。把这种条文贴在药性下面，
   * 用户会当成「古人对甘草的论述」，这是误导，比不给出处更糟。
   *
   * 所以只认 category==='本草'（神农本草经）且 herb_keywords 明确含这味药的。
   * 覆盖率很低（全库 5 条），但每一条都是准的——有出处才说出处，不相关就不说。
   */
  function ancientFor(name) {
    if (!Array.isArray(ANCIENT_TEXTS)) return null;
    return ANCIENT_TEXTS.find((t) => t
      && t.category === '本草'
      && Array.isArray(t.herb_keywords)
      && t.herb_keywords.includes(name)) || null;
  }

  function viewHerb(payload) {
    const B = need('BencaoEngine', BencaoEngine);
    const name = readName(payload, '药名');

    // 整句里带药名的情况（「当归是什么」「查一下当归」）在这里兜住。
    // 不让它进 search，否则 search('当归是什么') 必然空手而归，
    // 用户看到的是「本草库里没有当归是什么」——把句子当药名念回去了。
    const cleaned = extractOne(name) || name;

    const hits = B.search(cleaned) || [];
    if (hits.length === 0) {
      // 本草条目没有，但禁忌库认得它（桃仁就是这种：有妊娠禁忌和毒性记录，
      // 却没有性味功效条目）。这种情况必须说清楚「哪部分有、哪部分没有」，
      // 否则一句「没收录」会让用户以为这味药系统完全不认识。
      const knowsElsewhere = isKnownHerb(cleaned) && LEXICON.has(cleaned);
      return {
        found: false,
        query: cleaned,
        source: NOT_RECORDED.herb,
        sourceTag: '',
        speech: knowsElsewhere
          ? `${cleaned}没有性味功效条目，但禁忌库里有它的记录，可以问「${cleaned}有毒吗」或「孕妇能吃${cleaned}吗」。`
          : (isHerbLike(cleaned)
            ? `本草库还没收录${cleaned}，目前收录 ${Object.keys(B.DB || {}).length} 味常用药材。`
            : '没听出药名，说一下药名就行。'),
      };
    }

    // 精确命中优先，否则取第一个搜索结果
    const exact = hits.find((h) => h === cleaned) || hits[0];
    const info = B.query(exact);
    if (!info) {
      return { found: false, query: cleaned, source: NOT_RECORDED.herb, sourceTag: '', speech: `查到了${exact}，但没有详细条目。` };
    }

    // 只念四件用户当场最需要的事：性味、功效、用量、忌服。
    // 不念「主治」——那是最容易被当成诊断建议的一段。
    const parts = [];
    if (info.xingwei) parts.push(`性味${info.xingwei}`);
    if (info.功效) parts.push(`功效是${info.功效}`);
    if (info.jifu) parts.push(`常用量${info.jifu}`);
    if (info.tabi && info.tabi.length) parts.push(`${info.tabi.join('；')}`);

    const ancient = ancientFor(exact);
    // 原文放屏幕，播报只说一句「经典里有原文」。
    // 不整段念：古文的断句在语音里很难听懂，而且会把功效挤到听不见的地方。
    const ancientSay = ancient ? ancientLine(ancient.source) : '';

    return {
      found: true,
      name: exact,
      alternatives: hits.filter((h) => h !== exact).slice(0, 5),
      xingwei: info.xingwei,
      guijing: info.guijing,
      effect: info.功效,
      dosage: info.jifu,
      toxicity: info.jindu,
      avoid: info.tabi,
      // 出处只在真讲这味药时给，不给就不给——编一个出处比没有出处糟得多
      ancient: ancient ? { source: ancient.source, chapter: ancient.chapter, text: ancient.original_text } : null,
      // 引擎字段自带句号（维生素的「功效」就是「…。」），直接拼会出现「。。」
      // 用 joinSentences 统一管标点
      // 有原文时播报已点名《本草纲目》，尾巴就不再重复「性味功效按药典」，
      // 改成屏幕上的那句长说明，让用户知道药性和原文是两套来源。
      // 有原文时药性和原文是两套来源，必须分开标：用户翻书时得知道哪句在药典、
      // 哪句在古籍。合成一句「出自《中国药典》」会把原文也算成药典条目，
      // 合成「出自《本草纲目》」则把性味功效算成古人说的——两种都是错标。
      source: ancient
        ? `出处：《中国药典》（性味功效）；原文引自《${ancient.source}》。`
        : citeLine(['bencao']),
      sourceTag: ancient ? `《中国药典》、《${ancient.source}》` : '《中国药典》与中药学教材',
      sourceLong: ancient
        ? `${citeLong('bencao')} 屏幕上那段原文出自《${ancient.source}》，不是药典条目。`
        : citeLong('bencao'),
      speech: `${exact}：` + joinSentences(ancientSay ? [...parts, ancientSay] : parts),
      // 屏幕版正文：不带「原文在屏幕上可看」这句。
      // 那句话是给语音用的（用户看不见屏幕，得告诉他去看），
      // 放到屏幕上就变成「原文在屏幕上可看」紧接一段原文——自己指着自己，多余。
      screenText: `${exact}：` + joinSentences(parts),
    };
  }

  // ---------------------------------------------------------------- 毒性速查

  /**
   * 毒性查询。
   *
   * 这里有个必须堵的坑：引擎的 getToxicity() 对**任何**未知字符串都返回「无毒」
   *（实现是遍历毒性表没命中就 return '无毒'）。直接用它，用户问「★☆※有毒吗」
   * 会被回答「★☆※在药典里标注为无毒」——把「查不到」说成了「安全」，
   * 而且出现在最不能出错的毒性问题上。
   * 所以先确认这是不是药名、库里有没有，再谈毒性。
   */
  function viewToxicity(payload) {
    const I = need('InteractionEngine', InteractionEngine);
    const name = readName(payload, '药名');

    // 分级改以《中国药典》83 种名单为准（toxicity-canon.js），不再透传引擎。
    // 引擎那张表两个方向都错：半夏、白果、山豆根在药典里是「有毒」，
    // 引擎里根本没有它们，透传就成了「半夏在药典里标注为无毒」——
    // 一味药典明列的有毒药、还是十八反成员，被答成无毒。这不是数据陈旧。
    const tox = toxicityOf(name);
    // 认不认识只影响后半句，不该把整个问题挡掉。
    // 原来这里「不认识 → 本草库还没收录」，但用户问的是毒性，
    // 而毒性依据的是药典那 83 种名单，不依赖本草库——名单是完整的，
    // 查不到就说「不在名单里」，这比「本草库没收录」更接近他问的事。
    const known = isKnownHerb(name);

    if (!tox && !known && !isHerbLike(name)) {
      return {
        name,
        found: false,
        toxicity: null,
        source: NOT_RECORDED.herb,
        sourceTag: '',
        speech: '没听出药名。',
      };
    }

    if (tox) {
      return {
        name,
        found: true,
        // level 是等级字符串；已取消药用标准的没有等级，给字符串本身，
        // 调用方按「非空且不是无毒」判断有没有要提醒的东西，两种都能覆盖。
        toxicity: tox.level || '已取消药用标准',
        source: citeLine(['toxicity']),
        sourceTag: citeTag(['toxicity']),
        // 原来这句尾巴是「用量和炮制方式要严格按医嘱」。删掉的原因不是嫌它长：
        // 它把「谁负责」从书转移到了一个不在场的人身上，用户听完只剩一句
        // 「反正得问别人」，既没得到知识也没得到边界。换成出处之后，
        // 主语是药典，用户知道自己该去翻什么。
        speech: tox.kind === 'canon'
          ? `${tox.text}，具体用量和炮制方式药典里有规定，我不给数。`
          : tox.text,
      };
    }

    // 名单里没有。这里**不能**说「无毒」：83 种名单只覆盖药典收载的毒性品种，
    // 不在名单只说明药典没把它列为毒性药材，不说明它安全——
    // 而且「查不到」被说成「可以吃」是这个应用已经踩过一次的坑。
    return {
      name,
      found: true,
      toxicity: null,
      source: citeScope(['toxicity'], '没有把它列为毒性药材'),
      sourceTag: citeTag(['toxicity']),
      speech: known
        ? `${name}${NOT_LISTED}。`
        : `${name}${NOT_LISTED}，本草库也没有收录它的条目。`,
    };
  }

  // ---------------------------------------------------------------- 妊娠禁忌

  /**
   * 妊娠禁忌单独一个动作。
   * 为什么不复用 check：用户问「孕妇能吃桃仁吗」要的是这一味药的妊娠结论，
   * 而不是配伍提醒。混在一起答，最容易出现「问毒性答妊娠」这种答非所问。
   */
  function viewPregnancy(payload) {
    const I = need('InteractionEngine', InteractionEngine);
    const herbs = readHerbList(payload);
    const known = herbs.filter(isKnownHerb);

    if (known.length === 0) {
      return {
        herbs,
        found: false,
        entries: [],
        source: NOT_RECORDED.herb,
        sourceTag: '',
        speech: isHerbLike(herbs[0])
          ? `本草库还没收录${herbs.join('、')}，查不到妊娠禁忌记录。`
          : '没听出药名。',
      };
    }

    let entries = [];
    if (typeof I.checkPregnancy === 'function') entries = I.checkPregnancy(known) || [];
    entries = collapseByHerb(entries);

    if (entries.length === 0) {
      // 查不到记录 ≠ 可以用。这句必须说，否则「没查到」会被当成「安全」。
      // 但「去问医生」不是这里该给的答案：用户问的是「这味药记不记在禁忌歌里」，
      // 那是书能回答的，答完就够了。
      return {
        herbs: known,
        found: true,
        entries: [],
        source: citeLine(['pregnancy']),
        sourceTag: '妊娠用药禁忌歌',
        speech: `${known.join('、')}没有查到妊娠禁忌记录，但没有记录不等于孕妇可以吃。`,
      };
    }

    const msgs = entries.map((e) => e.msg.replace(/\s*—\s*/g, '：'));
    return {
      herbs: known,
      found: true,
      entries,
      strictest: entries.some((e) => e.level === 'strong') ? 'strong' : 'moderate',
      source: citeLine(['pregnancy']),
      sourceTag: '妊娠用药禁忌歌',
      speech: joinSentences([msgs.join('；'), '妊娠期间不要自行服用']),
    };
  }

  /**
   * 「X 能不能吃」这类一句话提问。
   * 把妊娠禁忌和毒性两条结果合并成一段，因为用户问的就是一个整体判断。
   * 注意这里不做配伍——单味药没有配伍可言；多味药的配伍由 check 那条路负责。
   */
  function viewSafety(payload) {
    const I = need('InteractionEngine', InteractionEngine);
    const herbs = readHerbList(payload);
    const known = herbs.filter(isKnownHerb);

    if (known.length === 0) {
      return {
        herbs,
        found: false,
        entries: [],
        source: NOT_RECORDED.herb,
        sourceTag: '',
        speech: isHerbLike(herbs[0])
          ? `本草库还没收录${herbs.join('、')}，查不到它的禁忌和毒性记录。`
          : '没听出药名。',
      };
    }

    const preg = typeof I.checkPregnancy === 'function'
      ? collapseByHerb(I.checkPregnancy(known) || [])
      : [];
    // 毒性也走药典名单，不再用 I.getToxicity。
    // 「能不能吃」这条路上漏报一次，用户就会把它当成「可以吃」——
    // 而引擎表里半夏、白果、山豆根整个缺失，透传等于替它们开了通行证。
    const tox = known.map((h) => {
      const t = toxicityOf(h);
      return { herb: h, level: t ? (t.level || '已取消药用标准') : null, text: t ? t.text : '' };
    });
    const toxic = tox.filter((t) => t.level);

    const parts = [];
    const cites = [];
    if (preg.length) {
      parts.push(preg.map((e) => e.msg.replace(/\s*—\s*/g, '：')).join('；'));
      cites.push('pregnancy');
    }
    if (toxic.length) {
      parts.push(toxic.map((t) => t.text).join('、'));
      cites.push('toxicity');
    }

    const body = parts.length === 0
      // 查不到记录 ≠ 可以放心用。这句必须说。
      ? `${known.join('、')}没有查到妊娠禁忌或毒性记录，但这不等于可以放心用`
      : parts.join('。') + (preg.length ? '。妊娠期间不要自行服用' : '');

    return {
      herbs: known,
      found: true,
      entries: preg,
      toxicity: tox,
      hasWarning: parts.length > 0,
      source: citeLine(cites),
      sourceTag: citeTag(cites),
      speech: joinSentences([body]),
    };
  }

  function readName(payload, label) {
    const raw = payload.name || payload.herb || payload.query || payload.text;
    if (!raw || !String(raw).trim()) {
      const err = new Error(`请告诉我${label}`);
      err.code = 'missing_name';
      throw err;
    }
    // 去掉口语里的前缀和问法后缀。
    // 后缀这一条不是洁癖：用户问「附子有毒吗」，不剥掉「有毒吗」就变成
    // search('附子有毒吗')，必然查不到，然后回一句「本草库没有附子有毒吗」——
    // 把一个正常问题答成了「你说的话不是药名」。
    return String(raw)
      .replace(/^(查一下|查查|查|问一下|问|请问|帮我查|帮我看看|看看)/, '')
      .replace(/(有没有毒|有毒吗|有毒么|毒性大吗|是什么药|是什么|有什么用|怎么用|多少克|多少钱|能吃吗|可以吃吗|能吃么|能用吗|怎么样)/g, '')
      .replace(/[？?！!。，,、\s]+$/g, '')
      .replace(/^[？?！!。，,、\s]+/g, '')
      .trim();
  }

  // ---------------------------------------------------------------- 营养素

  function viewVitamin(payload) {
    const V = need('VitaminEngine', VitaminEngine);
    const name = readName(payload, '营养素名');
    const all = V.getAllVitamins ? V.getAllVitamins() : [];
    const list = Array.isArray(all) ? all : [];

    // 语音识别给回来的「维生素c」是小写，库里是「维生素C」；口语还常说「维C」。
    // 直接 includes 比会永远查不到，而用户完全不知道自己哪里说错了。
    const norm = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();
    const key = norm(name)
      .replace(/^维他命/, '维生素')
      .replace(/^维(?=[ABCDEK]$)/, '维生素');
    const hit = list.find((v) => norm(v.nameCN).includes(key) || norm(v.id) === key);

    if (!hit) {
      // 「没收录」的答复同样要留边界。少了它，用户听到的是
      // 「这个库里没有它」——很容易被理解成「所以应该没关系」。
      return {
        found: false,
        query: name,
        available: list.slice(0, 8).map((v) => v.nameCN).filter(Boolean),
        source: NOT_RECORDED.nutrient,
        sourceTag: '',
        speech: `营养素库里没有「${name}」。可以问${list.slice(0, 4).map((v) => v.nameCN).filter(Boolean).join('、')}。`,
      };
    }

    const detail = V.getVitaminDetail ? V.getVitaminDetail(hit.id) : null;
    const d = detail || hit;
    const parts = [];
    if (d.function) parts.push(d.function);
    if (d.dailyIntake) parts.push(`每日建议量${d.dailyIntake}`);
    if (d.foods) parts.push(`食物来源${d.foods}`);

    return {
      found: true,
      id: hit.id,
      name: d.nameCN || hit.nameCN,
      effect: d.function,
      dailyIntake: d.dailyIntake,
      foods: d.foods,
      source: citeLine(['vitamin']),
      sourceTag: '现代营养学资料',
      // 引擎的「功效」字段本身带句号，直接用 join('。') 会念出「。。」
      speech: `${d.nameCN || hit.nameCN}：` + joinSentences(parts),
    };
  }

  // ---------------------------------------------------------------- 营养素搭配
  //
  // 为什么单独一条：用户问「钙和铁能一起吃吗」时，他问的其实和
  // 「甘草和海藻能一起用吗」是同一件事——两个东西放在一起会不会互相干扰。
  // 引擎里有 44 条营养素相互作用数据，但原来只有单味查询的入口，
  // 这块数据等于没用上。而它恰恰是养生场景里最实用的一块：
  // 中老年人同时吃钙片和铁剂、健身的人同时补锌和镁，都是真实会发生的。
  function viewNutrientMix(payload) {
    const V = need('VitaminEngine', VitaminEngine);
    const db = Array.isArray(V.INTERACTION_DB) ? V.INTERACTION_DB : [];
    const list = Array.isArray(V.VITAMIN_LIST) ? V.VITAMIN_LIST : [];

    // 入参可以是 id（vitamin-c）也可以是中文名（维生素C），统一成 id
    const toId = (x) => {
      const k = String(x || '').replace(/\s+/g, '').toUpperCase();
      const v = list.find((it) => String(it.id).toUpperCase() === k || String(it.nameCN || '').replace(/\s+/g, '').toUpperCase() === k);
      return v ? v.id : null;
    };
    const ids = (Array.isArray(payload.nutrients) ? payload.nutrients : [payload.a, payload.b])
      .map(toId)
      .filter(Boolean);

    if (ids.length < 2) {
      const err = new Error('要查搭配得说两样，比如「钙和铁能一起吃吗」');
      err.code = 'missing_nutrients';
      throw err;
    }

    const nameOf = (id) => (list.find((v) => v.id === id) || {}).nameCN || id;
    const found = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i]; const b = ids[j];
        const hit = db.find((r) => r && (
          (r.nutrientA === a && r.nutrientB === b) || (r.nutrientA === b && r.nutrientB === a)
        ));
        if (hit) found.push({ ...hit, aName: nameOf(hit.nutrientA), bName: nameOf(hit.nutrientB) });
      }
    }

    if (found.length === 0) {
      // 「数据库里没有这一对」不等于「一起吃不碍事」。和中药材那条同理，
      // 这句话必须说出来，否则用户会把「没查到」当成「没问题」。
      return {
        found: false,
        pair: ids.map(nameOf),
        source: NOT_RECORDED.nutrient,
        sourceTag: '',
        speech: `营养素库里没有「${ids.map(nameOf).join('、')}」这一对的搭配记录。没记录不等于可以随便一起吃。`,
      };
    }

    // 严重度高的先说。用户只记得住第一句。
    const rank = { high: 3, medium: 2, low: 1 };
    found.sort((x, y) => (rank[y.severity] || 0) - (rank[x.severity] || 0));

    const lines = found.map((f) => {
      const sev = f.severity === 'high' ? '要注意' : (f.severity === 'medium' ? '有影响' : '小影响');
      return `${f.aName}和${f.bName}：${sev}。${f.advice || f.description || ''}`;
    });

    return {
      found: true,
      pair: ids.map(nameOf),
      entries: found,
      severity: found[0].severity,
      hasWarning: found.some((f) => f.severity === 'high' || f.severity === 'medium'),
      source: citeLine(['nutrientMix']),
      sourceTag: '现代营养学资料',
      speech: joinSentences([lines.join('；')]),
    };
  }

  // ---------------------------------------------------------------- 自然语言入口

  function viewAsk(payload) {
    const text = String(payload.text || payload.query || payload.q || '').trim();
    if (!text) {
      const err = new Error('说一句想问的，比如「甘草海藻能不能一起吃」');
      err.code = 'missing_text';
      throw err;
    }

    let intent = detectIntent(text);

    // 兜底判据：一口气说了两味以上的药，几乎一定是在问「能不能一起用」。
    // 不加这条，「甘草、海藻、甘遂」会被当成本草条目查询，只答第一味甘草的性味功效，
    // 十八反写在「忌服」那一栏里，用户很可能没听完就走了——
    // 而这三味的组合恰恰是必须警告的。
    if (intent === 'herb') {
      const herbs = splitHerbList(stripQuestionWords(text), LEXICON);
      if (herbs.length >= 2) intent = 'check';
    }

    // 每种意图吃不同的字段，这里统一塞进去，免得调用方分别记 payload 形状。
    // 上游（流水线）如果已经切好药名，就直接用它的结果——
    // 两处各切一次会出现「上游认出附子、下游答没听出药名」这种自相矛盾。
    const preHerbs = Array.isArray(payload.herbs) ? payload.herbs : null;
    const wantsReason = Boolean(payload.wantsReason) || WANT_REASON.test(text);
    const args = preHerbs
      ? { text, query: text, herbs: preHerbs, name: preHerbs[0], wantsReason }
      : { text, query: text, herbs: text, name: text, wantsReason };
    const result = viewDispatch(intent, args);
    return { ...result, intent, text };
  }

  function viewDispatch(intent, args) {
    let result;
    switch (intent) {
      case 'check': result = viewCheck(args); break;
      case 'pregnancy': result = viewPregnancy(args); break;
      case 'safety': result = viewSafety(args); break;
      case 'toxicity': result = viewToxicity(args); break;
      case 'vitamin': result = viewVitamin(args); break;
      case 'vitamin-mix': result = viewNutrientMix(args); break;
      case 'herb': result = viewHerb(args); break;
      default: result = viewHerb(args);
    }
    // intent 统一在这里补，而不是只靠 viewAsk 那一层补。
    // 原因：页面也能直接 invoke('vitamin-mix') 拿到结果，
    // 那条路上没有 intent，视图模型就会把它当成本草条目渲染——
    // 实测表现是「钙和铁能一起吃吗」的屏幕上写着一个「本草」。
    return { ...result, intent };
  }
}
