// 用药计划的解析：把「记一下我早上八点吃二甲双胍」拆成 {药名, 时间}。
//
// 为什么单独一个文件：这是管家形态的地基。之前岐黄阁只会「记住你在吃什么」，
// 不知道「几点吃」——而不知道几点，就没法提醒，也就没有每天被打开的理由。
//
// 解析原则和 qihuang-pack 一致：**只用确定性规则，不猜。**
// 猜错时间的代价是这个人的药提醒没响，比「没听懂」严重得多。
// 所以凡是解析不出来的，一律返回 null，让调用方去问，而不是套一个默认值。
//
// 支持的钟点说法（只做真正常见的这些，不追求全覆盖）：
//   早上八点 / 上午8点 / 8点 / 八点半 / 早上八点十五
//   下午三点 / 晚上八点 / 晚八点 / 中午十二点 / 凌晨两点 / 睡前
// 「早上八点」= 08:00，「晚上八点」= 20:00，「下午三点」= 15:00。
// 时段词决定 12 小时制的换算，没写时段时按 24 小时制原样取（8点 = 08:00）。

/** 中文数字，只到「二十四」够用（钟点最大 24）。 */
const CN_DIGIT = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 时段词 → 12 小时制换算规则。 */
const PERIODS = [
  { re: /(凌晨|夜里|半夜)/, kind: 'am12' },
  { re: /(早上|早晨|清晨|上午|早间)/, kind: 'am' },
  { re: /(中午|正午)/, kind: 'noon' },
  { re: /(下午|午后)/, kind: 'pm' },
  // 单独的「晚」也要认：「晚八点」是口语里最常见的说法之一，
  // 漏了它会被当成没有时段词，按 24 小时制取成 08:00——整整差 12 小时。
  { re: /(晚上|晚间|傍晚|夜里|晚)/, kind: 'pm' },
];

/** 「睡前」「饭前」「饭后」这类相对时段，没有固定钟点，单独标记。 */
const RELATIVE_TIMINGS = [
  { re: /(睡前|临睡|睡觉前)/, key: 'before_sleep' },
  { re: /(饭前|餐前|吃饭前|晚饭前|早餐前|中饭前)/, key: 'before_meal' },
  { re: /(饭后|餐后|吃饭后|晚饭后|早餐后|中饭后)/, key: 'after_meal' },
  { re: /(早起|起床后|早上起来)/, key: 'after_wake' },
];

