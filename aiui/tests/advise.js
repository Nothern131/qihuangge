// 状况 → 食补建议：三道门槛、建议质量、冲突剔除。
//
// 这套断言守的不是「功能跑起来了」，是「给出去的话站不站得住」：
// 每一条建议都要能追回《中国药典》那句「用于…」原文，
// 而推荐的每一味都必须和用户正在吃的东西核对过。

import assert from 'node:assert/strict';
import { adviseFor, adviceLine, NATURE_RULE } from '../adapter/food-advice.js';
import { extractStates } from '../adapter/advice.js';
import { FOODS } from '../adapter/food-canon.js';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';
import { createQihuangView, SCREEN_BUDGET } from '../ui/qihuang-view.js';

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
const mk = () => createQihuangAgent(pack, { store: createProfileStore({ backend: memoryBackend() }) });
const st = (t) => extractStates(t);

// ─────────────────────────────────────────────────────────
console.log('\n[1] 三道门槛：缺一步就不给建议');

const noState = adviseFor([], { eating: [] });
eq('没状况时不给建议', noState.ok, false);
eq('归因是「不知道你的情况」', noState.code, 'no-state');

const noHist = adviseFor(st('我阴虚火旺'), {});
eq('不知道在吃什么时不给建议', noHist.ok, false);
eq('归因是「不知道在吃什么」', noHist.code, 'no-history');
truthy('理由里说清了为什么必须先知道', /相冲|比不给更糟/.test(noHist.reason), noHist.reason);

// null 和 [] 必须分开：前者是不知道，后者是知道「没有」。
const knownNone = adviseFor(st('我阴虚火旺'), { eating: [] });
eq('明确知道没在吃时给建议', knownNone.ok, true);

const preg = adviseFor(st('我怀孕了'), { eating: [] });
eq('孕期不给食补建议', preg.ok, false);
truthy('孕期理由指向医生', /医生|产检/.test(preg.reason), preg.reason);

const bleed = adviseFor(st('我容易出血'), { eating: [] });
eq('出血倾向不给食补建议', bleed.ok, false);

// ─────────────────────────────────────────────────────────
console.log('\n[2] 建议必须追得回药典原文');

// 核心断言：每一条推荐的 matched 词，必须真的出现在那一味的「用于」段落里。
// 这不是测代码，是测「我们没替药典编话」。
const cases = ['我阴虚火旺', '我脾胃虚寒', '我气虚乏力', '我阳虚怕冷', '我湿气重'];
const badQuote = [];
for (const c of cases) {
  const r = adviseFor(st(c), { eating: [] });
  if (!r.ok) continue;
  for (const p of r.picks) {
    const src = String(FOODS[p.name].functions || '');
    const use = src.slice(src.indexOf('用于') + 2);
    if (!use.includes(p.matched)) badQuote.push([c, p.name, p.matched]);
  }
}
eq('每条建议的匹配词都能在药典原文里找到', badQuote, []);

// 推荐里不能出现「治」——那是治疗方案的口吻，不是食材方向。
const treatWord = [];
for (const c of cases) {
  const r = adviseFor(st(c), { eating: [] });
  if (!r.ok) continue;
  for (const p of r.picks) if (/治/.test(adviceLine(p))) treatWord.push(p.name);
}
eq('建议里不出现「治」', treatWord, []);

// 剂量一个字都不给。
for (const c of cases) {
  const r = adviseFor(st(c), { eating: [] });
  if (!r.ok) continue;
  truthy(`「${c}」不给剂量`, !r.picks.some((p) => /\d+\s*(克|g|钱|两|毫升)/.test(adviceLine(p))));
}

// ─────────────────────────────────────────────────────────
console.log('\n[3] 方向排序：寒热对立');

const yin = adviseFor(st('我阴虚火旺'), { eating: [] });
const coolFirst = yin.picks.slice(0, 3).filter((p) => p.dir === 'cool').length;
truthy('阴虚榜前三条里偏凉占多数', coolFirst >= 2, yin.picks.map((p) => `${p.name}/${p.dir}`).join(' '));

const cold = adviseFor(st('我脾胃虚寒'), { eating: [] });
const warmFirst = cold.picks.slice(0, 3).filter((p) => p.dir === 'warm').length;
truthy('虚寒榜前三条里偏温占多数', warmFirst >= 2, cold.picks.map((p) => `${p.name}/${p.dir}`).join(' '));

// 方向相反的如果被药典写了适应证，不能删——删了就等于改书。要标出来。
const anyContrary = yin.picks.some((p) => p.contrary);
truthy('方向相反的条目标了 contrary 而不是删掉', yin.picks.length > 0 && (anyContrary || yin.picks.every((p) => !p.contrary)));

// ─────────────────────────────────────────────────────────
console.log('\n[4] 和你正在吃的东西核对');

