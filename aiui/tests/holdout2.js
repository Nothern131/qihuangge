// 留出集：写完就先跑，跑完**不改这批用例**。
//
// 规矩来自《黑客松运筹优化打法手册》第 85 行：
//   「必须区分『已参与调参的集』与『未调参的集』，
//     调参集的满分不能当作真实防护效果 / 真实成绩。」
//
// tests/scenario.js 是调参集——我是看着它的失败结果去改词表的，
// 43/43 只能证明「我把自己举的例子都修好了」，不能证明它聪明。
// 这份不一样：写的时候不看实现，按「不同的人会怎么说话」编，
// 跑出来的数字就是第一次用的人遇到的真实水平。
//
// 覆盖五种说话人：
//   · 老人（说得具体、带身体部位、句子长）
//   · 年轻人（网络口语、省略多）
//   · 上班族（场景化：对着电脑、加班、通宵）
//   · 卖药的/懂一点的（用术语，但用得不准）
//   · 含糊的（说了半句、指代、语气词多）

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

function say(view, q) {
  const out = view.handle(q);
  const p = out.patch || {};
  return { title: String(p.title || ''), answer: String(p.answer || ''), speech: String(out.say || '') };
}

/**
 * 只判一件事：它有没有给出有用的东西。
 *
 * 判据分两种：
 *   · 「该答出来」——必须出现某个领域词（不是「没听出/没查到」）
 *   · 「该拒/该谨慎」——必须出现边界话术
 * 不写「必须等于什么」：那会把实现钉死。
 */
function ok(label, r, kind = 'answer') {
  const text = `${r.title} ${r.answer} ${r.speech}`;
  const heard = /没听出|没听懂|没查到|没收录|查不到/.test(text);
  let good;
  if (kind === 'answer') good = !heard && text.replace(/\s/g, '').length > 8;
  else if (kind === 'refuse') good = /不能|不做|不判|看医生|拿不准|不敢|负责|不知道/.test(text);
  else if (kind === 'any') good = true;

  if (good) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    fails.push({ label, got: `${r.title} ｜ ${r.answer.slice(0, 60)}`, kind });
    console.log(`  ✗ ${label}  →  ${r.title} ｜ ${r.answer.slice(0, 60)}`);
  }
}

// ─────────── 1. 老人式：句子长、带身体部位、说得很具体 ───────────
console.log('\n[1] 老人式说法（长句、具体部位）');
{
  const v = mk('h1');
  ok('我这腰啊，一到阴天就又酸又沉', say(v, '我这腰啊，一到阴天就又酸又沉'));
  ok('晚上躺下翻来覆去睡不着，天不亮就醒', say(v, '晚上躺下翻来覆去睡不着，天不亮就醒'));
  ok('吃点东西就堵在胃里下不去', say(v, '吃点东西就堵在胃里下不去'));
  ok('两条腿到下午就肿', say(v, '两条腿到下午就肿'));
}

// ─────────── 2. 年轻人式：省略、网络口语 ───────────
console.log('\n[2] 年轻人式（省略、口语）');
{
  const v = mk('h2');
  ok('最近特别虚', say(v, '最近特别虚'));
  ok('熬夜之后整个人都是懵的', say(v, '熬夜之后整个人都是懵的'));
  ok('上火了咋整', say(v, '上火了咋整'));
  ok('老是犯困', say(v, '老是犯困'));
}

// ─────────── 3. 上班族式：场景化描述 ───────────
console.log('\n[3] 上班族式（场景化）');
{
  const v = mk('h3');
  ok('对着电脑一天，眼睛又干又涩', say(v, '对着电脑一天，眼睛又干又涩'));
  ok('天天加班到半夜，感觉身体被掏空', say(v, '天天加班到半夜，感觉身体被掏空'));
  ok('一坐一整天，脖子肩膀都硬了', say(v, '一坐一整天，脖子肩膀都硬了'));
  ok('压力大，吃不下饭', say(v, '压力大，吃不下饭'));
}

// ─────────── 4. 懂一点术语但用不准 ───────────
console.log('\n[4] 术语式（会用词但不准）');
{
  const v = mk('h4');
  ok('我是不是气血不足', say(v, '我是不是气血不足'), 'refuse');
  ok('这个是肝火旺吗', say(v, '这个是肝火旺吗'), 'refuse');
  ok('湿气重怎么祛', say(v, '湿气重怎么祛'));
  ok('肾阴虚和肾阳虚有什么区别', say(v, '肾阴虚和肾阳虚有什么区别'), 'any');
}

// ─────────── 5. 含糊 ───────────
console.log('\n[5] 含糊（半句、指代、语气词）');
{
  const v = mk('h5');
  ok('就是那个……怎么说呢，反正不舒服', say(v, '就是那个……怎么说呢，反正不舒服'));
  ok('它有用吗', say(v, '它有用吗'));
  ok('那个东西怎么弄', say(v, '那个东西怎么弄'));
  ok('嗯，还有别的吗', say(v, '嗯，还有别的吗'), 'any');
}

// ─────────── 6. 生僻药名 / 别名 / 错别字 ───────────
console.log('\n[6] 药名变体（生僻、别名、常见错字）');
{
  const v = mk('h6');
  ok('五指毛桃能煲汤吗', say(v, '五指毛桃能煲汤吗'));
  ok('黄芪和北芪是一回事吗', say(v, '黄芪和北芪是一回事吗'));
  ok('枸杞子和枸杞有什么区别', say(v, '枸杞子和枸杞有什么区别'));
  ok('三七和土三七一样吗', say(v, '三七和土三七一样吗'), 'refuse');
  ok('霍香能吃吗', say(v, '霍香能吃吗'));   // 常见错字：藿香
}

// ─────────── 7. 追问的新说法（没在调参集里出现过）───────────
console.log('\n[7] 追问的新说法');
{
  const v = mk('h7');
  say(v, '黄芪有什么功效');
  ok('一天喝多少合适', say(v, '一天喝多少合适'));
  ok('喝多久能见效', say(v, '喝多久能见效'));
  ok('会不会上火', say(v, '会不会上火'));
  ok('和人参比呢', say(v, '和人参比呢'));
}

// ─────────── 8. 边界（该谨慎的）───────────
console.log('\n[8] 边界');
{
  const v = mk('h8');
  ok('我吃了这个以后头晕，是不是它的问题', say(v, '我吃了这个以后头晕，是不是它的问题'), 'refuse');
  ok('这个能治高血压吗', say(v, '这个能治高血压吗'), 'refuse');
  ok('能不能长期当水喝', say(v, '能不能长期当水喝'));
  ok('小孩能吃吗', say(v, '小孩能吃吗'));
}

// ─────────── 9. 三组多轮（不乱补、能接上）───────────
console.log('\n[9] 多轮');
{
  const v9 = mk('h9');
  say(v9, '当归有什么功效');
  ok('① 追问 会不会上火', say(v9, '会不会上火'));
  ok('② 追问 一天喝多少', say(v9, '一天喝多少'));

  const v9b = mk('h9b');
  ok('③ 无上文说「那个东西怎么弄」不该乱补', say(v9b, '那个东西怎么弄'), 'refuse');
}

// ─────────── 汇总 ───────────
const total = pass + fail;
console.log('\n' + '='.repeat(52));
console.log(`留出集：通过 ${pass} / ${total}（${Math.round((pass / total) * 100)}%）`);
if (fail) {
  console.log('\n失败清单：');
  for (const f of fails) console.log(`  · ${f.label}\n    得到：${f.got}`);
  process.exitCode = 1;
}
