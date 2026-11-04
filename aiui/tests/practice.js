// 养生行为（adapter/practice-canon.js）与「状况 × 行为」交叉提醒的守门测试。
//
// 这一层是这套系统里唯一涉及「用户正在做什么」的地方，也是通用 AI 答不出的那一块：
// 它不知道你在艾灸，所以永远查不出「你在艾灸 + 你是阴虚」这种冲突。
//
// 守四件事：
//   ① 依据必须是原文出处，不许写成「中医认为」这类含糊说法，也不许编条号
//   ② 认不出的行为不猜（拔罐没有数据就是没有）
//   ③ 提醒要双向：先记行为后说状况、先说状况后记行为，都得提醒
//   ④ 不该提醒时闭嘴——一个总在提醒的助手，三天后就会被静音
//
// 运行：node tests/practice.js

import assert from 'node:assert/strict';
import {
  PRACTICES, PRACTICE_SOURCE, practiceOf, findPractices, practiceCautions, practiceWords,
} from '../adapter/practice-canon.js';
import { extractStates } from '../adapter/advice.js';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';

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

console.log('[1] 数据：每条禁忌都有原文、白话、出处');
eq('目前只收艾灸一项', Object.keys(PRACTICES), ['艾灸']);
check('艾灸有三条禁忌（阴虚 / 实热 / 表证）', () => {
  assert.equal(PRACTICES['艾灸'].tabi.length, 3);
});
check('每条都有原文、白话和出处', () => {
  const bad = PRACTICES['艾灸'].tabi.filter((t) => !t.text || !t.plain || !t.source);
  assert.deepEqual(bad, []);
});
check('原文是《伤寒论》原句，不打引号改写', () => {
  // 抽查一句：这是「微数之脉，慎不可灸」那条的前半段。
  const t = PRACTICES['艾灸'].tabi.find((x) => x.states.includes('yin-deficiency'));
  assert.ok(/微數之脈，慎不可灸/.test(t.text), t.text);
});
check('出处写到篇名，不写条号', () => {
  // 宋本、康平本、桂林古本对同一条的编号不一样，写死条号就有三分之一的机会写错。
  // 篇名是三个版本都一致的，所以只到篇。
  const bad = PRACTICES['艾灸'].tabi.filter((t) => /\d+\s*条/.test(t.source));
  assert.deepEqual(bad, []);
  assert.equal(PRACTICES['艾灸'].tabi[0].source, '《伤寒论·辨太阳病脉证并治中》');
});
check('出处书名对得上常量', () => assert.ok(/伤寒论/.test(PRACTICE_SOURCE)));

console.log('\n[2] 认得出，也认不出');
eq('艾灸', practiceOf('艾灸')?.name, '艾灸');
eq('艾条也是它', practiceOf('艾条')?.name, '艾灸');
eq('做艾灸', practiceOf('做艾灸')?.name, '艾灸');
eq('从整句里认', findPractices('我每天晚上都在做艾灸').map((p) => p.name), ['艾灸']);
check('拔罐没有数据，必须返回 null', () => {
  // 不是漏做，是找不到能和《伤寒论》同等分量的原文。宁缺不凑。
  assert.equal(practiceOf('拔罐'), null);
  assert.equal(practiceOf('刮痧'), null);
  assert.equal(practiceOf('泡脚'), null);
});
eq('空串不认', practiceOf('')?.name, undefined);
check('词表里只有真实存在的说法', () => {
  assert.deepEqual(practiceWords().sort(), ['做艾灸', '灸疗', '艾条', '艾柱', '艾灸', '艾绒'].sort());
});