/** 把「八」「十五」「二十」这类中文数字转成整数。转不了返回 null。 */
export function parseCnNumber(token) {
  if (!token) return null;
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  if (token === '十') return 10;
  if (token.includes('十')) {
    const [a, b] = token.split('十');
    const tens = a ? CN_DIGIT[a] : 1;
    const ones = b ? CN_DIGIT[b] : 0;
    if (tens === undefined || ones === undefined) return null;
    return tens * 10 + ones;
  }
  if (token.length === 1 && CN_DIGIT[token] !== undefined) return CN_DIGIT[token];
  return null;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 12 小时制 → 24 小时制。时段词决定换算，没时段就原样。 */
function toHour24(hour, periodKind) {
  if (periodKind === 'am12') return hour === 12 ? 0 : hour;          // 凌晨 12 点 = 00:00
  if (periodKind === 'am') return hour === 12 ? 0 : hour;            // 早上 12 点 = 00:00
  if (periodKind === 'noon') return hour <= 6 ? hour + 12 : hour;    // 中午 1 点 = 13:00
  if (periodKind === 'pm') return hour === 12 ? 12 : (hour < 12 ? hour + 12 : hour); // 下午 3 点 = 15:00
  return hour;
}

/**
 * 从一句话里抽时间。
 *
 * @param {string} text
 * @returns {{time:string, source:string}|{timing:string, source:string}|null}
 *   time 是 'HH:MM'；timing 是 before_sleep / before_meal / after_meal / after_wake。
 *   都解析不出来返回 null —— **不套默认值**。
 */
export function parseMedTime(text) {
  const src = String(text || '').replace(/[\s\u3000]+/g, '');
  if (!src) return null;

  // ① 相对时段优先。它们本身就不是钟点，硬套一个时间等于替用户做决定。
  for (const t of RELATIVE_TIMINGS) {
    if (t.re.test(src)) return { timing: t.key, source: src.match(t.re)[0] };
  }

  // ② 具体钟点：时段词 + 小时 + 可选的分
  const period = PERIODS.find((p) => p.re.test(src));
  const periodKind = period ? period.kind : null;

  // 先切掉时段词，避免「晚上八点」的「晚」被当成内容
  let body = src;
  if (period) body = body.replace(period.re, '');

  // 小时：数字或中文数字，后面必须跟「点」或「时」
  const m = body.match(/([零〇一二两三四五六七八九十0-9]{1,3})\s*(?:点|时|:|：)\s*(半|[零〇一二两三四五六七八九十0-9]{1,3})?/);
  if (!m) return null;

  const hour = parseCnNumber(m[1]);
  if (hour === null || hour < 0 || hour > 24) return null;

  let minute = 0;
  if (m[2] === '半') minute = 30;
  else if (m[2]) {
    const mm = parseCnNumber(m[2]);
    if (mm === null || mm < 0 || mm > 59) return null;
    minute = mm;
  }

  let h24 = toHour24(hour, periodKind);
  if (h24 > 23) return null;

  return { time: `${pad(h24)}:${pad(minute)}`, source: m[0] };
}

/** 把时间说得像人话：「08:00」→「早上 8 点」。屏幕上用。 */
export function humanTime(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return '';
  const [h, m] = time.split(':').map(Number);
  // 格式对不代表值合法。不校验的话「25:99」会被念成「晚上 13 点 99 分」，
  // 而这行字会直接出现在提醒页上。
  if (h > 23 || m > 59) return '';
  const minutePart = m === 0 ? '' : (m === 30 ? '半' : ` ${m} 分`);
  let label;
  let hour12;
  if (h === 0) { label = '凌晨'; hour12 = 12; }
  else if (h < 6) { label = '凌晨'; hour12 = h; }
  else if (h < 12) { label = '早上'; hour12 = h; }
  else if (h === 12) { label = '中午'; hour12 = 12; }
  else if (h < 18) { label = '下午'; hour12 = h - 12; }
  else { label = '晚上'; hour12 = h - 12; }
  return `${label} ${hour12} 点${minutePart}`;
}

/** 相对时段的屏幕文案。 */
export const TIMING_LABEL = {
  before_sleep: '睡前',
  before_meal: '饭前',
  after_meal: '饭后',
  after_wake: '起床后',
};

/**
 * 把「记一下我早上八点吃二甲双胍，晚上八点吃阿托伐他汀」拆成多条计划。
 *
 * 为什么支持一句多条：用户不会为了记两顿药分两次说话。
 * 但这要求切分逻辑靠得住——切错了会把两种药合并成一条，提醒就漏了一顿。
 * 所以切分只在「出现了新的时间词」时才断开，切不准就整句当一条，宁可少记不记错。
 *
 * @param {string} text
 * @returns {Array<{name:string, time:string|null, timing:string|null, raw:string}>}
 */
export function parseMedPlans(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  // 去掉记忆类的引导词
  const cleaned = raw
    .replace(/(帮我)?(记一下|记住|记下|记录一下)/g, '')
    .replace(/^(我|我的)/, '')
    .trim();

  // 按标点/连词切成候选片段
  const segments = cleaned
    .split(/[，,。；;、]|然后|还有|另外/)
    .map((s) => s.trim())
    .filter(Boolean);

  const list = [];
  for (const seg of segments) {
    const t = parseMedTime(seg);
    if (!t) continue; // 没有时间词，不是一条计划
    const PERIOD_PREFIX = /^(凌晨|早上|早晨|清晨|上午|中午|下午|晚上|晚间|傍晚|夜里|半夜)/;
    // 药名 = 去掉时间词和「吃/服用」之后的剩余，再剥掉残留的时段词。
    // 顺序不能反：先剥时段再判长度，否则「中午十二点吃饭」会剥成「中午饭」→「饭」，
    // 长度够 2，回退逻辑根本不触发，最后屏幕上就是一个孤零零的「饭」字。
    let name = seg
      .replace(t.source, '')
      .replace(/(我|要|需要|每天|天天|在)?(吃|服用|用|喝)/g, '')
      .replace(/^[的地得]+|[的地得]+$/g, '')
      .trim()
      .replace(PERIOD_PREFIX, '')
      .trim();
    // 剥太狠时往后退一步：只删时间词和时段词，保留动词。
    // 「吃饭」比「饭」像人话；判据用字数，只区分「剥过头」和「剥得刚好」。
    if (name.length < 2) name = seg.replace(t.source, '').replace(PERIOD_PREFIX, '').trim();
    if (!name) continue;
    list.push({
      name,
      time: t.time || null,
      timing: t.timing || null,
      raw: seg,
    });
  }
  return list;
}
