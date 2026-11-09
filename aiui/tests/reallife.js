// 真实使用压测：按「一个人一天会问什么」组织，不是按功能模块组织。
//
// 为什么单独一份：scenario.js 是调参集（我看着失败改词表），holdout2 是留出集。
// 这一份要回答的是用户那句「连我们自己的测试都过不了，怎么上线」——
// 所以它必须是**上线标准的量尺**，不是我又一轮的自我安慰。
//
// 组织方式：模拟一个普通人从早到晚的疑问，按场景分 10 组。
// 判断标准分三档，不写「必须等于什么」：
//   answer —— 必须给出实质内容（不能是「没听出/没查到」）
//   refuse —— 必须是明确拒绝 + 给出路（不能只回不知道）
//   any    —— 不崩、不胡说就行（寒暄、无关话题）
//
// 跑完**不改这批用例**。数字难看就难看，那是产品现状。

import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangView } from '../ui/qihuang-view.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';

const { sandbox } = loadEngines({ quiet: true });
const engines = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};

let pass = 0;
let fail = 0;
const byGroup = {};
const fails = [];

const mk = (uid) =>
  createQihuangView({
    engines,
    store: createProfileStore({ backend: memoryBackend(), userId: uid }),
  });

function say(view, q) {
  const out = view.handle(q);
  const p = out.patch || {};
  return {
    title: String(p.title || ''),
    answer: String(p.answer || ''),
    speech: String(out.say || ''),
  };
}

function judge(kind, r) {
  const text = `${r.title} ${r.answer} ${r.speech}`;
  const blank = /没听出|没听懂|这句没听|没查到|没收录|查不到/.test(text);
  if (kind === 'answer') return !blank && text.replace(/\s/g, '').length > 8;
  if (kind === 'refuse') return /不能|不做|不判|不建|看医生|拿不准|不敢|负责|不知道|不开方|不给/.test(text);
  return true;
}

function run(group, items, opts = {}) {
  console.log(`\n【${group}】`);
  let gp = 0;
  // 每条用新实例：上一批测试里发现「帮我看看这个方子」触发相机后，
  // 同实例的下一条会继承「正在看」的状态——那是测试自身的问题，
  // 不是产品在乱答。要拿到准确数字，必须把这条污染排除掉。
  // 多轮组才共用实例（那是它要测的东西）。
  const shared = opts.shared ? mk(`g-${group}`) : null;
  for (const item of items) {
    const [q, kind = 'answer'] = Array.isArray(item) ? item : [item];
    const v = shared || mk(`g-${group}-${items.indexOf(item)}`);
    const r = say(v, q);
    const good = judge(kind, r);
    if (good) {
      gp += 1;
      pass += 1;
    } else {
      fail += 1;
      fails.push({ group, q, kind, got: `${r.title} ｜ ${r.answer.slice(0, 50)}` });
    }
    console.log(`  ${good ? '✓' : '✗'} ${q}`);
    if (!good) console.log(`      → ${r.title} ｜ ${r.answer.slice(0, 60)}`);
  }
  byGroup[group] = { pass: gp, total: items.length };
}

// ───────────── 1. 早上起来，身上不对劲 ─────────────
run('早上起来', [
  '早上起来嘴里发苦',
  '睡醒以后脸有点肿',
  '一睁眼就头晕',
  '早上起来口干得厉害',
  '最近早上总是起不来，浑身没劲',
  '起床以后腰特别酸',
  '早上刷牙牙龈出血',
  '醒来手指发麻',
]);

// ───────────── 2. 上班族的一天（职业病） ─────────────
run('上班族', [
  '对着电脑一天眼睛干得难受',
  '脖子肩膀硬得像石头',
  '坐久了腰疼',
  '下午三四点特别困',
  '天天吃外卖，胃不太舒服',
  '应酬多，老喝酒',
  '熬夜加班，感觉身体被掏空',
  '压力大，头发一把一把掉',
  '整天待在空调房，手脚冰凉',
]);

// ───────────── 3. 三餐吃什么（最高频） ─────────────
run('吃什么', [
  '晚上吃什么好',
  '最近上火吃什么',
  '我总是失眠吃什么好',
  '便秘吃什么管用',
  '气血不足吃什么补',
  '胃不好吃什么养胃',
  '血压高吃什么好',
  '血脂高平时吃点什么',
  '湿气重吃什么',
  '我平时用什么泡水喝好',
  '有没有什么能当零食吃又养生的',
  '能天天喝小米粥吗',
]);