console.log('\n[3] 状况匹配：对得上才说');
const yin = extractStates('我阴虚火旺');
const heat = extractStates('我怕热大便干结');
const cold = extractStates('我手脚冰凉');
check('阴虚命中阴虚那条', () => {
  const hits = practiceCautions(practiceOf('艾灸'), yin);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].states.includes('yin-deficiency'));
});
check('实热命中实热那条', () => {
  const hits = practiceCautions(practiceOf('艾灸'), heat);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].states.includes('excess-heat'));
});
// 这条是防误报的：阳虚的人做艾灸是对症的，不能提醒他别做。
check('阳虚不命中任何一条', () => {
  assert.deepEqual(practiceCautions(practiceOf('艾灸'), cold), []);
});
check('没有任何状况时不提醒', () => {
  assert.deepEqual(practiceCautions(practiceOf('艾灸'), []), []);
});

console.log('\n[4] 端到端：两个方向都要提醒');
const { sandbox } = loadEngines({ quiet: true });
const ENGINES = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};
const pack = createQihuangPack(ENGINES);

{
  // 先做艾灸，后说阴虚
  const store = createProfileStore({ backend: memoryBackend() });
  const agent = createQihuangAgent(pack, { store });
  const r1 = askQihuang(agent, '我在做艾灸');
  check('记艾灸时档案里有一条', () => {
    assert.deepEqual(store.listPractices().map((x) => x.ref), ['艾灸']);
  });
  check('当时还没说状况，所以不提醒', () => {
    assert.ok(!/火会加重内热/.test(r1.speech), r1.speech);
  });
  const r2 = askQihuang(agent, '我阴虚火旺');
  check('后说阴虚时提醒了', () => {
    assert.ok(/阴虚火旺的人慎灸/.test(r2.speech), r2.speech);
    assert.ok(/伤寒论/.test(r2.speech), r2.speech);
  });
  check('提醒里带出处，不是空口一句', () => {
    assert.ok(/辨太阳病脉证并治中/.test(r2.speech), r2.speech);
  });
}

{
  // 先说阴虚，后做艾灸
  const store = createProfileStore({ backend: memoryBackend() });
  const agent = createQihuangAgent(pack, { store });
  askQihuang(agent, '我阴虚火旺');
  const r = askQihuang(agent, '我在做艾灸');
  check('记艾灸时当场提醒了（而不是等他下次问药）', () => {
    assert.ok(/阴虚火旺的人慎灸/.test(r.speech), r.speech);
  });
}

console.log('\n[5] 闭嘴：不该说的时候不许说');
{
  // 阳虚的人做艾灸是对症的
  const store = createProfileStore({ backend: memoryBackend() });
  const agent = createQihuangAgent(pack, { store });
  askQihuang(agent, '我手脚冰凉');
  const r = askQihuang(agent, '我在做艾灸');
  check('阳虚 + 艾灸不提醒', () => {
    assert.ok(!/慎灸/.test(r.speech), r.speech);
  });
}
{
  // 问句不是在交代，不能记进档案
  const store = createProfileStore({ backend: memoryBackend() });
  const agent = createQihuangAgent(pack, { store });
  askQihuang(agent, '艾灸有什么好处');
  check('「艾灸有什么好处」不进档案', () => {
    assert.deepEqual(store.listPractices(), []);
  });
}
{
  // 没有 store 时要明说记不住，不能假装记下了
  const agent = createQihuangAgent(pack, { store: null });
  const r = askQihuang(agent, '我在做艾灸');
  check('没存储时明说记不住', () => {
    assert.ok(/记不住/.test(r.speech), r.speech);
  });
}

{
  // 重复说不该变成两条
  const store = createProfileStore({ backend: memoryBackend() });
  const agent = createQihuangAgent(pack, { store });
  askQihuang(agent, '我在做艾灸');
  askQihuang(agent, '我在做艾条');
  check('同一项说两次仍是一条', () => {
    assert.equal(store.listPractices().length, 1);
  });
  check('档案里存规范名，不存原话', () => {
    // 存「我在做艾灸」的话，下次复述会变成「你在做我在做艾灸」。
    assert.equal(store.listPractices()[0].name, '艾灸');
  });
}

console.log('\n' + '='.repeat(56));
console.log(`通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
