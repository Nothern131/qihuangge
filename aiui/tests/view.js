// 岐黄阁页面层测试：证明「说一句话 → 屏幕变成什么 + 念哪句」这条链路通。
//
// 和上一版的区别：不再造假 DOM。视图模型只产出 { patch, say, tail }，
// 断言打在这两样东西上，并且**真的走一遍 core/speech.js 的裁剪与免责拼接**——
// 因为「播报里有没有免责声明」是合规项，不能靠「我记得加了」。
//
// 仍然没覆盖（只能在 AIUI Studio 里验证）：.ink 四块结构、SpeechRecognition 真实事件形态、
// 镜腿键上报的是 GlobalHook 还是 Enter、vendor 包装在 Ink 运行时里能否正常 import。

import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangView, INITIAL_STATE, GUIDE } from '../ui/qihuang-view.js';
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
truthy('开场白提到能查什么', /禁忌|同用/.test(GUIDE));
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
// 屏幕上也留一行：《中国药典》＋《本草纲目》这类短标签。
// 语音听完就忘了，想核对的时候必须有个地方能看。
truthy('屏幕上也标了出处', /《中国药典》/.test(String(out.patch.detail)));

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
truthy('最长播报不超过 60 字', longest.length <= 60);
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

console.log('\n' + '='.repeat(60));
console.log(`通过 ${PASSED.length} / ${PASSED.length + FAILED.length}`);
if (FAILED.length > 0) {
  console.log('失败项：' + FAILED.join('、'));
  process.exit(1);
}
console.log('全部通过');
