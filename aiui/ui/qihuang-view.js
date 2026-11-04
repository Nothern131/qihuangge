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

// 屏幕正文的字数上限。160 是**实测出来的**，不是估的：
// Studio 里注入 159 字的答复，正文和出处各就各位；
// 注入 173 字，正文最后一行就和底部出处叠在一起了，两行字互相压着。
// 所以真实容量在 159～173 之间，取下沿留余量。
// 代价要认：个别追问（甘草配大戟那类，要同时装结论、原因和争议）
// 会放不下争议——那部分照样会念出来，只是不上屏。
// 设成常量而不是散在判断里，是为了让「内容宽度会不会撑破屏幕」成为一条
// 可以断言的量——超过它就在出真机之前先红，而不是等到截图里才发现
// 最后一行和出处叠在一起。
export const SCREEN_BUDGET = 160;

// 开场白只做一件事：说清它能查什么。
//
// 不预告「每条都告诉你出处」——那是产品的内部机制，用户要的是答案，
// 不是使用说明。出处该出现的位置是每条结论的末尾，那里标了自然就看见了；
// 提前承诺一遍，反而像在给自己免责。
//
// 也不念「我会记住你说过什么」——开场白超过 10 秒用户就开始烦。
// 记忆能力放屏幕上第一行，用户看得见、不用等。
export const GUIDE = '说药名查性味和禁忌；说「记一下在吃钙片」，我替你记着。';

