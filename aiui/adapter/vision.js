/**
 * 拍一下，认出这是什么，然后直接告诉你怎么用。
 *
 * 为什么这一层在眼镜上是核心而不是「输入优化」：
 * 手机要掏出来、解锁、对准、拍——四个动作。眼镜只用「看一眼」。
 * 而「看着我手里这包东西问它怎么用」这件事，只有第一视角的载体做得到。
 * 所以这里的产物不是「一串识别文字」，而是**直接接上查书的结果**。
 *
 * 链路（社区实践验证过的形状）：
 *   camera.takePhoto → base64 → LanguageModel.prompt
 *     → 药名 → view.handle('X怎么吃') → 播报 + 屏幕
 *
 * 安全边界写死在最后：识别只负责「这是什么」，不负责「能不能吃」。
 * 认错了让它说「没认出来」，比猜一个更像的强——猜错的代价是有人照着吃。
 */

/** 能查的才认：识别结果必须能在书架上找到，否则宁可说没认出来。 */
import { booksOn, SHELF } from './bookshelf.js';
import { FOODS } from './food-canon.js';
import { gmOf } from './gm-canon.js';

/**
 * 两阶段识别的提示词。
 *
 * 为什么分两步：一步到位地问「这是不是黄芪」，模型会顺着你的话点头——
 * 社区里做拍照识花的人踩过这个坑（画面不符合也判成功）。
 * 先让它客观描述，再拿描述去对书，是把它从「迎合」拉回「观察」。
 */
export const VISION_PROMPTS = {
  describe: '客观描述这张图里有什么。只写你确实看见的东西（形状、颜色、质地、包装上的字）。'
    + '不要推测用途，不要判断好坏，不要下任何结论。不超过 60 字。',
  identify: (desc) => `下面是刚才那张图的客观描述：\n"""${desc}"""\n`
    + `从描述里挑出属于中药材、药食同源或常见食材的名称。`
    + '只输出名称，用顿号分隔，最多三个。一个都没有就输出「无」。'
    + '不要解释，不要加标点以外的字。',
};

/**
 * 从模型输出里捞出可能的名称。
 *
 * 模型不听话是常态：会带「图中是…」「主要有」这类前缀，会加句号，
 * 会给出同义词。这里只做清洗，不做判断——能不能查由 canLookup 决定。
 */
export function parseNames(raw) {
  let t = String(raw || '').trim();
  if (!t || t === '无' || /^(无|没有|未识别)/.test(t)) return [];
  // 模型不会照着格式答：会写「图中是…」「看起来像…」「主要有：…」「还有几片…」。
  // 这些前缀必须逐层剥，否则「看起来像党参」会当成一个词去查，永远查不到。
  const PREFIX = /^(图中|图里|这张图|画面中|照片中|看起来像|看起来|看上去像|看上去|主要有|包括|可能是|应该是|应该是|还有|以及|是|有)+/g;
  const MEASURE = /^(几片|一点|一些|几个|若干|一把|一小把|两片|三片)+/g;
  return t
    .split(/[、,，;；。\s]+/)
    .flatMap((x) => x.split(/[和与跟及]/))     // 「黄芪和当归」是两味，不是一味
    .map((x) => x
      .replace(/[（(].*?[）)]/g, '')            // 括号里是解释，不是名字
      .replace(PREFIX, '')
      .replace(MEASURE, '')
      .replace(/[。.\s：:]/g, '')
      .trim())
    .filter((x) => x.length >= 1 && x.length <= 8)
    .slice(0, 3);
}

/**
 * 这个名字我们真的查得到吗。
 * 三处有一处命中就算：药食同源 102 味、本草纲目条目、书架任意一本。
 */
export function canLookup(name) {
  const k = String(name || '').trim();
  if (!k) return false;
  return Boolean(FOODS[k] || gmOf(k) || booksOn(k).length);
}

/**
 * 把识别结果变成「能查的那个」。
 *
 * 返回 null 表示一个都查不到——这时上层必须说「没认出来」，
 * 不许拿最像的那个顶替。认错药比认不出严重得多。
 */
export function pickLookupName(names) {
  const list = Array.isArray(names) ? names : parseNames(names);
  const hit = list.find(canLookup);
  if (hit) return { name: hit, lookupable: true };
  // 认出来了但书里没有：这个要和「完全没认出来」分开说。
  // 用户拍一包阿胶，说「没认出来」是撒谎——我们认出来了，只是没收录。
  const any = list.find((x) => x && x.length >= 2);
  return any ? { name: any, lookupable: false } : { name: null, lookupable: false };
}

/**
 * 识别失败/没认出来时的话术。
 * 不说「识别失败」这种系统语言，说清楚现在能怎么办。
 */
export function visionFallback() {
  return '这张图里没认出能查的东西。可以换个角度再拍一张，或者直接说名字，比如「黄芪怎么吃」';
}

/**
 * 拍照入口的提示。真机上先要说清「拍什么」，否则用户会对着空气按。
 */
export function visionHint() {
  return '对着药材、食材或者包装袋，按一下确认键拍照。拍完我看看是什么，再告诉你它怎么用';
}

/**
 * 书架自述——给「你能认什么」这个问法用。
 * 数字是算出来的，不是宣传语。
 */
export function visionScope() {
  return `书架上 ${SHELF.length} 本、${SHELF.reduce((n, b) => n + b.count, 0)} 条里的东西都能认，`
    + '药食同源 102 味和本草纲目收录的药材优先';
}
