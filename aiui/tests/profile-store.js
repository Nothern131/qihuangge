// 个人档案存储层的测试。
//
// 这一层的价值全在「失败方式」上，所以断言的重点不是「能存能读」，
// 而是三件容易出错的事：
//   ① 存储写失败时必须抛，不能装作成功（否则用户以为记下了）
//   ② 两个用户共用一个存储时不能串（「把每个人分开」是产品的硬要求）
//   ③ 档案为空 / 版本变 / 数据损坏时不能崩，要退化成空档案

import assert from 'node:assert/strict';
import { createProfileStore, memoryBackend, STORE_VERSION } from '../adapter/profile-store.js';

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

console.log('\n[1] 基本读写');
const mem = memoryBackend();
const store = createProfileStore({ backend: mem, userId: 'u1' });
check('第一次读返回空档案而不是 null', () => {
  const p = store.load();
  assert.equal(p.userId, 'u1');
  assert.deepEqual(p.supplements, []);
  assert.equal(p.createdAt, null);
});
check('记一样东西之后读得到', () => {
  const r = store.rememberItem('钙片', 'nutrient', 'calcium');
  assert.equal(r.added, true);
  const list = store.listItems();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, '钙片');
  assert.equal(list[0].ref, 'calcium');
});
check('写入后有 createdAt / updatedAt', () => {
  const p = store.load();
  assert.ok(p.createdAt, 'createdAt 为空');
  assert.ok(p.updatedAt, 'updatedAt 为空');
  assert.equal(p.version, STORE_VERSION);
});

console.log('\n[2] 去重');
check('同名再加一次不重复', () => {
  const r = store.rememberItem('钙片', 'nutrient', 'calcium');
  assert.equal(r.added, false);
  assert.equal(store.listItems().length, 1);
});
check('同一个 ref 换个说法也不重复', () => {
  const r = store.rememberItem('钙', 'nutrient', 'calcium');
  assert.equal(r.added, false);
  assert.equal(store.listItems().length, 1);
});

console.log('\n[3] 用户隔离：「把每个人分开」');
// 同一条设备上两个档案（比如老人和子女共用一副眼镜），数据不能串。
const shared = memoryBackend();
const a = createProfileStore({ backend: shared, userId: 'mom' });
const b = createProfileStore({ backend: shared, userId: 'me' });
a.rememberItem('阿司匹林', 'other');
b.rememberItem('维生素C', 'nutrient', 'vitamin-c');
check('a 只看到自己的', () => {
  const names = a.listItems().map((x) => x.name);
  assert.deepEqual(names, ['阿司匹林']);
});
check('b 只看到自己的', () => {
  const names = b.listItems().map((x) => x.name);
  assert.deepEqual(names, ['维生素C']);
});
check('清空 a 不影响 b', () => {
  a.wipe();
  assert.equal(a.listItems().length, 0);
  assert.equal(b.listItems().length, 1);
});

console.log('\n[4] 存储写失败必须抛，不能装作成功');
// 这是这一层最重要的一条。官方文档写明 storage 不可用时同步方法直接 throw，
// 如果这里吞掉，用户会以为自己记下了，三个月后才发现什么都没有。
const brokenBackend = {
  get: () => undefined,
  set: () => { throw new Error('storage unavailable'); },
  remove: () => {},
};
const broken = createProfileStore({ backend: brokenBackend, userId: 'x' });
check('写不进去时 rememberItem 抛错', () => {
  assert.throws(() => broken.rememberItem('钙片', 'nutrient', 'calcium'), /storage unavailable/);
});
check('available() 返回 false 而不是假装可用', () => {
  assert.equal(broken.available(), false);
});
check('读失败不崩，退化成空档案', () => {
  const readBroken = createProfileStore({
    backend: { get: () => { throw new Error('boom'); }, set: () => {}, remove: () => {} },
    userId: 'x',
  });
  const p = readBroken.load();
  assert.deepEqual(p.supplements, []);
});
check('历史写失败不阻断言本次回答', () => {
  const onlyHistoryBroken = createProfileStore({
    backend: { get: () => undefined, set: () => { throw new Error('full'); }, remove: () => {} },
    userId: 'x',
  });
  // pushHistory 是唯一允许吞异常的地方：它失败不影响用户这一次问的问题。
  assert.doesNotThrow(() => onlyHistoryBroken.pushHistory('附子有毒吗'));
});

console.log('\n[5] 怪数据不能崩');
check('存的是字符串也能读（wx 存的就是 JSON 串）', () => {
  const s = memoryBackend();
  s.set('qihuang:profile:v1:str', JSON.stringify({ version: 1, userId: 'str', supplements: [{ name: '铁' }] }));
  const st = createProfileStore({ backend: s, userId: 'str' });
  assert.equal(st.listItems().length, 1);
});
check('损坏的 JSON 退化成空档案', () => {
  const s = memoryBackend();
  s.set('qihuang:profile:v1:bad', '{不是JSON');
  const st = createProfileStore({ backend: s, userId: 'bad' });
  assert.deepEqual(st.listItems(), []);
});
check('版本不一致按空档案处理，不硬套旧结构', () => {
  const s = memoryBackend();
  s.set('qihuang:profile:v1:old', { version: 0, supplements: [{ name: '旧数据' }] });
  const st = createProfileStore({ backend: s, userId: 'old' });
  assert.deepEqual(st.listItems(), []);
});
check('没接 backend 时当场报错', () => {
  assert.throws(() => createProfileStore({}), /backend/);
});

console.log('\n[6] 上限');
check('历史不会无限长', () => {
  const s = memoryBackend();
  const st = createProfileStore({ backend: s, userId: 'h' });
  for (let i = 0; i < 80; i += 1) st.pushHistory(`问题${i}`);
  const h = st.getHistory();
  assert.equal(h.length, 50, `实际 ${h.length}`);
  assert.equal(h[h.length - 1].q, '问题79');
});

console.log('\n[7] 交叉核对用的查得到');
check('按 ref 找得到用户记着的东西', () => {
  const s = memoryBackend();
  const st = createProfileStore({ backend: s, userId: 'c' });
  st.rememberItem('钙片', 'nutrient', 'calcium');
  assert.equal(st.findItemByRef('calcium').name, '钙片');
  assert.equal(st.findItemByRef('iron'), null);
  assert.equal(st.findItemByRef(null), null);
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) {
  console.log('存在失败');
  process.exit(1);
}
console.log('全部通过');
