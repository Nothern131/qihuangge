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
import { reasonFor, mergeBriefs, WHY_KIND_TAG, reasonSource, WEI_DEFINITION, FAN_GROUPS, WEI_PAIRS } from '../adapter/reasons.js';
import { CANON_PAIRS, CANON_HERBS, WEI_SONG, DIFF, reconcileWei } from '../adapter/wei-canon.js';
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
function truthy(label, v, hint) {
  // hint 是失败时要看的东西。原来这个参数被丢掉了，断言红了只看到「实际值 false」，
  // 得回代码里加 console.log 才知道屏幕到底写了什么。
  check(label, () => assert.ok(v, `实际值 ${JSON.stringify(v)}${hint ? `｜${hint}` : ''}`));
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
const ENGINE_WEI = Array.from(I.FEAR_PAIRS, (p) => [p[0], p[1]]);
// 十九畏的用例不再取自引擎表，改取歌诀——引擎那张表有两组是读错歌诀得来的。
// 这么改之后，断言验的是「歌诀里的每一对都查得到原因」，
// 而不是「引擎恰好吐出来的那几对查得到」。
const WEI_CASES = CANON_PAIRS.map(([a, b]) => [a, b]);
const missingWei = WEI_CASES.filter(([a, b]) => reasonFor(a, b, '十九畏').whyKind === 'none');
equal('十九畏全部有原因', missingWei, []);

// 歌诀里没有被误当成禁忌的两对，原因库必须不再给出禁令——
// 否则「查得到原因」这件事本身会把一条错禁忌坐实。
equal('原因库不再给川乌草乌编禁令',
  reasonFor('川乌', '草乌', '十九畏').whyKind, 'none');
equal('原因库不再给人参赤石脂编禁令',
  reasonFor('人参', '赤石脂', '十九畏').whyKind, 'none');

truthy('十八反用例数与引擎分组一致', FAN_CASES.length ===
  (G1.length - 1) + (G2.length - 1) + (G3.length - 1));

// 「十九畏」这个名字来自 19 味药，不是 19 组：歌诀里 19 味药配成 10 对，
// 其中川乌、草乌是并列主语、共畏犀角，所以按组算只有 9 组。
// 把 19 当组数去补，会补出一堆不存在的组合——这个数是算出来的，不是数的。
truthy('歌诀 19 味药、10 对',
  CANON_HERBS.length === 19 && CANON_PAIRS.length === 10);
equal('引擎表比歌诀少 4 对、多 2 对',
  [DIFF.missing.length, DIFF.extra.length], [4, 2]);

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

const badKind = ALL.filter((r) => !['experiment', 'pharmacology', 'classic', 'none'].includes(r.whyKind));
equal('whyKind 取值合法', badKind.map((r) => r.pair), []);

const badTag = ALL.filter((r) => r.whyKindTag !== WHY_KIND_TAG[r.whyKind]);
equal('标签与类型一致', badTag.map((r) => r.pair), []);

// 说得出「现代研究」的，就得说得出是哪一类研究；说不出就别说它是研究。
check('modern 档都给了来源类别', () => {
  const bad = ALL.filter((r) => ['experiment', 'pharmacology'].includes(r.whyKind) && !reasonSource(r.whyKind));
  assert.deepEqual(bad.map((r) => r.pair), []);
});

// 这条是防伪造的核心：标成 modern 的条目里不能出现「传统认为」「古人」，
// 标成 classic 的条目里不能出现具体的现代分子或酶名。
// 两种都是把归属搞反了，而搞反了比不说更糟。
check('modern 档没有写成古人说的话', () => {
  const bad = ALL.filter((r) => ['experiment', 'pharmacology'].includes(r.whyKind) && /(传统认为|古人认为|古籍认为)/.test(r.why));
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

// ── 分组：说给谁听，就只说谁 ──────────────────────────
console.log('\n[6] 分组：屏幕上的原因只念用户问到的那几味');

// 甘草「反」四味，但用户只问了海藻。
// 原来句子里把整组名单写死（「大戟、甘遂、芫花、海藻都属利水逐饮药」），
// 于是问海藻时屏幕上替他念了三味没问的药。这不是措辞问题——
// 屏幕空间是定量，多念一个无关药名就少一句有用的，而用户还会去找大戟在哪。
const onlyOne = q1.reasonGroups || [];
truthy('屏幕原因是分组后的，不是逐对的', onlyOne.length === 1);
check('没问到的药名不上屏', () => {
  const why = onlyOne[0] && onlyOne[0].why;
  for (const other of ['大戟', '甘遂', '芫花']) {
    assert.ok(!String(why).includes(other), `${other} 没问到却被念了：${why}`);
  }
});
// 反过来：问到的必须说。只删名单不补药名，原因就变成「都属利水逐饮药」，指代不明。
truthy('问到的药名在原因里', /海藻/.test(onlyOne[0] ? onlyOne[0].why : ''));

// 单数不能配「都」。模板拼出来的病句最容易被一眼看穿，
// 「海藻都属利水逐饮药」读起来就是「这系统在套模板」。
check('单味药不配「都」', () => {
  assert.ok(!/海藻都属/.test(onlyOne[0] ? onlyOne[0].why : ''), onlyOne[0] && onlyOne[0].why);
});
// 多味时该加还得加，否则读成「大戟、甘遂属利水逐饮药」也能通，但不如「都属」清楚。
const multi = pack.invoke('ask', { text: '甘草大戟甘遂能一起吃吗', query: '甘草大戟甘遂能一起吃吗' });
check('多味药才加「都」', () => {
  const why = (multi.reasonGroups || []).map((g) => g.why).join('');
  assert.ok(/大戟、甘遂都属/.test(why), why);
});

// 藜芦这一组原来七味共用一句「人参、沙参、丹参、玄参这些是补益药」。
// 问细辛或芍药时，那句就成了「细辛是补药」——不是说得不好，是说错了。
const withXixin = pack.invoke('ask', { text: '细辛和藜芦能一起用吗', query: '细辛和藜芦能一起用吗' });
check('藜芦配细辛不说细辛是补药', () => {
  const why = (withXixin.reasonGroups || []).map((g) => g.why).join('');
  assert.ok(/细辛/.test(why), why);
  assert.ok(!/细辛[^。；]{0,12}(是补|补益|补药|参类)/.test(why), why);
});
check('藜芦配细辛走发散那一路', () => {
  const why = (withXixin.reasonGroups || []).map((g) => g.why).join('');
  assert.ok(/发散/.test(why), why);
});

// ── 空正文：只有提示、没有禁忌时，必须正面回答「能不能同用」 ──
console.log('\n[7] 没有禁忌时，正文要正面回答用户问的那件事');

// 甘草配半夏：两味之间确实没有十八反、十九畏（反半夏的是乌头），
// 但半夏有妊娠禁用和毒性提示。正文原来被清空，屏幕只剩提示——
// 用户问「能同用吗」，屏幕上没有一句话回答那可不可以。
const noConflict = pack.invoke('ask', { text: '甘草和半夏能同用吗', query: '甘草和半夏能同用吗' });
truthy('正文回答了有没有配伍禁忌', /之间没有十八反、十九畏/.test(noConflict.screenText || ''), noConflict.screenText);
truthy('毒性提示仍在', /毒性：半夏（有毒）/.test(noConflict.screenText || ''), noConflict.screenText);
truthy('妊娠提示仍在', /妊娠禁用：半夏/.test(noConflict.screenText || ''), noConflict.screenText);

// 有妊娠提示时，正文不能再说「没查到妊娠禁忌」——前一句刚说禁用，后一句说没查到，
// 自己打自己。原来为了躲这个矛盾干脆把正文清空，代价是用户的问题没人答。
// 现在的做法是把句子拆开：正文只说配伍禁忌，妊娠单独作为提示。
const preg = pack.invoke('ask', { text: '三棱能吃不', query: '三棱能吃不' });
check('有妊娠禁用时不套「没查到妊娠禁忌」', () => {
  const t = preg.screenText || '';
  if (!/妊娠/.test(t)) return; // 这条问法没命中妊娠，跳过
  assert.ok(!/没有查到[^。]*妊娠禁忌/.test(t), t);
});

// 问到两味、只认出一味时，不能说「没有查到禁忌」。
// 实测过的原始输出：问「阿司匹林和当归能一起吃吗」，答的是
// 「阿司匹林本草库没收录，只查了认识的药。没有查到当归相关的十八反、十九畏」——
// 前半句说了没收录，后半句仍是一个干净的否定结论，而用户记住的往往是后者。
// 中西药同服恰恰是最多人真正要问的那件事，不能这样带过去。
const partial = pack.invoke('ask', { text: '阿司匹林和当归能一起吃吗', query: '阿司匹林和当归能一起吃吗' });
truthy('只认出一味时要说「这一问答不了」', /这一问答不了/.test(partial.screenText || ''), partial.screenText);
truthy('只说没收录的那味，不拿它当药名念', /阿司匹林本草库没收录/.test(partial.screenText || ''), partial.screenText);

console.log('\n[8] 十九畏按歌诀校正：错的不能再报，缺的必须能查到');

// 这一组断言守的是一个已经发生的错：引擎表把歌诀「川乌草乌不顺犀」读成了
// 「川乌畏草乌」，又把人参的对手记成了赤石脂。两处都错在**配错对手**，
// 后果不是措辞问题——真正的那两对（人参畏五灵脂、官桂畏赤石脂）查不到，
// 而川乌草乌这两味在实际方子里本来就同用（小活络丹）。
const ask = (text) => pack.invoke('ask', { text, query: text });

const w1 = ask('人参五灵脂能一起用吗');
truthy('人参畏五灵脂能查到了', /十九畏：人参畏五灵脂/.test(w1.screenText || ''), w1.screenText);
// 原因不在 screenText 里（那一层只管结论和提示），要看 reasonGroups。
truthy('人参五灵脂给了原因', (w1.reasonGroups || []).length > 0, JSON.stringify(w1.reasonGroups));

const w2 = ask('川乌草乌能一起用吗');
// 判据要卡「属十九畏，不宜同用」整句：只查「属十九畏」会被
// 「**不**属十九畏」这句纠正说明命中，断言假绿。
truthy('川乌草乌不再被当成十九畏', !/属十九畏，不宜同用/.test(w2.screenText || ''), w2.screenText);
truthy('川乌草乌要说清歌诀畏的是犀角', /畏的是犀角/.test(w2.screenText || ''), w2.screenText);
// 纠正一条错禁忌之后必须把真实风险补回来：两味都含乌头碱，
// 只说「不属十九畏」会被听成「可以放心一起吃」。
truthy('川乌草乌仍给出毒性提示', /大毒/.test(w2.screenText || ''), w2.screenText);

const w3 = ask('人参赤石脂能同用吗');
truthy('人参赤石脂不再说「不宜同用」', !/不宜同用/.test(w3.screenText || ''), w3.screenText);
truthy('人参赤石脂要说清对手记错了', /人参畏的不是赤石脂/.test(w3.screenText || ''), w3.screenText);

// 官桂是肉桂的规格名。用户很可能照着歌诀的原文说法问「官桂」，
// 表里记的是正名「肉桂」——不归口的话这一对就查不到。
const w4 = ask('官桂畏赤石脂');
truthy('官桂按正名查到肉桂畏赤石脂', /肉桂畏赤石脂/.test(w4.screenText || ''), w4.screenText);

// 单元层：被删掉的那一对要带着歌诀原句出来，否则 pack 层没法解释「为什么不算」。
const re = reconcileWei([{ herbs: ['川乌', '草乌'], type: '十九畏', level: 'moderate', msg: '川乌畏草乌' }], ['川乌', '草乌']);
equal('川乌草乌被移除', re.weis.length, 0);
equal('移除项带着歌诀信息', re.removed.length, 1);
truthy('补上的两对只补用户问到的',
  reconcileWei([], ['人参', '五灵脂', '甘草']).weis.length === 1);

console.log('\n[9] 引经据典：说了「研究/实验」就必须给得出文献');

// 这一条是用户明确提的要求：关乎身体，引用必须真实。
// 它抓的是一种最难发现的错——**说法本身很像真的，但去查查不到**。
// 曾经就有过一条：「研究认为丁香油酚会抑制郁金中姜黄素的吸收利用」。
// 查证的结果相反（共煎时姜黄素基本不变），那句话只在健康科普网站上流转。
//
// 判据只认肯定句式（「研究认为/实验显示/测过」），不认否定句
//（「现代研究没有专门验证」本身是诚实的，不该被罚）。
// 只认肯定句式，而且要看前面有没有否定词。
// 不加这一层，「不是实验测出来的」会被当成在声称实验——而这句恰恰是在**否认**有实验。
function claimsResearch(text) {
  const re = /(研究|实验)(认为|显示|表明|发现|观察|看到|测出|测过|里)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 6), m.index);
    if (/不是|没有|缺少|未做|没有同等/.test(before)) continue;
    return true;
  }
  return false;
}
const noRef = [];
for (const [key, g] of Object.entries(FAN_GROUPS)) {
  const sample = g.partners[0] || '';
  const why = g.whyOf ? g.whyOf([sample]) : String(g.why || '').replace(/\{partners\}/g, sample);
  const text = `${why}${g.debateFor ? g.debateFor([sample]) : (g.debate || '')}`;
  if (claimsResearch(text) && !(Array.isArray(g.ref) && g.ref.length > 0)) noRef.push([key, text.slice(0, 24)]);
}
for (const w of WEI_PAIRS) {
  const text = `${w.why || ''}${w.debate || ''}`;
  if (claimsResearch(text) && !(Array.isArray(w.ref) && w.ref.length > 0)) noRef.push([w.pair.join('+'), text.slice(0, 24)]);
}
equal('声称有研究依据的条目都给了文献', noRef, []);

