// 岐黄阁的「听懂」层。
//
// 和麻将那边共用同一套流水线骨架，但阈值和自检规则完全不同——因为出错代价不同。
// 麻将算错：打错一张牌，输一局。
// 中药答错：把「查不到」说成「可以吃」，可能真出事。
// 所以这里宁可多问一句、多说一句免责，也不给一个利落的假结论。
//
// 这一层不碰 static/ 里的引擎，只调 adapter 暴露的 recognize 和 invoke，
// 「只加不改」的边界保持不变。

// 注意：core/pipeline.mjs 是麻将那边的同一份内核的副本。
// 两个作品各自打包成 .aix 独立上架，跨目录 import 在打包后必然断，所以只能各持一份。
// 代价是可能漂移——tests/parity.mjs 会逐字节比对两份，不一致就红。
import { createPipeline } from '../core/pipeline.js';

// 本版明确不做的事。这些不是说错了，是根本不该由这个作品回答——
// 眼镜上一个只说三句话的助手给出剂量建议，比不给建议危险得多。
const DOSE_RE = /(吃多少|多少克|几克|几钱|几两|一天吃几次|一天几次|用量|剂量|每次用|怎么吃|服用多少)/;
const PRESCRIBE_RE = /(开个方|开方|配个方|开副药|处方|给我治|怎么治|吃什么药能治|我头疼|我咳嗽|我失眠|我胃疼|辨证|把脉)/;

// 安慰措辞。这些词出现在有风险项的结论里就是自相矛盾，必须拦住。
const REASSURE_RE = /(可以放心|放心吃|放心用|没问题|没事|安全|可以一起|能一起吃)/;

// 养生调理类问法。定位叫「养生助手」，用户一定会问「失眠怎么调理」。
// 答「没听懂」是最差的反应——听起来像不会，实际是不该答。
// 这两件事对用户的意义完全不同：前者他会换个说法再试，后者他会去找会编的人。
const WELLNESS_RE = /(调理|养生|怎么养|怎么预防|怎么缓解|怎么改善|如何改善|如何调理|能治好|能治吗|能治|怎么治|什么能治|吃什么能|吃什么好|有什么办法|食补|食疗|偏方)/;

// 「记一下我在吃钙片」——这是「越用越懂你」唯一的入口。
// 没有它，产品永远只能回答当下这一句，用户用三个月和用一天没有区别。
const MEMO_RE = /(记一下|记住|记下|帮我记|我在吃|我在用|我常吃|我一直在吃|我平时吃|在吃|吃着)/;
const MEMO_STRIP = /(帮我)?(记一下|记住|记下|我一直在吃|我平时吃|我在吃|我在用|我常吃|吃着|在吃|在用|还有)/g;

/** 从「记一下我在吃钙片」里取出「钙片」。取不出来就返回空串，交给上层的报错路径。 */
function extractMemoTarget(text) {
  return String(text || '')
    .replace(MEMO_STRIP, '')
    .replace(/[，。,.！!？?、\s]/g, '')
    .trim();
}

// 医疗语义词：出现任何一个，说明这句话是在问用药，不是在闲聊。
// 和「长度」一起用，是为了把「今天天气不错」和「三七」分开——
// 两者在系统眼里都是「一个不认识的词」，但一个是闲聊，一个是真药名。
const MEDICAL_RE = /(毒|吃|用|服|禁忌|孕妇|怀孕|哺乳|一起|同用|相克|副作用|功效|什么用|治|病|配伍|忌)/;

// 出处自检：结论必须说得出它从哪来。
//
// 原来这里查的是「有没有就医提示」。那句话有两个毛病：对用户没有信息量，
// 而且把所有结论压成同一种口吻——引《儒门事亲》的和引现代营养学的听起来一样，
// 可这两件事的可信度根本不是一回事。现在改查出处。
//
// 注意不能只查「有没有《》」：查不到的时候本来就没书可引，那种时候该说的是
// 「本草库没收录」这个边界句。两类都算合格，因为它们都在回答「凭什么」。
// 「没收录」必须算在内——把它当作不合格的后果实测过：
// 问「三七」会被自检判成「没说清出处」，然后降级成反问，
// 播报变成「我三七、未收录：三七不在本草库里」，比原来更难听懂。
const SOURCE_RE = /(《[^》]+》|药典|现代营养学|禁忌歌|本草库|营养素库|歌诀|没收录|没记录)/;

