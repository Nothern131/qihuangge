// 设备侧引擎加载。
//
// 和 adapter/load-engines.js 的分工：
//   · load-engines.js  —— Node 测试用，fs 读原始文件灌进 vm 沙箱，证明「原始文件零改动也能跑」
//   · 本文件            —— 设备用，import 打包进 aiui/ 的包装副本，证明「打包后照样能跑」
// 两条路必须行为一致，由 tests/vendor-parity.js 逐查询比对。
//
// 为什么不直接用全局：AIUI 页面里有没有 window / global 没有可靠保证，
// 官方文档只确认了 window 是路由与视口 API，没说它是全局对象。
// 所以这里按「调用方传入 → globalThis → window → 打包副本」的顺序找，
// 打包副本放最后兜底，是唯一定然存在的那个。

import * as vendored from '../vendor/engines.js';

export const ENGINE_NAMES = [
  'EngineRegistry',
  'InteractionEngine',
  'BencaoEngine',
  'VitaminEngine',
  'TizhiEngine',
  'SymptomEngine',
];

// 缺了这三个就答不了话，不能拿半套引擎硬答
export const REQUIRED_ENGINES = ['InteractionEngine', 'BencaoEngine', 'VitaminEngine'];

/**
 * @param {object} [scope] 调用方手里的全局对象（测试或特殊宿主用）
 * @returns {object} 引擎集合；缺必需引擎时抛错，由页面转成可读提示
 */
export function getEngines(scope) {
  const holders = [];
  if (scope) holders.push(scope);
  if (typeof globalThis !== 'undefined') holders.push(globalThis);
  if (typeof window !== 'undefined') holders.push(window);
  holders.push(vendored);

  const out = {};
  const missing = [];
  for (const name of ENGINE_NAMES) {
    const holder = holders.find((h) => h && h[name]);
    if (holder) out[name] = holder[name];
    else missing.push(name);
  }

  const lack = REQUIRED_ENGINES.filter((n) => !out[n]);
  if (lack.length > 0) {
    throw new Error(`资料库没加载起来：缺少 ${lack.join('、')}`);
  }

  // 不静默：可选引擎缺失要能在日志里看见，否则「某个功能查不到」会被当成数据问题
  if (missing.length > 0) console.warn('[qihuang] 可选引擎缺失：', missing.join('、'));

  return out;
}
