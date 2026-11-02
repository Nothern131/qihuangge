// 毒性分级的回归测试。
//
// 这套测试存在的原因是一次真实的错：引擎的毒性表里**没有半夏**，
// 用户问「半夏有毒吗」，播报是「半夏在《中国药典》里标注为无毒」。
// 半夏是药典明列的「有毒」品种，还是十八反成员。
//
// 错的不是措辞，是结论，而且方向最危险——把有毒说成无毒。
// 所以这里的断言分四类：
//   ① 名单本身完整（83 种、10/42/31，少一味就红）
//   ② 全量穷举：名单里每一味都答得出等级，且答复里不出现「无毒」
//   ③ 引擎的错不再犯（半夏、白果有等级；野菊花、桃仁不在名单——
//      它们的答复也不能倒过来变成「有毒」）
//   ④ 名单外不说「无毒」：不在名单只说明药典没列为毒性药材，不说明安全

import assert from 'node:assert/strict';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import {
  CANON_HERBS, CANON_SIZE, toxicityOf, normalizeToxin, NOT_LISTED, DIFF,
} from '../adapter/toxicity-canon.js';

const { sandbox } = loadEngines({ quiet: true });
const pack = createQihuangPack({
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
});

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
function equal(label, actual, expected) {
  check(`${label}（期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}）`, () => {
    assert.deepEqual(actual, expected);
  });
}
const ask = (t) => pack.invoke('ask', { text: t, query: t });

console.log('=== 毒性分级（《中国药典》2020 版 83 种名单）===');

// ── 名单本身 ────────────────────────────────────────────
console.log('\n[1] 名单完整：少一味就等于把那味药放行了');

equal('大毒 10 种', CANON_SIZE.大毒, 10);
equal('有毒 42 种', CANON_SIZE.有毒, 42);
equal('小毒 31 种', CANON_SIZE.小毒, 31);
equal('合计 83 种', CANON_SIZE.total, 83);
equal('没有重名的药', CANON_HERBS.length, new Set(CANON_HERBS).size);

// ── 全量穷举 ────────────────────────────────────────────
console.log('\n[2] 名单里的每一味，都要答得出等级');

const noLevel = [];
const saidHarmless = [];
for (const h of CANON_HERBS) {
  const t = toxicityOf(h);
  if (!t || !t.level) {
    noLevel.push(h);
    continue;
  }
  const r = ask(`${h}有毒吗`);
  const s = r.speech || '';
  // 「无毒」这两个字在任何毒性答复里都不该出现——
  // 名单里的药答「无毒」就是半夏那个错，名单外的药答「无毒」是把没列入说成安全。
  if (/无毒/.test(s)) saidHarmless.push([h, s]);
}
equal('全部 83 种都查得到等级', noLevel, []);
equal('答复里不出现「无毒」', saidHarmless, []);

// ── 等级准确 ────────────────────────────────────────────
console.log('\n[3] 等级不能错配：错一级就会说重或说轻');

const LEVEL_CASES = [
  ['半夏', '有毒'], ['白果', '有毒'], ['朱砂', '有毒'], ['雄黄', '有毒'],
  ['全蝎', '有毒'], ['蜈蚣', '有毒'], ['洋金花', '有毒'], ['蟾酥', '有毒'],
  ['山豆根', '有毒'], ['附子', '有毒'], ['甘遂', '有毒'],
  ['巴豆', '大毒'], ['天仙子', '大毒'], ['红粉', '大毒'], ['川乌', '大毒'],
  ['草乌', '大毒'], ['马钱子', '大毒'], ['斑蝥', '大毒'], ['闹羊花', '大毒'],
  ['苦杏仁', '小毒'], ['桃仁_占位', null], ['土鳖虫', '小毒'], ['吴茱萸', '小毒'],
  ['红大戟', '小毒'], ['重楼', '小毒'], ['急性子', '小毒'], ['水蛭', '小毒'],
];
const wrongLevel = [];
for (const [h, want] of LEVEL_CASES) {
  if (!want) continue; // 占位项跳过（见下面「不在名单」那组）
  const got = toxicityOf(h);
  if (!got || got.level !== want) wrongLevel.push([h, want, got && got.level]);
}
equal('抽样等级全对', wrongLevel, []);

