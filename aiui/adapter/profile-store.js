// 个人档案的存储层。
//
// 产品要「越用越懂你」，前提是记住东西。而「记住」在眼镜上只有一条路：
// 官方 wx 兼容层的 wx.setStorageSync / getStorageSync（见 AIUI 平台规范速查 §wx storage）。
// 直接写 localStorage 在 AIUI 里没有这个全局，写了就是 ReferenceError，
// 而且这个错往往被最外层 catch 吞掉，表现成「功能没反应」。
//
// 更要紧的是失败方式。官方文档写明：storage 不可用时，**同步方法直接 throw**。
// 如果把 throw 捕获掉、当成「这次没存上」继续跑，用户会以为自己记下了，
// 三个月后换了设备发现什么都没留下——这比当场报错糟糕得多。
// 所以这一层的原则是：存不上就明说存不上，绝不假装成功。
//
// 再一层考虑是可测性：存储后端做成注入，Node 里用内存后端跑断​​言，
// 设备上注入 wx 后端。同一套逻辑，不需要在测试里伪造一个假的 wx。

export const STORE_VERSION = 1;

/** 单个用户的档案 key。按 userId 分开，是「把每个人分开」这条要求的落地点。 */
function keyOf(userId) {
  return `qihuang:profile:v${STORE_VERSION}:${userId}`;
}

/** 空档案。字段只放「查询时真的会用上」的，不做无用的采集。 */
function emptyProfile(userId) {
  return {
    version: STORE_VERSION,
    userId,
    // 正在吃/在用的东西。查询时用来交叉核对：
    // 用户问维生素D，而他记着在吃钙，就该顺口提一句。
    supplements: [],
    // 用户自己说的关注点（胃寒、备孕、睡眠差）。只存原话，不做任何医学解读。
    concerns: [],
    // 用药计划：几点吃什么。这是「管家」和「字典」的分界——
    // 只有 supplements（在吃什么）而没有 time（几点吃），就没法提醒，也就没有每天被打开的理由。
    // 每条 { id, name, time: 'HH:MM' | null, timing: 'before_meal' | ... | null, createdAt }
    medPlans: [],
    // 养生行为：艾灸、拔罐这类「身体上的」操作。
    // 和 supplements 分开存：一个是吃进去的，一个是做在身上的，
    // 两者对同一味药的结论可能相反（比如阴虚的人吃滋阴药是对症，做艾灸是加重）。
    // 每条 { name, ref, addedAt }
    practices: [],
    // 问过什么。用于「上次那个」，也有上限，不无限长。
    history: [],
    createdAt: null,
    updatedAt: null,
  };
}

/** 内存后端。测试用，也是「设备不支持存储」时唯一诚实的降级目标。 */
export function memoryBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    name: 'memory',
    get: (k) => map.get(k),
    set: (k, v) => { map.set(k, v); },
    remove: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

const HISTORY_LIMIT = 50;
const SUPPLEMENT_LIMIT = 30;
// 20 条足够覆盖常见多病共存（高血压 + 糖尿病 + 血脂，每种早晚各一次也才 6 条）。
// 定上限不是为了省空间，是为了让「记不下」这件事有明确的说法，而不是悄悄丢掉最旧的一条。
const MED_PLAN_LIMIT = 20;

/**
 * @param {object} opts
 * @param {{get:Function,set:Function,remove:Function}} opts.backend 存储后端，必须注入
 * @param {string} [opts.userId] 档案归属，默认 local（眼镜是个人设备）
 */
