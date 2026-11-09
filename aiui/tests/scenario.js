// 多轮场景测试：按「一个人真会怎么用」来测，不是按我写的规则测。
//
// 为什么单独写这份：tests/ 下其它文件都是在验证「某个改动没把别的地方弄坏」，
// 用例是我照着实现写的——那种测试永远通过，因为它测的是我的假设。
// 这份反过来：先想用户会说什么，再看它答不答得上。
//
// 分组说明：
//   A 单味药       —— 主干能力，必须 100%
//   B 追问         —— 用户实测栽在这里（「主要是治什么的」）
//   C 症状自述     —— 用户实测栽在这里（「口很干」）
//   D 症状+要办法  —— 说出症状之后到底给不给方向
//   E 多轮连贯     —— 用户反复抱怨的「没有延续性」
//   F 边界         —— 不该答的必须拒
//   G 口语含糊     —— 最接近真机的一句话

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
const fails = [];

const mk = (uid) =>
  createQihuangView({
    engines,
    store: createProfileStore({ backend: memoryBackend(), userId: uid }),
  });

/** 跑一条，返回 { title, answer }。 */
function say(view, q) {
  const out = view.handle(q);
  const p = out.patch || {};
  return {
    title: String(p.title || ''),
    answer: String(p.answer || ''),
    speech: String(out.say || ''),
  };
}

/**
 * 断言：这么问，应该答出这种东西。
 *
 * 判据写「必须出现什么」而不是「必须等于什么」——等于什么就把实现钉死了，
 * 改一句文案测试就红，那种红没有信息量。
 */
function expect(label, r, re, why) {
  const hit = re.test(`${r.title} ${r.answer} ${r.speech}`);
  if (hit) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    fails.push({ label, got: `${r.title} ｜ ${r.answer.slice(0, 70)}`, why });
    console.log(`  ✗ ${label}`);
    console.log(`     得到：${r.title} ｜ ${r.answer.slice(0, 70)}`);
    if (why) console.log(`     期望：${why}`);
  }
}

const NOT_HEARD = /没听出|没听懂|没查到|没收录/;

// ======================= A. 单味药（主干） =======================
console.log('\n[A] 单味药查询 —— 主干，必须全过');
{
  const v = mk('t-a');
  expect('枸杞有什么功效', say(v, '枸杞有什么功效'), /枸杞/);
  expect('决明子伤不伤胃', say(v, '决明子伤不伤胃'), /决明子/);
  expect('三七粉怎么用', say(v, '三七粉怎么用'), /三七/);
  expect('铁皮石斛能吃吗', say(v, '铁皮石斛能吃吗'), /石斛/);
  expect('附子有毒吗', say(v, '附子有毒吗'), /附子/);
}

// ======================= B. 追问（用户实测栽过） =======================
console.log('\n[B] 追问 —— 接在「决明子有什么功效」后面');
{
  const v = mk('t-b');
  say(v, '决明子有什么功效');
  const asks = [
    ['主要是治什么的', /决明子/],
    ['怎么泡水喝', /决明子|泡|吃/],
    ['一次放多少', /决明子|克|g/],
    ['能天天喝吗', /决明子/],
    ['有什么好处', /决明子/],
    ['管什么用', /决明子/],
    ['哪些人不能吃', /决明子|忌|慎/],
    ['和什么一起泡好', /决明子|配|一起/],
  ];
  for (const [q, re] of asks) {
    expect(`「${q}」要能接上决明子`, say(v, q), re);
  }
}

// ======================= C. 症状自述（用户实测栽过） =======================
console.log('\n[C] 症状自述 —— 每种说法都要认出来是个状况');
{
  const cases = [
    ['我最近老失眠', /失眠/],
    ['我每次睡醒之后口很干', /阴虚|口干|津/],
    ['我胃老是胀', /胀|食积|脾|胃/],
    ['眼睛干得难受', /眼|肝|阴虚/],
    ['手脚总是冰凉', /阳虚|寒|温/],
    ['最近老是上火', /上火|阴虚|热/],
    ['大便总是不成形', /湿|脾|便/],
    ['总是没力气', /气虚|乏力|补气/],
  ];
  for (const [q, re] of cases) {
    const r = say(mk(`t-c-${q}`), q);
    expect(`「${q}」`, r, re, '要认成一个状况并给方向');
  }
}

