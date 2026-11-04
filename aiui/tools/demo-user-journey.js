// 用户视角走查：模拟一个真实用户从开机到被提醒的完整一天。
//
// 这不是测试（tests/ 里 587+ 条断言管对错），这里管「体验」：
//   每一步打印两样东西 ——
//   📺 屏幕看到 = view.handle 返回的 patch（title/detail/answer/source/status）
//   🔊 眼镜念   = toBrief(say, {max, tail})，与页面 apply() 完全同一压缩路径
// 任何一步听上去别扭、看上去拥挤，都该记下来改，而不是只让断言绿着。
//
// 只读走查：不改任何产品代码，跑完 git 必须还是干净的。

import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangView, GUIDE, INITIAL_STATE } from '../ui/qihuang-view.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';
import { toBrief } from '../core/speech.js';

const { sandbox } = loadEngines({ quiet: true });

const store = createProfileStore({ backend: memoryBackend(), userId: '体验用户' });
const view = createQihuangView({
  engines: {
    InteractionEngine: sandbox.InteractionEngine,
    BencaoEngine: sandbox.BencaoEngine,
    VitaminEngine: sandbox.VitaminEngine,
  },
  store,
});

let step = 0;

function show(userText, out) {
  step += 1;
  console.log(`\n─────────────────────────────────────────────`);
  console.log(`【${step}】👤 用户说：「${userText}」`);
  const p = out.patch || {};
  if (p.title !== undefined) console.log(`    📺 标题　 ${p.title}`);
  if (p.status !== undefined) console.log(`    📺 状态　 ${p.status}`);
  if (p.detail !== undefined) console.log(`    📺 摘要　 ${p.detail}`);
  if (p.answer !== undefined) console.log(`    📺 正文　 ${String(p.answer).split('\n').join('\n　　　　　')}`);
  if (p.tone !== undefined) console.log(`    📺 语气　 ${p.tone}`);
  if (out.say) {
    const heard = toBrief(out.say, { max: out.sayMax || 32, tail: out.tail || '' });
    console.log(`    🔊 眼镜念（${heard.length} 字）：${heard}`);
  } else {
    console.log(`    🔊 眼镜念（0 字）：（不播报）`);
  }
}

function ask(text) {
  const out = view.handle(text);
  show(text, out);
  return out;
}

console.log('═════════════════════════════════════════════');
console.log(' 岐黄阁 · 用户视角走查（同一个人，同一天，不重置档案）');
console.log('═════════════════════════════════════════════');

console.log('\n── 开机 ──');
console.log(`    🔊 开场白（${GUIDE.length} 字）：${GUIDE}`);
console.log(`    📺 首屏　 ${JSON.stringify({ title: INITIAL_STATE.title, detail: INITIAL_STATE.detail, status: INITIAL_STATE.status })}`);

console.log('\n── 第一幕：先随便查查（还不熟）──');
ask('黄芪');
ask('甘草海藻能不能一起吃');
ask('半夏有毒吗');

console.log('\n── 第二幕：开始交代自己的情况 ──');
ask('记一下我在吃当归');
ask('我脾胃虚寒');

console.log('\n── 第三幕：档案开始起作用 ──');
ask('黄连');
ask('我阴虚吃什么好');

console.log('\n── 第四幕：养生行为 ──');
ask('我这几天在艾灸');
ask('枸杞一天吃多少');
ask('帮我开个方子');

console.log('\n── 第五幕：三个月没用（冷热记忆）──');
{
  const d = store.decayConcerns(90);
  console.log(`    （模拟 90 天没提：重要度下降 ${d.decayed} 条）`);
}
ask('黄连'); // 主动提醒应该闭嘴（冷了），但查询核对仍然要说（全量 + reheat）
ask('我阴虚吃什么好'); // 用户主动提起 → reheat，又激活了

console.log('\n═════════════════════════════════════════════');
console.log(' 走查结束。档案里最终留下：');
console.log(`    在吃的：${store.listItems().map((i) => i.name).join('、') || '（无）'}`);
console.log(`    状况：${store.getConcerns().map((c) => `${c.text}(重要度${(c.importance || 0).toFixed(1)}${c.core ? ',核心' : ''})`).join('、') || '（无）'}`);
console.log(`    养生行为：${(store.listPractices ? store.listPractices() : []).map((x) => x.name || x).join('、') || '（无）'}`);
console.log('═════════════════════════════════════════════');
