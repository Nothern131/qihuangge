// 「记住」这条链路的测试。
//
// 这是产品区别于「查询工具」的唯一一处：它记得你，下次会主动提。
// 所以断言的核心不是「能存」，而是三件容易做成假象的事：
//   ① 存不上时必须说「没记上」，绝不能说「记下了」
//   ② 没有存储能力时必须明说，不能装作记住了
//   ③ 提示只在真有数据时说，不为了显得聪明硬凑

import assert from 'node:assert/strict';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';

const { sandbox } = loadEngines({ quiet: true });
const ENGINES = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};

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
    console.log(`          ${err && err.message}`);
  }
}

/** 造一个带存储的 agent，每个用例互不干扰 */
function freshAgent(userId = 'me') {
  const pack = createQihuangPack(ENGINES);
  const store = createProfileStore({ backend: memoryBackend(), userId });
  return { pack, store, agent: createQihuangAgent(pack, { store }) };
}

const ask = (a, t) => askQihuang(a, t);

console.log('\n[1] 记住一样东西');
{
  const { store, agent } = freshAgent();
  const r = ask(agent, '记一下我在吃钙片');
  check('答复是「记下了」', () => {
    assert.equal(r.verdict, 'answer', `verdict=${r.verdict} speech=${r.speech}`);
    assert.ok(/记下/.test(r.speech), r.speech);
    assert.ok(!/不在本草库|没收录/.test(r.speech), r.speech);
  });
  check('存的是规范名「钙」而不是原话「钙片」', () => {
    // 存原话的话，下次拿 ref 去交叉核对永远对不上，「记住」就成了摆设。
    const items = store.listItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].name, '钙');
    assert.equal(items[0].ref, 'calcium');
    assert.equal(items[0].kind, 'nutrient');
  });
  check('记药材也存得下', () => {
    ask(agent, '记一下我在吃丹参');
    const herb = store.listItems().find((x) => x.name === '丹参');
    assert.ok(herb, '没存上');
    assert.equal(herb.kind, 'herb');
  });
  check('同一句再说一次不重复存', () => {
    const before = store.listItems().length;
    const r2 = ask(agent, '记一下我在吃钙片');
    assert.equal(store.listItems().length, before);
    assert.ok(/已经记着/.test(r2.speech), r2.speech);
  });
}

console.log('\n[2] 下次会主动提（这才是「越用越懂你」）');
{
  const { agent } = freshAgent();
  ask(agent, '记一下我在吃钙片');
  const r = ask(agent, '铁有什么作用');
  check('问铁时提醒钙铁要间隔', () => {
    assert.equal(r.verdict, 'answer', `verdict=${r.verdict}`);
    assert.ok(/记着在吃/.test(r.speech), r.speech);
    assert.ok(/间隔|分开/.test(r.speech), r.speech);
  });
  check('提示里仍保留主答案和出处', () => {
    assert.ok(/构成血红蛋白|运输氧气/.test(r.speech), r.speech);
    assert.ok(/现代营养学/.test(r.result.source || ''), r.result.source);
  });
  check('问的就是记着的那一样时不重复提醒', () => {
    const r2 = ask(agent, '钙有什么作用');
    assert.ok(!/你记着在吃/.test(r2.speech), r2.speech);
  });
}
{
  const { agent } = freshAgent();
  ask(agent, '记一下我在吃丹参');
  const r = ask(agent, '黄芪有什么功效');
  check('问另一味药时提醒可以先查配伍', () => {
    assert.ok(/记着在吃丹参/.test(r.speech), r.speech);
    assert.ok(/能不能一起用/.test(r.speech), r.speech);
  });
  check('不替用户下配伍结论', () => {
    // 只认出一味药就说「不能一起用」是没有依据的，只能说「去查一下」。
    assert.ok(!/不能同用|属于十八反|配伍禁忌/.test(r.speech), r.speech);
  });
}

