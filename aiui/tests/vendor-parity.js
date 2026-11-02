// 打包副本与原始引擎的一致性验证。
//
// 两条硬证据，缺一不可：
//   ① 生成的包装文件与源文件同步——重跑生成器，逐字节比对磁盘上的文件。
//      防的是「改了源文件忘了重新生成」，这种漂移不会报错，只会让设备上的数据和
//      Node 测的数据悄悄不一致。
//   ② 包装副本行为与原文件一致——同一批查询分别喂给 vm 沙箱版和 vendor 版，
//      结果必须深度相等。防的是「严格模式下 IIFE 行为变了」这类玄学。
//
// 注意 ①② 都通过，也不等于原始文件没被改动——原始文件是只读的，本仓库不写它。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AIUI_ROOT, PROJECT_ROOT, VENDOR_DIR, generate } from '../tools/vendor-engines.js';
import { loadEngines } from '../adapter/load-engines.js';
import * as vendored from '../vendor/engines.js';
import { ANCIENT_TEXTS, ANCIENT_TEXTS_COUNT, ANCIENT_TEXTS_SHA256 } from '../vendor/ancient-texts.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';

const PASSED = [];
const FAILED = [];

function check(name, fn) {
  let detail = '';
  try {
    const r = fn();
    const ok = r === undefined ? true : Boolean(r.ok !== false);
    detail = typeof r === 'object' && r !== null ? (r.detail || '') : (r === undefined ? '' : String(r));
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? `：${detail}` : ''}`);
    (ok ? PASSED : FAILED).push(name);
  } catch (err) {
    console.log(`  [FAIL] ${name}：${err && err.message ? err.message : err}`);
    FAILED.push(name);
  }
}

console.log('【1】包装文件与源文件同步（重跑生成器逐字节比对）');
// generate() 会重写磁盘文件，为了不意外改坏，先读回旧内容再写同样的内容比对
const before = {};
for (const f of ['engines.js', 'engine-registry.js', 'interaction-engine.js', 'bencao-engine.js', 'vitamin-engine.js', 'tizhi-engine.js', 'symptom-engine.js']) {
  try { before[f] = readFileSync(join(VENDOR_DIR, f), 'utf8'); } catch { before[f] = null; }
}
const { made, missing } = generate({ quiet: true });
check('没有遗漏的引擎文件', () => {
  if (missing.length) throw new Error(`跳过：${missing.join('、')}`);
  return `${made.length} 个`;
});
for (const m of made) {
  check(`${m.file} 与源文件同步`, () => {
    const now = readFileSync(join(VENDOR_DIR, m.file), 'utf8');
    if (now !== before[m.file]) throw new Error('磁盘上的版本是旧的，已重新生成，请重跑');
    if (!now.includes(m.sha256)) throw new Error('包装里记录的 sha256 与当前源文件不符');
    return `sha256 ${m.sha256.slice(0, 12)}…`;
  });
}

console.log('\n【2】包装副本与原始文件行为一致');
const { sandbox } = loadEngines({ quiet: true });
const originEngines = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};
const vendorEngines = {
  InteractionEngine: vendored.InteractionEngine,
  BencaoEngine: vendored.BencaoEngine,
  VitaminEngine: vendored.VitaminEngine,
};

check('两边引擎都齐', () => {
  const lack = Object.keys(originEngines).filter((k) => !originEngines[k] || !vendorEngines[k]);
  if (lack.length) throw new Error(`缺 ${lack.join('、')}`);
  return '3 个必需引擎';
});

// 直接比对引擎方法的结果，不经过 pack——pack 有措辞和分流逻辑，
// 混进来会让「引擎行为变了」和「措辞变了」分不开
// 签名照 qihuang-pack.js 的实际调用来写：check([...药名]) / checkPregnancy([...]) / getToxicity(单味)
const CASES = [
  ['check', [['甘草', '海藻']]],
  ['check', [['人参', '五灵脂']]],
  ['check', [['附子', '半夏']]],
  ['check', [['当归', '黄芪']]],
  ['check', [['甘草', '甘遂', '大戟']]],
  ['checkPregnancy', [['桃仁']]],
  ['checkPregnancy', [['红花']]],
  ['getToxicity', ['附子']],
  ['getToxicity', ['桃仁']],
  ['getToxicity', ['陈皮']],
];

for (const [method, args] of CASES) {
  check(`${method}(${args.join(',')}) 结果一致`, () => {
    const a = originEngines.InteractionEngine[method];
    const b = vendorEngines.InteractionEngine[method];
    if (typeof a !== 'function' || typeof b !== 'function') throw new Error('方法不存在');
    const ra = JSON.stringify(a.apply(originEngines.InteractionEngine, args));
    const rb = JSON.stringify(b.apply(vendorEngines.InteractionEngine, args));
    if (ra !== rb) throw new Error(`不一致\n     原：${ra.slice(0, 160)}\n     包：${rb.slice(0, 160)}`);
    return ra.slice(0, 60) + (ra.length > 60 ? '…' : '');
  });
}

check('本草库条目数一致', () => {
  const a = originEngines.BencaoEngine.DB;
  const b = vendorEngines.BencaoEngine.DB;
  const na = Array.isArray(a) ? a.length : Object.keys(a).length;
  const nb = Array.isArray(b) ? b.length : Object.keys(b).length;
  if (na !== nb) throw new Error(`原 ${na} 条 / 包 ${nb} 条`);
  return `${na} 条`;
});

check('营养素库条目数一致', () => {
  const a = originEngines.VitaminEngine.VITAMIN_LIST;
  const b = vendorEngines.VitaminEngine.VITAMIN_LIST;
  const na = Array.isArray(a) ? a.length : Object.keys(a).length;
  const nb = Array.isArray(b) ? b.length : Object.keys(b).length;
  if (na !== nb) throw new Error(`原 ${na} / 包 ${nb}`);
  return `${na} 条`;
});

console.log('\n【3】端到端：整句问答在两个引擎集下结论一致');
const packOrigin = createQihuangPack({ ...originEngines });
const packVendor = createQihuangPack({ ...vendorEngines });
const QUESTIONS = [
  '附子有毒吗',
  '甘草海藻能不能一起吃',
  '孕妇能吃桃仁吗',
  '维生素C',
  '陈皮',
  '人参和五灵脂',
  '三七的功效',
  '生姜',
];
for (const q of QUESTIONS) {
  check(`「${q}」结论一致`, () => {
    const a = JSON.stringify(packOrigin.invoke('ask', { text: q }));
    const b = JSON.stringify(packVendor.invoke('ask', { text: q }));
    if (a !== b) throw new Error(`不一致\n     原：${a.slice(0, 200)}\n     包：${b.slice(0, 200)}`);
    return '逐字段相同';
  });
}

// ---------------------------------------------------------------- 数据内嵌的一致性
//
// 古籍条文是内嵌进包里的（.aix 只收 aiui/ 以内）。内嵌的代价是可能漂移：
// 改了 static/data/ancient_texts.json 却忘了重跑 tools/vendor-data.js，
// 设备上就还是旧数据，而这种不一致**不会报错**，只会让设备表现和测试表现不一样。
check('古籍数据与源文件一致（没忘记重跑生成器）', () => {
  const src = readFileSync(join(PROJECT_ROOT, 'static/data/ancient_texts.json'), 'utf8');
  const want = createHash('sha256').update(src, 'utf8').digest('hex');
  if (want !== ANCIENT_TEXTS_SHA256) {
    throw new Error(`源文件已变更，请重跑：node tools/vendor-data.js\n     源 ${want.slice(0, 12)} / 包 ${ANCIENT_TEXTS_SHA256.slice(0, 12)}`);
  }
  if (ANCIENT_TEXTS.length !== ANCIENT_TEXTS_COUNT) {
    throw new Error(`条数不一致：数组 ${ANCIENT_TEXTS.length} / 标称 ${ANCIENT_TEXTS_COUNT}`);
  }
  return `${ANCIENT_TEXTS_COUNT} 条一致`;
});

console.log('\n' + '='.repeat(60));
console.log(`通过 ${PASSED.length} / ${PASSED.length + FAILED.length}`);
if (FAILED.length > 0) {
  console.log('失败项：' + FAILED.join('、'));
  process.exit(1);
}
console.log('全部通过');
