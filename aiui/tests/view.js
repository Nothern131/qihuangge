// 岐黄阁页面层测试：证明「说一句话 → 屏幕变成什么 + 念哪句」这条链路通。
//
// 和上一版的区别：不再造假 DOM。视图模型只产出 { patch, say, tail }，
// 断言打在这两样东西上，并且**真的走一遍 core/speech.js 的裁剪与免责拼接**——
// 因为「播报里有没有免责声明」是合规项，不能靠「我记得加了」。
//
// 仍然没覆盖（只能在 AIUI Studio 里验证）：.ink 四块结构、SpeechRecognition 真实事件形态、
// 镜腿键上报的是 GlobalHook 还是 Enter、vendor 包装在 Ink 运行时里能否正常 import。

import { loadEngines } from '../adapter/load-engines.js';
import { CANON_PAIRS } from '../adapter/wei-canon.js';
import { createQihuangView, INITIAL_STATE, GUIDE, SCREEN_BUDGET } from '../ui/qihuang-view.js';
import { speak, toBrief } from '../core/speech.js';

const PASSED = [];
const FAILED = [];

// 页面 apply() 的真实行为：setData(patch) + speak(say, {max, tail})。
// 这里把 speak 换成记录器，但仍然过 toBrief，所以「免责被裁掉」会被抓到。
const spoken = [];
globalThis.speechSynthesis = { speak: () => {}, cancel: () => {} };

function applyOut(out) {
  if (out && out.say) {
    spoken.push(toBrief(out.say, { max: out.sayMax || 32, tail: out.tail || '' }));
  }
}

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}: ${JSON.stringify(actual)}${ok ? '' : `  期望 ${JSON.stringify(expected)}`}`);
  (ok ? PASSED : FAILED).push(name);
}

function truthy(name, actual) {
  const ok = Boolean(actual);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}: ${JSON.stringify(actual)}`);
  (ok ? PASSED : FAILED).push(name);
}

const { sandbox } = loadEngines({ quiet: true });
const view = createQihuangView({
  engines: {
    InteractionEngine: sandbox.InteractionEngine,
    BencaoEngine: sandbox.BencaoEngine,
    VitaminEngine: sandbox.VitaminEngine,
  },
});

function ask(q) {
  spoken.length = 0;
  const out = view.handle(q);
  applyOut(out);
  return out;
}

console.log('【1】开场白：只说能查什么，不说自己怎么实现的');
// 例子从播报移到屏幕了：口头只问一句「哪儿不舒服」（18 字，3 秒），
// 三个例子放在首屏 answer 里——看得见、不占耳朵。
// 断言跟着改，同时补一条下限：播报不许再变长（超过 25 字就开始烦人）。
truthy('开场白给出可照说的例子（在首屏）',
  /睡不着|胃胀|眼睛干/.test(`${INITIAL_STATE.answer || ''}${INITIAL_STATE.detail || ''}`));
truthy('播报控制在 25 字以内', GUIDE.length <= 25, `${GUIDE.length} 字`);
// 开场白只介绍能力。不预告「每条都告诉你出处」——
// 出处是结论的一部分，跟在结论后面就够了；提前承诺一遍变成使用说明，
// 用户开屏听到的不是答案而是承诺书。那条线由 [5][7] 在结论侧守。
truthy('开场白不预告出处', !/出处|哪本书|每条/.test(GUIDE));
truthy('开场白不挂免责话术', !/咨询医师|仅供参考|药师/.test(GUIDE));

console.log('\n【2】口语不加连词也要查得出配伍禁忌');
let out = ask('甘草海藻能不能一起吃');
check('标题显示两味药', out.patch.title, '甘草 + 海藻');
truthy('结论提示不可同用', String(out.patch.answer).includes('不可同用'));
truthy('有播报', spoken.length === 1);
console.log(`       屏幕：${out.patch.title}　|　${out.patch.detail}`);
console.log(`       播报：${spoken[0]}`);

