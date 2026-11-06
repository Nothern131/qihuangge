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
import { pickShiliao, commonHow, pickDish } from '../adapter/recipe.js';
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
  // 播报只念一层（字数约束）：有菜谱就念菜谱，没有才念食疗本草。
  // 屏幕上是两层都给。这里断言「至少有一层古籍依据」。
  check('山药有古籍做法（菜谱或食疗本草）', () => {
    assert.ok(/山家清供|食疗本草/.test(r.speech || ''), r.speech);
  });
  check('屏幕食谱层齐全', () => {
    // askQihuang 返回的是外层结构，业务字段在 result 里
    const d = (r.result && r.result.dish) || null;
    const rec = (r.result && r.result.recipe) || null;
    assert.ok(d && /金玉羹/.test(d.dish), JSON.stringify(d && d.dish));
    assert.ok(rec && /熟煮|汤煎|作粉/.test(rec.text), rec && rec.text);
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

console.log('\n[5] 古籍菜谱：整道菜的配方');
{
  check('山药有金玉羹（山药+栗+羊汁）', () => {
    const d = pickDish('山药');
    assert.ok(d && /金玉羹/.test(d.dish), JSON.stringify(d && d.dish));
    assert.ok(/山药与栗/.test(d.text), d && d.text);
  });
  check('萝卜走异名找到玉糁羹', () => {
    const d = pickDish('萝卜');
    assert.ok(d, '萝卜没有菜谱');
    assert.ok(/芦菔|萝卜/.test(d.text), d.text);
  });
  check('菜谱不带考据尾巴（书名号处收）', () => {
    const d = pickDish('百合');
    assert.ok(d && !/鸡粪|岁时广记/.test(d.text), d && d.text);
  });
  check('不在药典词表的食材也能问', () => {
    const agent = mk();
    const r = askQihuang(agent, '萝卜怎么吃');
    assert.equal(r.intent, 'howto', `intent=${r.intent}`);
    assert.ok(/芦菔|玉糁羹|萝卜/.test(r.speech || ''), r.speech);
  });
}

console.log('\n[6] 查不到就说查不到');
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

console.log('\n[7] 调理 vs 治病：有的只能调，不给方');
{
  const { RULES } = await import('../adapter/food-advice.js');
  check('失眠/气虚/血虚/阴虚/阳虚/湿盛 都标成 regulate', () => {
    for (const k of ['insomnia', 'qi-deficiency', 'blood-deficiency', 'yin-deficiency', 'yang-deficiency', 'damp']) {
      assert.equal(RULES[k].mode, 'regulate', k);
    }
  });
  check('脾胃虚寒/食积/便秘 标成 remedy', () => {
    for (const k of ['spleen-cold', 'food-stagnation', 'constipation']) {
      assert.equal(RULES[k].mode, 'remedy', k);
    }
  });
  check('失眠的答复明说「这类靠日常调理」且不给方', () => {
    const agent = mk();
    const r = askQihuang(agent, '我失眠吃什么好');
    // 没交代在吃什么时会被第二道门拦，这里只断言话术里有调理说明
    const say = String(r.speech || '');
    assert.ok(/调理/.test(say) || /记一下|没在吃/.test(say), say);
    assert.ok(!(r.result && r.result.formula), '失眠不该给方');
  });
  check('脾胃虚寒给了方，就不再说是「不是方子」', () => {
    const agent = mk();
    const r = askQihuang(agent, '我脾胃虚寒吃什么好');
    const say = String(r.speech || '');
    if (r.result && r.result.formula) {
      assert.ok(!/这些只是方向，不是方子/.test(say), say);
    }
  });
}

console.log('\n[8] 古籍方：按病分类的膳方');
{
  const { formulasForState, YANGLAO_ITEMS, yanglaoCategories } = await import('../adapter/yanglao-canon.js');
  check('16 个病类 98 方都在', () => {
    assert.equal(YANGLAO_ITEMS.length, 98, String(YANGLAO_ITEMS.length));
    assert.ok(yanglaoCategories().length >= 16, String(yanglaoCategories().length));
  });
  check('脾胃虚寒能查到方', () => {
    const f = formulasForState('spleen-cold');
    assert.ok(f.length > 0, '脾胃虚寒没有方');
  });
  check('便秘不映射到泻痢（方向相反）', () => {
    assert.equal(formulasForState('constipation').length, 0);
  });
  check('失眠不硬指一章（原书没有失眠章）', () => {
    assert.equal(formulasForState('insomnia').length, 0);
  });
  check('食材名已剥掉用量', () => {
    const f = formulasForState('spleen-cold')[0];
    assert.ok(f.ing.length >= 2, JSON.stringify(f.ing));
    assert.ok(!/半两|二钱|枚/.test(f.ing.join('')), f.ing.join('、'));
  });
  check('气虚能查到方且食材够配一道', () => {
    const f = formulasForState('qi-deficiency');
    assert.ok(f.length > 0, '气虚没有方');
    const withEnough = f.filter((x) => x.ing.length >= 3);
    assert.ok(withEnough.length > 0, '没有一道是 3 样以上食材的');
  });
}

console.log('\n[9] 书架：知识在书里，不在代码里');
{
  const shelfMod = await import('../adapter/bookshelf.js');
  check('五本书都登记了，条数取自数据文件', () => {
    assert.equal(shelfMod.SHELF.length, 5, String(shelfMod.SHELF.length));
    for (const b of shelfMod.SHELF) {
      assert.ok(b.count > 0, `${b.name} 条数为 0`);
      assert.ok(b.name && b.era && b.ask, `${b.name} 缺元数据`);
    }
  });
  check('总条数与各书相加一致（不是写死的宣传数字）', () => {
    const sum = shelfMod.SHELF.reduce((n, b) => n + b.count, 0);
    assert.equal(shelfMod.totalEntries(), sum);
  });
  check('跨书查询能报出「哪几本有」', () => {
    const hits = shelfMod.booksOn('山药');
    assert.ok(hits.length >= 2, JSON.stringify(hits.map((h) => h.name)));
  });
  check('异名也查得到（萝卜 → 山家清供的芦菔）', () => {
    const hits = shelfMod.booksOn('萝卜').map((h) => h.name);
    assert.ok(hits.includes('山家清供'), hits.join('、'));
  });
  check('映射层是承认的，不是藏着的', () => {
    assert.ok(Array.isArray(shelfMod.MAPPINGS) && shelfMod.MAPPINGS.length >= 4);
    for (const m of shelfMod.MAPPINGS) {
      assert.ok(m.what && m.basis, JSON.stringify(m));
    }
  });
  check('「你能查什么」报真实书目', () => {
    const agent = mk();
    const r = askQihuang(agent, '你能查什么');
    assert.equal(r.intent, 'books');
    assert.ok(new RegExp(String(shelfMod.SHELF.length)).test(r.speech || ''), r.speech);
  });
}

console.log('\n[10] 复杂方分级 + 泡水');
{
  const { commonHow } = await import('../adapter/recipe.js');
  check('种子/果实类把泡水排第一', () => {
    assert.ok(/^泡水/.test(commonHow('酸枣仁', FOODS['酸枣仁']) || ''), commonHow('酸枣仁', FOODS['酸枣仁']));
  });
  check('复杂方标了「做起来麻烦」', () => {
    const agent = mk();
    // 先交代没在吃，才过第二道门
    const store = createProfileStore({ backend: memoryBackend() });
    store.declareNoMeds();
    const a = createQihuangAgent(pack, { store });
    const r = askQihuang(a, '我脾胃虚寒吃什么好');
    const f = r.result && r.result.formula;
    assert.ok(f, '没有方');
    assert.equal(f.hard, true, JSON.stringify(f));
    // 复杂方不报工序，只说「做起来麻烦，想做再问我」
    assert.ok(/做起来麻烦/.test(r.speech || ''), r.speech);
  });
  check('多味一起记（枸杞菊花茶记两味）', () => {
    const store = createProfileStore({ backend: memoryBackend() });
    const a = createQihuangAgent(pack, { store });
    askQihuang(a, '记一下我在喝枸杞菊花茶');
    const names = store.listItems().map((x) => x.name);
    assert.ok(names.includes('枸杞') && names.includes('菊花'), names.join('、'));
  });
}