// ── 引擎的三个方向 ──────────────────────────────────────
console.log('\n[4] 引擎表的三类错，都不许再出现');

// ① 药典明列有毒、引擎整个没有（46 味，含半夏、白果、山豆根）
//    这是最严重的一类：透传引擎就是「半夏无毒」。
const MISSING_IN_ENGINE = ['半夏', '白果', '山豆根', '朱砂', '雄黄', '牵牛子', '木鳖子', '罂粟壳'];
check('药典有毒但引擎漏收的药，现在答得出等级', () => {
  const bad = MISSING_IN_ENGINE.filter((h) => {
    const t = toxicityOf(h);
    return !t || !t.level;
  });
  assert.deepEqual(bad, []);
});

// ② 等级错（巴豆引擎写「有毒」、药典是「大毒」；苦杏仁引擎写「有毒」、药典是「小毒」）
equal('等级错的条目都在差异表里', Object.keys(DIFF.wrongLevel).length, 16);

// ③ 药典名单没有、引擎却标了毒性（野菊花、车前草、桃仁……）
const NOT_IN_LIST = ['野菊花', '车前草', '桃仁', '枳实', '枳壳', '厚朴', '槟榔'];
check('引擎标了毒性但药典名单没有的，不再答成有毒', () => {
  const bad = NOT_IN_LIST.filter((h) => {
    const t = toxicityOf(h);
    return t && t.kind === 'canon';
  });
  assert.deepEqual(bad, []);
});
check('它们也不能被判成「不认识这味药」', () => {
  const bad = NOT_IN_LIST.filter((h) => /没收录|没听出/.test(ask(`${h}有毒吗`).speech || ''));
  assert.deepEqual(bad, []);
});

// ── 名单外的三种特殊情况 ────────────────────────────────
console.log('\n[5] 名单外不能说成「无毒」，三种情况分别交代');

const notListed = ask('甘草有毒吗');
check('名单外的药只说「不在名单」，不说无毒', () => {
  assert.ok(!/无毒/.test(notListed.speech), notListed.speech);
  assert.ok(new RegExp(NOT_LISTED).test(notListed.speech), notListed.speech);
});

// 马兜铃酸类：药典已取消药用标准。单看「不在毒性名单」会让人以为可以用，
// 它们是**不能用**，比有毒更重。
for (const h of ['关木通', '青木香', '马兜铃']) {
  check(`${h}要说清已取消药用标准`, () => {
    const s = ask(`${h}有毒吗`).speech || '';
    assert.ok(/取消药用标准|马兜铃酸/.test(s), s);
  });
}

// 药典未收载、但公认有毒：名单外的沉默必须单独解释，
// 否则「藜芦有毒吗」会答「药典没列为毒性药材」——而它是十八反成员。
for (const h of ['藜芦', '雪上一枝蒿']) {
  check(`${h}要说清「药典未收载但公认有毒」`, () => {
    const t = toxicityOf(h);
    assert.ok(t && t.level, `${h} 应有等级`);
    assert.ok(/没有收载|未收载/.test(t.text), t.text);
  });
}

// ── 别名 ────────────────────────────────────────────────
console.log('\n[6] 别名归口：用户说的是俗名，表里记的是正名');

const ALIAS_CASES = [
  ['硫磺', '硫黄'], ['皂荚', '大皂角'], ['皂角', '大皂角'],
  ['大戟', '京大戟'], ['蟾蜍', '蟾酥'], ['牵牛', '牵牛子'], ['乌头', '川乌'],
];
const badAlias = ALIAS_CASES.filter(([a, b]) => normalizeToxin(a) !== b);
equal('别名都归到正名', badAlias, []);

check('说别名也能查到等级', () => {
  const t = toxicityOf('硫磺');
  assert.ok(t && t.level === '有毒', JSON.stringify(t));
});

// 「乌头」是川乌、草乌、附子的统称，三者最严的是川乌（大毒）。
// 含混的问法要往安全侧靠：按最严的答，不按最松的。
check('含混的「乌头」按最严的川乌答', () => {
  const t = toxicityOf('乌头');
  assert.equal(t.level, '大毒');
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