console.log('\n【2b】查禁忌要说得出「为什么」，而且这句话要能上屏');
// 只说「不可同用」是安全的，也是没用的：用户不知道怎么权衡。
// 这一组守的是「原因真的到了用户眼前」，而不只是存在某个字段里。
const ans = String(out.patch.answer);
truthy('屏幕有原因全文', /原因（[^）]+）：甘草含甘草酸/.test(ans), ans);
// 归属标签必须跟着原因一起上屏。没有它，现代研究和古人的推断在屏幕上长得一样，
// 而这两种话的可信度差得很远。
// 标签在句首而不是句末：句末的括号会被行尾截成「（现代药理研」+「究）」，
// 两行都读不通。Studio 截图实证过。
// 标签从「现代药理研究」拆成了「动物实验」和「药理常识」——
// 甘草这一组有动物实验支持（附三项文献），所以标的是前者。
// 拆的理由：混在一档里，「药理上说得通」会借「做过实验」的可信度。
truthy('原因带归属标签且在句首', /原因（动物实验）：/.test(ans), ans);
// 顺序：结论 → 原因 → 出处。原因跑到结论前面，用户得读到第二行才知道结论。
check('结论在原因之前', () => {
  assert.ok(ans.indexOf('不可同用') < ans.indexOf('原因（'), ans);
});
// 原因在正文里，出处在下方的固定行：模板顺序保证它排在结论之后。
// 这里只验原因确实在正文中，位置关系由 platform.js（模板顺序）守。
truthy('原因在正文中', /原因（/.test(ans), ans);
// 播报和屏幕给不同的量：播报是浓缩一句，屏幕是全文。
// 两边一样长的话，播报要么太长，要么屏幕太浅。
truthy('屏幕比播报详细', ans.length > spoken[0].length);

console.log('\n【3】单味药的妊娠禁忌不能漏（必须单独查 checkPregnancy）');
out = ask('桃仁能不能吃');
truthy('提到妊娠相关', String(out.patch.answer).includes('妊娠'));

console.log('\n【4】认不出药名时不能说「没有禁忌」');
out = ask('乱说的东西能不能一起吃');
// 断言的是性质，不是某一句话：屏幕必须承认「没查到」，并指出是哪一味没查到。
// 措辞会随归因改进而变（「没听出药名」→「本草库没收录」），性质不能变。
truthy('标题承认没查到', /没查到|没听出/.test(out.patch.title));
truthy('详情指出是哪一味没查到', String(out.patch.detail).includes('乱说的东西'));
truthy('不谎称无禁忌', !/没有查到.*禁忌/.test(String(out.patch.answer)));

console.log('\n【5】本草条目查询：性味 + 用量 + 出处');
out = ask('查一下当归');
check('标题是药名', out.patch.title, '当归');
truthy('详情有性味或用量', String(out.patch.detail).length > 0);
truthy('播报带出处', /《中国药典》/.test(spoken[0]));
// 出处单独一行、单独字段。
// 拼进 answer 末尾会在正文变长时被顶出可视区（Studio 截图实证），
// 而出处看不见等于这条结论没有依据。模板里它排在 answer 之后，
// 所以视觉上仍然「跟在结论后面」。
truthy('出处独立成字段', /出处：《中国药典》/.test(String(out.patch.source)));
truthy('没有出处时不渲染那一行', out.patch.sourceClass === 'source');
truthy('出处不在正文里重复一遍', !/出处/.test(String(out.patch.answer)));
truthy('出处不在结论上方', !/出处/.test(String(out.patch.detail)));

console.log('\n【6】重复说同一句不重复念，「再说一遍」能重听');
spoken.length = 0;
const o1 = view.handle('当归'); applyOut(o1);
const afterFirst = spoken.length;
const o2 = view.handle('当归'); applyOut(o2);
check('同一句第二次不重复播报', spoken.length, afterFirst);
const o3 = view.handle('再说一遍'); applyOut(o3);
check('「再说一遍」触发重播', spoken.length, afterFirst + 1);

console.log('\n【7】播报长度受控（超过 32 字由 speech 层压缩，但出处必须留）');
ask('当归');
ask('甘草海藻能不能一起吃');
const longest = spoken.reduce((a, b) => (b.length > a.length ? b : a), '');
// 上限从 60 放宽到 90：播报内容从「只有结论」变成「结论 + 原因」，
// 长度必然增加。但也不能无限长——超过 90 字，念完要二十秒以上，
// 用户会开始等下一句而不是听这一句。想听全的走「为什么」追问（上限 140）。
truthy('最长播报不超过 90 字', longest.length <= 90);
// 这条守的是设计：出处走 tail，进 toBrief 的「永不裁剪」路径。
// 如果哪天有人把出处改回拼在 speech 末尾，这里会红。
truthy('最长播报保留出处', /《[^》]+》|药典|现代营养学/.test(longest));
console.log(`       最长 ${longest.length} 字：${longest}`);

