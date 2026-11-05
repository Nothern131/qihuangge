// 生成器：把 static/data/bencao_gm_full.json 内嵌成 aiui/adapter/gm-canon.js。
// 与 vendor-data.js 同一问题：.aix 只收 aiui/ 以内，设备上读不到项目根的 JSON。
// 原始 JSON 一个字节不改（json.loads 后原样序列化进去），生成物记录源文件哈希，
// 「源改了没重跑生成器」由测试里的哈希断言抓（见 tests/ancient.js 同款机制）。
//
// 用法：node tools/build_gm_canon.js

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const AIUI_ROOT = resolve(HERE, '..');
const SRC = join(AIUI_ROOT, '..', 'static', 'data', 'bencao_gm_full.json');
const OUT = join(AIUI_ROOT, 'adapter', 'gm-canon.js');

const raw = readFileSync(SRC, 'utf-8');
const data = JSON.parse(raw);
const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);

const banner = `// 《本草纲目》谷部、菜部、果部的「气味」「主治」与「附方（食治类）」。
//
// 生成器：tools/build_gm_data.py（源：维基文库《本草纲目》，明·李时珍，1596 年成书，
// 共 285 条）→ static/data/bencao_gm_full.json → 本文件。源哈希 ${hash}。
// 源 JSON 改了必须重跑两个生成器，否则设备上还是旧数据——
// 这种漂移不报错，只在测试里会红。
//
// 定位（必须先说清，否则用起来一定出事）：
//   **这是 1596 年的书，它的记载不等于科学验证。**
//   所以这份数据只做一件事：用户问的时候，把书上怎么写的原样摆出来，
//   并标明是古籍记载。**不参与任何配伍判断、不给结论、不构成建议。**
//
// 附方（fufang）是 1.0.5 新增的食治层：
//   用户拿到「适合吃什么」的方向后，下一个问题一定是「怎么做着吃」——
//   这是「用法断层」的古籍答案。附方原文带做法和出处典籍（如《食疗本草》），
//   但它同时含治疗方（汤剂丸散），**展示层只挑食治类**（做法含粥/羹/汁/酒等），
//   并且每一条都必须挂「古籍记载，未经现代验证，不构成建议」的说明。
//
// 与现行标准的优先级：药典（国家标准）> 中药学教材/本草库（现代通行）> 本草纲目（古籍）。
// 冲突时不合并、不取舍，各说各的——用户要知道哪句话是谁说的。

export const GM_SOURCE = '《本草纲目》（明·李时珍，1596）';
export const GM_NOTE = '古籍记载，未经现代验证';
export const GM_FU_FANG_NOTE = '古籍附方原文，未经现代验证，不构成任何使用建议';
export const GM_SOURCE_HASH = '${hash}';

export const GM_ITEMS = `;

// 辅助函数由生成器保留（旧版手工文件里的 gmOf/gmWords 被 qihuang-pack 引用，
// 生成器覆盖整份文件时必须一并输出，否则 import 直接崩）。它们是**生成物的一部分**，
// 写在 banner 模板串之外，拼接时附在数据后面。
const HELP_FUNCS = `;

export function gmOf(name) {
  const k = String(name || '').trim();
  if (!k) return null;
  const hit = GM_ITEMS[k];
  return hit ? { name: k, ...hit } : null;
}

/** 表里所有条目名，给词表和测试用。 */
export function gmWords() {
  return Object.keys(GM_ITEMS);
}
`;

const itemsJs = JSON.stringify(data.items, null, 0)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e');

writeFileSync(OUT, banner + itemsJs + ';\n' + HELP_FUNCS + '\n', 'utf-8');
console.log(`生成 ${OUT}（${data.items.length ? Object.keys(data.items).length : 0} 条，源哈希 ${hash}）`);