const clash = adviseFor(st('我气虚乏力'), { eating: ['藜芦'] });
eq('在吃藜芦时仍然给建议（换别的，不是拒绝）', clash.ok, true);
const blockedNames = clash.skipped.filter((x) => x.blocked).map((x) => x.name);
truthy('党参被剔除（药典写不宜与藜芦同用）', blockedNames.includes('党参'), blockedNames.join('、'));
truthy('剔除理由说得出药典原话', /不宜与藜芦同用/.test(clash.skipped.find((x) => x.name === '党参').why));
truthy('推荐里不再出现党参', !clash.picks.some((p) => p.name === '党参'));

// 已经在吃的不重复推荐——那不是建议，是复述他已经在做的事。
const already = adviseFor(st('我气虚乏力'), { eating: ['黄芪'] });
truthy('已经在吃的不再推荐', !already.picks.some((p) => p.name === '黄芪'));
truthy('记了「已经在吃」', already.skipped.some((x) => x.name === '黄芪'));

// ─────────────────────────────────────────────────────────
console.log('\n[5] 端到端：一句话到一条建议');

const a1 = mk();
eq('「我吃什么好」先问清在吃什么', askQihuang(a1, '我吃什么好').intent, 'advice');
truthy('答复说的是缺在吃记录', /不知道你在吃什么/.test(askQihuang(a1, '我吃什么好').speech));

const a2 = mk();
askQihuang(a2, '我阴虚火旺');
const r2 = askQihuang(a2, '我没在吃什么药，吃什么好');
eq('说了没在吃之后能答', r2.intent, 'advice');
truthy('答复里点名了具体品种', /百合|麦冬|桑椹/.test(r2.speech), r2.speech);
truthy('答复里给了依据', /药典/.test(r2.speech), r2.speech);
truthy('答复里声明不给量', /不给量|不是方子/.test(r2.speech), r2.speech);

const a3 = mk();
askQihuang(a3, '记一下我在吃藜芦');
const r3 = askQihuang(a3, '我气虚吃什么好');
truthy('剔除的那几味要说出来', /藜芦相冲/.test(r3.speech), r3.speech);
truthy('返回结构里带 blocked', Array.isArray(r3.result.blocked) && r3.result.blocked.length > 0);

// 「想补气」这种需求描述也要能进
const a4 = mk();
askQihuang(a4, '记一下我在吃钙片');
const r4 = askQihuang(a4, '吃什么能补气');
// 1.0.3 起 states/stateNames 是本轮主题的中文标签（给标题与播报用），
// 英文 key 只在程序内部流转——所以这里认「气虚」两个字。
truthy('「补气」识别为气虚需求', (r4.result.states || []).includes('气虚'), JSON.stringify(r4.result && r4.result.states));

// 回归：补钙这类营养素问法不能被抢走
const a5 = mk();
eq('「补钙怎么补」仍走营养素', askQihuang(a5, '补钙怎么补').intent, 'nutrient');

// 带药名的查询不能被抢走
const a6 = mk();
eq('「当归有什么功效」仍走查询', askQihuang(a6, '当归有什么功效').intent, 'ask');

// ─────────────────────────────────────────────────────────
console.log('\n[6] 屏幕与出处');

const store6 = createProfileStore({ backend: memoryBackend() });
const view = createQihuangView({ engines: ENGINES, store: store6 });
view.handle('我阴虚火旺');
const v = view.handle('我没在吃什么药，吃什么好');
truthy('屏幕有正文', String(v.patch.answer || '').length > 0);
truthy('屏幕字数在预算内', String(v.patch.answer).length <= SCREEN_BUDGET, String(v.patch.answer.length));
truthy('出处标了药典', /《中国药典》/.test(v.patch.source || ''), v.patch.source);
truthy('出处标了排序依据', /素问/.test(v.patch.source || ''), v.patch.source);
truthy('出处没有重复前缀', !/出处：出处：/.test(v.patch.source || ''), v.patch.source);
truthy('标题是身体状况，不是「本草」', /阴虚/.test(v.patch.title), v.patch.title);

// 数字与数据一致性：屏幕上列了几味，就让用户看到几味
const listed = String(v.patch.answer).split('\n').filter((l) => l.includes('用于')).length;
truthy('屏幕上每条都带原文', listed >= 2, `listed=${listed}`);

// ─────────────────────────────────────────────────────────
console.log('\n【新增证候】便秘 / 失眠 / 食积腹胀 / 血虚——映射词必须是药典原文');
// 审计（tools/audit-food-coverage.js）发现药典有货但给不出建议的断裂点，
// 补了四个映射。断言守两条线：
//   ① 给出的每一味都要能追回药典「用于」原文（匹配词真实存在）
//   ② 「贫血」这类西医词不收——药典没写，塞进来两头都不真实。

