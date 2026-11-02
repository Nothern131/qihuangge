// 岐黄阁「听懂层」的回归测试。
//
// 断言的原则和麻将那边一致：验性质，不验措辞。但这里多一类必须钉死的性质——
// 危险结论的一致性。措辞可以为了更顺口反复改，但「有风险时不能说放心」
// 「查不到时不能说没问题」这两条一旦松掉，改文案就会改出医疗事故。

import assert from 'node:assert/strict';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';

const { sandbox } = loadEngines({ quiet: true });
const pack = createQihuangPack({
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
});
const agent = createQihuangAgent(pack);

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

const ask = (t) => askQihuang(agent, t);

// 每一句给用户的话都要过这一关
function spokenOk(s) {
  assert.equal(typeof s, 'string');
  assert.ok(s.trim().length > 0, '播报不能为空');
  assert.ok(!/undefined|NaN|\[object/.test(s), `出现未定义值：${s}`);
  assert.ok(!/字段|payload|引擎|索引|接口/.test(s), `泄漏技术词：${s}`);
  assert.ok(/医师|药师|医嘱|用量我不给建议|不辨证/.test(s) || s.length < 40,
    `长答复应当带退路：${s}`);
}

console.log('\n=== 岐黄阁听懂层 ===');

console.log('\n[1] 毒性：直接答，且结论明确');
const r1 = ask('附子有毒吗');
check('走直接回答', () => assert.equal(r1.verdict, 'answer'));
check('认出了附子', () => assert.deepEqual(r1.recognized, ['附子']));
check('明确指出有毒', () => assert.ok(/有毒/.test(r1.speech)));
check('播报说得出口', () => spokenOk(r1.speech));

console.log('\n[2] 妊娠：风险必须出现在答复里');
const r2 = ask('孕妇能吃桃仁吗');
check('认出桃仁', () => assert.ok(r2.recognized.includes('桃仁')));
check('答复含妊娠风险', () => assert.ok(/妊娠|孕妇|禁用/.test(r2.speech)));
check('播报说得出口', () => spokenOk(r2.speech));

console.log('\n[3] 配伍：十八反要说出来，且不能只有一味');
const r3 = ask('甘草和海藻能一起吃吗');
check('认出两味', () => assert.deepEqual(r3.recognized, ['甘草', '海藻']));
check('给出相反结论', () => assert.ok(/反|十八反|不(能|可)/.test(r3.speech)));
check('没有自检问题', () => assert.deepEqual(r3.issues, []));

console.log('\n[4] 「能不能吃」不能降级成性味功效（会把风险整段漏掉）');
const r4 = ask('桃仁能不能吃');
check('答复里出现风险而不只是性味', () => assert.ok(/妊娠|有毒|禁用/.test(r4.speech)));
check('没有只说功效', () => assert.ok(!/^桃仁：性味/.test(r4.speech)));

console.log('\n[5] 剂量与开方：听懂了也不能答');
const r5 = ask('当归吃多少克');
check('走 stop 档', () => assert.equal(r5.verdict, 'stop'));
check('不给出任何数字用量', () => assert.ok(!/\d+\s*(克|钱|两)/.test(r5.speech)));
check('说明为什么不说', () => assert.ok(/危险|不给|不说/.test(r5.speech)));

const r5b = ask('我头疼吃什么药好');
check('开方请求也走 stop', () => assert.equal(r5b.verdict, 'stop'));
check('明确不做辨证', () => assert.ok(/不辨证|不开方|只查/.test(r5b.speech)));

console.log('\n[6] 未收录的真药名：说「没收录」，不能说「没问题」');
const r6 = ask('三七');
check('走直接回答（没收录也是准确答案）', () => assert.equal(r6.verdict, 'answer'));
check('说明没收录', () => assert.ok(/没收录|没有收录|还没收录/.test(r6.speech)));
check('绝不说可以放心用', () => assert.ok(!/(放心|没问题|安全)/.test(r6.speech)));
check('给出退路', () => spokenOk(r6.speech));

console.log('\n[7] 闲聊：不能把整句话当药名念回去');
const r7 = ask('今天天气不错');
check('走引导档', () => assert.equal(r7.verdict, 'guide'));
check('不复读原话当药名', () => assert.ok(!/还没收录今天天气不错/.test(r7.speech)));
check('结果为空', () => assert.equal(r7.result, null));

console.log('\n[8] 口语前缀不影响识别（上游和下游必须用同一份切词结果）');
// 这条钉的是一个已经修过的 bug：上游 recognize 切出了「附子」，
// 下游 viewAsk 却拿原句重新切词，切不出来，于是答「没听出药名」——
// 同一句话里自己和自己矛盾。
for (const [dirty, herb] of [
  ['那个，我想问一下附子是不是有毒啊', '附子'],
  ['帮我看看甘草和海藻能不能一起吃', '甘草'],
  ['嗯……孕妇能吃桃仁吗', '桃仁'],
]) {
  const r = ask(dirty);
  check(`认出${herb}：${dirty.slice(0, 12)}`, () => {
    assert.ok(r.recognized.includes(herb), `应认出${herb}，实际 ${JSON.stringify(r.recognized)}`);
    assert.ok(!/没听出药名|没听清是哪几味/.test(r.speech), `不该说没听出：${r.speech}`);
  });
}

console.log('\n[9] 不变量：直接回答档一律说得出出处');
// 先断言「结论里没有免责话术」，再断言「给出了出处」。
// 为什么两条都要：只删免责不补出处，等于把「有边界」变成「没依据」；
// 只加出处不删免责，就成了用户明确提过不要的那种每句挂尾巴。
const NO_DISCLAIMER = /仅供参考|咨询医师|咨询药师|见医生/;
const HAS_SOURCE = /(《[^》]+》|药典|现代营养学|禁忌歌|本草库|营养素库|没收录|没记录)/;
for (const t of ['附子有毒吗', '孕妇能吃桃仁吗', '甘草和海藻能一起吃吗', '桃仁能不能吃', '三七']) {
  const r = ask(t);
  if (r.verdict !== 'answer') continue;
  check(`说了出处：${t}`, () => assert.ok(HAS_SOURCE.test(r.result.source || ''), `source=${r.result.source}`));
  check(`不挂免责尾巴：${t}`, () => assert.ok(!NO_DISCLAIMER.test(r.speech), r.speech));
}

console.log('\n[10] 不变量：有风险时不允许出现安慰措辞');
// 这是整个作品最重要的一条。用户只会记住最后听到的半句话，
// 前半句说「禁用」后半句说「放心」，等于没说。
const RISKY = ['附子有毒吗', '孕妇能吃桃仁吗', '桃仁能不能吃', '甘草和海藻能一起吃吗',
  '甘草、海藻、甘遂能不能一起用', '斑蝥', '巴豆'];
for (const t of RISKY) {
  const r = ask(t);
  if (r.verdict === 'stop' || r.verdict === 'guide') continue;
  check(`无安慰措辞：${t}`, () => {
    assert.ok(!/(可以放心|放心吃|放心用|没问题|没事)/.test(r.speech), r.speech);
  });
}

console.log('\n[11] 不变量：所有档位都要有一句能念出去的话');
for (const t of ['附子有毒吗', '当归吃多少克', '今天天气不错', '三七', '甘草海藻', '啊啊啊']) {
  const r = ask(t);
  check(`${r.verdict} 档有播报：${t}`, () => spokenOk(r.speech));
}

console.log('\n[13] 营养素：养生场景里比中药更高频的问法');
// 这一组是补漏：原来「维生素C有什么作用」会被判成「没听出药名」，
// 因为本草词表里根本没有维生素。用户的结论会是「这个只会查中药」。
for (const [q, expect] of [
  ['维生素C有什么作用', '维生素C'],
  ['维C有什么用', '维生素C'],
  ['补钙怎么补', '钙'],
  ['叶酸是什么', '叶酸'],
  ['鱼油有什么用', 'Omega-3'],
  ['辅酶Q10', '辅酶Q10'],
]) {
  const r = ask(q);
  check(`${q} → 认出${expect}`, () => {
    assert.equal(r.verdict, 'answer', `verdict=${r.verdict} speech=${r.speech}`);
    assert.ok(r.speech.includes(expect), r.speech);
  });
}

console.log('\n[14] 营养素：查不到要说「库里没有」，不能说「没听懂」');
// 「没听懂」会让用户以为是自己发音不准，对着眼镜反复重说同一句。
// 维生素 B5、B8、H 都是真实存在的，只是库里没有——说清查不到才是准确答复。
for (const q of ['维生素B5是什么', '维生素Z']) {
  const r = ask(q);
  check(`${q} 说清是库里没有`, () => {
    assert.ok(/库里没有|没有收录|没收录/.test(r.speech), r.speech);
    assert.ok(!/没听懂/.test(r.speech), r.speech);
  });
}

console.log('\n[15] 营养素搭配：问两样就必须答搭配，不能只答第一样');
const mix = ask('钙和铁能一起吃吗');
check('钙和铁走搭配而不是单味', () => {
  assert.equal(mix.verdict, 'answer', `verdict=${mix.verdict}`);
  assert.ok(/钙/.test(mix.speech) && /铁/.test(mix.speech), mix.speech);
  assert.ok(/间隔|分开/.test(mix.speech), mix.speech);
});
check('搭配结论说得出出处', () => assert.ok(/现代营养学/.test(mix.result.source || ''), mix.result.source));
check('库里没有这一对时不说「没问题」', () => {
  const r = ask('锌和镁能一起吃吗');
  assert.ok(!/(可以一起吃|没问题|放心)/.test(r.speech), r.speech);
  assert.ok(/没有.*记录|没记录/.test(r.speech), r.speech);
});

console.log('\n[16] 药名优先：不能被营养素抢走');
// 「铁皮石斛」里有个「铁」。先认营养素就会去查铁元素，而用户问的是一味药。
const tps = ask('铁皮石斛有什么功效');
check('铁皮石斛没被当成铁元素', () => {
  assert.ok(!/血红蛋白|运输氧气/.test(tps.speech), tps.speech);
  assert.ok(/铁皮石斛/.test(tps.speech), tps.speech);
});

console.log('\n[17] 问句尾巴要切掉，否则整句被当药名');
// 「丹参的作用是什么」原来七个字过不了「像不像药名」，答「没听出药名」。
for (const [q, name] of [['丹参的作用是什么', '丹参'], ['丹参有什么功效', '丹参']]) {
  const r = ask(q);
  check(`${q} 仍能查到时`, () => {
    assert.equal(r.verdict, 'answer', `verdict=${r.verdict} speech=${r.speech}`);
    assert.ok(r.speech.includes(name), r.speech);
  });
}

console.log('\n[18] 养生定位的边界：调理类要说明白，不能答「没听懂」');
// 定位是「养生助手」，用户一定会问「失眠怎么调理」。
// 答「没听懂」听起来像不会，实际是不该答——两者对用户的意义完全不同：
// 前者他会换个说法再试，后者他会去找一个会编的答案。
for (const q of ['我最近失眠怎么调理', '养生该怎么养', '什么能治咳嗽']) {
  const r = ask(q);
  check(`${q} 说明是不做而不是听不懂`, () => {
    assert.equal(r.verdict, 'stop', `verdict=${r.verdict} speech=${r.speech}`);
    assert.ok(/调理|辨证|不做/.test(r.speech), r.speech);
    assert.ok(!/没听懂/.test(r.speech), r.speech);
  });
}
check('认出了药名时仍答药，不被「调理」抢走', () => {
  const r = ask('丹参怎么调理');
  assert.equal(r.verdict, 'answer', `verdict=${r.verdict}`);
  assert.ok(/丹参/.test(r.speech), r.speech);
});

console.log('\n[19] 经典原文：只给真正讲这味药的');
// 甘草在《伤寒论》里出现 18 次，但那些是「太阳病…桂枝汤主之」这类方论，
// 讲的是方不是甘草。把它贴在药性下面，用户会以为古人是这么论述甘草的。
// 所以宁可不给，也不能给一个不相关的出处。
for (const [q, want] of [['当归有什么功效', true], ['人参有什么功效', true], ['甘草有什么功效', false]]) {
  const r = ask(q);
  check(`${q} ${want ? '给' : '不给'}原文`, () => {
    const a = r.result && r.result.ancient;
    if (want) {
      assert.ok(a, '应该有原文');
      assert.equal(a.source, '神农本草经');
      assert.ok(a.text && a.text.length > 5, '原文为空');
    } else {
      assert.equal(a, null, '不该给原文');
    }
  });
}
check('有原文时播报里要说明去哪看', () => {
  const r = ask('当归有什么功效');
  assert.ok(/屏幕上/.test(r.speech), r.speech);
  // 同时要能说出是哪本书——「屏幕上能看到」但不说书名，等于没说。
  assert.ok(/《[^》]+》/.test(r.speech), r.speech);
  assert.ok(/《[^》]+》/.test(r.result.source || ''), r.result.source);
});

console.log('\n[20] 耗时可控');
for (let i = 0; i < 10; i += 1) ask('甘草和海藻能一起吃吗');
const times = [];
for (let i = 0; i < 50; i += 1) {
  const t0 = process.hrtime.bigint();
  ask('甘草和海藻能一起吃吗');
  times.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
times.sort((a, b) => a - b);
const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
console.log(`  p50=${times[25].toFixed(2)}ms p95=${p95.toFixed(2)}ms`);
check('热路径 p95 低于 30ms', () => assert.ok(p95 < 30, `p95=${p95.toFixed(2)}ms`));

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) {
  console.log('存在失败');
  process.exit(1);
}
console.log('全部通过');