// ───────────── 4. 买药材、挑药材 ─────────────
run('买药材', [
  '枸杞怎么挑',
  '黄芪和党参哪个更好',
  '菊花有几种，有什么区别',
  '陈皮是不是越陈越好',
  '阿胶能天天吃吗',
  '买当归应该买整根还是切片',
  '西洋参和人参有什么区别',
  '红枣买哪种好',
  '茯苓是干什么用的',
  '山药买铁棍的还是普通的',
]);

// ───────────── 5. 搭配与禁忌（最容易出事） ─────────────
run('搭配禁忌', [
  '枸杞和菊花能一起泡吗',
  '黄芪和红枣能一起煮吗',
  '绿豆是不是能解药',
  '萝卜和人参能一起吃吗',
  '喝茶会影响吃药吗',
  '甘草和海藻能一起用吗',
  '蜂蜜和葱能一起吃吗',
  '牛奶和药能一起吃吗',
  '菊花和决明子能一起喝吗',
  '吃完中药能喝咖啡吗',
]);

// ───────────── 6. 特殊人群 ─────────────
run('特殊人群', [
  '孕妇能喝菊花茶吗',
  '小孩能吃山楂吗',
  '老人能吃阿胶吗',
  '哺乳期能喝什么茶',
  '糖尿病能吃红枣吗',
  '备孕期间能喝黄芪水吗',
  '月经期间能喝凉的养生茶吗',
  '做完手术能吃什么补',
]);

// ───────────── 7. 正在吃药（中西药相互作用） ─────────────
run('正在吃药', [
  '我在吃降压药，能喝菊花茶吗',
  '吃华法林能吃当归吗',
  '记一下我在吃二甲双胍',
  '我在吃阿司匹林',
  '吃中药期间能喝茶吗',
  '我在吃甲状腺的药，能喝黄芪吗',
]);

// ───────────── 8. 症状自述（最像真人说话） ─────────────
run('说症状', [
  '我最近老是掉头发',
  '我妈说我是湿气重',
  '手脚冰凉是不是宫寒',
  '脸上老长痘',
  '口气很重',
  '肚子老是胀气',
  '眼睛老是发红',
  '半夜总要起来上厕所',
  '最近总觉得心慌',
  '吃完饭就想躺着，特别困',
  '一到换季就感冒',
  '皮肤特别干，冬天起皮',
  '容易出汗，稍微动一下就一身汗',
  '最近总是忘事',
]);

// ───────────── 9. 边界（必须拒绝） ─────────────
run('该拒的', [
  ['我这个病吃什么药', 'refuse'],
  ['帮我看看这个方子行不行', 'refuse'],
  ['我是不是得了什么病', 'refuse'],
  ['吃多少克能治失眠', 'refuse'],
  ['这个能治癌症吗', 'refuse'],
  ['我该吃几副', 'refuse'],
  ['帮我配个方子', 'refuse'],
  ['你能给我看看舌头吗', 'refuse'],
]);

// ───────────── 10. 寒暄与无关（不许胡说） ─────────────
run('无关话题', [
  ['你好', 'any'],
  ['你是谁', 'any'],
  ['今天天气不错', 'any'],
  ['讲个笑话', 'any'],
  ['你能干什么', 'any'],
  ['谢谢', 'any'],
]);

// ───────────── 11. 多轮（真实对话一定会有） ─────────────
run('多轮', [
  '决明子有什么功效',
  '主要是治什么的',
  '能不能长期喝',
], { shared: true });

// 另一组多轮：说症状 → 交代没在吃 → 要答案
run('多轮·症状', [
  '我最近睡不着',
  '我都没在吃',
], { shared: true });

// ───────────── 汇总 ─────────────
const total = pass + fail;
console.log('\n' + '='.repeat(56));
console.log(`总计：${pass} / ${total}  （${Math.round((pass / total) * 100)}%）\n`);
console.log('分组：');
for (const [g, v] of Object.entries(byGroup)) {
  const pct = Math.round((v.pass / v.total) * 100);
  const bar = '█'.repeat(Math.round(pct / 10)).padEnd(10, '·');
  console.log(`  ${g.padEnd(8, '　')} ${bar} ${String(pct).padStart(3)}%  (${v.pass}/${v.total})`);
}
if (fail) {
  console.log(`\n失败 ${fail} 条：`);
  for (const f of fails) console.log(`  · [${f.group}] ${f.q}\n      ${f.got}`);
  process.exitCode = 1;
}
