#!/usr/bin/env node
/**
 * static/data/shiliao.json → adapter/shiliao-canon.js
 *
 * 数据由 tools/build_shiliao_data.py 从维基文库《食疗本草》抽取，
 * 一个字都没改写。这里只做打包与索引，另外补一张「现代药名 → 古籍条目名」
 * 的对照表——用户说山药，书里叫薯蓣；说大枣，书里叫干枣。
 * 这是别名映射，不是改写原文。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const src = join(root, 'static', 'data', 'shiliao.json');
const out = join(here, '..', 'adapter', 'shiliao-canon.js');

const raw = readFileSync(src, 'utf-8');
const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
const data = JSON.parse(raw);
const items = data.items;

/**
 * 现代药名 → 《食疗本草》条目名。
 * 只收能一一对应的：书里叫法不同（山药/薯蓣）、或条目名带部位（干枣/大枣）。
 * 对不上的（如酸枣仁，书里没有）宁可留空，也不硬指一个近似条目。
 */
const EXTRA_ALIASES = {
  酸枣仁: '酸枣',
  枸杞子: '枸杞',
  黑芝麻: '胡麻',
  芝麻: '胡麻',
  核桃: '胡桃',
  蜂蜜: '蜜',
  黄豆: '大豆',
  黑豆: '大豆',
  赤小豆: '赤小豆',
  玉竹: '萎蕤',
  大枣: '干枣',
  红枣: '干枣',
  山药: '薯蓣',
  淮山: '薯蓣',
  乌梅: '梅实',
  芡实: '鸡头子',
  菱角: '芰实',
  荸荠: '茨',
  牛蒡: '恶食',
  小蓟: '蓟菜',
  瓜蒌: '栝蒌',
  栝楼: '栝蒌',
  菊花: '甘菊',
  白菊: '甘菊',
  蔗: '甘蔗',
  砂糖: '沙糖',
  乳糖: '石蜜',
};

// 书里自带的别名（薯蓣（山药）→ 山药）也一并进索引，原文标注的可信度最高
const fromBook = {};
for (const [name, v] of Object.entries(items)) {
  if (v.alias) fromBook[v.alias] = name;
}

const aliases = { ...EXTRA_ALIASES, ...fromBook };

const banner = `/**
 * 《食疗本草》（唐·孟诜）数据——「这个东西怎么吃」的第一手依据。
 *
 * 为什么需要这本：本草纲目的【附方】是治病方剂（「为末，每服二钱」），
 * 那是抓药不是做饭。用户问「山药怎么吃」，正解在食疗专著里：
 * 薯蓣「熟煮和蜜，或为汤煎，或为粉，并佳」。
 *
 * 数据由 tools/build_shiliao_data.py 从维基文库原文抽取，未改写。
 * 源哈希 ${hash}（改数据必须重跑生成器，这个值会跟着变）。
 */
export const SHILIAO_SOURCE = '《食疗本草》（唐·孟诜，约公元 700 年）';
export const SHILIAO_NOTE = '唐代食疗专著原文，未经现代验证，不构成使用建议';
export const SHILIAO_SOURCE_HASH = '${hash}';

export const SHILIAO_ITEMS = `;

const itemsJs = JSON.stringify(items);
const help = `

/** 别名 → 条目名（用户说山药，书里叫薯蓣）。 */
export const SHILIAO_ALIASES = ${JSON.stringify(aliases)};

/**
 * 查一味药的食疗记载。用户说现代名也能命中别名。
 * 查不到返回 null——书里没有就是没有，不拿近似条目顶替。
 */
export function shiliaoOf(name) {
  const k = String(name || '').trim();
  if (!k) return null;
  if (SHILIAO_ITEMS[k]) return { name: k, ...SHILIAO_ITEMS[k] };
  const canon = SHILIAO_ALIASES[k];
  if (canon && SHILIAO_ITEMS[canon]) return { name: canon, asked: k, ...SHILIAO_ITEMS[canon] };
  return null;
}

/** 书里所有条目名，给词表和测试用。 */
export function shiliaoWords() {
  return Object.keys(SHILIAO_ITEMS);
}
`;

writeFileSync(out, banner + itemsJs + ';\n' + help, 'utf-8');
console.log(`生成 ${out}（${Object.keys(items).length} 条，源哈希 ${hash}）`);
