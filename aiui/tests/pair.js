// 药典口径配伍禁忌（adapter/pair-canon.js）的守门测试。
//
// 这份数据的作用是补上歌诀没有的那些对：十八反十九畏一共 26 对，
// 药典归并后有 49 组。多出来的部分（党参反藜芦、三棱畏芒硝）歌诀里根本没有，
// 而「党参」是日常煲汤最常用的一味参。
//
// 守四件事：
//   ① 条目完整（每对都有出处、页码、原话）
//   ② 别名能展开（乌头、朴硝、牵牛、芍药——不展开就查不到最常见的那几种问法）
//   ③ 与歌诀的差异只有已知的那 3 对，多一处少一处都要红
//   ④ 端到端接得上：药典独有的对真能被答出来，且不与歌诀的结论重复
//
// 运行：node tests/pair.js

import assert from 'node:assert/strict';
import {
  CANON_PAIRS, PAIR_SOURCE, canonPair, allCanonPairs,
} from '../adapter/pair-canon.js';
import { loadEngines } from '../adapter/load-engines.js';

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`  [FAIL] ${name}\n         ${err.message}`);
  }
}

function eq(name, actual, expected) {
  check(name, () => assert.deepEqual(actual, expected));
}

const KEYS = Object.keys(CANON_PAIRS);
const ALL = allCanonPairs();

console.log('[1] 数据完整：从药典抽出来的每一对都要能回查');
eq('共 49 组', KEYS.length, 49);
check('每组都有两味药', () => {
  const bad = KEYS.filter((k) => !Array.isArray(CANON_PAIRS[k].herbs) || CANON_PAIRS[k].herbs.length !== 2);
  assert.deepEqual(bad, []);
});
check('每组都有药典原话和页码', () => {
  const bad = KEYS.filter((k) => {
    const v = CANON_PAIRS[k];
    return !v.text || !v.clause || !(v.page > 0);
  });
  assert.deepEqual(bad, []);
});
check('clause 只讲配伍，不掺「孕妇慎用」这类别的事', () => {
  // 肉桂、三棱的【注意】把两件事写在一句里（「有出血倾向者及孕妇慎用；不宜与赤石脂同用」）。
  // 整句念出来，用户会以为孕妇和赤石脂是一回事。
  const bad = KEYS.filter((k) => /孕妇|慎用|禁用/.test(CANON_PAIRS[k].clause));
  assert.deepEqual(bad, []);
});
check('clause 里确实写着「不宜与…同用」', () => {
  const bad = KEYS.filter((k) => !/不宜与.+同用/.test(CANON_PAIRS[k].clause));
  assert.deepEqual(bad, []);
});
check('from 是这一对里的某一位（否则拼出来的句子会张冠李戴）', () => {
  const bad = KEYS.filter((k) => !CANON_PAIRS[k].herbs.includes(CANON_PAIRS[k].from));
  assert.deepEqual(bad, []);
});
eq('出处标明是药典', /中国药典/.test(PAIR_SOURCE), true);

console.log('\n[2] 查得准：双向、别名、表外不编');
eq('正向查', canonPair('丁香', '郁金').from, '丁香');
eq('反向查同一对', canonPair('郁金', '丁香').from, '丁香');
check('自己是自己不算一对', () => assert.equal(canonPair('甘草', '甘草'), null));
check('表外返回 null', () => {
  for (const [a, b] of [['山药', '枸杞子'], ['红枣', '桂圆'], ['★', '☆'], ['', '甘草']]) {
    assert.equal(canonPair(a, b), null, `${a}×${b} 不该有结果`);
  }
});

