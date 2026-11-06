/**
 * 「这味怎么弄着吃」的回归测试。
 *
 * 这一层是从用户实测长出来的：原来问「酸枣仁怎么吃」被回「用量我不给建议」——
 * 用户问的是做法，系统当成了问剂量。这组断言守住三件事：
 *   ① 问做法不能被当成问剂量
 *   ② 三层来源各标各的，不能混成「药典说这样吃」
 *   ③ 有毒的必须先说禁忌，再讲怎么做
 */
import assert from 'node:assert';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';
import { pickShiliao, commonHow } from '../adapter/recipe.js';
import { FOODS } from '../adapter/food-canon.js';

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    fail++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err.message}`);
  }
}

const { sandbox } = loadEngines({ quiet: true });
const pack = createQihuangPack({
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
});
const mk = () => createQihuangAgent(pack, { store: createProfileStore({ backend: memoryBackend() }) });

console.log('[1] 「怎么吃」不是问剂量');
{
  const agent = mk();
  for (const q of ['酸枣仁怎么吃', '山药怎么弄着吃', '山楂怎么做着吃', '百合怎么用']) {
    const r = askQihuang(agent, q);
    check(`${q} → 走做法而不是剂量拒答`, () => {
      assert.equal(r.intent, 'howto', `intent=${r.intent} speech=${r.speech}`);
      assert.ok(!/用量我不给建议/.test(r.speech || ''), r.speech);
    });
  }
}

console.log('\n[2] 三层来源各归各位');
{
  const agent = mk();
  const r = askQihuang(agent, '山药怎么吃');
  check('山药有食疗本草原文', () => {
    assert.ok(/食疗本草/.test(r.speech || ''), r.speech);
    assert.ok(/熟煮和蜜|为汤煎|为粉/.test(r.speech || ''), r.speech);
  });
  check('山药有常见吃法', () => {
    assert.ok(/常见吃法/.test(r.speech || ''), r.speech);
  });
  check('药典用量在', () => {
    assert.ok(/15~30g/.test(r.speech || ''), r.speech);
  });
}

console.log('\n[3] 有毒的先说禁忌');
{
  const agent = mk();
  const r = askQihuang(agent, '苦杏仁怎么吃');
  check('苦杏仁的禁忌排在前半句', () => {
    const s = String(r.speech || '');
    const i = s.indexOf('中毒');
    assert.ok(i >= 0, s);
    assert.ok(i < s.length / 2, `禁忌出现在第 ${i} 字，太后了：${s}`);
  });
  check('有毒的不给通用吃法', () => {
    assert.equal(commonHow('苦杏仁', FOODS['苦杏仁']), '');
    assert.equal(commonHow('白果', FOODS['白果']), '');
  });
}

console.log('\n[4] 古籍做法只挑真能照着做的');
{
  // 治病方剂、炮制、外用一律不进
  const cases = [
    ['酸枣', /分服|煮取.{0,4}升|为散|每服/, '汤剂不进'],
    ['牡蛎', /火上炙|炮|煅/, '炮制不进'],
  ];
  for (const [name, bad, why] of cases) {
    check(`${name}：${why}`, () => {
      const r = pickShiliao(name);
      if (r) assert.ok(!bad.test(r.text), `挑到了不该展示的：${r.text}`);
    });
  }
  check('山药挑到的做法句可照做', () => {
    const r = pickShiliao('山药');
    assert.ok(r && r.cookable, JSON.stringify(r));
    assert.ok(/熟煮|汤煎|作粉/.test(r.text), r.text);
  });
}

console.log('\n[5] 查不到就说查不到');
{
  const agent = mk();
  const r = askQihuang(agent, '血竭怎么吃');
  check('未收录的药不编做法', () => {
    assert.ok(!/常见吃法是炖汤|常见吃法是煮粥/.test(r.speech || ''), r.speech);
  });
}

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail) {
  console.error('存在失败');
  process.exit(1);
}
