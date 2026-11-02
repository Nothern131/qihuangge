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

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) {
  console.log('存在失败');
  process.exit(1);
}
console.log('全部通过');
