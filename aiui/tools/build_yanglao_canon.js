#!/usr/bin/env node
/**
 * static/data/yanglao.json → adapter/yanglao-canon.js
 *
 * 《养老奉亲书》（宋·陈直）98 首按病分类的食疗方。
 * 数据由 tools/build_yanglao_data.py 抽取，未改写。
 *
 * 这层补的是最后一环：前三本都从「东西」出发（某味药、某道菜），
 * 只有这本从「病」出发——脾胃气弱、泻痢、喘嗽、眼目、耳聋…
 * 用户说「我脾胃弱」，终于有地方可查。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const raw = readFileSync(join(root, 'static', 'data', 'yanglao.json'), 'utf-8');
const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
const items = JSON.parse(raw).items;

/**
 * 药名列表：把「猪肚（二枚，洗，如食法）人参（半两，去芦）」拆成 ['猪肚','人参',...]。
 *
 * 只留名字，剥掉括号里的用量与炮制。理由：这是「古籍拿哪几样配」的
 * 搭配思路，不是让人照着抓药。带分量的原文留在 raw 字段里可查。
 */
function splitIngredients(s) {
  const out = [];
  const re = /([\u4e00-\u9fa5]{1,8})\s*[（(][^）)]*[）)]/g;
  let m;
  while ((m = re.exec(String(s || '')))) out.push(m[1]);
  return out.slice(0, 10);
}

const enriched = items.map((x) => ({
  ...x,
  ing: splitIngredients(x.ingredients),
}));

const banner = `/**
 * 《养老奉亲书》（宋·陈直，约 1085 年）—— 按病分类的食疗方。
 *
 * 前三本从「东西」出发（药 → 吃法 → 菜），这本从「病」出发：
 * 食治老人脾胃气弱方、泻痢方、喘嗽方、眼目方…共 16 类 98 方。
 *
 * ing 是剥掉用量的食材名，用于看「古籍拿哪几样配」；
 * ingredients 是原文全文（含分量与炮制），只在需要查证时展示。
 *
 * 源哈希 ${hash}
 */
export const YANGLAO_SOURCE = '《养老奉亲书》（宋·陈直，约 1085 年）';
export const YANGLAO_NOTE = '宋代养老专著原方，含明确用量与炮制，未经现代验证，不构成用药建议';
export const YANGLAO_SOURCE_HASH = '${hash}';

export const YANGLAO_ITEMS = `;

const help = `

/** 所有病类。 */
export function yanglaoCategories() {
  return [...new Set(YANGLAO_ITEMS.map((x) => x.category))];
}

/** 按病类取方。 */
export function formulasOf(category) {
  return YANGLAO_ITEMS.filter((x) => x.category === category);
}

/**
 * 证候 → 病类 的映射。
 *
 * 这张表是**桥梁，不是知识**：左边是我们已经能识别的证候 key，
 * 右边是原书自己分的章名。只收**方向明确对得上**的：
 *   · 脾胃气弱 ↔ 湿盛 / 食积（都是脾胃运化的事）
 *   · 冷气 ↔ 阳虚（冷气章讲的是虚寒）
 *   · 虚损羸瘦 ↔ 气虚 / 血虚（虚损就是这两类的结果）
 *   · 喘嗽 ↔ 咳嗽、泻痢 ↔ 腹泻、眼目 ↔ 眼干、耳聋耳鸣 ↔ 耳鸣、水气 ↔ 水肿
 *
 * 刻意不收的（想了但否掉）：
 *   · 便秘 → 泻痢：方向相反，一个不通一个太通，指过去等于害人
 *   · 失眠 → 益气：原书没有失眠章，硬指一章是替用户辨证，超出边界
 * 查不到就不给，这比给错好。
 */
export const CATEGORY_OF_STATE = {
  // 脾胃虚寒 → 脾胃气弱（同一件事的两种说法）+ 冷气（虚寒）
  'spleen-cold': ['脾胃气弱', '冷气'],
  // 阴虚：原书没有阴虚章。虚损羸瘦讲的是整体虚，方向不冲突但不精确，
  // 只挂一章，不挂冷气（性味相反）。
  'yin-deficiency': ['虚损羸瘦'],
  'qi-deficiency': ['益气', '虚损羸瘦', '五劳七伤'],
  'blood-deficiency': ['虚损羸瘦', '益气'],
  'yang-deficiency': ['冷气', '虚损羸瘦'],
  damp: ['脾胃气弱', '水气'],
  'food-stagnation': ['脾胃气弱', '噎塞'],
  cough: ['喘嗽'],
  diarrhea: ['泻痢'],
  tinnitus: ['耳聋耳鸣'],
  eye: ['眼目'],
  edema: ['水气'],
  'qi-stagnation': ['噎塞', '冷气'],
};

/**
 * 按证候 key 找方。返回空数组表示这章没有可用方（不硬凑）。
 */
export function formulasForState(stateKey) {
  const cats = CATEGORY_OF_STATE[stateKey];
  if (!cats) return [];
  const out = [];
  for (const c of cats) {
    for (const x of YANGLAO_ITEMS) {
      if (x.category === c) out.push(x);
    }
  }
  return out;
}
`;

writeFileSync(join(here, '..', 'adapter', 'yanglao-canon.js'),
  banner + JSON.stringify(enriched) + ';\n' + help, 'utf-8');
console.log(`生成 yanglao-canon.js（${enriched.length} 方，源哈希 ${hash}）`);
