// 《本草纲目》谷/菜/果部数据（adapter/gm-canon.js）的守门测试。
//
// 这份数据的风险不在错字，在**性质**：它是 1596 年的书，里面的说法多数没有经过
// 现代验证（「合鲤鱼鲊食，久则令人肝黄成渴病」既没验证过也没法验证）。
// 一旦用户把它当成现行结论，这个应用就从「查资料」变成了「拿古籍开方」。
//
// 所以这里守的是四件事：
//   ① 每一条都带着「古籍记载，未经现代验证」这句话，一条都不能漏
//   ② 药典/本草库有的，绝不许走古籍这条路（现行标准永远排前面）
//   ③ 古籍不参与配伍判断——问「绿豆和 X 能一起吃吗」不许拿本草纲目当依据
//   ④ 单字食材认得出来（梨、桃、李、杏……），这是加词表的理由
//
// 运行：node tests/ancient.js

import assert from 'node:assert/strict';
import { GM_ITEMS, GM_SOURCE, GM_NOTE, gmOf, gmWords } from '../adapter/gm-canon.js';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangView, SCREEN_BUDGET } from '../ui/qihuang-view.js';
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

const NAMES = gmWords();

console.log('[1] 数据规模与完整');
check('收录 294 味', () => assert.equal(NAMES.length, 294));
check('每条都有气味、出处卷次', () => {
  const bad = NAMES.filter((n) => !GM_ITEMS[n].qi || !GM_ITEMS[n].vol);
  assert.deepEqual(bad, []);
});
check('卷次只用谷部/菜部/果部', () => {
  const ok = new Set(['谷部', '菜部', '果部']);
  const bad = NAMES.filter((n) => !ok.has(GM_ITEMS[n].vol));
  assert.deepEqual(bad, []);
});
check('不含繁体残留（转简体时漏掉的字）', () => {
  // 只列**简繁不同形**的字。「味」「毒」这种两边写法一样，
  // 放进字符类会把每一条都判成残留——第一次写这条断言就栽在这上面。
  const bad = NAMES.filter((n) => /[氣無藥熱腸補虛綠黃當歸麥棗薑]/.test(
    n + GM_ITEMS[n].qi + (GM_ITEMS[n].zhi || ''),
  ));
  assert.deepEqual(bad, []);
});
check('不许有竖排冒号这类排版字符', () => {
  const bad = NAMES.filter((n) => /[︰﹕]/.test(GM_ITEMS[n].qi + (GM_ITEMS[n].zhi || '')));
  assert.deepEqual(bad, []);
});

console.log('\n[2] 性质：每一条都必须带「未经现代验证」');
check('GM_NOTE 写明了是古籍且未经验证', () => {
  assert.ok(/古籍/.test(GM_NOTE) && /(未|没有).*验证/.test(GM_NOTE), GM_NOTE);
});
check('GM_SOURCE 指明了朝代和年份', () => {
  assert.ok(/本草纲目/.test(GM_SOURCE) && /1596/.test(GM_SOURCE), GM_SOURCE);
});
check('绿豆那条被截断的原文已经补全', () => {
  // 维基文库版断在「合鲤鱼」，四库全书本是「合鲤鱼鲊食，久则令人肝黄成渴病」
  const qi = gmOf('绿豆').qi;
  assert.ok(/合鲤鱼鲊食/.test(qi) && /肝黄成渴病/.test(qi), qi);
});
check('认不出就说认不出', () => {
  for (const q of ['人参', '西洋参', '★☆※', '']) {
    // 人参在药典里，不该出现在这本古籍的谷菜果部数据里
    assert.equal(gmOf(q), null, `${q} 不该有结果`);
  }
});

console.log('\n[3] 单字食材认得出来');
// 本草纲目里梨、桃、李、杏都是单字条目。不加词表的话，
// 切词器认不出「梨」，后面「像不像药名（≥2 字）」再筛一次，
// 用户问「梨有什么功效」只会得到「没听出药名」。
for (const n of ['梨', '桃', '李', '杏', '梅', '枣', '栗', '橘', '柚', '柿']) {
  check(`收录了单字条目 ${n}`, () => assert.ok(GM_ITEMS[n], `${n} 不在表里`));
}

console.log('\n[4] 端到端：药典优先，古籍只在没有现代数据时出来');
const { sandbox } = loadEngines({ quiet: true });
const ENGINES = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};
const pack = createQihuangPack(ENGINES);
const store = createProfileStore({ backend: memoryBackend() });
const view = createQihuangView({ engines: ENGINES, store });

const ld = view.handle('绿豆有什么功效');
check('绿豆能查到', () => {
  assert.ok(/绿豆/.test(ld.patch.answer), ld.patch.answer);
});
check('先说药典没有收载', () => {
  assert.ok(/《中国药典》没有收载/.test(ld.patch.answer), ld.patch.answer);
});
check('再说本草纲目哪一部', () => {
  assert.ok(/本草纲目·谷部/.test(ld.patch.answer), ld.patch.answer);
});
check('最后一句必须是「未经现代验证」', () => {
  assert.ok(/未经现代验证/.test(ld.patch.answer), ld.patch.answer);
});
check('出处行标了古籍', () => {
  assert.ok(/古籍/.test(ld.patch.source || ''), ld.patch.source);
});

// 药典收载的品种绝不能走古籍那条路
const dz = view.handle('大枣有什么功效');
check('药典有的（大枣）不走古籍', () => {
  assert.ok(!/本草纲目/.test(dz.patch.answer), dz.patch.answer);
  assert.ok(/中国药典/.test(dz.patch.source || ''), dz.patch.source);
});

// 屏幕预算：古籍的原文很长，必须压进一屏
const over = [];
for (const n of ['绿豆', '梨', '桃', '莱菔', '韭']) {
  const t = view.handle(`${n}有什么功效`);
  const len = String(t.patch.answer || '').length;
  if (len > SCREEN_BUDGET) over.push([n, len]);
}
check(`古籍答复全部压进 ${SCREEN_BUDGET} 字`, () => assert.deepEqual(over, []));

console.log('\n[5] 古籍不参与判断');
// 这一条是这份数据的边界：能查、能读原文，但不能拿去下结论。
check('「绿豆和甘草能一起吃吗」不拿本草纲目当依据', () => {
  const r = pack.invoke('ask', { text: '绿豆和甘草能一起吃吗', query: '绿豆和甘草能一起吃吗' });
  const t = String(r.screenText || r.speech || '');
  assert.ok(!/本草纲目/.test(t), t);
});
check('单味食材不会被当成配伍禁忌的来源', () => {
  // 「绿豆」出现在药的配伍里时，结论只能来自药典/歌诀，不能来自古籍
  const r = pack.invoke('ask', { text: '绿豆和藜芦能一起用吗', query: '绿豆和藜芦能一起用吗' });
  const t = String(r.screenText || r.speech || '');
  assert.ok(!/本草纲目/.test(t), t);
});

console.log('\n' + '='.repeat(56));
console.log(`通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
