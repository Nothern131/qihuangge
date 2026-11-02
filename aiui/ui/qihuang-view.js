// 岐黄阁 · 本草速查的视图模型。
//
// 只产出「要改哪些字段 + 要念哪句话」，由 .ink 页面负责 setData 和播报。
// 不碰 DOM：AIUI 页面没有 getElementById，屏幕内容只能靠 setData 改。
//
// 这一层要保住的核心不是措辞，是**三个档位在屏幕上必须看起来不一样**：
//   查到  /  没查到  /  这件事不做
// 混在一起的后果最严重：用户会把「本草库没收录」当成「可以放心用」。
// 所以 tone 是硬字段，不是样式偏好。

import { createQihuangPack } from '../adapter/qihuang-pack.js';
import { createQihuangAgent, askQihuang } from '../adapter/qihuang-agent.js';

// 出处不再是一个兜底常量。每条结论自己带回出处（pack 的 source 字段），
// 页面只负责把它挂到播报尾巴上。tail 为空就真是「这条没有出处可说」（比如没听出药名），
// 不能拿一句通用话术填上去——那会让「查到了」和「没查到」听起来一样完整。
//
// 也不能把出处拼进 speech 里：播报会被 toBrief 按句截断，
// 出处排在最后就有被截掉的可能，而截掉之后听起来像结论没有出处。

const SAY_MAX = 32;

// 开场白只做一件事：说清它能查什么。
//
// 不预告「每条都告诉你出处」——那是产品的内部机制，用户要的是答案，
// 不是使用说明。出处该出现的位置是每条结论的末尾，那里标了自然就看见了；
// 提前承诺一遍，反而像在给自己免责。
//
// 也不念「我会记住你说过什么」——开场白超过 10 秒用户就开始烦。
// 记忆能力放屏幕上第一行，用户看得见、不用等。
export const GUIDE = '说药名，查药性与配伍禁忌；说两味药，查能否同用。';

export const INITIAL_STATE = {
  title: '说药名，查禁忌',
  detail: '说「记一下在吃钙片」可记住',
  status: '按住说话',
  answer: '—',
  tone: 'idle', // idle=灰 / ok=绿 / warn=黄 / bad=红
};

