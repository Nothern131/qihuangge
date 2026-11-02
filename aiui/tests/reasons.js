// 「为什么不能同用」这一层的回归测试。
//
// 这一层加得很晚，但它撑起的是最容易被糊弄的一件事：
// 只说「不可同用」是安全的，说「为什么」就开始承担说错的风险。
// 所以这里的断言不验措辞，验三件性质：
//   ① 覆盖：引擎判出来的每一对，都必须查得到原因，不能有死角
//   ② 归属：每条原因都要标清是现代研究还是传统说法——标错就是伪造出处
//   ③ 诚实：书里没写解释的那几对，必须明说「没写」，不能现编一段像模像样的机理
//
// 第三条尤其重要：编一段机理，用户读起来和真的一样，
// 但他按这话去查书查不到，之后就一句都不信了。

import assert from 'node:assert/strict';
import { reasonFor, mergeBriefs, WHY_KIND_TAG, reasonSource, WEI_DEFINITION } from '../adapter/reasons.js';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';

const { sandbox } = loadEngines({ quiet: true });
const I = sandbox.InteractionEngine;
const pack = createQihuangPack({
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
});

let pass = 0;
let fail = 0;
function check(label, fn) {
  try {
    fn();
    pass += 1;
    console.log(`  [PASS] ${label}`);
  } catch (err) {
    fail += 1;
    console.log(`  [FAIL] ${label}`);
    console.log(`         ${err.message}`);
  }
}
function equal(label, actual, expected) {
  check(`${label}（期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}）`, () => {
    assert.deepEqual(actual, expected);
  });
}
function truthy(label, v) {
  check(label, () => assert.ok(v, `实际值 ${JSON.stringify(v)}`));
}

console.log('=== 配伍禁忌原因库 ===');

// ── 覆盖 ────────────────────────────────────────────────
console.log('\n[1] 覆盖：引擎判得出的每一对，都必须查得到原因');

// 直接按引擎自己的名单穷举，不手写清单。
// 手写清单的问题是会漏：以后有人往 ANTI_GROUP 里加了一味药，
// 手写的用例不会红，而那味药的答复就退化成「不可同用，没有原因」。
const FAN_CASES = [];
const G1 = I.ANTI_GROUP1;
for (const b of G1.slice(1)) FAN_CASES.push([G1[0], b]);
const G2 = I.ANTI_GROUP2;
for (const b of G2.slice(1)) FAN_CASES.push([G2[0], b]);
const G3 = I.ANTI_GROUP3;
for (const b of G3.slice(1)) FAN_CASES.push([G3[0], b]);

// 判据是 whyKind !== 'none'，不是「why 非空」。
// 原因库对表外组合会返回一句 fallback（「书里只列了禁忌，没有给解释」），
// 所以 why 永远非空——用「非空」判覆盖，删掉一整对也能通过。
// 这个漏洞是反向验证时发现的：故意改掉一对的药名，覆盖断言纹丝不动。
const missingFan = FAN_CASES.filter(([a, b]) => reasonFor(a, b, '十八反').whyKind === 'none');
equal('十八反全部有原因', missingFan, []);

// 注意：引擎跑在 vm 沙箱里，I.FEAR_PAIRS 是**另一个 realm** 的数组。
// 在它上面直接 .map() 得到的也是沙箱的 Array，deepStrictEqual 会因为原型不同判为不等
//（内容一模一样，仍然报 "same structure but not reference-equal"）。
// 所以先 Array.from 搬进本 realm 再处理。这个坑在断言里表现为「明明空的却红了」，
// 不看 realm 会查很久。
const WEI_CASES = Array.from(I.FEAR_PAIRS, (p) => [p[0], p[1]]);
const missingWei = WEI_CASES.filter(([a, b]) => reasonFor(a, b, '十九畏').whyKind === 'none');
equal('十九畏全部有原因', missingWei, []);

truthy('用例数与引擎名单一致', FAN_CASES.length + WEI_CASES.length ===
  (G1.length - 1) + (G2.length - 1) + (G3.length - 1) + I.FEAR_PAIRS.length);