// 文献不能是占位符。要求至少有「刊物名或年份」这种能追的痕迹。
const weakRef = [];
const allRefs = [
  ...Object.entries(FAN_GROUPS).flatMap(([k, g]) => (g.ref || []).map((r) => [k, r])),
  ...WEI_PAIRS.flatMap((w) => (w.ref || []).map((r) => [w.pair.join('+'), r])),
];
for (const [k, r] of allRefs) {
  if (!/\d{4}|学报|杂志|出版社/.test(String(r))) weakRef.push([k, r]);
}
equal('文献要追得下去（有年份或刊物）', weakRef, []);
truthy('至少有一条条目给了文献', allRefs.length > 0);

// 屏幕上标着「动物实验」的，背后必须有文献。
// 之前只有一档「现代药理研究」，把「做过实验」和「药理上讲得通」混在一起，
// 结果是后者借了前者的可信度。拆开之后，标 experiment 就必须给得出实验。
const expNoRef = [
  ...Object.entries(FAN_GROUPS).filter(([, g]) => g.whyKind === 'experiment'
    && !(Array.isArray(g.ref) && g.ref.length)).map(([k]) => k),
  ...WEI_PAIRS.filter((w) => w.whyKind === 'experiment'
    && !(Array.isArray(w.ref) && w.ref.length)).map((w) => w.pair.join('+')),
];
equal('标了「动物实验」的必须有文献', expNoRef, []);

// 反过来：标「药理常识」的不许挂文献——挂了就说明它其实是实验结论，标签写错了。
const pharmWithRef = Object.entries(FAN_GROUPS)
  .filter(([, g]) => g.whyKind === 'pharmacology' && Array.isArray(g.ref) && g.ref.length)
  .map(([k]) => k);
equal('标「药理常识」的不该挂实验文献', pharmWithRef, []);

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