// 首屏第一行是**身份**不是功能说明。
// 原来写「说药名，查禁忌」——那是一句使用说明，读起来像个查询工具；
// 而策划案定的是「私人养生助手」，第一眼就该让他知道这不是又一个查药 APP。
// 第二行给可直接照说的句子：新用户最需要的是「我该怎么开口」，不是能力清单。
export const INITIAL_STATE = {
  title: '私人养生助手',
  detail: '说药名查性味配伍；说「记一下在吃钙片」，我替你记着',
  status: '按住说话',
  answer: '—',
  tone: 'idle', // idle=灰 / ok=绿 / warn=黄 / bad=红
  // 出处单独一个字段，单独一行，不跟着正文一起被裁。
  // 原来它拼在 answer 末尾，正文一长就顶到屏幕外——而出处是结论的一部分，
  // 看不见等于这条结论没有依据。Studio 截图实证：274 字时出处整行落在可视区外。
  source: '',
  // 没有出处时不渲染这一行。用类名切换而不是条件渲染：
  // AIUI 模板里 wx:if 这类指令没有文档保证，类名是纯 CSS，一定能用。
  sourceClass: 'source-off',
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
  // max 逐条给：查禁忌要说结论加原因，32 字装不下；
  // 而「没听清」这种一句话回答用 72 是浪费。长度跟着内容走，不跟应用走。
  function emit(patch, speech = null, source = '', max = SAY_MAX) {
    Object.assign(state, patch);
    return { patch, say: speech, sayMax: max || SAY_MAX, tail: source };
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
      // 追问「为什么」时屏幕放宽：多给争议，少给别的都不行。
      const wantsReason = /(为什么|为啥|凭什么|什么道理|原因|原理|道理)/.test(t);
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
          // 「配伍禁忌」这个标签从正文里挪到这一行。
          // 正文里留着它会把「出处：」顶出本行，书名断到下一行。
          // 不写「配伍禁忌 N 条」：totalWarnings 把十九畏和妊娠也算了进去，
          // 用「配伍禁忌」概括会把妊娠禁忌说成配伍问题。
          patch.detail = r.hasWarning ? `禁忌 ${r.totalWarnings} 条` : '未查到禁忌';
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
        } else if (r.kind === 'food') {
          // 药食同源：副标题只给一句定位。
          // 原来这里拼的是「性味 + 用量」，而性味在正文第一句里已经有了，
          // 同一屏上说两遍，还占掉两行——那两行是从功效和出处里挤出来的。
          patch.detail = '药食同源 · 药典收载';
        } else {
          const head = [r.xingwei, r.dosage].filter(Boolean).join('　｜　');
          // 「下方附原文」不加书名：出处行里已经列了，同一行出现两次书名
          // 看起来像 bug，而屏幕只有两行宽。
          patch.detail = r.ancient ? `${head}　｜　下方附原文` : head;
        }
        patch.status = r.found === false ? '没查到' : '已查询';
        tone = r.found === false ? 'idle' : (r.toxicity && r.toxicity !== '无毒' ? 'warn' : 'ok');
        // 经典原文放屏幕，不塞进播报：古文断句在语音里很难听懂，
        // 而且会把「功效」挤到听不见的位置。播报里已经说了屏幕上有原文。
        //
        // 正文用 screenText 而不是 speech：speech 末尾那句
        // 「原文见《X》，屏幕上可看」在屏幕上紧跟着就是原文，指着自己说，多余。
        if (r.ancient) {
          patch.answer = `${r.screenText || r.speech}\n《${r.ancient.source}·${r.ancient.chapter}》：${r.ancient.text}`;
        } else if (r.screenText) {
          // 播报和屏幕本来可以不一样，而这个分支以前只在有古籍原文时才用 screenText。
          // 结果食材那条线两版内容一样，屏幕上就没机会多出「药典没列 ≠ 没有禁忌」
          // 那半句——恰恰是最该让人看见的一句。
          patch.answer = r.screenText;
        }
      }

      patch.tone = tone;

      // 原因写进正文，紧跟结论句。
      //
      // 为什么放屏幕而不是全靠播报：原因是整段文字，念出来要十几秒，
      // 而用户往往只想知道「能不能」；但想深究的时候，屏幕上必须有全文可读。
      // 两边给不同的量，是这个界面唯一能同时满足两种需求的办法。
      if (r.intent === 'check' && r.reasons && r.reasons.length) {
        // 用合并后的分组，不用逐对的 reasons。
        // 逐对时同组的两对（甘草配大戟、甘遂）各占一行、说的是同一段机理，
        // 屏幕上多花一行却不多给信息——这一行是从结论和出处的可见空间里挤出来的。
        const groups = r.reasonGroups && r.reasonGroups.length ? r.reasonGroups : r.reasons;
        const seen = new Set();
        const whyLines = [];
        let debate = '';
        for (const rs of groups) {
          // 同组多对药（甘草配大戟、甘遂）机理是同一段，列两遍会挤掉别的内容。
          if (whyLines.length >= 2) break;
          if (!rs.why || seen.has(rs.why)) continue;
          seen.add(rs.why);
          // 标签放句首，不放句末。
          // 放句末时括号被行尾截断成「（现代药理研」+「究）」，两行都读不通；
          // 放句首就永远跟着冒号走，不会被拆。顺带也更好扫读。
          whyLines.push(`原因（${rs.whyKindTag}）：${rs.why}`);
          // 争议只在追问时才上屏，而且只取一条。
          // 默认屏已经装不下，而争议是次要信息：
          // 用户先要知道「为什么」，再决定要不要听「这条有多硬」。
          if (wantsReason && !debate && rs.debate) debate = `另：${rs.debate}`;
        }
        const base = r.screenText || r.speech;
        // 屏幕有硬预算，这里是按实测算的：17px 字、一行约 22 字、可读区约 8 行，
        // 大致 170 字。超了不是「挤一挤」，而是最后一行被裁掉——
        // 实测过最难看的一种：正文最后一行和下面的出处行叠在一起，两行字互相压着。
        //
        // 按信息价值依次让位，而不是等它自己溢出：
        //   ① 先去掉争议（次要，且只在追问时才有）
        //   ② 再去掉第二条原因（多个药对时才有）
        // 结论和第一条原因永远不砍：那是用户问的那件事本身。
        const fits = (parts) => [base, ...parts].filter(Boolean).join('\n').length <= SCREEN_BUDGET;
        let picked = [...whyLines, debate].filter(Boolean);
        if (!fits(picked)) picked = [...whyLines];
        if (!fits(picked)) picked = whyLines.slice(0, 1);
        // 不再套 `if (picked.length)`。
        // picked 至少有一条（slice(0,1) 兜底），所以那个条件本来就是恒真的死判断；
        // 它的存在只会让读代码的人以为「空的时候不设 answer」，而真到空的时候，
        // 不设比设更糟——patch 里没有 answer，页面就留着上一题的答复。
        // 宁可超一截（超了是裁切），也不能让屏幕上躺着别的答案。
        patch.answer = [base, ...picked].join('\n');
      }

      // 出处写在结论后面，不往 detail 里塞。
      //
      // 页面结构从上到下是 title → detail → answer，detail 在结论上方。
      // 把出处放 detail，屏幕上就是「先看出处、后看结论」——顺序反了，
      // 实测确实如此（共 1 条提示 ｜ 出处 …. 上面，结论在下面红字）。
      // 出处是结论的附属信息，位置必须跟在结论句之后。
      if (r.sourceTag) {
        // 单独一行、单独字段。见 INITIAL_STATE 里的说明。
        patch.source = `出处：${r.sourceTag}`;
        patch.sourceClass = 'source';
      }
      // 同一句话连问两次就不重播，避免「没听清 → 再说一遍」时被自己的播报盖住
      return emit(patch, same ? null : r.speech, same ? '' : lastSource, r.sayMax);
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
