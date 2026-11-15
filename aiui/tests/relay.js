// 接力链路专项测试。
//
// 为什么单独写：追问接力改了三版（1.1.11 传 carry、1.1.12 信模型给 state、
// 1.1.13 从药典反推），每一版都是我在命令行手敲两三句验证的，
// 没有固化下来。结果同一个 bug 换了个形状又出现两次。
//
// 这份测试锁的是**行为**，不是实现：
//   用户说完状况再说「我该怎么调理」，系统必须接上那个状况；
//   中间插一句查药，状况就该过期，不能乱接。
//
// 本地没有 LLM，所以用 rememberState 模拟「感知层已经判定完状况」这一步，
// 验的是它之后的所有逻辑。感知层本身只能在真机验，这里管不到。

import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangView } from '../ui/qihuang-view.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';

const { sandbox } = loadEngines({ quiet: true });
const engines = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};

let uid = 0;
const mk = () =>
  createQihuangView({
    engines,
    store: createProfileStore({ backend: memoryBackend(), userId: `relay-${(uid += 1)}` }),
  });

let pass = 0;
let fail = 0;
const fails = [];

function text(r) {
  const p = r.patch || {};
  return `${p.title || ''} ${p.answer || ''}`;
}

function check(caseName, cond, got) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    fails.push({ caseName, got });
  }
  console.log(`  ${cond ? '✓' : '✗'} ${caseName}`);
  if (!cond) console.log(`      → ${String(got).replace(/\n/g, ' ').slice(0, 90)}`);
}

// ── 1. 有上文时，追问调理要接上 ──
console.log('\n【1】有上文，追问要接上');
{
  const v = mk();
  v.rememberState('血虚');
  const r = v.handle('我该怎么调理');
  const t = text(r);
  check(
    '追问「我该怎么调理」→ 接上血虚（不出现「说哪儿不舒服」）',
    !/说哪儿不舒服/.test(t) && /血虚/.test(t),
    t,
  );
}

// ── 2. 无上文时，追问要说「说哪儿不舒服」 ──
console.log('\n【2】无上文，不许装作知道');
{
  const v = mk();
  const r = v.handle('我该怎么调理');
  const t = text(r);
  check('没有上文 → 请用户说症状', /说哪儿不舒服/.test(t) && !/这个不做/.test(t), t);
}

// ── 3. 中间查了药，上文作废 ──
console.log('\n【3】上文过期要清掉');
{
  const v = mk();
  v.rememberState('血虚');
  v.handle('决明子有什么功效'); // 这一轮答的是查药，状况应该失效
  const r = v.handle('我该怎么调理');
  const t = text(r);
  check('查完药再追问 → 不该接老状况', !/血虚的话/.test(t), t);
}

// ── 4. 真拒绝不能被「缺信息」话术吞掉 ──
console.log('\n【4】真拒绝仍然拒绝');
{
  const v = mk();
  const r = v.handle('帮我开个方子');
  const t = text(r);
  check('开方 → 「这个不做」，不是「说哪儿不舒服」', /这个不做/.test(t), t);
}

// ── 5. 给了「在吃什么」之后要出清单 ──
console.log('\n【5】交代完用药要给药典清单');
{
  const v = mk();
  v.rememberState('血虚');
  v.handle('我该怎么调理'); // 走到「先知道你在吃什么」
  const r = v.handle('我都没在吃');
  const t = text(r);
  check('回答「我都没在吃」→ 出具体药材', /当归|火麻仁|龙眼肉|党参/.test(t), t);
}

// ── 6. rememberState 传空不能把上文清掉 ──
console.log('\n【6】空值不许污染上文');
{
  const v = mk();
  v.rememberState('血虚');
  v.rememberState('');
  const r = v.handle('我该怎么调理');
  check('rememberState("") 之后，血虚还在', /血虚/.test(text(r)), text(r));
}

// ── 7. 各种说法都要能触发接力 ──
console.log('\n【7】追问的各种说法');
for (const q of ['我该怎么调理', '能推荐药膳吗', '要不要食疗', '怎么养比较好', '吃什么能改善']) {
  const v = mk();
  v.rememberState('血虚');
  const t = text(v.handle(q));
  check(`「${q}」→ 接上血虚`, /血虚/.test(t) && !/说哪儿不舒服/.test(t), t);
}

// ── 8. 药材名当上文时也不能崩 ──
console.log('\n【8】上文是药名也能用');
{
  const v = mk();
  v.rememberState('当归'); // 药典反推失败时的兜底形态
  const r = v.handle('我该怎么调理');
  const t = text(r);
  check('上文是药名 → 至少给出该药信息，不空回', /当归/.test(t) && text(r).length > 20, t);
}

// ── 汇总 ──
const total = pass + fail;
console.log('\n' + '='.repeat(56));
console.log(`通过 ${pass} / ${total}`);
if (fail) {
  console.log(`\n失败 ${fail} 条：`);
  for (const f of fails) console.log(`  · ${f.caseName}\n      ${String(f.got).replace(/\n/g, ' ').slice(0, 100)}`);
  process.exitCode = 1;
} else {
  console.log('全部通过');
}