console.log('\n[3] 没有存储能力时，必须明说');
{
  const pack = createQihuangPack(ENGINES);
  const agentNoStore = createQihuangAgent(pack); // 不传 store，模拟设备不支持
  const r = ask(agentNoStore, '记一下我在吃钙片');
  check('走拒绝档，说清存不了', () => {
    assert.equal(r.verdict, 'stop', `verdict=${r.verdict}`);
    assert.ok(/没法保存|记不住/.test(r.speech), r.speech);
    assert.ok(!/记下了/.test(r.speech), r.speech);
  });
}

console.log('\n[4] 存不上时必须说「没记上」');
{
  const pack = createQihuangPack(ENGINES);
  const badStore = createProfileStore({
    backend: { get: () => undefined, set: () => { throw new Error('磁盘写满'); }, remove: () => {} },
    userId: 'x',
  });
  const agent = createQihuangAgent(pack, { store: badStore });
  const r = ask(agent, '记一下我在吃钙片');
  check('不假装记下了', () => {
    assert.notEqual(r.verdict, 'answer', `verdict=${r.verdict}`);
    assert.ok(!/^记下了/.test(r.speech), r.speech);
  });
  check('说清是没记上', () => {
    assert.ok(/没记上|没存上/.test(r.speech), r.speech);
  });
}

console.log('\n[5] 档案隔离：换个用户看不到别人的');
{
  const backend = memoryBackend();
  const pack = createQihuangPack(ENGINES);
  const mom = createProfileStore({ backend, userId: 'mom' });
  const me = createProfileStore({ backend, userId: 'me' });
  const agentMom = createQihuangAgent(pack, { store: mom });
  ask(agentMom, '记一下我在吃钙片');
  const r = askQihuang(createQihuangAgent(pack, { store: me }), '铁有什么作用');
  check('别人的档案不会出现在我的答复里', () => {
    assert.ok(!/你记着在吃/.test(r.speech), r.speech);
  });
}

// ── 跨句记忆：历史与指代 ─────────────────────────────────
console.log('\n[跨句] 记住刚才问什么，「上次那个」要能对上');

{
  const backend = memoryBackend();
  const store = createProfileStore({ backend });
  const agent = createQihuangAgent(createQihuangPack(ENGINES), { store });

  askQihuang(agent, '甘草有毒吗');
  askQihuang(agent, '当归有什么功效');

  check('每一问都记进历史，不是只写不读', () => {
    const h = store.getHistory();
    assert.equal(h.length, 2, JSON.stringify(h));
    assert.equal(h[0].q, '甘草有毒吗');
  });

  // 指代补全：历史里最近一条能认出药名的是「当归有什么功效」，
  // 所以「上次那个」应该补成当归，而不是从头开始答「没听出药名」。
  const r = askQihuang(agent, '上次那个有毒吗');
  check('「上次那个」补成上一次问的药', () => {
    assert.ok(r.recognized.includes('当归'), JSON.stringify(r.recognized));
  });

  // 补错了比不补更糟：没有历史时，原句不能被动。
  const fresh = createQihuangAgent(createQihuangPack(ENGINES), { store: createProfileStore({ backend: memoryBackend() }) });
  const noHist = askQihuang(fresh, '上次那个有毒吗');
  // 判据不能看 recognized：切词会把「上次那个」当成一味药名（4 个汉字，像药名），
  // 那是既有兜底行为，不是这次的问题。要看的是它怎么回答——
  // 必须说「没有上次的记录」，而不是「本草库没收录上次那个」。
  check('没有历史时说「没有记录」，不说成「没收录」', () => {
    assert.ok(/没有上次的记录/.test(noHist.speech), noHist.speech);
    assert.ok(!/没收录/.test(noHist.speech), noHist.speech);
  });
}

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) {
  console.log('存在失败');
  process.exit(1);
}
console.log('全部通过');