// 川乌、草乌是乌头组的别名。引擎会把 msg 里的名字换成实际出现的那味，
// 查原因时也必须能按别名查到，否则「川乌反半夏」会答成「没有解释」。
check('别名川乌能查到乌头组的原因', () => {
  assert.ok(reasonFor('川乌', '半夏', '十八反').why.includes('乌头碱'));
});
check('别名草乌能查到乌头组的原因', () => {
  assert.ok(reasonFor('草乌', '贝母', '十八反').why.includes('乌头碱'));
});
check('顺序无关：反过来说也查得到', () => {
  assert.equal(reasonFor('海藻', '甘草', '十八反').why, reasonFor('甘草', '海藻', '十八反').why);
});

// ── 归属 ────────────────────────────────────────────────
console.log('\n[2] 归属：每条原因都标得出它是谁说的');

const ALL = [
  ...FAN_CASES.map(([a, b]) => ({ pair: [a, b], ...reasonFor(a, b, '十八反') })),
  ...WEI_CASES.map(([a, b]) => ({ pair: [a, b], ...reasonFor(a, b, '十九畏') })),
];

const badKind = ALL.filter((r) => !['modern', 'classic', 'none'].includes(r.whyKind));
equal('whyKind 取值合法', badKind.map((r) => r.pair), []);

const badTag = ALL.filter((r) => r.whyKindTag !== WHY_KIND_TAG[r.whyKind]);
equal('标签与类型一致', badTag.map((r) => r.pair), []);

// 说得出「现代研究」的，就得说得出是哪一类研究；说不出就别说它是研究。
check('modern 档都给了来源类别', () => {
  const bad = ALL.filter((r) => r.whyKind === 'modern' && !reasonSource('modern'));
  assert.deepEqual(bad.map((r) => r.pair), []);
});

// 这条是防伪造的核心：标成 modern 的条目里不能出现「传统认为」「古人」，
// 标成 classic 的条目里不能出现具体的现代分子或酶名。
// 两种都是把归属搞反了，而搞反了比不说更糟。
check('modern 档没有写成古人说的话', () => {
  const bad = ALL.filter((r) => r.whyKind === 'modern' && /(传统认为|古人认为|古籍认为)/.test(r.why));
  assert.deepEqual(bad.map((r) => r.pair), []);
});
check('classic 档没有冒充实验结论', () => {
  const bad = ALL.filter((r) => r.whyKind === 'classic' && /(CYP\d|受体|酶活性|LD50|血药浓度)/.test(r.why));
  assert.deepEqual(bad.map((r) => r.pair), []);
});

// ── 诚实 ────────────────────────────────────────────────
console.log('\n[3] 诚实：书里没写解释的，必须明说，不能现编');

// 表内的每一对现在都有解释（或都有可交代的推断），所以这里没有 none 条目。
// 但 none 这一档必须存在——表外的组合、以及将来补不上的组合都要落到它上面，
// 落到它就是「照实说没有」，不能不声不响地给一段编出来的机理。
const outside = reasonFor('黄芪', '当归', '十八反');
truthy('表外组合落在 none 档', outside.whyKind === 'none');
check('none 档明说没给解释', () => {
  assert.ok(/(没给解释|没有给解释|没写为什么|没有统一结论)/.test(outside.why), outside.why);
});

// 反过来：标成 modern 或 classic 的，就必须真的有解释——
// 一句「归在禁忌里」不算解释，那是把禁令换个说法。
check('表内条目不是空壳', () => {
  const bad = ALL.filter((r) => r.whyKind !== 'none' && r.why.length < 20);
  assert.deepEqual(bad.map((r) => r.pair), []);
});

// 每条原因都得有实体内容。低于这个长度基本只剩「不可同用」这种复述，
// 而复述禁令不是解释——用户听两遍就发现「你没回答我的问题」。
const tooShort = ALL.filter((r) => r.why.length < 20);
equal('没有一条原因是「换个说法的禁令」', tooShort.map((r) => [r.pair, r.why]), []);

// 屏幕要读得下。超过这个长度，原因会占满整屏，把结论挤出可视区。
const tooLong = ALL.filter((r) => r.why.length > 130);
equal('单条原因不超过 130 字', tooLong.map((r) => [r.pair, r.why.length]), []);

// 表里没有的组合不能静默返回空对象——那会让调用方拿到 undefined 去拼字符串。
check('表外组合也有可念的话', () => {
  const r = reasonFor('黄芪', '当归', '十八反');
  assert.ok(r.why && r.why.length > 0, JSON.stringify(r));
  assert.equal(r.whyKind, 'none');
});