export function createQihuangAgent(pack, { store = null } = {}) {
  /**
   * 记住一样东西。
   *
   * 名字优先用引擎认出来的规范名而不是用户原话：用户说「钙片」，
   * 档案里存的应该是「钙」——不然下次问「维生素D」时对不上，
   * 交叉核对永远不会命中，「记住」就成了摆设。
   */
  function doMemo(ctx) {
    const target = extractMemoTarget(ctx.text);
    const n = (ctx.recog.nutrients || [])[0];
    const herb = (ctx.recog.known || [])[0];

    if (!n && !herb && !target) {
      const err = new Error('没听清要记什么');
      err.code = 'missing_item';
      throw err;
    }

    const name = n ? n.name : (herb || target);
    const kind = n ? 'nutrient' : (herb ? 'herb' : 'other');
    const ref = n ? n.id : (herb || null);

    // rememberItem 在存储写失败时会抛，交给 pipeline 的 onError 处理。
    // 这里不做 try：捕获了就只能「假装记下了」，那是最坏的结果。
    const r = store.rememberItem(name, kind, ref);
    return {
      found: true,
      intent: 'memo',
      name,
      kind,
      added: r.added,
      total: r.profile.supplements.length,
      items: store.listItems(),
      speech: r.added
        ? `记下了：${name}。以后你问到它，我会先看一眼有没有冲突。`
        : `${name}已经记着了`,
    };
  }

  return createPipeline({
    name: 'qihuang',
    // 和麻将的 0.75/0.4 不同：这里 lower 档位意味着「先反问」，
    // 而反问在用药场景里成本极低（用户再说一句），漏答风险却很高。
    thresholds: { answer: 0.75, confirm: 0.5 },

    normalize(ctx) {
      const r = pack.recognize(ctx.text);
      ctx.recog = r;
      // tokens 在中药域是药名（字符串），不是牌索引。
      // 骨架不关心类型，只关心「这一站产出了什么结构」。
      return { tokens: r.herbs, notes: r.unknown };
    },

    interpret(ctx) {
      // 能力边界优先于一切：这几类问题听懂了也不能答。
      if (DOSE_RE.test(ctx.text)) {
        return {
          stop: true,
          speech: '用量我不给建议。同一个药不同的人、不同的炮制方式用量差很多，'
            + '说错比不说危险。这里只能告诉你它有什么禁忌和毒性',
        };
      }
      if (PRESCRIBE_RE.test(ctx.text)) {
        return {
          stop: true,
          speech: '这个作品只查资料，不辨证也不开方。可以说药名问我它的禁忌、毒性，'
            + '或者两味药能不能一起用',
        };
      }

      // 「记一下」优先于查询：用户在交代一件事，不是在提问。
      // 没有 store 时必须明说存不了，不能装作记住了——
      // 用户以为记下了，明天再问「我记的都有什么」会得到空，这种失望比当场报错重得多。
      if (MEMO_RE.test(ctx.text)) {
        if (!store) {
          return {
            stop: true,
            speech: '这台设备上没法保存记录，我只能当场回答，记不住你之前说过什么',
          };
        }
        return { intent: 'memo', conf: 1 };
      }

      const { herbs, known, plausible } = ctx.recog;

      // 药名优先，营养素兜底——顺序不能反。
      // 「铁皮石斛」里有个「铁」，先认营养素就会去查铁元素，而用户问的是一味药。
      // 反过来漏掉的代价更大：维生素和矿物质是养生场景里最高频的问法，
      // 认不出来就变成「没听出药名」，用户会认为这个作品只会查中药。
      const nutrients = ctx.recog.nutrients || [];
      if (known.length === 0 && nutrients.length > 0) {
        ctx.nutrients = nutrients;
        // 认出两样以上就走搭配，否则只答第一样——「钙和铁能一起吃吗」
        // 只答钙的功效，等于没回答他问的问题。
        const intent = nutrients.length >= 2 ? 'nutrient-mix' : 'nutrient';
        return { intent, conf: 1, why: `营养素：${nutrients.map((n) => n.name).join('、')}` };
      }

      // 注意判据是「没认出明确药名」（known 为空），不是「一个词都没切出来」。
      // 「我最近失眠怎么调理」会被整串保留成一块（9 个字），
      // 用 herbs.length===0 判就永远命中不了。
      if (known.length === 0 && WELLNESS_RE.test(ctx.text)) {
        // 放在营养素之后：先把「补钙怎么补」这类能答的捞走，
        // 剩下的「失眠怎么调理」才落到这条边界上。
        return {
          stop: true,
          speech: '调理和诊断这类我不做，涉及辨证，说错要负责。'
            + '可以问我某味药有什么禁忌，或者两样东西能不能一起用',
        };
      }

      if (herbs.length === 0) {
        // 一个字都没认出来：不猜，也不拿「没查到」冒充结论
        return { intent: null, conf: 0 };
      }
      // 连一个像药名的都没有，就是把闲聊当药名了。这种不答比答好——
      // 「本草库还没收录今天天气不错」看着像在工作，其实是在复读用户的话。
      if (known.length === 0 && plausible.length === 0) {
        return { intent: null, conf: 0, why: '没有一个像药名' };
      }
      // 库里没有，且既不像药名（≤4 字）也没问用药 → 当闲聊。
      // 长度这条不是拍脑袋：常用药材名两到四个字（附子/夏枯草/五指毛桃），
      // 五个字以上的多半是整句被切词器兜住了。
      if (known.length === 0) {
        const shortEnough = plausible.some((h) => h.length <= 4);
        if (!shortEnough && !MEDICAL_RE.test(ctx.text)) {
          return { intent: null, conf: 0, why: '不认识的闲聊' };
        }
      }
      // 认出了药名就算有把握——哪怕库里没收录，「没收录」本身也是准确答案，
      // 不需要反问。这类情况交给 verify 检查措辞是否把「没收录」说成了「没问题」。
      return { intent: 'ask', conf: 1, why: ctx.recog.unknown.length ? `未收录：${ctx.recog.unknown.join('、')}` : '' };
    },

    execute(ctx) {
      if (ctx.intent === 'memo') return { result: doMemo(ctx) };

      // 营养素走独立动作：下游的 vitamin 分支只认单味营养素名，
      // 把整句「维生素C有什么作用」丢进去它只会答「库里没有这句话」。
      if (ctx.intent === 'nutrient' && ctx.nutrients && ctx.nutrients.length) {
        return { result: pack.invoke('vitamin', { name: ctx.nutrients[0].name, text: ctx.text }) };
      }
      if (ctx.intent === 'nutrient-mix' && ctx.nutrients && ctx.nutrients.length >= 2) {
        return { result: pack.invoke('vitamin-mix', { nutrients: ctx.nutrients.map((n) => n.name) }) };
      }
      // 把上游切好的药名一并交给下游。不传的话下游会拿原句重新切一遍，
      // 而两边的前置处理不同，就会出现「我认出附子，它答没听出药名」。
      const result = pack.invoke('ask', {
        text: ctx.text,
        query: ctx.text,
        herbs: ctx.recog.herbs,
      });
      return { result };
    },

    /**
     * 中药的自检不看数字，看「话和数据对不对得上」。
     * 这些规则都是从真实危险场景倒推的：用户只会记住最后听到的那半句。
     */
    verify(ctx, r) {
      const issues = [];
      if (!r) return { issues: ['无结果'] };

      // 记住一件事不是查询结论：它没给任何健康建议，也就不需要就医提示。
      // 不豁免的话，每次「记一下」都会被自检判成「结论缺少就医提示」，
      // 然后降级成反问——用户会觉得这个助手连记东西都记不住。
      if (r.intent === 'memo') return { issues: [] };

      const speech = String(r.speech || '');

      const risky = Boolean(
        r.hasWarning
        || (Array.isArray(r.entries) && r.entries.length > 0)
        || (Array.isArray(r.toxicity) && r.toxicity.some((t) => t.level && t.level !== '无毒'))
        || (Array.isArray(r.fans) && r.fans.length > 0)
        || (Array.isArray(r.weis) && r.weis.length > 0)
        || (Array.isArray(r.pregnancy) && r.pregnancy.length > 0),
      );

      // 最危险的一条：结果里明明有风险，措辞却让人放心
      if (risky && REASSURE_RE.test(speech) && !/不等于|不代表/.test(speech)) {
        issues.push('有风险项却用了安慰措辞');
      }

      // 查不到时说成「安全」，是把假阴性包装成结论。
      // 措辞有多种（「没收录」「库里没有」「查不到」），这里只要求出现其中一种，
      // 不锁死某一句——锁死措辞的测试会在改文案时全红，那是测试在拖后腿。
      if (r.found === false && !/(没收录|没有收录|查不到|没查到|没听出|库里没有|没有「)/.test(speech)) {
        issues.push('查不到却没有说明查不到');
      }

      // 结论必须能说出出处。少了这一步，产品就从「引书」越界成了「给建议」——
      // 差别很小但在审核和信任上很关键：引书可以核对，建议只能相信。
      //
      // 查的是 r.source 而不是 speech：出处作为播报尾巴单独传（见 ui/qihuang-view.js），
      // 不在 speech 里。在这里查 speech 会全部报错，然后每条结论都被降级成反问——
      // 表面上「更谨慎」，实际上是助手什么都不肯答了。
      const source = String(r.source || '');
      if (!SOURCE_RE.test(source)) {
        issues.push('结论没说清出处');
      }

      // 用户问的是配伍，却只认出一味药——这时候的配伍结论没有意义。
      // 但「一味都认不出」不在此列：那种情况答复本身就是「没收录」，是准确答案。
      if (r.intent === 'check' && r.recognized !== false
        && Array.isArray(r.herbs) && r.herbs.length < 2) {
        issues.push('问配伍但只认出一味药');
      }

      return { issues };
    },

    describe(ctx) {
      const { herbs, unknown } = ctx.recog;
      if (herbs.length === 0) return `我听到「${ctx.text}」，但没听出药名`;
      const known = herbs.filter((h) => !unknown.includes(h));
      const parts = [];
      if (known.length) parts.push(`认出${known.join('、')}`);
      if (unknown.length) parts.push(`${unknown.join('、')}不在本草库里`);
      return `我${parts.join('，')}`;
    },

    confirm(ctx) {
      const { herbs, unknown } = ctx.recog;
      if (herbs.length === 0) {
        return '没听出药名。请直接说药名，比如「附子」或者「甘草 海藻」';
      }
      if (unknown.length === herbs.length) {
        return `本草库里还没有${herbs.join('、')}，查不了禁忌和毒性。`
          + '换个收录过的药名，或者说「换一个」';
      }
      return `我听到的是${herbs.join('、')}，是这个意思吗`;
    },

    guide(ctx) {
      if (ctx.recog && ctx.recog.herbs.length === 0) {
        return '没听出药名。可以问「附子有毒吗」「孕妇能吃桃仁吗」「甘草和海藻能一起吃吗」';
      }
      return '这句没听懂，可以说药名，或者问两味药能不能一起用';
    },

    /**
     * 结论后补一句与用户有关的话。这是「越用越懂你」唯一能被听见的地方，
     * 所以规则要严：只在本问没提到、且确实有数据支持时才说。
     * 没数据就不说——为了显得聪明硬凑一句，比不说更糟。
     */
    decorate(ctx) {
      if (!store || ctx.intent === 'memo') return null;
      const items = store.listItems();
      if (items.length === 0) return null;

      const askedIds = new Set((ctx.nutrients || []).map((n) => n.id).filter(Boolean));
      const askedHerbs = new Set((ctx.recog && ctx.recog.known) ? ctx.recog.known : []);

      // ① 营养素：记着在吃 A，这次问 B，去看 A 和 B 之间有没有记录。
      for (const it of items) {
        if (!it.ref || askedIds.has(it.ref)) continue;
        for (const n of (ctx.nutrients || [])) {
          if (!n.id) continue;
          let r = null;
          try {
            r = pack.invoke('vitamin-mix', { nutrients: [n.id, it.ref] });
          } catch (err) {
            continue; // 查不了不算错，这次就是没什么可提醒的
          }
          if (r && r.found && r.hasWarning) {
            return { say: `你记着在吃${it.name}：${r.entries[0].advice}` };
          }
        }
      }

      // ② 药材：记着在吃某味药，这次问的是另一味。
      // 这里**不替用户下禁忌结论**——两味药之间有没有问题，要认全两味才有资格说，
      // 而用户嘴里只说了一味。所以只提醒「可以做这件事」，把判断交回给查询。
      for (const it of items.filter((x) => x.kind === 'herb')) {
        for (const a of askedHerbs) {
          if (a === it.name) continue;
          return { say: `你记着在吃${it.name}。如果打算一起用，建议先问「${a}和${it.name}能不能一起用」` };
        }
      }

      return null;
    },

    onError(ctx, err) {
      if (err && err.code === 'missing_item') {
        return '没听清要记什么。可以说「记一下我在吃钙片」这样';
      }
      // 存储写失败走到这里。必须说清是「没存上」，不能说「记下了」。
      return `这次没记上（${err && err.message}）。可以再说一次，或者检查设备的存储空间`;
    },
  });
}

export function askQihuang(agent, text, carry) {
  const ctx = agent.run(text, carry);
  return {
    verdict: ctx.verdict,
    intent: ctx.intent,
    conf: Number(ctx.conf.toFixed(2)),
    speech: ctx.speech,
    recognized: ctx.recog ? ctx.recog.herbs : [],
    result: ctx.result || null,
    issues: ctx.issues,
    trace: ctx.trace,
  };
}
