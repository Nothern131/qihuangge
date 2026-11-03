// 用药计划解析的测试。
//
// 这一层出错的方式很具体：**把时间算错了一小时**，用户的药就没按时吃。
// 所以断言不看「有没有解析出东西」，看的是**每一个时段词换算成几点**。
//
// 另一类错是「猜」：解析不出来时套一个默认时间（比如默认早上八点）。
// 那会让用户在完全没说时间的情况下收到一个 8 点的提醒，以为是自己设的。
// 所以有一条专门的断言守着「解析不出来就返回空」。

import assert from 'node:assert/strict';
import {
  parseMedPlans, parseMedTime, parseCnNumber, humanTime, TIMING_LABEL,
} from '../adapter/med-schedule.js';
import { loadEngines } from '../adapter/load-engines.js';
import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';
import { createProfileStore, memoryBackend } from '../adapter/profile-store.js';

let pass = 0;
let fail = 0;
function check(label, fn) {
  try {
    fn();
    pass += 1;
    console.log(`  [PASS] ${label}`);
  } catch (err) {
    fail += 1;
    console.log(`  [FAIL] ${label}`);
    console.log(`         ${err.message}`);
  }
}
function eq(label, actual, expected) {
  check(`${label}（期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}）`, () => {
    assert.deepEqual(actual, expected);
  });
}

console.log('=== 用药计划解析 ===');

// ── 中文数字 ────────────────────────────────────────────
console.log('\n[1] 中文数字：语音识别回来的是汉字，不是阿拉伯数字');

eq('八 → 8', parseCnNumber('八'), 8);
eq('十 → 10', parseCnNumber('十'), 10);
eq('十一 → 11', parseCnNumber('十一'), 11);
eq('二十 → 20', parseCnNumber('二十'), 20);
eq('二十三 → 23', parseCnNumber('二十三'), 23);
eq('两 → 2', parseCnNumber('两'), 2);
eq('阿拉伯数字原样', parseCnNumber('8'), 8);
eq('认不出的返回 null，不猜', parseCnNumber('什么'), null);

// ── 时段换算（这一组错了就是吃错时间）────────────────────
console.log('\n[2] 时段换算：早上 8 点 ≠ 晚上 8 点');

const TIME_CASES = [
  ['早上八点', '08:00'],
  ['上午8点', '08:00'],
  ['八点', '08:00'],
  ['八点半', '08:30'],
  ['早上八点十五', '08:15'],
  ['中午十二点', '12:00'],
  ['中午一点', '13:00'],
  ['下午三点', '15:00'],
  ['晚上八点', '20:00'],
  ['晚八点', '20:00'],
  ['晚上八点半', '20:30'],
  ['凌晨两点', '02:00'],
  ['早上十二点', '00:00'],
  ['晚上十二点', '12:00'],
];
const badTimes = [];
for (const [text, want] of TIME_CASES) {
  const r = parseMedTime(text);
  if (!r || r.time !== want) badTimes.push([text, want, r && r.time]);
}
eq('14 种钟点说法全部换算正确', badTimes, []);

// ── 相对时段 ────────────────────────────────────────────
console.log('\n[3] 「睡前 / 饭前」这类没有固定钟点，不能替用户定时间');

eq('睡前', parseMedTime('睡前吃') && parseMedTime('睡前吃').timing, 'before_sleep');
eq('饭前', parseMedTime('饭前吃') && parseMedTime('饭前吃').timing, 'before_meal');
eq('饭后', parseMedTime('饭后吃') && parseMedTime('饭后吃').timing, 'after_meal');
eq('相对时段不带 clock 时间', parseMedTime('睡前吃') && parseMedTime('睡前吃').time, undefined);
eq('四种相对时段都有屏幕文案',
  Object.keys(TIMING_LABEL).sort(), ['after_meal', 'after_wake', 'before_meal', 'before_sleep']);

// ── 不猜 ────────────────────────────────────────────────
console.log('\n[4] 解析不出来就返回空，不套默认值');

eq('没说时间的「记一下我在吃钙片」不产出计划', parseMedPlans('记一下我在吃钙片'), []);
eq('只有时间没内容时不算一条', parseMedPlans('早上八点').length, 0);
eq('乱码不产出计划', parseMedPlans('★☆※点'), []);
eq('空字符串', parseMedPlans(''), []);