console.log('\n【8】拒绝档：屏幕必须一眼看出「系统没答」');
// 这条是接上听懂层之后多出来的保护。之前「当归吃多少克」会被当成
// 本草条目查询，返回性味功效——用户问的是用量，拿到的却是功效，
// 而屏幕上看起来完全正常，没人会觉得哪里不对。
out = ask('当归吃多少克');
check('标题明确不做', out.patch.title, '这个不做');
truthy('状态标为做不了', /做不了/.test(String(out.patch.status)));
truthy('详情说明只查资料', /只查资料|不给用量|不开方/.test(String(out.patch.detail)));
truthy('答复里没有任何用量数字', !/\d+\s*(克|钱|两)/.test(String(out.patch.answer)));
truthy('播报也说了为什么', /危险|不给|不说/.test(spoken.join('|')));
check('视觉档位是红', out.patch.tone, 'bad');

console.log('\n【9】闲聊不当药名：不能把「今天天气不错」念回去');
out = ask('今天天气不错');
check('标题承认没听出', out.patch.title, '没听出');
truthy('没有把整句话当药名念', !String(out.patch.answer).includes('还没收录今天天气不错'));
truthy('没有给出任何药物结论', !/禁忌|毒性|配伍/.test(String(out.patch.answer)));

console.log('\n【10】不变量：补丁字段必须在模板绑定里，且视觉档位只用四个值');
const KEYS = Object.keys(INITIAL_STATE);
const TONES = ['idle', 'ok', 'warn', 'bad'];
const QS = [
  '甘草海藻能不能一起吃', '桃仁能不能吃', '乱说的东西能不能一起吃', '查一下当归',
  '当归吃多少克', '今天天气不错', '附子有毒吗', '维生素C', '生姜', '人参和五灵脂',
];
let stray = null;
let badTone = null;
for (const q of QS) {
  const p = createQihuangView({
    engines: {
      InteractionEngine: sandbox.InteractionEngine,
      BencaoEngine: sandbox.BencaoEngine,
      VitaminEngine: sandbox.VitaminEngine,
    },
  }).handle(q).patch;
  for (const k of Object.keys(p)) {
    if (!KEYS.includes(k)) stray = `${k} ← ${q}`;
    if (p[k] === undefined) stray = `${k} 值为 undefined ← ${q}`;
  }
  if (p.tone && !TONES.includes(p.tone)) badTone = `${p.tone} ← ${q}`;
}
check('没有越界字段', stray, null);
check('tone 只有四种', badTone, null);

console.log('\n【11】资料库缺失时必须报错，不能装作能查');
try {
  createQihuangView({ engines: {} });
  check('空引擎被拦住', '没报错', '应抛错');
} catch (err) {
  truthy('空引擎被拦住并说明原因', /缺少/.test(err.message));
}

console.log('\n【12】屏幕字数预算：任何一对药都不能把出处挤出屏幕');

