#!/usr/bin/env node
/**
 * static/data/shanjia.json → adapter/shanjia-canon.js
 *
 * 《山家清供》（宋·林洪）89 道山野菜谱。数据由 tools/build_shanjia_data.py
 * 从维基文库抽取，未改写。
 *
 * 这层解决的是「配方」：食疗本草给单味吃法（「熟煮和蜜」），
 * 这本给整道菜（「燖雞淨洗，用麻油、鹽水煑之，入葱、椒」）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const raw = readFileSync(join(root, 'static', 'data', 'shanjia.json'), 'utf-8');
const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
const items = JSON.parse(raw).items;

const banner = `/**
 * 《山家清供》（宋·林洪，约 1200 年）—— 一整道菜怎么做。
 *
 * 「药膳配方」这一层，古籍里真正给得出的是这类书：
 * 有原料、有下锅顺序、有分量思路（「不拘多少」「少許」），照着能炒出来。
 * 本草纲目【附方】是治病方剂，食疗本草是单味吃法，这本才是菜谱。
 *
 * 源哈希 ${hash}（改数据必须重跑生成器）。
 */
export const SHANJIA_SOURCE = '《山家清供》（宋·林洪，约 1200 年）';
export const SHANJIA_NOTE = '宋代菜谱原文，未经现代验证，不构成食用建议';
export const SHANJIA_SOURCE_HASH = '${hash}';

export const SHANJIA_ITEMS = `;

const help = `

/** 所有菜名。 */
export function shanjiaWords() {
  return Object.keys(SHANJIA_ITEMS);
}

/**
 * 按食材找菜谱：正文里提到这味食材的都算。
 *
 * 为什么按全文找而不是建索引表：宋代原文没有「主料/配料」字段，
 * 硬拆字段等于替古人分类。全文匹配至少不会漏，代价是可能命中
 * 只是顺带提一句的条目——所以调用方还要按「提到次数 + 篇幅」排序。
 */
export function dishesWith(ingredient) {
  const k = String(ingredient || '').trim();
  if (!k) return [];
  const out = [];
  for (const [dish, v] of Object.entries(SHANJIA_ITEMS)) {
    const text = String(v.text || '');
    const hits = text.split(k).length - 1;
    if (!hits) continue;
    out.push({ dish, text, hits });
  }
  // 提到次数多的排前面：主料通常反复出现，顺带一提的一般只有一次
  out.sort((a, b) => b.hits - a.hits);
  return out;
}
`;

writeFileSync(join(here, '..', 'adapter', 'shanjia-canon.js'),
  banner + JSON.stringify(items) + ';\n' + help, 'utf-8');
console.log(`生成 shanjia-canon.js（${Object.keys(items).length} 道，源哈希 ${hash}）`);
