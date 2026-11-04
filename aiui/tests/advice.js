// 个人状况 × 本草禁忌的测试。
//
// 这一层最怕两种错，方向相反：
//   ① 该说的没说——用户说过脾胃虚寒，查黄连时没提一句
//   ② 不该说的乱说——用户说脾胃虚寒，查人参也硬凑一句「注意」
//
// ② 比 ① 更伤：一个总在提醒的助手，三天后就被静音了。
// 所以这里既断言「命中要说」，也断言「没命中必须闭嘴」。

import assert from 'node:assert/strict';
import { extractStates, cautionsFor, cautionSpeech, cautionLine } from '../adapter/advice.js';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';

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
function eq(label, actual, expected) {
  check(`${label}（期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}）`, () => {
    assert.deepEqual(actual, expected);
  });
}

console.log('=== 个人状况 × 本草禁忌 ===');

// ── 状况识别 ────────────────────────────────────────────
console.log('\n[1] 口语 → 状况标签，词必须和本草禁忌里的用词对得上');

const STATE_CASES = [
  ['我脾胃虚寒', 'spleen-cold'],
  ['我胃怕凉', 'spleen-cold'],
  ['吃凉的不舒服', 'spleen-cold'],
  ['我在备孕', 'pregnancy'],
  ['湿气重', 'damp'],
  ['舌苔厚腻', 'damp'],
  ['我总是手脚冰凉', 'yang-deficiency'],
  ['容易上火', 'yin-deficiency'],
];
const badState = [];
for (const [text, want] of STATE_CASES) {
  const got = extractStates(text);
  if (!got.some((x) => x.key === want)) badState.push([text, want, got.map((x) => x.key)]);
}
eq('8 种口语都能归到标签', badState, []);

eq('无关的话不产出状况', extractStates('今天天气不错'), []);

// ── 匹配 ────────────────────────────────────────────────
console.log('\n[2] 匹配只做文本命中，不做推理');

const SPLEEN = ['脾胃虚寒者慎用'];
const states = extractStates('我脾胃虚寒');
eq('命中：脾胃虚寒 × 黄连的禁忌', cautionsFor(SPLEEN, states).length, 1);
eq('库里没写这类就不说', cautionsFor(['阳虚热盛者忌服'], states), []);
eq('禁忌列表为空时不说', cautionsFor([], states), []);
eq('没有状况时不说', cautionsFor(SPLEEN, []), []);

// 命中的那句话，必须原样来自库里的禁忌，不能改写成「建议」
check('引用的是库里原话，不是加工过的建议', () => {
  const hits = cautionsFor(SPLEEN, states);
  assert.equal(hits[0].line, '脾胃虚寒者慎用');
});

check('主语是「本草库标注」，不是「你不能」', () => {
  const s = cautionSpeech('黄连', cautionsFor(SPLEEN, states));
  assert.ok(/本草库标注/.test(s), s);
  assert.ok(!/你不能|不可以|禁止/.test(s), s);
});

// ── 端到端 ──────────────────────────────────────────────
console.log('\n[3] 端到端：说过状况，问药时要提一句');

const { sandbox } = loadEngines({ quiet: true });
const ENGINES = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};
const pack = createQihuangPack(ENGINES);
const store = createProfileStore({ backend: memoryBackend() });
const agent = createQihuangAgent(pack, { store });

const c1 = askQihuang(agent, '我脾胃虚寒');
eq('状况走的是 concern 意图', c1.intent, 'concern');
check('答复里说清了记下什么', () => {
  assert.ok(/脾胃虚寒/.test(c1.speech), c1.speech);
});

const q1 = askQihuang(agent, '黄连有什么功效');
check('问黄连时要提脾胃虚寒', () => {
  assert.ok(/脾胃虚寒者慎用/.test(q1.speech), q1.speech);
  assert.ok(/你之前说过脾胃虚寒/.test(q1.speech), q1.speech);
});

// ② 不该说的要说：人参的禁忌是「阳虚热盛」「孕妇慎用」，和脾胃虚寒无关
const q2 = askQihuang(agent, '人参有什么功效');
check('人参不能硬凑一句提醒（禁忌对不上就是不说）', () => {
  assert.ok(!/你说过|本草库标注/.test(q2.speech), q2.speech);
});

// 没说过状况的用户，问什么都不该多话
const clean = createQihuangAgent(pack, { store: createProfileStore({ backend: memoryBackend() }) });
const q3 = askQihuang(clean, '黄连有什么功效');
check('没有状况档案时不多话', () => {
  assert.ok(!/你之前说过|本草库标注/.test(q3.speech), q3.speech);
});

// 带药名的状况陈述要放去查询，不能只记个状况就完事
const q4 = askQihuang(agent, '我胃寒能吃黄连吗');
eq('带问句的不吞成状况记录', q4.intent, 'ask');
check('而且要把提醒带出来', () => {
  assert.ok(/脾胃虚寒者慎用/.test(q4.speech), q4.speech);
});

// 屏幕也要有一行：只进播报的话，回头在屏幕上找不到
check('屏幕正文里有那条提醒', () => {
  const t = q1.result && q1.result.screenText;
  assert.ok(/注意：黄连/.test(t || ''), t);
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
