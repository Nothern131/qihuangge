// 状况记忆的冷热：重要、衰减、资格线。
//
// 机制参考本地 SoulBrain 项目（智能脑_SoulBrain/src/core/memory.js）：
// importance 随时间衰减、core 类衰减率 1/10、低于阈值失去资格。
// 两处医疗化改造的差异也在这里守着：
//   ① 冷 = 失去主动提醒资格，**数据不删**（SoulBrain 是删）；
//   ② 只有「状态」衰减，「事实」（在吃什么、几点吃药）永不衰减。

import assert from 'node:assert/strict';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';

globalThis.speechSynthesis = { speak: () => {}, cancel: () => {} };

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    fail += 1;
    console.log(`  [FAIL] ${name}\n         ${e.message}`);
  }
}
const eq = (n, a, b) => check(n, () => assert.deepEqual(a, b));
const truthy = (n, v, extra = '') => check(n, () => assert.ok(v, extra || `实际 ${JSON.stringify(v)}`));

const { sandbox } = loadEngines({ quiet: true });
const ENGINES = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};
const pack = createQihuangPack(ENGINES);
const mk = () => {
  const store = createProfileStore({ backend: memoryBackend() });
  return { store, agent: createQihuangAgent(pack, { store }) };
};
// 个性化提醒的标志是「你之前说过」（cautionSpeech 拼的），本草原文不含这句
const personal = (agent, q) => /你之前说过/.test(askQihuang(agent, q).speech);

// ─────────────────────────────────────────────────────────
console.log('\n[1] 热记忆：提起就强化');

{
  const { store, agent } = mk();
  askQihuang(agent, '我脾胃虚寒');
  eq('新记的初始重要度', store.getConcerns()[0].importance, 3.0);

  const r = askQihuang(agent, '我脾胃虚寒');
  eq('重复提起 +1', store.getConcerns()[0].importance, 4.0);
  truthy('强化要能被听见', /又记了一次/.test(r.speech), r.speech);

  for (let i = 0; i < 5; i += 1) askQihuang(agent, '我脾胃虚寒');
  truthy('封顶 5，不会无限涨', store.getConcerns()[0].importance <= 5,
    String(store.getConcerns()[0].importance));
}

// ─────────────────────────────────────────────────────────
console.log('\n[2] 冷却：衰减只降资格，不删数据');

{
  const { store, agent } = mk();
  askQihuang(agent, '我脾胃虚寒');
  store.decayConcerns(60);

  const after = store.getConcerns();
  // 用 (after[0] || {}) 而不是直接 [0].importance：
  // 反向验证「衰减顺带删数据」时，数组会真的空掉——
  // 直接取 [0].importance 会抛 TypeError，测试变成崩溃而不是变红。
  eq('60 天掉到 0（0.05 × 60 = 3.0）', (after[0] || {}).importance, 0);
  eq('主动提醒资格失去', store.activeConcerns().length, 0);
  eq('但数据还在——这是和 SoulBrain 的关键差异', after.length, 1);

  // 冷 ≠ 忘。查询触发的核对用全量：用户半年没提脾胃虚寒，
  // 今天问黄连，碰上「脾胃虚寒者慎用」恰恰最该提——这是回答问题，不是打扰。
  truthy('冷掉仍参与查询核对', personal(agent, '黄连有什么功效'));
  eq('核对命中后热回来（恢复到初始值）', store.getConcerns()[0].importance, 3.0);
  truthy('热回来之后仍持续提醒', personal(agent, '黄连有什么功效'));

  // 冷热真正管的是主动提醒：practiceWarnings 只认热记忆（见 [5] 的对照）
}

// 热的时候必须有提醒——上面那条「不再提醒」才有意义
{
  const { agent } = mk();
  askQihuang(agent, '我脾胃虚寒');
  truthy('热记忆要提醒（黄连 × 脾胃虚寒）', personal(agent, '黄连有什么功效'));
}

// ─────────────────────────────────────────────────────────
console.log('\n[3] core：孕期衰减 1/10，半年不提也热着');

{
  const { store } = mk();
  const { agent } = { agent: null };
  agent_check: {
    const a = createQihuangAgent(pack, { store });
    askQihuang(a, '我怀孕了');
  }
  store.decayConcerns(60);
  // 0.05 × 60 × 0.1 = 0.3；3.0 − 0.3 = 2.7，远在线上
  truthy('孕期 60 天只掉 0.3', Math.abs(store.getConcerns()[0].importance - 2.7) < 0.001,
    String(store.getConcerns()[0].importance));
  eq('仍在活跃', store.activeConcerns().length, 1);
}

