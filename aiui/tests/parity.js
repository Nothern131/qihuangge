// 两份流水线内核的一致性校验。
//
// 背景：麻将（E:\hackathons\rokid-agent\aiui）和岐黄阁（E:\岐黄阁\aiui）
// 各自打包成 .aix 独立上架，跨目录 import 打包后必断，所以 core/pipeline.mjs
// 只能各持一份。代价是可能漂移——改了其中一份，另一份不会跟着变，
// 而两边的行为差异会以「同样的输入给出不同结论」的形式出现，极难排查。
//
// 这个测试放在「副本方」（岐黄阁），因为负责同步的是原件方。
// 只读，不做任何自动同步——自动覆盖会在原件方改到一半时把半成品推过去。

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const copy = resolve(here, '../core/pipeline.js');
const origin = resolve(here, '../../../hackathons/rokid-agent/aiui/js/core/pipeline.js');

console.log('=== 流水线内核一致性 ===');

if (!existsSync(origin)) {
  console.log(`  [FAIL] 找不到原件：${origin}`);
  console.log('         两个作品需要放在同一盘，否则无法校验副本是否漂移');
  process.exit(1);
}

// 比对前统一行尾。Windows 上 git 的 autocrlf 会把 LF 换成 CRLF，
// 于是同一个文件在两边行尾不同——逐行比会报「全篇都不一样」，
// 实际内容一字未差（实测只差每行多出的 1 个字节）。
const norm = (t) => t.replace(/\r\n/g, '\n');
const a = norm(readFileSync(origin, 'utf8'));
const b = norm(readFileSync(copy, 'utf8'));

if (a === b) {
  console.log(`  [PASS] 与原件逐字符一致（${a.length} 字符）`);
  console.log('\n全部通过');
  process.exit(0);
}

console.log('  [FAIL] 副本已漂移');
console.log(`         原件 ${a.length} 字符 / 副本 ${b.length} 字符`);

const la = a.split('\n');
const lb = b.split('\n');
const max = Math.max(la.length, lb.length);
let shown = 0;
for (let i = 0; i < max && shown < 8; i += 1) {
  if ((la[i] || '') !== (lb[i] || '')) {
    console.log(`         第 ${i + 1} 行`);
    console.log(`           原件: ${la[i] || '(缺行)'}`);
    console.log(`           副本: ${lb[i] || '(缺行)'}`);
    shown += 1;
  }
}
console.log('         修法：确认原件方的改动已经定稿，再把原件整份复制过来');
process.exit(1);
