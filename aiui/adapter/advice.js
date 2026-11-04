// 个人状况 × 本草禁忌的匹配。
//
// 这个文件只做一件事：把「用户说过自己是什么状况」和「本草库里写着什么人忌服」
// 对上，然后把**库里那句原话**说出来。
//
// 为什么不自己写规则：这条产品线最不能出的错是「我以为我知道」。
// 本草条目的 tabi 字段本来就写着「脾胃虚寒者慎用」「孕妇慎用」，
// 我们只需要判断用户说的情况是不是这一句，不需要判断这句话对不对。
// 一旦开始自己推「艾灸温热，所以不能配寒凉药」，结论的正确性就落在我们身上了。
//
// 匹配原则：
//   ① 只做文本命中，不做推理。库里没写这一类，就不说。
//   ② 命中就把原话念出来，不改写、不加工成「建议」。
//   ③ 一个都没命中时保持安静——「没提醒」不等于「可以放心」，
//      但也不该反过来变成「每次都提一句注意」。

/**
 * 用户口语 → 状况标签。
 *
 * 标签必须和本草 tabi 里的用词一致，否则永远匹配不上。
 * 收词原则：只收本草书里真会写的那几种，不追求覆盖用户所有说法。
 */
const STATE_TERMS = [
  // 里寒 / 脾胃
  { key: 'spleen-cold', tags: ['脾胃虚寒', '虚寒'], re: /(脾胃虚寒|胃寒|胃怕凉|怕凉|吃凉的?不?舒服|肚子怕凉|脾胃虚弱|脾虚)/ },
  // 阴虚 / 内热
  { key: 'yin-deficiency', tags: ['阴虚', '虚热'], re: /(阴虚|虚火|上火|内热|手心热|盗汗|口干舌燥)/ },
  // 阳虚
  { key: 'yang-deficiency', tags: ['阳虚'], re: /(阳虚|怕冷|手脚冰凉|畏寒)/ },
  // 湿盛 / 痰湿
  { key: 'damp', tags: ['湿盛', '痰湿'], re: /(湿气重|湿盛|痰湿|舌苔厚|舌苔腻|身体沉)/ },
  // 孕产哺乳
  { key: 'pregnancy', tags: ['孕妇', '妊娠', '哺乳'], re: /(怀孕|孕妇|妊娠|孕期|备孕|哺乳|喂奶)/ },
  // 儿童 / 年老体弱
  { key: 'weak', tags: ['体弱', '年老体弱'], re: /(体质弱|体弱|年纪大|老人|小孩|儿童)/ },
  // 气虚（和「虚不受补」相关）
  { key: 'qi-deficiency', tags: ['气虚'], re: /(气虚|没力气|容易累|乏力)/ },
  // 出血倾向
  { key: 'bleeding', tags: ['出血'], re: /(出血|易出血|凝血|月经量多)/ },

  // ── 下面两个是接入养生行为时补的 ──
  // 《伤寒论》讲艾灸禁忌，判据是「脉浮热甚」（实热）和「太阳病」（表证），
  // 原来这两类都收不进来，于是「实热的人不宜艾灸」这条永远命中不了。
  //
  // 收词刻意保守：只认说得明确的。
  // 「上火」故意留在这里之外——它已经归 yin-deficiency（虚火），
  // 挪到实热会让一大批人从「阴虚慎灸」变成「实热禁灸」，程度错了一档。
  { key: 'excess-heat', tags: ['实热'], re: /(实热|壮热|大便秘结|大便干结|口臭|舌苔黄|面红目赤)/ },
  // 表证：感冒初期那种「又怕冷又发热」。和 yang-deficiency 的「怕冷」不是一回事，
  // 所以这里要求出现「发热/外感/感冒」这类词，单说「怕冷」不算。
  { key: 'exterior', tags: ['表证'], re: /(外感|感冒|着凉|受凉|发热恶寒|恶寒发热|流清涕)/ },
];

/**
 * 从一句话里抽出用户说过的状况。
 *
 * 只抽能对上本草用词的，其余不收——收了也匹配不上，只会让档案里堆一堆
 * 用不到的自由文本，最后「记住」变成「记了一堆没用的」。
 *
 * @param {string} text
 * @returns {Array<{key:string, tags:string[], raw:string}>}
 */
export function extractStates(text) {
  const src = String(text || '');
  if (!src) return [];
  const out = [];
  for (const term of STATE_TERMS) {
    const m = src.match(term.re);
    if (m) out.push({ key: term.key, tags: term.tags, raw: m[0] });
  }
  return out;
}

/**
 * 拿用户状况去本草禁忌里找命中的条目。
 *
 * @param {string[]} tabiList 本草条目的 tabi（如 ['脾胃虚寒者慎用']）
 * @param {Array<{key:string, tags:string[]}>} states 用户状况
 * @returns {Array<{state:string, line:string}>} 命中的状况 + 库里的原话
 */
export function cautionsFor(tabiList, states) {
  const list = Array.isArray(tabiList) ? tabiList : [];
  const out = [];
  if (!list.length || !states || !states.length) return out;
  for (const st of states) {
    // 同一状况可能对应好几个词（脾胃虚寒 / 虚寒），任一命中即算
    const hit = list.find((line) => st.tags.some((tag) => String(line).includes(tag)));
    if (hit) out.push({ state: st.tags[0], line: String(hit) });
  }
  return out;
}

/**
 * 把命中结果组织成一句能念的话。
 *
 * 注意措辞：主语是「本草库里写着」，不是「你不能」。前者是把依据交给用户，
 * 后者是在替医生下结论——这条线不能过。
 *
 * @param {string} herb 药名
 * @param {Array<{state:string, line:string}>} hits
 */
export function cautionSpeech(herb, hits) {
  if (!hits || !hits.length) return '';
  const first = hits[0];
  return `${herb}这一条你要看一下：本草库标注「${first.line}」，你之前说过${first.state}`;
}

/** 屏幕上的短版，一行放得下。 */
export function cautionLine(herb, hits) {
  if (!hits || !hits.length) return '';
  return `注意：${herb} — ${hits[0].line}（你说过${hits[0].state}）`;
}
