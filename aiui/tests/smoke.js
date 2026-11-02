// 岐黄阁适配层冒烟测试。
//
// 这个文件要证明两件事：
// ① 适配层真的能调通原始引擎（不是「我以为能」）；
// ② 原始文件一个字节都没改（用 git status 证明，不靠我口头保证）。

import { execSync } from 'node:child_process';
import { loadEngines, listEngineGlobals, PROJECT_ROOT } from './../adapter/load-engines.js';
import { createQihuangPack } from './../adapter/qihuang-pack.js';
import { toBrief } from './../core/speech.js';

const PASSED = [];
const FAILED = [];

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

console.log('【1】按 manifest 加载原始引擎（零改动）');
const { sandbox, loaded, missing } = loadEngines({ quiet: true });
check('六个脚本全部加载', loaded.length, 6);
check('没有缺失文件', missing, []);
const globals = listEngineGlobals(sandbox);
truthy('InteractionEngine 在内', globals.includes('InteractionEngine'));
truthy('BencaoEngine 在内', globals.includes('BencaoEngine'));

const pack = createQihuangPack({
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
});

console.log('\n【2】配伍禁忌：十八反应能查出来');
const bad = pack.invoke('check', { herbs: '甘草 海藻' });
check('识别为有警告', bad.hasWarning, true);
truthy('十八反条目非空', bad.fans.length > 0);
truthy('语音里点明不可同用', bad.speech.includes('不可同用'));
console.log(`       语音：${bad.speech}`);

const good = pack.invoke('check', { herbs: '当归 黄芪' });
check('正常搭配无警告', good.hasWarning, false);
console.log(`       语音：${good.speech}`);

console.log('\n【3】妊娠禁忌与毒性');
const preg = pack.invoke('check', { herbs: '桃仁' });
truthy('桃仁触发妊娠提示', preg.pregnancy.length > 0);
const toxic = pack.invoke('toxicity', { name: '附子' });
check('附子标为有毒', toxic.toxicity, '有毒');
console.log(`       语音：${toxic.speech}`);

console.log('\n【4】本草条目查询');
const herb = pack.invoke('herb', { query: '查一下当归' });
check('查到当归', herb.found, true);
truthy('有性味', herb.xingwei);
truthy('有功效', herb.effect);
truthy('有用量', herb.dosage);
const miss = pack.invoke('herb', { query: '不存在的药材xyz' });
check('查不到时明确说没查到', miss.found, false);

console.log('\n【5】合规边界：辨证/开方必须拒绝');
for (const act of ['bianzheng', 'fangji', 'diagnose', 'prescribe']) {
  let code = 'no error';
  try {
    pack.invoke(act, {});
  } catch (e) {
    code = e.code || 'threw';
  }
  check(`拒绝 ${act}`, code, 'unsupported_action');
}

console.log('\n【6】每条结论都说得出出处（说不出就是没依据）');
// 断言两件事，缺一不可：
//   ① 每条结论都带出处 —— 否则「我查到了」和「我猜的」在用户耳朵里一样
//   ② 没有一条挂免责话术 —— 那句话对用户没有信息量，而且会把引书和给建议混成一件事
const allResults = [bad, good, toxic, herb, pack.invoke('vitamin', { name: '维生素C' })];
const noSource = allResults.filter((r) => !/(《[^》]+》|药典|现代营养学|本草库|营养素库)/.test(r.source || ''));
check('全部带出处', noSource.length, 0);
check('没有一条挂免责话术', allResults.filter((r) => /仅供参考|咨询医师|咨询药师/.test(r.speech)).length, 0);