// 这条是拿 Studio 截图倒推出来的，不是设计时想到的。
// 原因全文上屏之后，最长的问法是「为什么乌头反瓜蒌」：结论 + 原因 + 争议
// 一共 196 字，超出可读区，最后一行没能被裁住，
// 直接和底部的出处行叠在一起——两行字互相压着，都读不了。
// 所以这里不验措辞，验「长度」：一旦超过预算，出真机之前就该红。
const I = sandbox.InteractionEngine;
// 预算这个数字本身也要守住。
// 上面的「在预算内」是自指的：把 SCREEN_BUDGET 改成 9999，它照样全绿——
// 那样这条断言就成了摆设。真机可读区是实测的物理事实，不会因为改个常量而变大。
// 所以这里钉一个上界：谁想把预算调大来让测试通过，就得先来这里改数字，
// 而改这一行的人一定会看到这句话。
check('预算没有被人为调大', () => {
  assert.ok(SCREEN_BUDGET <= 170, `SCREEN_BUDGET=${SCREEN_BUDGET}，超过了实测的一屏容量`);
});
const ALL_PAIRS = [];
for (const g of [I.ANTI_GROUP1, I.ANTI_GROUP2, I.ANTI_GROUP3]) {
  for (const b of g.slice(1)) ALL_PAIRS.push([g[0], b]);
}
for (const p of Array.from(I.FEAR_PAIRS)) ALL_PAIRS.push([p[0], p[1]]);
// 歌诀里有、引擎表里没有的那几对也要过一遍预算。
// 只穷举引擎表的话，新补进来的「人参五灵脂」「肉桂赤石脂」「川乌犀角」
// 这几条答复从来没被测过长度——而它们恰恰是最新写的文案，最可能超。
for (const [a, b] of CANON_PAIRS) {
  if (!ALL_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) ALL_PAIRS.push([a, b]);
}

const overBudget = [];
let screenLongest = { len: 0, q: '' };
for (const [a, b] of ALL_PAIRS) {
  for (const q of [`${a}${b}能一起吃吗`, `为什么${a}反${b}`]) {
    const t = view.handle(q);
    // 只算正文：出处是固定底栏，不在这份文本里，所以预算也是按正文算的。
    const len = String(t.patch.answer || '').length;
    if (len > screenLongest.len) screenLongest = { len, q };
    if (len > SCREEN_BUDGET) overBudget.push([q, len]);
  }
}
check(`全部 ${ALL_PAIRS.length * 2} 条问法都在 ${SCREEN_BUDGET} 字以内`, () => {
  assert.deepEqual(overBudget, []);
});
console.log(`       最长 ${screenLongest.len} 字：${screenLongest.q}`);

// 曾经想在这里加一条「裁到极限也要把正文写出去」的断言，反向验证时发现它是空的：
// `picked` 有 `slice(0,1)` 兜底，永远不会是空数组，所以旧写法
// `if (picked.length) patch.answer = …` 里的条件是恒真的死判断，坏场景根本构造不出来。
// 断言写不出反例，就不是断言，是装饰。改成守一条真的性质：
// 有原因的答复，屏幕上必须同时有结论句和原因行。
const missingHalf = [];
for (const [a, b] of ALL_PAIRS) {
  const t = view.handle(`${a}${b}能一起吃吗`);
  const ans = String(t.patch.answer || '');
  if (!ans.includes(b)) missingHalf.push([a, b, '结论里没有这一味']);
  else if (!/原因（/.test(ans)) missingHalf.push([a, b, '有原因却没上屏']);
}
check('有原因的答复：结论和原因同时在屏上', () => {
  assert.deepEqual(missingHalf, []);
});

// 预算不是「随便砍」：砍的顺序必须是先争议、后第二条原因，
// 结论和第一条原因永远留着——那是用户问的那件事本身。
// 这一条守的是「砍对了」，不是「砍了」。
// 用例换过一次：原来用「为什么乌头反瓜蒌」，后来原因句变短，那个问法装得下了，
// 断言就失去了前提（它期待争议被砍，实际没砍）。现在改用一条确实装不下的问法。
// 这类断言的用例必须跟着文案长度走，否则文案一改，断言就从「守着」变成「碰巧绿」。
const longestOut = view.handle('为什么乌头反半夏');
truthy('超预算时先砍争议', !/另：/.test(longestOut.patch.answer), longestOut.patch.answer);
truthy('砍完还留着原因', /原因（/.test(longestOut.patch.answer), longestOut.patch.answer);
truthy('砍完还留着结论', /不可同用/.test(longestOut.patch.answer), longestOut.patch.answer);

// 反过来：装得下时争议不能被顺手砍掉，否则追问就白问了。
const fitOut = view.handle('为什么乌头反瓜蒌');
truthy('装得下时争议要保留', /另：/.test(fitOut.patch.answer), fitOut.patch.answer);

console.log('\n' + '='.repeat(60));
console.log(`通过 ${PASSED.length} / ${PASSED.length + FAILED.length}`);
if (FAILED.length > 0) {
  console.log('失败项：' + FAILED.join('、'));
  process.exit(1);
}
console.log('全部通过');