export function createProfileStore({ backend, userId = 'local' } = {}) {
  if (!backend || typeof backend.get !== 'function' || typeof backend.set !== 'function') {
    // 缺后端是接线错误，不是运行时状态。当场炸掉，别让它变成「查得到但记不住」。
    throw new Error('档案存储没接上：需要提供 backend（get/set/remove）');
  }

  const key = keyOf(userId);

  /** 读。读不出来时返回空档案，但记一条 warn——读失败和「第一次用」必须能区分。 */
  function load() {
    let raw;
    try {
      raw = backend.get(key);
    } catch (err) {
      console.warn('[profile] 读取失败，本次按空档案处理：', err && err.message);
      return emptyProfile(userId);
    }
    if (raw === undefined || raw === null || raw === '') return emptyProfile(userId);
    // wx.getStorageSync 已经做过 JSON 解析；内存后端存的是对象本身。
    const data = typeof raw === 'string' ? safeParse(raw) : raw;
    if (!data || typeof data !== 'object') return emptyProfile(userId);
    if (data.version !== STORE_VERSION) {
      // 版本不一致时宁可从头开始，也不要把旧结构的字段硬套进新代码。
      console.warn(`[profile] 档案版本 ${data.version} 与当前 ${STORE_VERSION} 不一致，按空档案处理`);
      return emptyProfile(userId);
    }
    return { ...emptyProfile(userId), ...data };
  }

  /**
   * 写。这里**不吞异常**：写失败必须往上抛。
   * 理由见文件头——静默失败会让用户误以为数据已经保存。
   */
  function save(profile) {
    const next = { ...profile, updatedAt: new Date().toISOString() };
    if (!next.createdAt) next.createdAt = next.updatedAt;
    backend.set(key, next);
    return next;
  }

  function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  const norm = (s) => String(s || '').replace(/\s+/g, '');

  return {
    userId,

    /** 存储是否真的可用。查到不可用时要让页面去说清楚，不能装作无事。 */
    available() {
      try {
        backend.set(`${key}:__probe`, 1);
        backend.remove(`${key}:__probe`);
        return true;
      } catch (err) {
        console.warn('[profile] 存储不可用：', err && err.message);
        return false;
      }
    },

    load,
    exists() {
      const p = load();
      return Boolean(p.createdAt);
    },

    /**
     * 记住一样正在吃/在用的东西。
     * @param {string} name 用户说的名字，原样保留（「钙片」不该被改写成「钙」）
     * @param {string} kind 'nutrient' | 'herb' | 'other'
     * @param {string} [ref] 引擎里的规范 id，交叉核对时用
     */
    rememberItem(name, kind = 'other', ref = null) {
      const clean = String(name || '').trim();
      if (!clean) {
        const err = new Error('要记的东西没说清');
        err.code = 'missing_item';
        throw err;
      }
      const p = load();
      const k = norm(clean);
      const dup = p.supplements.find((x) => norm(x.name) === k || (ref && x.ref === ref));
      if (dup) return { added: false, item: dup, profile: p };
      const item = { name: clean, kind, ref, addedAt: new Date().toISOString() };
      p.supplements = [...p.supplements, item].slice(-SUPPLEMENT_LIMIT);
      const saved = save(p);
      return { added: true, item, profile: saved };
    },

    forgetItem(name) {
      const p = load();
      const k = norm(name);
      const before = p.supplements.length;
      p.supplements = p.supplements.filter((x) => norm(x.name) !== k);
      if (p.supplements.length === before) return { removed: false, profile: p };
      return { removed: true, profile: save(p) };
    },

    listItems() {
      return load().supplements;
    },

    /** 用户常吃的东西里，有没有和这个引擎 id 对应的。用于查询后追加提示。 */
    findItemByRef(ref) {
      if (!ref) return null;
      return load().supplements.find((x) => x.ref === ref) || null;
    },

    /**
     * 加一条用药计划。
     *
     * @param {string} name 药名（用户原话里剥出来的）
     * @param {string|null} time 'HH:MM'
     * @param {string|null} timing 相对时段（before_meal 等）
     */
    addMedPlan(name, time = null, timing = null) {
      const clean = String(name || '').trim();
      if (!clean) {
        const err = new Error('要记的药没说清');
        err.code = 'missing_item';
        throw err;
      }
      if (!time && !timing) {
        // 没有时间就不是「计划」，只是「在吃什么」。让调用方走 rememberItem。
        // 两条路不能混：混了会出现「记了药但永远不会提醒」这种静默失效。
        const err = new Error('没说时间，记不成计划');
        err.code = 'missing_time';
        throw err;
      }
      const p = load();
      const k = norm(clean);
      // 同一种药同一个时间，只留一条。重复说「早上八点吃二甲双胍」不该变成两条提醒。
      const dup = p.medPlans.find((x) => norm(x.name) === k && x.time === time && x.timing === timing);
      if (dup) return { added: false, plan: dup, profile: p };
      const plan = {
        id: `m${Date.now()}${p.medPlans.length}`,
        name: clean,
        time: time || null,
        timing: timing || null,
        createdAt: new Date().toISOString(),
      };
      const next = [ ...p.medPlans, plan ];
      if (next.length > MED_PLAN_LIMIT) {
        const err = new Error(`最多记 ${MED_PLAN_LIMIT} 条用药计划`);
        err.code = 'too_many';
        throw err;
      }
      p.medPlans = next;
      const saved = save(p);
      return { added: true, plan, profile: saved };
    },

    listMedPlans() {
      return load().medPlans;
    },

    removeMedPlan(id) {
      const p = load();
      const before = p.medPlans.length;
      p.medPlans = p.medPlans.filter((x) => x.id !== id);
      if (p.medPlans.length === before) return { removed: false, profile: p };
      return { removed: true, profile: save(p) };
    },

    /**
     * 记一个养生行为。
     *
     * ref 存规范名（艾灸），name 存用户原话。
     * 只存规范名的话，用户下次说「我做艾条」对不上；
     * 只存原话的话，做禁忌匹配时没有稳定的键。两个都要。
     */
    addPractice(name, ref) {
      const clean = String(name || '').trim();
      const key = String(ref || name || '').trim();
      if (!clean || !key) {
        const err = new Error('没听出是哪一项');
        err.code = 'missing_item';
        throw err;
      }
      const p = load();
      const hit = p.practices.find((x) => x.ref === key);
      if (hit) return { added: false, practice: hit, profile: p };
      const item = { name: clean, ref: key, addedAt: new Date().toISOString() };
      p.practices = [...p.practices, item];
      return { added: true, practice: item, profile: save(p) };
    },

    listPractices() {
      return load().practices;
    },

    removePractice(ref) {
      const p = load();
      const before = p.practices.length;
      p.practices = p.practices.filter((x) => x.ref !== ref);
      if (p.practices.length === before) return { removed: false, profile: p };
      return { removed: true, profile: save(p) };
    },

    addConcern(text) {
      const clean = String(text || '').trim();
      if (!clean) return { added: false };
      const p = load();
      if (p.concerns.some((c) => norm(c.text) === norm(clean))) return { added: false, profile: p };
      p.concerns = [...p.concerns, { text: clean, addedAt: new Date().toISOString() }].slice(-20);
      return { added: true, profile: save(p) };
    },

    getConcerns() {
      return load().concerns;
    },

    /** 记一条问过的。失败不影响本次回答，所以这里可以吞——但只吞这一处。 */
    pushHistory(q) {
      const clean = String(q || '').trim();
      if (!clean) return load();
      const p = load();
      p.history = [...p.history, { q: clean, at: new Date().toISOString() }].slice(-HISTORY_LIMIT);
      try {
        return save(p);
      } catch (err) {
        console.warn('[profile] 历史记录没写进去（不影响本次回答）：', err && err.message);
        return p;
      }
    },

    getHistory() {
      return load().history;
    },

    /** 全部清空。用户要求删数据时必须真的删干净，不能只清内存。 */
    wipe() {
      backend.remove(key);
      return emptyProfile(userId);
    },
  };
}