// ======================= D. 症状 + 要办法 =======================
console.log('\n[D] 症状 + 要办法 —— 说了症状就得给方向，不能只回收据');
{
  const cases = [
    ['我最近失眠怎么办', /失眠.*适合|适合|药典/],
    ['口很干吃什么好', /阴虚|百合|玉竹|适合/],
    ['胃胀怎么调理', /胀|食积|山楂|适合/],
    ['上火吃点什么', /火|热|适合/],
  ];
  for (const [q, re] of cases) {
    const r = say(mk(`t-d-${q}`), q);
    expect(`「${q}」要给出方向`, r, re, '不能只回「记下了」');
    // 只回收据是最典型的失败，单独判一次
    if (/^记下了/.test(r.answer) && !/适合|药典/.test(r.answer)) {
      fail += 1;
      fails.push({ label: `${q}（只回收据）`, got: r.answer.slice(0, 60), why: '说完症状只回「记下了」' });
    }
  }
}

// ======================= E. 多轮连贯（核心抱怨） =======================
console.log('\n[E] 多轮连贯 —— 用户反复说的「没有延续性」');
{
  // E1 药 → 追问 → 再追问
  const v1 = mk('t-e1');
  expect('① 决明子有什么功效', say(v1, '决明子有什么功效'), /决明子/);
  expect('② 主要是治什么的', say(v1, '主要是治什么的'), /决明子/);
  expect('③ 能天天喝吗', say(v1, '能天天喝吗'), /决明子/);

  // E2 症状 → 说自己没在吃 → 要答案
  const v2 = mk('t-e2');
  const r21 = say(v2, '我最近失眠');
  expect('① 说失眠就要有方向或问在吃什么', r21, /失眠/);
  const r22 = say(v2, '我都没在吃');
  expect('② 说「没在吃」之后要接着答完', r22, /失眠|适合|药典/);

  // E3 记档 → 问另一个药时主动提冲突
  const v3 = mk('t-e3');
  say(v3, '记一下我在吃降压药');
  const r32 = say(v3, '菊花茶能喝吗');
  expect('③ 记了在吃药，问菊花茶要提一句', r32, /菊花|降压|一起用|问问医生|冲突/);

  // E4 状况 → 问相反的药
  const v4 = mk('t-e4');
  say(v4, '我脾胃虚寒');
  const r42 = say(v4, '能吃黄连吗');
  expect('④ 说脾胃虚寒，问黄连要有反应', r42, /黄连|寒|慎|不适合|别/);

  // E5 换一味药
  const v5 = mk('t-e5');
  say(v5, '山药怎么吃');
  expect('⑤ 换问枸杞要跟着换', say(v5, '那枸杞呢'), /枸杞/);
}

// ======================= F. 边界（不能越线） =======================
console.log('\n[F] 边界 —— 该拒的必须拒，拒了要给出口');
{
  const v = mk('t-f');
  expect('「帮我开个方子」要拒', say(v, '帮我开个方子'), /不开方|不给开|方子|辨证|看医生/);
  expect('「我是不是肾虚」要拒诊断', say(v, '我是不是肾虚'), /不诊断|说不准|看医生|不能判断|辨/);
  expect('甘草海藻要查配伍禁忌', say(v, '甘草和海藻能一起用吗'), /相反|禁忌|不能|不宜/);
  expect('孕妇能吃薏米吗', say(v, '孕妇能吃薏米吗'), /孕妇|慎|不宜|忌/);
  expect('「你好」不该乱答', say(v, '你好'), /不舒服|查|药|小安/);
}

// ======================= G. 口语含糊（最接近真机） =======================
console.log('\n[G] 口语含糊 —— 真机上用户就是这么说话的');
{
  const cases = [
    ['那个枸杞咋吃', /枸杞/],
    ['睡不着', /失眠|睡/],
    // 「上火」在 advice.js 里归 yin-deficiency（虚火），这是设计内的：
    // 归实热会让一大批人从「阴虚慎灸」变成「实热禁灸」，程度错一档。
    // 所以判据要把「阴虚」也算过——这不是放宽，是原本就这么设计的。
    ['有点上火', /火|热|阴虚/],
    ['最近老是累', /气虚|乏力|没力气|补/],
    ['这个能吃吗', /不清楚|哪个|说药名|没听出|不能判断|看看这个/],
  ];
  for (const [q, re] of cases) {
    expect(`「${q}」`, say(mk(`t-g-${q}`), q), re);
  }
}

// ======================= 汇总 =======================
console.log('\n' + '='.repeat(52));
console.log(`通过 ${pass} / ${pass + fail}`);
if (fail) {
  console.log(`\n失败 ${fail} 条：`);
  for (const f of fails) {
    console.log(`  · ${f.label}`);
    console.log(`    得到：${f.got}`);
    if (f.why) console.log(`    该是：${f.why}`);
  }
  process.exitCode = 1;
} else {
  console.log('全部通过');
}
