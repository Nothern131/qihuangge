/**
 * 书架：系统里所有的书都在这里登记。
 *
 * 这个文件的定位必须说清，因为它决定了整个产品是「查书」还是「背答案」：
 *
 *   ❌ 硬编码：代码里写着「失眠 → 酸枣仁」。知识在程序里，
 *      加一味药要改代码，说错一句要重发版。
 *   ✅ 活编码：书是数据，程序只做三件事——听懂用户说的、到书里找、
 *      把原文和出处交出来。知识在书里，程序只负责检索和翻译。
 *
 * 所以每本书 = 一个 build 脚本（抓原文）+ 一个 canon 模块（打包）+ 这里一行登记。
 * 加书不改业务逻辑，只加登记——这是这条架构能不能站住的分界线。
 *
 * 但有一层必须诚实：**映射层不是书**。
 * 「用户说『睡不好』要能查到书里的『不眠』」这件事，任何一本古籍都不会写，
 * 只能由我们做一张翻译表（见下面 MAPPINGS）。这些表是「读完书之后的索引」，
 * 不是书的内容，所以每一处都标了它站在哪本书上说。
 */

import { GM_ITEMS, GM_SOURCE, gmOf, gmWords } from './gm-canon.js';
import { SHILIAO_ITEMS, SHILIAO_SOURCE, shiliaoOf, shiliaoWords } from './shiliao-canon.js';
import { SHANJIA_ITEMS, SHANJIA_SOURCE, shanjiaWords, dishesWith } from './shanjia-canon.js';
import { YANGLAO_ITEMS, YANGLAO_SOURCE, yanglaoCategories, formulasForState } from './yanglao-canon.js';
import { CARE_ITEMS, CARE_SOURCE, careForState, careForSeason } from './care-canon.js';
import { synonyms, pickDish } from './recipe.js';

/**
 * 书目录。字段含义：
 *   view   —— 这本书回答的是哪种问题（药 / 吃法 / 菜 / 病 / 调护）
 *   count  —— 条目数，界面和测试都要用
 *   ask    —— 「这本书能回答什么」，一句话
 */
export const SHELF = [
  {
    id: 'bencao',
    name: '本草纲目',
    era: '明·李时珍，1596',
    view: '药',
    count: Object.keys(GM_ITEMS).length,
    ask: '这味药有什么附方、古人怎么用它',
    source: GM_SOURCE,
  },
  {
    id: 'shiliao',
    name: '食疗本草',
    era: '唐·孟诜，约 700',
    view: '吃法',
    count: Object.keys(SHILIAO_ITEMS).length,
    ask: '这味东西怎么弄着吃',
    source: SHILIAO_SOURCE,
  },
  {
    id: 'shanjia',
    name: '山家清供',
    era: '宋·林洪，约 1200',
    view: '一道菜',
    count: Object.keys(SHANJIA_ITEMS).length,
    ask: '几样东西配起来能做什么菜',
    source: SHANJIA_SOURCE,
  },
  {
    id: 'yanglao',
    name: '养老奉亲书·上籍',
    era: '宋·陈直，约 1085',
    view: '病 → 方',
    count: YANGLAO_ITEMS.length,
    ask: '这类状况古人有什么食治方',
    source: YANGLAO_SOURCE,
  },
  {
    id: 'care',
    name: '养老奉亲书·下籍',
    era: '宋·陈直，约 1085',
    view: '调护',
    count: CARE_ITEMS.length,
    ask: '不吃药的话，起居饮食该怎么调',
    source: CARE_SOURCE,
  },
];

/** 书目摘要，给「我查了哪几本书」用。 */
export function shelfSummary() {
  return SHELF.map((b) => `${b.name}（${b.count} 条）`);
}

/**
 * 一条回答里，这本书到底出没出力。
 * 有就返回书名，没有返回空串——界面据此决定出处行写几本书。
 */
function hit(bookId, name) {
  // 异名要一起试：用户说「萝卜」，书里写「芦菔」；
  // 只按字面查会让书架少报一本书，而用户看到的结果是「这本书里没有」。
  const tries = synonyms(name);
  switch (bookId) {
    case 'bencao':
      return tries.some((t) => gmOf(t)) ? GM_SOURCE : '';
    case 'shiliao':
      return tries.some((t) => shiliaoOf(t)) ? SHILIAO_SOURCE : '';
    case 'shanjia':
      return pickDish(name) ? SHANJIA_SOURCE : '';
    default:
      return '';
  }
}

/**
 * 跨书查一个词：哪几本书里有它。
 *
 * 这是「书架」比「五个模块」多出来的东西——用户问一味药，
 * 系统能说清「本草纲目收它，食疗本草记它怎么吃，山家清供有它的菜」，
 * 而不是只从一本里掏一段。
 */
export function booksOn(name) {
  const k = String(name || '').trim();
  if (!k) return [];
  return SHELF
    .map((b) => ({ id: b.id, name: b.name, source: hit(b.id, k) }))
    .filter((x) => x.source);
}

/** 这本书一共多少条 —— 用户问「你知道多少」时用真实数字，不吹。 */
export function totalEntries() {
  return SHELF.reduce((n, b) => n + b.count, 0);
}

/**
 * 映射层：程序做的翻译，不是书的内容。
 *
 * 列在这里是为了承认它的存在——审核和用户都有权知道
 * 「哪些是古人写的，哪些是我们为了让你说得上话而加的」。
 */
export const MAPPINGS = [
  {
    what: '口语 → 药典证候词',
    file: 'adapter/advice.js（STATE_TERMS）',
    basis: '对应词逐条验证过是药典「功能与主治」里的原文用词',
  },
  {
    what: '证候 → 古籍病类',
    file: 'adapter/yanglao-canon.js（CATEGORY_OF_STATE）',
    basis: '只对方向明确的章建映射；便秘→泻痢、失眠→益气这类想过的都否掉了',
  },
  {
    what: '现代名 ↔ 古籍异名',
    file: 'adapter/food-canon.js（ALIASES）、adapter/recipe.js（SYN_GROUPS）',
    basis: '同物异名对照（山药/薯蓣、萝卜/芦菔），不新增判断',
  },
  {
    what: '药材形态 → 常见吃法',
    file: 'adapter/recipe.js（FORM_DIST）',
    basis: '形态是客观的，吃法是生活常识——界面上必须标「常见吃法」而不是「古籍记载」',
  },
  {
    what: '文言做法词 → 白话',
    file: 'adapter/recipe.js（GLOSS）',
    basis: '通用词义解释（作羹＝煮成浓汤），不改原文',
  },
];

// 统一再导出，业务代码只认这个门
export {
  gmOf, gmWords, shiliaoOf, shiliaoWords, shanjiaWords, dishesWith,
  yanglaoCategories, formulasForState, careForState, careForSeason,
};
