#!/usr/bin/env node
/** static/data/care.json → adapter/care-canon.js（《养老奉亲书》下籍调护条目） */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const raw = readFileSync(join(root, 'static', 'data', 'care.json'), 'utf-8');
const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
const items = JSON.parse(raw).items;

const banner = `/**
 * 《养老奉亲书》下籍「保生调护」—— 不吃药的调理方法。
 *
 * 目标人群是「忙到没条件看医生、只想调理舒服一点」的人（程序员一类），
 * 对这类人只给「吃什么」不够：进食节奏、起居、当季怎么穿怎么吃，
 * 才是日常真能改的。
 *
 * 只收不含药名、不带宗教/孝道/饮酒说教的条目（抽取时已过滤）。
 * 源哈希 ${hash}
 */
export const CARE_SOURCE = '《养老奉亲书》下籍·保生调护（宋·陈直，约 1085 年）';
export const CARE_NOTE = '宋代调护原文，属日常起居经验，不构成医疗建议';
export const CARE_SOURCE_HASH = '${hash}';

export const CARE_ITEMS = `;

const help = `

/**
 * 挑一条最有用的调护。
 *
 * 之前按「最短」挑，挑到的是讲病机的句子（「若生冷无节…动成疾患」）——
 * 它解释了为什么会病，但没告诉人该怎么做。用户要的是后者。
 * 所以按「有没有明确宜忌」优先，再看长度。
 */
function score(text) {
  const t = String(text || '');
  let s = 0;
  // 「不宜」里含「宜」字，不剔掉会把「不宜与食」当成正面指令加分
  if (/宜/.test(t.replace(/不宜/g, ''))) s += 3;
  if (/忌|不可|不宜/.test(t)) s += 2;
  if (/须|勿|莫/.test(t)) s += 1;
  if (t.length <= 32) s += 2;        // 屏幕上放得下
  if (t.length > 45) s -= 2;         // 太长读不完
  if (/动成疾患|故成疾患/.test(t)) s -= 4;  // 讲后果不是讲做法
  return s;
}

/** 按标签取条目（饮食 / 起居 / 情志 / 春 / 夏 / 秋 / 冬）。 */
export function careByTag(tag) {
  return CARE_ITEMS.filter((x) => x.tag === tag);
}

/**
 * 当前季节的调养条目。
 *
 * 季节按节气粗分：3-5 春、6-8 夏、9-11 秋、12-2 冬。
 * 这层最通用——不管用户问哪个状况，「当季怎么吃」都成立，
 * 而且是他明天就能改的事。
 */
export function careForSeason(month) {
  const m = Number(month) || (new Date().getMonth() + 1);
  const tag = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  const list = careByTag(tag);
  if (!list.length) return null;
  return list.slice().sort((a, b) => score(b.text) - score(a.text))[0];
}

/**
 * 证候相关的调护条目。
 *
 * 只映射方向明确的：脾胃类 → 饮食调治（温热熟软、不可顿饱），
 * 其余走当季。不硬凑——原书这部分本来就不按证候分。
 */
const STATE_TAGS = {
  'spleen-cold': ['饮食'],
  'food-stagnation': ['饮食'],
  damp: ['饮食'],
  // 失眠不挂「起居」：那里只有菊花枕、矮床这类具体物件，
  // 和失眠的关系要绕两层才说得通。不如走当季，至少是普适的。
};

export function careForState(stateKey) {
  const tags = STATE_TAGS[stateKey];
  if (!tags) return null;
  const list = tags.flatMap((t) => careByTag(t));
  if (!list.length) return null;
  return list.slice().sort((a, b) => score(b.text) - score(a.text))[0];
}
`;

writeFileSync(join(here, '..', 'adapter', 'care-canon.js'),
  banner + JSON.stringify(items) + ';\n' + help, 'utf-8');
console.log(`生成 care-canon.js（${items.length} 条，源哈希 ${hash}）`);