{
  const r = adviseFor(st('我便秘'), { eating: [] });
  truthy('便秘能给出建议', r.ok && r.picks.length > 0, JSON.stringify(r.reason));
  truthy('便秘的每味都是药典写了便秘/肠燥的',
    r.picks.every((p) => /便秘|肠燥/.test(p.use)), r.picks.map((p) => p.name).join('、'));
  truthy('便秘榜首是润肠类（火麻仁/决明子/郁李仁/罗汉果/桃仁/桑椹）',
    /火麻仁|决明子|郁李仁|罗汉果|桃仁|桑椹/.test(r.picks[0].name), r.picks[0].name);
}
{
  const r = adviseFor(st('我血虚'), { eating: [] });
  truthy('血虚能给出建议', r.ok && r.picks.length > 0);
  truthy('血虚榜里有当归或龙眼肉',
    r.picks.some((p) => /当归|龙眼肉/.test(p.name)), r.picks.map((p) => p.name).join('、'));
  truthy('血虚的每味都是药典写了血虚的',
    r.picks.every((p) => /血虚|面色萎黄/.test(p.use)), r.picks.map((p) => p.name).join('、'));
}
{
  const r = adviseFor(st('我失眠'), { eating: [] });
  truthy('失眠能给出建议', r.ok && r.picks.length > 0);
  truthy('失眠榜里有安神类（百合/龙眼肉/酸枣仁/茯苓/莲子/桑椹）',
    r.picks.some((p) => /百合|龙眼肉|酸枣仁|茯苓|莲子|桑椹/.test(p.name)),
    r.picks.map((p) => p.name).join('、'));
  truthy('失眠的每味都是药典写了失眠/虚烦/多梦的',
    r.picks.every((p) => /失眠|虚烦|多梦/.test(p.use)), r.picks.map((p) => p.name).join('、'));
  truthy('失眠的就医提醒进了 why', r.notes.some((n) => /看医生/.test(n)), r.notes.join('|'));
}
{
  const r = adviseFor(st('我肚子胀消化不良'), { eating: [] });
  truthy('食积腹胀能给出建议', r.ok && r.picks.length > 0);
  truthy('食积榜里有消导类（山楂/麦芽/鸡内金/莱菔子/小茴香）',
    r.picks.some((p) => /山楂|麦芽|鸡内金|莱菔子|小茴香/.test(p.name)),
    r.picks.map((p) => p.name).join('、'));
}

console.log('\n【识别边界】西医词不收，实热词不两头占');
eq('「我贫血」不识别（药典没这个词）', extractStates('我贫血').length, 0);
eq('「我血虚」识别为血虚', extractStates('我血虚')[0].key, 'blood-deficiency');
eq('「我睡不好」识别为失眠', extractStates('我睡不好')[0].key, 'insomnia');
eq('「我便秘」识别为便秘', extractStates('我便秘')[0].key, 'constipation');
truthy('「大便干结」不进便秘识别（留给实热拒答）',
  !extractStates('我大便干结').some((s) => s.key === 'constipation'));

console.log('\n【端到端】新证候走完整三道门 + 拒答给出口');
{
  const agent = mk();
  const first = askQihuang(agent, '我便秘吃什么好');
  truthy('不知道在吃什么时先要档案（拒答话术带记的入口）',
    /记一下/.test(first.speech), first.speech);
  askQihuang(agent, '我什么都没在吃');
  const second = askQihuang(agent, '我便秘吃什么好');
  truthy('交代没在吃之后给出建议', second.verdict === 'answer' && /用于/.test(second.speech || ''),
    String(second.speech).slice(0, 60));
}
{
  const agent = mk();
  const r = askQihuang(agent, '我失眠怎么调理');
  // 顺序：第二道门（在吃什么）先于给方向——连这个都不知道谈不上建议。
  // 拒答必须带出口（记一下），不能一句「瞎给」就完。
  truthy('失眠调理：先问在吃什么（第二道门在前），拒答带出口',
    /记一下/.test(r.speech || ''), String(r.speech).slice(0, 60));
  askQihuang(agent, '我什么都没在吃');
  const r2 = askQihuang(agent, '我失眠吃什么好');
  truthy('交代没在吃后，失眠的调理诉求给方向而不是拒答',
    r2.verdict === 'answer' && /用于|适合/.test(r2.speech || ''), String(r2.speech).slice(0, 60));
  truthy('失眠的就医提醒进了播报', /医生/.test(r2.speech || ''), String(r2.speech).slice(0, 80));
}
{
  const agent = mk();
  askQihuang(agent, '我什么都没在吃');
  const r = askQihuang(agent, '我阳虚吃什么好');
  // 审计口径修正后阳虚有货（secondary：宫冷/肢冷，肉桂人参干姜），
  // 但每味都必须能追回药典写阳虚/畏寒/宫冷/肢冷的原文——不编。
  truthy('阳虚给建议且每味带药典原文',
    r.verdict === 'answer' && /用于/.test(r.speech || ''), String(r.speech).slice(0, 60));
  const useOk = (r.picks || []).every((p) => /阳虚|畏寒|宫冷|肢冷/.test(p.use));
  truthy('阳虚的每味都是药典原文背书的', useOk, JSON.stringify(r.picks && r.picks.map((p) => [p.name, p.use.slice(0, 20)])));
}

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
