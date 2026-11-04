// 药食同源数据（adapter/food-canon.js）的守门测试。
//
// 这套数据是「养生吃了什么」那条线唯一的事实来源。它出错的方式和代码 bug 不一样：
// 代码出错会崩，数据出错会**很顺地说一句错话**，而且没人看得出来。
// 所以这里守的不是「能不能跑」，是四件事：
//   ① 条目没被悄悄弄丢（102 味少了哪味都要红）
//   ② 锚点原文没被改动（硬编码几条药典原句做对照）
//   ③ 没出处的东西不许进表（tabi 为空必须真的是空，不能是「暂缺」之类的占位）
//   ④ 别名不许有歧义（「姜」这种一个词指三味药的，收进来就会答错）
//
// 运行：node tests/food.js

import assert from 'node:assert/strict';
import {
  FOODS, ALIASES, FOOD_SOURCE, foodOf, foodWords,
} from '../adapter/food-canon.js';

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

const NAMES = Object.keys(FOODS);

console.log('[1] 数据规模：少了哪味都要红');
eq('收录 102 味', NAMES.length, 102);
// 这几味是卫健委药食同源名单里的高频项，也是用户最可能问到的。
// 它们掉了一定是抽取出了问题，不是「本来就没有」。
for (const must of ['大枣', '枸杞子', '山药', '菊花', '生姜', '茯苓', '薏苡仁', '陈皮', '金银花', '山楂']) {
  check(`收录了 ${must}`, () => assert.ok(FOODS[must], `${must} 不在表里`));
}

console.log('\n[2] 出处：表里每一句都必须能回查药典');
check('SOURCE 标明是药典', () => {
  assert.ok(/中国药典/.test(FOOD_SOURCE), FOOD_SOURCE);
});
check('每味都有页码可回查', () => {
  const bad = NAMES.filter((n) => !(FOODS[n].page > 0 && FOODS[n].page < 2100));
  assert.deepEqual(bad, []);
});
check('每味都有性味和功效', () => {
  const bad = NAMES.filter((n) => !FOODS[n].nature || !FOODS[n].functions);
  assert.deepEqual(bad, []);
});
check('性味里必须有归经（药典这一项就是「性味与归经」）', () => {
  const bad = NAMES.filter((n) => !/归.+经/.test(FOODS[n].nature));
  assert.deepEqual(bad, []);
});
check('正文里不许残留抽取噪音（页码、页眉、换行）', () => {
  const bad = NAMES.filter((n) => {
    const s = [FOODS[n].nature, FOODS[n].functions, FOODS[n].dosage, FOODS[n].tabi].join('');
    return /中国药典|\n/.test(s) || /\d{3,}$/.test(s);
  });
  assert.deepEqual(bad, []);
});

console.log('\n[3] 锚点原文：抽查几条与药典原句逐字比对');
// 这几条是从官方 PDF 抄下来的原句。它们变了说明数据被改过或重抽时抓错了条目。
eq('大枣性味', FOODS['大枣'].nature, '甘，温。归脾、胃、心经。');
eq('枸杞子性味', FOODS['枸杞子'].nature, '甘，平。归肝、肾经。');
eq('山药性味', FOODS['山药'].nature, '甘，平。归脾、肺、肾经。');
eq('菊花性味', FOODS['菊花'].nature, '甘、苦，微寒。归肺、肝经。');
eq('陈皮性味', FOODS['陈皮'].nature, '苦、辛，温。归肺、脾经。');
eq('肉桂性味', FOODS['肉桂'].nature, '辛、甘，大热。归肾、脾、心、肝经。');
check('苦杏仁带毒性标注', () => assert.ok(/有小毒/.test(FOODS['苦杏仁'].nature), FOODS['苦杏仁'].nature));
check('甘草的禁忌是药典原文那条', () => {
  assert.ok(/海藻/.test(FOODS['甘草'].tabi) && /甘遂/.test(FOODS['甘草'].tabi), FOODS['甘草'].tabi);
});
check('肉桂的禁忌含「不宜与赤石脂同用」', () => {
  assert.ok(/赤石脂/.test(FOODS['肉桂'].tabi), FOODS['肉桂'].tabi);
});

console.log('\n[4] 禁忌诚实：空就是空，不许有占位符');
// tabi 为空表示药典没列【注意】项，**不等于没有禁忌**。
// 这一条守的是数据层：不许出现「暂缺」「待补」这类占位，那种东西一旦上屏，
// 用户会以为是内容，而不是缺失。
eq('有禁忌的 13 味', NAMES.filter((n) => FOODS[n].tabi).length, 13);
check('没有占位符式的假数据', () => {
  const bad = NAMES.filter((n) => /暂缺|待补|TODO|未知|暂无/.test(
    FOODS[n].nature + FOODS[n].functions + FOODS[n].tabi,
  ));
  assert.deepEqual(bad, []);
});
check('tabi 要么是完整句子，要么是空串', () => {
  const bad = NAMES.filter((n) => FOODS[n].tabi && !/[。；]$/.test(FOODS[n].tabi));
  assert.deepEqual(bad, [], `这些 tabi 不像完整句子：${bad.join('、')}`);
});

console.log('\n[5] 别名：能对上，且不许有歧义');
eq('红枣 → 大枣', foodOf('红枣').name, '大枣');
eq('桂圆 → 龙眼肉', foodOf('桂圆').name, '龙眼肉');
eq('枸杞 → 枸杞子', foodOf('枸杞').name, '枸杞子');
eq('薏米 → 薏苡仁', foodOf('薏米').name, '薏苡仁');
eq('淮山 → 山药', foodOf('淮山').name, '山药');
eq('桑葚 → 桑椹', foodOf('桑葚').name, '桑椹');
eq('杏仁 → 苦杏仁', foodOf('杏仁').name, '苦杏仁');
check('别名的目标必须在表里', () => {
  const bad = Object.entries(ALIASES).filter(([, v]) => !FOODS[v]).map(([k]) => k);
  assert.deepEqual(bad, []);
});
// 「姜」同时指生姜、干姜、姜黄，「枣」可能指大枣也可能指酸枣。
// 收进来会让系统在一句含糊的话上给出确定答案——比不答更糟。
check('单字别名一律不收', () => {
  const bad = Object.keys(ALIASES).filter((k) => k.length < 2);
  assert.deepEqual(bad, []);
});
check('别名不许和正名撞车', () => {
  const bad = Object.keys(ALIASES).filter((k) => FOODS[k]);
  assert.deepEqual(bad, []);
});

console.log('\n[6] 认不出就说认不出，不编');
check('表外的返回 null', () => {
  for (const q of ['绿豆', '白萝卜', '雪梨', '西瓜', '★☆※', '', null]) {
    assert.equal(foodOf(q), null, `${q} 不该有结果`);
  }
});
check('foodWords 同时给出正名和别名', () => {
  const w = foodWords();
  assert.ok(w.includes('大枣') && w.includes('红枣'), '缺正名或别名');
  assert.equal(w.length, NAMES.length + Object.keys(ALIASES).length);
});

console.log('\n' + '='.repeat(56));
console.log(`通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
