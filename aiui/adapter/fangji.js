// 证型 → 古籍方剂。
//
// 为什么需要这一层：fangji-engine 有 37 个方，每个带君臣佐使、古籍原文、
// 煎服法、加减变化——但它是**按方名索引**的，不知道「用户说掉头发该给谁」。
// 中间缺的这一步就是证型到方的匹配。
//
// 匹配依据不用症状，用**证型**。理由：
//   症状是「掉头发」，证型是「血虚」，方是「治血虚的方」。
//   症状千变万化，证型只有十几个，从证型走才不会漏。
//
// 边界：这里只做「古籍里有什么方、由什么组成」，不做「你该吃这个方」。
// PRD 第 8 节原文：方剂仅展示古籍记载与组成，不作为用药建议。

import { FangjiEngine } from '../vendor/fangji-engine.js';

const DB = FangjiEngine.DB;

// 证型 → 方名。一个证型给多个方，按「贴近程度」排。
//
// 排序原则：先给「专门治这个的」，再给「兼治这个的」。
//   「血虚」先给当归补血汤（专治），再给归脾汤（心脾气血两虚，兼）
//   不一次全给——给太多等于没给。
const STATE_TO_FANG = {
  血虚: ['当归补血汤', '归脾汤', '逍遥散'],
  阴虚: ['六味地黄丸', '百合固金汤', '青蒿鳖甲汤'],
  阳虚: ['真武汤', '理中丸', '实脾散'],
  气虚: ['四君子汤', '补中益气汤', '玉屏风散'],
  湿: ['平胃散', '五苓散', '参苓白术散'],
  寒: ['理中丸', '真武汤'],
  热: ['银翘散', '清胃散', '犀角地黄汤'],
  便秘: ['大承气汤', '小承气汤'],
  失眠: ['归脾汤'],
  食积: ['平胃散'],
  腹胀: ['半夏泻心汤', '平胃散'],
  瘀: ['血府逐瘀汤', '桂枝茯苓丸', '补阳还五汤'],
  痰: ['半夏厚朴汤'],
  肝郁: ['逍遥散', '四逆散'],
};

// 证型的白话叫法。用户听到「血虚」可能不懂，标题后面补一句。
const STATE_PLAIN = {
  血虚: '血不够用',
  阴虚: '阴液不足，容易干、热',
  阳虚: '阳气不足，怕冷',
  气虚: '气不够，容易累',
  湿: '体内水湿重',
  寒: '偏寒',
  热: '偏热',
  便秘: '大便不通',
  失眠: '睡不好',
  食积: '吃进去没消化',
  腹胀: '肚子胀',
  瘀: '血行不畅',
  痰: '痰湿',
  肝郁: '情绪郁结',
};

/** 把证型数组映射成方剂列表（去重，保持顺序）。 */
export function matchFangji(states) {
  const out = [];
  const seen = new Set();
  for (const s of states || []) {
    for (const name of STATE_TO_FANG[s] || []) {
      if (seen.has(name) || !DB[name]) continue;
      seen.add(name);
      out.push({ ...DB[name], fangming: name, matchedState: s });
    }
  }
  return out;
}

/** 君臣佐使压成一行，播报和屏幕都用这个。 */
function roleLine(f) {
  // 桂枝汤 → 桂枝(君) 白芍(臣) 生姜(佐) 大枣(佐) 炙甘草(使)
  return (f.composition || [])
    .map((c) => `${c.herb}${c.dosage ? c.dosage : ''}(${c.role})`)
    .join('、');
}

/** 君药单独拎出来——用户最想先知道的是"主药是什么"。 */
function monarch(f) {
  const m = (f.composition || []).filter((c) => c.role === '君');
  return m.map((c) => c.herb).join('、');
}

/**
 * 格式化成一轮回答。
 *
 * 结构照用户提的来：
 *   标题 = 证型（让他心里有个底）
 *   正文 = 药 → 君臣佐使 → 古籍原方
 *
 * speech 给播报（短，先说到方名和君药就够，细节看屏幕）
 * lines 给屏幕（完整，含原文）
 */
export function formatFangji(f, state) {
  const plain = STATE_PLAIN[state] || '';
  const title = `可能是${state}`;

  const speak = [
    plain ? `${state}，也就是${plain}。` : `${state}。`,
    `古籍里有个方叫${f.fangming}，出自${f.source}。`,
    `主药是${monarch(f) || '（见组成）'}。`,
    // 这句必须在播报里，不能只在屏幕上——不播出来等于没说。
    '这是古籍记载，不是给你开的方。',
  ].join('');

  const lines = [
    plain ? `${state}，也就是${plain}。` : `${state}。`,
    '',
    `古籍里的方：${f.fangming}`,
    `${f.source}${f.category ? ' · ' + f.category : ''}`,
    '',
    `组成：${roleLine(f)}`,
    f.indication ? `主治：${f.indication}` : '',
    f.yongfa ? `用法：${String(f.yongfa).split(/[。；]/)[0]}。` : '',
  ].filter(Boolean);

  // 原文单独一节。这是差异化——别的产品给不出"这句话出自哪本书第几条"。
  if (Array.isArray(f.shanghan_wenyi) && f.shanghan_wenyi.length) {
    const w = f.shanghan_wenyi[0];
    lines.push('');
    lines.push(`原文（${w.source}）：`);
    lines.push(String(w.text).slice(0, 80) + (String(w.text).length > 80 ? '…' : ''));
  }

  const taboo = (f.禁忌 || [])[0];
  if (taboo) {
    lines.push('');
    lines.push(`忌：${taboo}`);
  }

  lines.push('');
  lines.push('※ 古籍记载，不作为用药建议。要用请找医生。');

  return { title, speak, lines };
}

/** 供测试用：看某个证型能匹配到几个方。 */
export function debugMatch(states) {
  return matchFangji(states).map((f) => `${f.fangming}（${f.source}）`);
}