// ── 一句多药 ────────────────────────────────────────────
console.log('\n[5] 一句话记两种药：切不开宁可少记，不能记错');

const two = parseMedPlans('记一下我早上八点吃二甲双胍，晚上八点吃阿托伐他汀');
eq('拆成两条', two.length, 2);
eq('第一条', [two[0].name, two[0].time], ['二甲双胍', '08:00']);
eq('第二条', [two[1].name, two[1].time], ['阿托伐他汀', '20:00']);

// 剥「吃」剥到只剩一个字时，回退成原词——「吃饭」不能变成「饭」
const meal = parseMedPlans('中午十二点吃饭');
eq('剥太狠时回退，「吃饭」不变成「饭」', meal[0].name, '吃饭');

// ── 回显 ────────────────────────────────────────────────
console.log('\n[6] 屏幕回显：时间要说得像人话');

eq('08:00 → 早上 8 点', humanTime('08:00'), '早上 8 点');
eq('20:30 → 晚上 8 点半', humanTime('20:30'), '晚上 8 点半');
eq('12:00 → 中午 12 点', humanTime('12:00'), '中午 12 点');
eq('00:00 → 凌晨 12 点', humanTime('00:00'), '凌晨 12 点');
eq('非法输入返回空串，不抛', humanTime('25:99'), '');
eq('undefined 返回空串', humanTime(undefined), '');

// ── 端到端：从一句话到一条会响的计划 ─────────────────────
console.log('\n[7] 端到端：带时间的进计划，不带时间的进「在吃清单」');

const { sandbox } = loadEngines({ quiet: true });
const ENGINES = {
  InteractionEngine: sandbox.InteractionEngine,
  BencaoEngine: sandbox.BencaoEngine,
  VitaminEngine: sandbox.VitaminEngine,
};
const pack = createQihuangPack(ENGINES);
const store = createProfileStore({ backend: memoryBackend() });
const agent = createQihuangAgent(pack, { store });

const r1 = askQihuang(agent, '记一下我早上八点吃二甲双胍');
check('答复里把时间念回去（这是唯一一次能纠错的机会）', () => {
  assert.ok(/早上 8 点/.test(r1.speech), r1.speech);
  assert.ok(/二甲双胍/.test(r1.speech), r1.speech);
});
eq('计划里存了 08:00', store.listMedPlans().map((x) => [x.name, x.time]), [['二甲双胍', '08:00']]);
eq('带时间的不会进「在吃清单」', store.listItems().length, 0);

// 同一种药同一时间说两次，不该变成两条提醒
askQihuang(agent, '记一下我早上八点吃二甲双胍');
eq('重复记不新增', store.listMedPlans().length, 1);

// 不带时间：走原来的清单，不进计划
const r3 = askQihuang(agent, '记一下我在吃钙片');
check('不带时间的走清单', () => {
  assert.ok(/记下了/.test(r3.speech), r3.speech);
});
eq('计划没被动', store.listMedPlans().length, 1);
eq('清单里有了钙', store.listItems().map((x) => x.name), ['钙']);

// 补充交代时不重复动词，也要进计划
const store2 = createProfileStore({ backend: memoryBackend() });
const agent2 = createQihuangAgent(pack, { store: store2 });
askQihuang(agent2, '记一下早上八点吃二甲双胍，晚上八点吃阿托伐他汀');
eq('一句两条都进了计划',
  store2.listMedPlans().map((x) => [x.name, x.time]),
  [['二甲双胍', '08:00'], ['阿托伐他汀', '20:00']]);

// 上限：说清楚，不悄悄丢最旧的一条
const store3 = createProfileStore({ backend: memoryBackend() });
const agent3 = createQihuangAgent(pack, { store: store3 });
const many = Array.from({ length: 21 }, (_, i) => `记一下${i + 1}点吃药${i + 1}号`).join('，');
const r4 = askQihuang(agent3, many);
// 判据不能只看「20」——「记下了 20 条」里也有 20，那种假绿抓不到吞掉第 21 条的问题。
check('超过 20 条时说明白了，不是静默丢弃', () => {
  assert.ok(/没记上|最多记/.test(r4.speech), r4.speech);
});
check('上限守住了', () => {
  assert.ok(store3.listMedPlans().length <= 20, String(store3.listMedPlans().length));
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail > 0) process.exit(1);