// 这几条别名不展开就会漏掉最常见的问法。
// 「乌头反半夏」——药典里没有「乌头」条目，它把川乌、草乌分开写。
// 注意把取值放进 check 里：写成 eq('…', canonPair(…).from, …) 的话，
// 参数在 check 之前就求值了，查不到时会直接抛 TypeError 把整个测试文件崩掉——
// 看起来像环境坏了，实际是断言报红。
check('乌头 → 川乌', () => assert.equal(canonPair('乌头', '半夏')?.from, '川乌'));
// 「乌头反贝母」在药典里是两个方向都写着：「川乌…不宜与川贝母同用」，
// 反过来「川贝母…不宜与川乌同用」。查到哪一条取决于谁先命中，
// 所以只验「查得到」，不锁 from —— 锁死就会因为数据顺序变了而误报。
check('乌头 → 贝母 查得到', () => assert.ok(canonPair('乌头', '贝母'), '查不到'));
check('朴硝 → 芒硝', () => assert.ok(canonPair('朴硝', '硫黄'), '查不到'));
check('牙硝 → 芒硝', () => assert.ok(canonPair('牙硝', '三棱'), '查不到'));
check('牵牛 → 牵牛子', () => assert.ok(canonPair('牵牛', '巴豆'), '查不到'));
check('芍药 → 白芍/赤芍', () => assert.ok(canonPair('芍药', '藜芦'), '查不到'));
check('沙参 → 南/北沙参', () => assert.ok(canonPair('沙参', '藜芦'), '查不到'));

console.log('\n[3] 与歌诀的差异：只允许已知的那 3 对');
// 引擎的十八反十九畏是明清歌诀，药典是现行标准，两者本该高度重合。
// 差出来的每一对都要能说清原因，说不清就是数据出问题了。
const { sandbox } = loadEngines({ quiet: true });
const I = sandbox.InteractionEngine;
const POEM = [];
for (const g of [I.ANTI_GROUP1, I.ANTI_GROUP2, I.ANTI_GROUP3]) {
  for (const b of g.slice(1)) POEM.push([g[0], b]);
}
// 引擎数组是 vm 沙箱里另一个 realm 的，先搬进本 realm 再处理
for (const p of Array.from(I.FEAR_PAIRS)) POEM.push([p[0], p[1]]);
const missWei = POEM.filter(([a, b]) => !canonPair(a, b)).map(([a, b]) => `${a}×${b}`).sort();
eq('歌诀里药典查不到的只有这 3 对', missWei, ['人参×赤石脂', '川乌×草乌', '水银×砒霜']);
// 逐条说清为什么：
//   水银、砒霜：药典一部不收这两味（剧毒品，另有管理规定），不是漏抽
//   川乌×草乌：引擎把「川乌草乌不顺犀」的并列主语读成了一对，本就该被否掉
//   人参×赤石脂：引擎配错了对手，歌诀是「人参畏五灵脂」「官桂畏石脂」
check('水银、砒霜不在药典一部', () => {
  assert.equal(canonPair('水银', '砒霜'), null);
});
check('川乌草乌不属配伍禁忌（药典也没有这一对）', () => {
  assert.equal(canonPair('川乌', '草乌'), null);
});
check('人参畏的是五灵脂，药典也这么写', () => {
  assert.ok(/五灵脂/.test(canonPair('人参', '五灵脂').clause));
});
check('官桂（肉桂）畏赤石脂，药典也这么写', () => {
  assert.ok(/赤石脂/.test(canonPair('肉桂', '赤石脂').clause));
});

console.log('\n[4] 歌诀没有、药典有的，必须真的能查到');
// 这四对是这份数据存在的理由。歌诀里一味都没有，而党参、西洋参是日常最常吃的。
for (const [a, b] of [['党参', '藜芦'], ['西洋参', '藜芦'], ['三棱', '芒硝'], ['硫黄', '芒硝']]) {
  check(`${a} × ${b} 药典有记录`, () => {
    const r = canonPair(a, b);
    assert.ok(r && r.clause, `${a}×${b} 查不到`);
  });
}
check('药典的对数比歌诀多', () => assert.ok(ALL.length > POEM.length));

console.log('\n' + '='.repeat(56));
console.log(`通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