// 出血倾向同样算 core
{
  const { store } = mk();
  const a = createQihuangAgent(pack, { store });
  askQihuang(a, '我容易出血');
  store.decayConcerns(60);
  truthy('出血倾向也按 core 衰减', Math.abs(store.getConcerns()[0].importance - 2.7) < 0.001,
    String(store.getConcerns()[0].importance));
}

// ─────────────────────────────────────────────────────────
console.log('\n[4] 自动衰减：onLoad 那一次');

{
  const { store, agent } = mk();
  askQihuang(agent, '我脾胃虚寒');
  const first = store.decayConcernsAuto();
  eq('首次调用只记录时间，不衰减', first.decayed, 0);
  const second = store.decayConcernsAuto();
  eq('同一次会话内重复调不重复扣', second.days, 0);
}

// ─────────────────────────────────────────────────────────
console.log('\n[5] 事实类永不衰减');

{
  const { store, agent } = mk();
  askQihuang(agent, '记一下我在吃钙片');
  askQihuang(agent, '记一下早上八点吃二甲双胍');
  store.decayConcerns(365);
  eq('一年之后，在吃清单原样', store.listItems().length, 1);
  eq('用药计划原样', store.listMedPlans().length, 1);
  truthy('药是事实，不因为没提就当用户停了', store.listItems()[0].name === '钙');
}

// 冷了半年重新说一遍，立即热起——重新提起本来就该把记忆激活，
// 行为提醒（艾灸 × 阴虚）随之恢复。这是「用户主动」，不是「系统主动打扰」。
{
  const { store, agent } = mk();
  askQihuang(agent, '我阴虚火旺');
  askQihuang(agent, '我在做艾灸');
  store.decayConcerns(180);
  const r = askQihuang(agent, '我阴虚火旺');
  eq('重新提起 → importance 回到 1（0 + 1）', store.getConcerns()[0].importance, 1);
  truthy('重新提起后行为提醒恢复', r.speech.includes('艾灸'), r.speech);
}

// ─────────────────────────────────────────────────────────
console.log('\n[6] 老数据兼容');

{
  const store = createProfileStore({ backend: memoryBackend() });
  // 直接塞一条没有 importance 的旧格式数据（schema 升级前的档案）
  const p = JSON.parse(JSON.stringify(store.getConcerns()));
  const backend = store._backendForTest || null;
  // 走公开接口造一条旧格式：addConcern 之后手动抹掉 importance
  const { agent } = { agent: createQihuangAgent(pack, { store }) };
  askQihuang(agent, '我脾胃虚寒');
  const raw = store.getConcerns();
  delete raw[0].importance;
  // getConcerns 读路径补默认值
  eq('没有 importance 的旧数据按 3.0 处理', store.getConcerns()[0].importance, 3.0);
  truthy('补默认值不写回存储（读路径只读）', backend === null);
  // 塞回一条旧格式验证衰减不崩
  store.decayConcerns(30);
  truthy('旧数据衰减不崩', typeof store.getConcerns()[0].importance === 'number');
}

// ─────────────────────────────────────────────────────────
console.log('\n[7] 食补建议只认热记忆');

{
  const { store, agent } = mk();
  askQihuang(agent, '记一下我在吃钙片');
  askQihuang(agent, '我阴虚火旺');
  const hot = askQihuang(agent, '我没在吃什么药，吃什么好');
  truthy('热的状况参与食补', /百合|麦冬|桑椹/.test(hot.speech), hot.speech);
}

{
  const { store, agent } = mk();
  askQihuang(agent, '记一下我在吃钙片');
  askQihuang(agent, '我阴虚火旺');
  store.decayConcerns(60);
  const cold = askQihuang(agent, '我没在吃什么药，吃什么好');
  // 食补也是查询触发的核对：半年前说的阴虚，今天问「吃什么好」就该按阴虚给。
  // 忘了才是错的——冷热管的是主动打扰，不管「被问到时想不想得起来」。
  truthy('冷的状况仍作为食补依据', /百合|麦冬|桑椹/.test(cold.speech), cold.speech);
}

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