export function createQihuangView({ engines, store = null } = {}) {
  const state = { ...INITIAL_STATE };

  // 缺引擎时必须在这里拦住。不拦的后果不是崩溃，是**更糟**：
  // pack 会对每一味药都答「本草库没收录」，而这跟「这味药真的没收录」
  // 在屏幕上一模一样，用户会把系统故障当成查询结论。
  const lack = ['InteractionEngine', 'BencaoEngine', 'VitaminEngine'].filter((n) => !engines || !engines[n]);
  if (lack.length > 0) throw new Error(`资料库没加载起来：缺少 ${lack.join('、')}`);

  const pack = createQihuangPack(engines || {});
  // 听懂层。加这一层不是为了更聪明，是为了有一处能说「这个我不答」——
  // 剂量和开方是本版明确不做的，靠 invoke 自己拦不住（它一进去就开查了）。
  // store 可选：不传就是「这台设备记不住」，说「记一下」时会明确拒绝，
  // 而不是收下这句话然后什么也没留下。
  const agent = createQihuangAgent(pack, { store });

  let lastAnswer = '';
  let lastQuery = '';
  let lastSource = '';

  // source 就是播报末句的出处。它只从 pack 的返回值里来，页面不发明一句。
  function emit(patch, speech = null, source = '') {
    Object.assign(state, patch);
    return { patch, say: speech, sayMax: SAY_MAX, tail: source };
  }

  function handle(text) {
    const t = String(text || '').trim();
    if (!t) return { patch: {}, say: null, sayMax: SAY_MAX, tail: '' };

    // 「再说一遍」要能重听——播报有去重（见下面），不给这条出口用户只能重新说药名。
    if (/再说一遍|再念|重复一下/.test(t)) {
      if (lastAnswer) return emit({ status: '重播' }, lastAnswer, lastSource);
      return emit({ status: '还没念过内容' });
    }

    // 意图分流全部交给适配层的 ask —— 页面不再自己写正则。
    // 原来页面只分「配伍 / 本草」两路，「附子有毒吗」「孕妇能吃桃仁吗」「维生素C」
    // 全被当成本草条目去查，四个真实问法在真机上全部查不到。
    // 分流规则放在适配层还多一个好处：它能被 tests/smoke.js 直接测到。
    try {
      const a = askQihuang(agent, t);

      // 拒绝档和引导档没有查询结果可渲染，直接显示它给的话。
      // 这两档必须和「查到了」在视觉上分开：用户需要一眼看出「系统没答」，
      // 而不是把一句拒绝当成查询结果读。
      if (a.verdict !== 'answer') {
        const refused = a.verdict === 'stop';
        lastQuery = t;
        lastAnswer = a.speech;
        lastSource = '';
        return emit(
          {
            title: refused ? '这个不做' : '没听出',
            detail: refused ? '本版只查资料，不给用量也不开方' : '换个说法再试',
            status: refused ? '做不了' : '没听懂',
            answer: a.speech,
            tone: refused ? 'bad' : 'idle',
          },
          a.speech,
        );
      }

      const r = a.result;
      const same = t === lastQuery;
      lastQuery = t;
      lastAnswer = r.speech;
      lastSource = r.source || '';

      const patch = { answer: r.speech };
      let tone = 'ok';

      if (r.intent === 'check') {
        if (r.recognized === false) {
          patch.title = '没查到';
          patch.detail = r.notRecorded && r.notRecorded.length
            ? `${r.notRecorded.join('、')} 本草库没收录`
            : '没听出药名';
          patch.status = '没查到';
          tone = 'idle';
        } else if (r.unknown && r.unknown.length > 0) {
          patch.title = r.herbs.join(' + ');
          patch.detail = `${r.unknown.join('、')} 没查到　｜　已知药共 ${r.totalWarnings} 条提示`;
          patch.status = '部分没查到';
          tone = r.hasWarning ? 'warn' : 'ok';
        } else {
          patch.title = r.herbs.join(' + ');
          patch.detail = r.hasWarning ? `共 ${r.totalWarnings} 条提示` : '未查到禁忌';
          patch.status = '已查询';
          const strong = (r.fans || []).some((f) => f.level === 'strong');
          tone = strong ? 'bad' : (r.hasWarning ? 'warn' : 'ok');
        }
      } else if (r.intent === 'pregnancy' || r.intent === 'safety') {
        patch.title = (r.herbs || []).join(' + ') || '禁忌查询';
        patch.detail = r.found === false
          ? '本草库没收录'
          : ((r.entries || []).length ? `共 ${r.entries.length} 条妊娠提示` : (r.hasWarning ? '有毒性提示' : '未查到记录（不等于安全）'));
        patch.status = r.found === false ? '没查到' : '已查询';
        tone = (r.entries || []).some((e) => e.level === 'strong') ? 'bad'
          : (r.hasWarning ? 'warn' : 'ok');
      } else if (r.intent === 'toxicity') {
        patch.title = r.name || '毒性查询';
        patch.detail = r.found === false
          ? '本草库没收录'
          : (r.toxicity === '无毒' ? '药典标注无毒' : `药典标注「${r.toxicity}」`);
        patch.status = r.found === false ? '没查到' : '已查询';
        tone = r.found === false ? 'idle' : (r.toxicity === '无毒' ? 'ok' : 'bad');
      } else if (r.intent === 'vitamin') {
        patch.title = r.name || r.query || '营养素';
        patch.detail = r.found === false ? '营养素库没有' : (r.dailyIntake || '');
        patch.status = r.found === false ? '没查到' : '已查询';
        tone = r.found === false ? 'idle' : 'ok';
      } else if (r.intent === 'nutrient-mix') {
        // 不加这一档，「钙和铁能一起吃吗」的标题会落到下面的 else 上，
        // 而 r.name 在搭配结果里不存在，屏幕上于是显示一个「本草」。
        // 用户问的是两样营养素，屏幕上写「本草」，看起来就像答错了题。
        patch.title = (r.pair || []).join(' + ') || '营养素搭配';
        patch.detail = r.found === false ? '营养素库没这一对' : (r.hasWarning ? '有需要注意的地方' : '未查到相互影响');
        patch.status = r.found === false ? '没查到' : '已查询';
        tone = r.found === false ? 'idle' : (r.hasWarning ? 'warn' : 'ok');
      } else if (r.intent === 'memo') {
        // 「记住」是唯一一个长期生效的动作，所以屏幕上要说清「现在记着几样」，
        // 否则用户不知道这句话到底有没有落地——语音一次就过去了，
        // 记没记住只能靠屏幕给第二重确认。
        patch.title = r.name || '记住了';
        patch.detail = r.added === false
          ? '之前就记着了'
          : `现在记着 ${r.total || (r.items || []).length} 样`;
        patch.status = r.added === false ? '已记着' : '已记住';
        tone = 'ok';
      } else {
        patch.title = r.name || (r.found === false ? '没查到' : '本草');
        if (r.found === false) {
          // 「换个说法」只适用于「听不出药名」。库里真没收这味药时说这句，
          // 会让用户反复重说同一个名字，一直试到放弃。
          patch.detail = /没收录|没有收录/.test(r.speech)
            ? '这味药不在本草库'
            : '换个说法，或者把药名说全';
        } else {
          const head = [r.xingwei, r.dosage].filter(Boolean).join('　｜　');
          // 不在这里写「《X》有原文」：下面那行出处已经列了书名，
          // 两处书名相同看起来像重复三次，而屏幕只有两行宽。
          patch.detail = r.ancient ? `${head}　｜　下方附原文` : head;
        }
        patch.status = r.found === false ? '没查到' : '已查询';
        tone = r.found === false ? 'idle' : (r.toxicity && r.toxicity !== '无毒' ? 'warn' : 'ok');
        // 经典原文放屏幕，不塞进播报：古文断句在语音里很难听懂，
        // 而且会把「功效」挤到听不见的位置。播报里已经说了「屏幕上有原文」。
        if (r.ancient) {
          patch.answer = `${r.speech}\n《${r.ancient.source}·${r.ancient.chapter}》：${r.ancient.text}`;
        }
      }

      patch.tone = tone;
      // 屏幕上也留一行出处。语音听完就忘了，想核对时得有地方看；
      // 而且单墨绿屏上这行小字比任何图标都容易做对（颜色会塌成亮度）。
      //
      // 加「出处」二字而不是光贴书名：只有书名和前面的「性味」「常用量」
      // 看起来是同一层信息，用户分不清哪部分是依据、哪部分是资料名。
      if (r.sourceTag) {
        patch.detail = [patch.detail, `出处 ${r.sourceTag}`].filter(Boolean).join('　｜　');
      }
      // 同一句话连问两次就不重播，避免「没听清 → 再说一遍」时被自己的播报盖住
      return emit(patch, same ? null : r.speech, same ? '' : lastSource);
    } catch (err) {
      // 用户能自己改的（没给药名 / 没听清）念给他听；其余只记日志，不假装成功
      const fixable = ['missing_herbs', 'missing_name', 'missing_text'];
      const isFixable = fixable.includes(err.code);
      if (!isFixable) console.error('[qihuang]', err.code, err.message);
      return emit(
        {
          answer: err.message || '这个查不了',
          status: isFixable ? '再说一次' : '出错',
          tone: isFixable ? 'warn' : 'bad',
        },
        isFixable ? err.message : null,
      );
    }
  }

  return {
    get state() { return state; },
    handle,
  };
}
