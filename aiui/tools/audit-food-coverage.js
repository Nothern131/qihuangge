// 食补命中率审计：口语高频诉求 × 药典 102 味原文。
//
// 回答一个问题：用户说了这句话，系统给不给得出建议？
//   (a) extractStates 认不认这句话里的状况
//   (b) 药典 102 味的原文（功能与主治）里，药典自己写了适合的有几味
//   (c) food-advice 的 RULES 是否已有映射
// (a) 不认而 (b) 有货 = 听懂层漏词；(b) 为 0 = 药典没背书，给不出是诚实不是缺陷。
// 审计只读数据，不改产品。

import { FOODS } from '../adapter/food-canon.js';
import { extractStates } from '../adapter/advice.js';
import { RULES } from '../adapter/food-advice.js';

/** 口语高频诉求 → 状况识别正则（取自 adapter/advice.js 的 STATE_TERMS）。 */
const DEMANDS = [
  { say: '我阴虚吃什么好', re: /阴虚|虚火|上火|盗汗|口干舌燥/, rule: 'yin-deficiency' },
  { say: '我脾胃虚寒吃什么好', re: /脾胃虚寒|胃寒|脾胃虚弱|脾虚/, rule: 'spleen-cold' },
  { say: '我气虚吃什么好', re: /气虚|没力气|容易累|乏力/, rule: 'qi-deficiency' },
  { say: '我阳虚怕冷吃什么好', re: /阳虚|怕冷|手脚冰凉|畏寒/, rule: 'yang-deficiency' },
  { say: '我湿气重吃什么好', re: /湿气重|痰湿|舌苔厚/, rule: 'damp' },
  { say: '我血虚吃什么好', re: /血虚|贫血|面色发黄|面色差/, rule: 'blood-deficiency' },
  { say: '我失眠吃什么好', re: /失眠|睡不好|睡不着/, rule: 'insomnia' },
  { say: '我便秘吃什么好', re: /便秘|排便困难|大便费劲/, rule: 'constipation' },
  { say: '我咳嗽吃什么好', re: /咳嗽|咳痰/, rule: null },
  { say: '我没胃口吃什么好', re: /没胃口|食欲不振|不想吃饭/, rule: null },
  { say: '我腹胀吃什么好', re: /腹胀|肚子胀|消化不良/, rule: 'food-stagnation' },
  { say: '我拉肚子吃什么好', re: /拉肚子|腹泻|大便稀/, rule: null },
  { say: '我眼干看东西模糊吃什么好', re: /眼干|眼睛干|视物模糊/, rule: null },
  { say: '我心悸心慌吃什么好', re: /心悸|心慌/, rule: null },
  { say: '我咽干嗓子疼吃什么好', re: /咽干|嗓子疼|咽喉肿痛/, rule: null },
  { say: '我月经量少吃什么好', re: /月经量少|经血少/, rule: null },
];

/** 药典适应证段（与 adviseFor 的 usePart 同口径：只取「用于」第一段）。 */
function usePart(food) {
  const fx = String(food.functions || '');
  const i = fx.indexOf('用于');
  if (i < 0) return '';
  const rest = fx.slice(i + 2);
  const j = rest.indexOf('。');
  return j < 0 ? rest : rest.slice(0, j);
}

console.log(`药食同源库：${Object.values(FOODS).length} 味\n`);
const ALL = Object.entries(FOODS).map(([name, v]) => ({ _name: name, ...v }));
console.log('口语诉求'.padEnd(14), '识别', '药典命中', 'RULES', '命中的味（前6）');
console.log('─'.repeat(90));

const gaps = [];

for (const d of DEMANDS) {
  const recognized = extractStates(d.say).length > 0;
  // 命中口径：有 RULES 的证候用 RULES 的 primary+secondary 全词表测（与 adviseFor 同口径），
  // 没映射的用诉求原话的词测。审计漏了 secondary 会把「有货」误报成「断裂」。
  const words = d.rule && RULES[d.rule]
    ? [...RULES[d.rule].primary, ...RULES[d.rule].secondary]
    : null;
  const hit = ALL.filter((f) => (words ? words.some((w) => usePart(f).includes(w)) : d.re.test(usePart(f))));
  const mark = (ok) => (ok ? '✅' : '❌');
  const names = hit.map((f) => f._name || '?').slice(0, 6).join('、');
  console.log(
    d.say.padEnd(14),
    mark(recognized).padEnd(3),
    String(hit.length).padEnd(5),
    (d.rule && RULES[d.rule] ? RULES[d.rule].label : '无').padEnd(14),
    names,
  );
  // 断裂 = 药典有货（≥2 味）但没有 RULES 映射（刻意不做的会写进报告，不算断裂）
  if (hit.length >= 2 && (!d.rule || !RULES[d.rule])) {
    gaps.push({ say: d.say, count: hit.length, names: names });
  }
}

console.log('\n═══ 断裂点（药典有货 ≥2 味，但系统给不出建议）═══');
for (const g of gaps) console.log(`  ${g.say} → 药典写了 ${g.count} 味：${g.names}`);
if (!gaps.length) console.log('  （无）');