// ── 合并 ────────────────────────────────────────────────
console.log('\n[4] 多条命中的合并：同组说一次，异组各说一次');

const twoSameGroup = mergeBriefs([
  { ...reasonFor('甘草', '大戟', '十八反'), partner: '大戟' },
  { ...reasonFor('甘草', '甘遂', '十八反'), partner: '甘遂' },
]);
equal('同组两对合并成一句', twoSameGroup.length, 1);
// 合并之后必须把两味药名都说出来。只说大戟，用户会以为甘遂那对没查。
truthy('合并后两味药名都在', /大戟/.test(twoSameGroup[0]) && /甘遂/.test(twoSameGroup[0]));

const twoGroups = mergeBriefs([
  { ...reasonFor('甘草', '海藻', '十八反'), partner: '海藻' },
  { ...reasonFor('丁香', '郁金', '十九畏'), partner: '' },
]);
equal('异组不合并', twoGroups.length, 2);

// ── 播报行为 ────────────────────────────────────────────
console.log('\n[5] 播报：结论在前，原因紧随，出处仍在');

const q1 = pack.invoke('ask', { text: '甘草海藻能不能一起吃', query: '甘草海藻能不能一起吃' });
truthy('播报带原因', /原因：/.test(q1.speech));
// 顺序有意义：先说不可以，再说为什么。反过来用户要听到最后才知道结论。
check('结论在原因之前', () => {
  assert.ok(q1.speech.indexOf('不可同用') < q1.speech.indexOf('原因：'), q1.speech);
});
truthy('出处仍在', /《儒门事亲》/.test(q1.source));
truthy('长答复给了更长的播报预算', q1.sayMax >= 64);
truthy('屏幕正文不含播报里的浓缩原因', !/原因：甘草会让身体/.test(q1.screenText || ''), q1.screenText);

// 追问要真正多给东西，不能和默认一档。
const q2 = pack.invoke('ask', { text: '为什么甘草反海藻', query: '为什么甘草反海藻' });
truthy('追问给得更多', q2.speech.length > q1.speech.length);
truthy('追问带上争议', /古方|争议|同用/.test(q2.speech));
truthy('追问的预算更大', q2.sayMax > q1.sayMax);
// 「为什么」本身不是药名，剥不干净就会答「没听出药名」——用户明明说得很清楚。
truthy('「为什么」不污染药名识别', Array.isArray(q2.herbs) && q2.herbs.includes('海藻'));

// 十九畏必须给出「不宜同用」这个结论。
// 只念「丁香畏郁金」的话，用户听到的是一个不知道该怎么处理的词。
const q3 = pack.invoke('ask', { text: '丁香和郁金能一起用吗', query: '丁香和郁金能一起用吗' });
truthy('十九畏给了结论', /不宜同用/.test(q3.speech), q3.speech);

// 十九畏的「畏」和七情里的「相畏」同字不同义，这个概念区别必须能说出来。
// 直接读常量而不是把文案抄进测试：抄了之后改一边就漂移，而漂移的文案没人会发现。
check('能说清「畏」字的两层含义', () => {
  assert.ok(/相畏/.test(WEI_DEFINITION), WEI_DEFINITION);
  // 说清区别的关键是点出「同字不同义」，只说「畏就是相忌」不够。
  assert.ok(/(不是一回事|同字不同义|相忌)/.test(WEI_DEFINITION), WEI_DEFINITION);
});

// 没有命中禁忌时不该有原因，也不该出现「原因：」这个空壳。
const q4 = pack.invoke('ask', { text: '黄芪和当归能一起用吗', query: '黄芪和当归能一起用吗' });
truthy('没命中不给空原因', !/原因：。|原因：$/.test(q4.speech), q4.speech);

// 屏幕要拼的两块料必须都在：原因全文 + 归属标签。
// pack 只给 screenText（不含原因），原因由视图层拼进去，
// 所以这里验的是零件齐全，渲染在 tests/view.js 里验。
check('屏幕所需的原因与标签都在', () => {
  assert.ok((q1.reasons || []).length > 0, '没有 reasons');
  assert.ok(q1.reasons[0].whyKindTag, '缺归属标签');
  assert.ok(q1.reasons[0].why.length > 20, '原因是空的');
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