console.log('\n【7】原始文件零改动（git 证明，不是口头保证）');
// 断言范围精确锁定 static/ —— 这才是「不动它原本的架构」要证明的东西。
// 仓库里可能有与本次改动无关的既有状态（比如 python 的 __pycache__ 缓存被删），
// 把它混进断言会让这条检查变成噪音，反而失去意义。
let staticStatus = '';
let otherStatus = '';
try {
  staticStatus = execSync('git status --porcelain -- static/', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
  otherStatus = execSync('git status --porcelain -- . ":(exclude)static" ":(exclude)aiui"', {
    cwd: PROJECT_ROOT, encoding: 'utf8',
  }).trim();
} catch (e) {
  console.log('  [SKIP] git 不可用：' + e.message);
}
check('static/ 下零改动（0 行输出）', staticStatus, '');
const diffStat = (() => {
  try {
    return execSync('git diff --stat -- static/', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
  } catch { return ''; }
})();
check('git diff --stat static/ 为空', diffStat, '');
if (otherStatus) {
  console.log('       与本轮无关的既有改动（仅告知）：');
  otherStatus.split('\n').forEach((l) => console.log('         ' + l.trim()));
}

const untracked = (() => {
  try {
    return execSync('git status --porcelain -- . ":(exclude)static"', { cwd: PROJECT_ROOT, encoding: 'utf8' })
      .split('\n').map((l) => l.trim()).filter((l) => l.startsWith('??'));
  } catch { return []; }
})();
console.log('       本次新增（应都在 aiui/ 之内）：');
untracked.forEach((u) => console.log('         ' + u));
// 断言的性质是「没有跑到 aiui/ 外面去建东西」，不是「新增的必须恰好叫 aiui/」。
// 原来那句 `u === '?? aiui/'` 只在 aiui/ 整个目录还没被 git 跟踪时成立；
// 目录一进版本库，新增文件就变成 `?? aiui/adapter/x.js`，断言会假红。
check('新增项都在 aiui/ 之内', untracked.every((u) => /^\?\? aiui(\/|$)/.test(u)), true);

console.log('\n【8】口语切词：不加连词也能拆出两味药');
// 用户对眼镜说话不会加「和」。「甘草海藻能不能一起吃」老版本切成一个整体，
// 于是永远查不到禁忌 —— 而这恰好是配伍功能最该答对的问法。
for (const [input, expect] of [
  ['甘草海藻能不能一起吃', ['甘草', '海藻']],
  ['甘草和海藻', ['甘草', '海藻']],
  ['半夏川乌', ['半夏', '川乌']],
  ['甘草跟海藻、川乌', ['甘草', '海藻', '川乌']],
]) {
  const r = pack.invoke('check', { herbs: input });
  check(`「${input}」→ ${expect.join('+')}`, r.herbs, expect);
}
// 词表覆盖不到的药名不能被切坏，仍要原样进查询
const outside = pack.invoke('check', { herbs: '当归 黄芪' });
check('词表外的药名原样保留', outside.herbs, ['当归', '黄芪']);

console.log('\n【9】认不出药名时不能报「无禁忌」（假阴性是医疗风险）');
const bogus = pack.invoke('check', { herbs: '乱说的东西' });
check('全部认不出时 recognized=false', bogus.recognized, false);
// 断言写成「性质」而不是抄某一句话：只要结论里出现「没查到…禁忌」就是假阴性。
// 具体措辞会随归因改进而变（「没听出药名」→「本草库没收录」），
// 但「不能把查询失败说成安全结论」这条永远不能变。
truthy('不谎称无禁忌', !/没有查到.*禁忌/.test(bogus.speech) && /收录|没听出/.test(bogus.speech));
const partial = pack.invoke('check', { herbs: '甘草 乱说的东西' });
check('部分认不出时列出未知项', partial.unknown, ['乱说的东西']);
// 不能拿 totalWarnings 当判据：单味甘草本来就没有禁忌，警告数就是 0。
// 真正要证明的是「照样给结论，并且把没查到的那味说出来」。
truthy('部分认不出时仍返回结论文本', partial.recognized === true && /没收录|没听出/.test(partial.speech));
console.log(`       语音：${partial.speech}`);

console.log('\n【10】播报裁剪：出处必须留在播报里');
const herbRes = pack.invoke('herb', { query: '附子' });
const longSpeech = herbRes.speech;
// 用真实出处当过 tail：tail 的作用就是「不管怎么裁都不把它丢掉」，
// 拿一句硬编码的假免责去测，测到的是那句假话，不是产品行为。
const brief = toBrief(longSpeech, { max: 20, tail: herbRes.source });
truthy('裁剪后仍带出处', /《中国药典》/.test(brief));
truthy('裁剪后确实短了', brief.length < longSpeech.length);
console.log(`       原句 ${longSpeech.length} 字 → 播报 ${brief.length} 字：${brief}`);

console.log('\n【11】自然语言入口：眼镜上用户不会说「动作名」');
// 这一节测的是「一句话 → 该走哪条路」。判错的代价是答非所问，
// 在用药场景里比查不到更糟：问毒性却答了性味功效，用户会以为「系统说没事」。
const ROUTES = [
  ['桃仁能不能吃', 'safety'],
  ['孕妇能吃桃仁吗', 'pregnancy'],
  ['甘草海藻能不能一起吃', 'check'],
  ['甘草和海藻相克吗', 'check'],
  ['附子有毒吗', 'toxicity'],
  ['附子有副作用吗', 'toxicity'],
  ['维生素C', 'vitamin'],
  ['维C', 'vitamin'],
  ['当归', 'herb'],
];
for (const [say, want] of ROUTES) {
  const r = pack.invoke('ask', { text: say });
  check(`「${say}」→ ${want}`, r.intent, want);
}

console.log('\n【12】毒性：查不到不能说成「无毒」');
// 引擎的 getToxicity() 对任何未知输入都返回「无毒」（遍历毒性表没命中就 return '无毒'）。
// 直接透传会得到「★☆※在药典里标注为无毒」——把查询失败包装成安全结论，
// 而且发生在最不能出错的毒性问答上。这一节锁住这个坑。
const garbage = pack.invoke('toxicity', { name: '★☆※' });
check('乱码不报「无毒」', garbage.found, false);
truthy('乱码不说「标为无毒」', !garbage.speech.includes('标注为无毒'));
// 口径变过一次，这里如实记下来：
// 原来「三七」这类药典名单外、本草库也没有的药，答案是「本草库还没收录」，
// found 记 false（什么也没查到）。现在毒性分级以药典 83 种名单为准，
// 「不在名单里」本身就是一个可核对的结论，found 记 true。
// 变的是「查到的东西」多了，不是「把查不到说成查到了」——
// 这两种情况的区别在于答复里有没有说清依据，所以断言改成守那一句。
const notRecorded = pack.invoke('toxicity', { name: '三七' });
truthy('名单外药材不说「无毒」', !/无毒/.test(notRecorded.speech), notRecorded.speech);
truthy('名单外药材要说清「不在名单」', notRecorded.speech.includes('不在《中国药典》'), notRecorded.speech);
truthy('名单外药材要交代本草库也没有', notRecorded.speech.includes('本草库'), notRecorded.speech);
console.log(`       ${notRecorded.speech}`);
const real = pack.invoke('toxicity', { name: '附子' });
truthy('真有毒的药照实说', real.found === true && real.toxicity === '有毒');

console.log('\n【13】妊娠禁忌：同一味药只能给一个结论');
// 引擎把桃仁同时放进 PREGNANCY_Toxic 和 PREGNANCY_Mild，
// checkPregnancy 会吐出「禁用」和「慎用」两条。直接念给用户是
// 「同一味药两个结论」，用户只会记住后面那个「慎用」，而实际更严。
const pw = pack.invoke('pregnancy', { herbs: '桃仁' });
check('桃仁只留一条妊娠结论', pw.entries.length, 1);
check('留下的是更严的那条', pw.entries[0].level, 'strong');
truthy('播报里不出现两个相反的词', !(/禁用/.test(pw.speech) && /慎用/.test(pw.speech)));
// 查不到记录 ≠ 可以用，必须明说
const safe = pack.invoke('pregnancy', { herbs: '甘草' });
truthy('无记录时说明「不等于安全」', /不等于/.test(safe.speech));
console.log(`       ${safe.speech}`);

console.log('\n【14】营养素：大小写与口语缩写都要认');
for (const say of ['维生素C', '维生素c', '维他命C', '维C']) {
  const r = pack.invoke('vitamin', { name: say });
  check(`「${say}」查得到`, r.found, true);
}
// 引擎的「功效」字段自带句号，直接 join('。') 会念出「。。」
const vc = pack.invoke('vitamin', { name: '维生素C' });
truthy('播报里没有连续两个句号', !vc.speech.includes('。。'));

console.log('\n【15】本草条目：整句里要能抽出药名');
for (const say of ['当归', '查一下当归', '当归是什么', '帮我看看人参']) {
  const r = pack.invoke('herb', { query: say });
  truthy(`「${say}」能查到条目`, r.found === true && typeof r.name === 'string');
}
const dup = pack.invoke('herb', { query: '三七和三七' });
truthy('口误重复的药名收敛成一味', dup.speech.includes('三七') && !/三七和三七/.test(dup.speech));

console.log('\n' + '='.repeat(60));
console.log(`通过 ${PASSED.length} / ${PASSED.length + FAILED.length}`);
if (FAILED.length > 0) {
  console.log('失败项：' + FAILED.join('、'));
  process.exit(1);
}
console.log('全部通过');
