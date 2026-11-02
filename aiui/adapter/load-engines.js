// 零改动加载岐黄阁原始引擎。
//
// 为什么这样做（关键约束）：
// 用户明确要求「不要动它原本的架构，是额外进行改动」。
// 所以这里不 import、不改写、不打包 copy——而是把原始 .js 文件原样读进来，
// 在独立的 vm 沙箱里按声明顺序执行。原始文件一个字节都没变。
//
// 为什么能这么干：岐黄阁的引擎统一写成
//   (function(global){ ... global.XxxEngine = ... })(typeof global !== 'undefined' ? global : window)
// 只要给沙箱一个叫 global 的对象指向它自己，引擎就把它挂到沙箱上，
// 不会污染 Node 的全局，也不需要 window。
//
// 顺序敏感：registry 必须在 engines 之前，某些引擎之间也有依赖。顺序写在 manifest.json。

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// 岐黄阁项目根（aiui/ 的上一级）
export const PROJECT_ROOT = path.resolve(HERE, '..', '..');

export function loadManifest() {
  const manifestPath = path.join(HERE, '..', 'manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

/**
 * 按 manifest 顺序把原始脚本加载进沙箱，返回 { sandbox, loaded, missing }。
 * @param {object} opts
 * @param {boolean} opts.quiet 不打印加载日志
 */
export function loadEngines({ quiet = false } = {}) {
  const manifest = loadManifest();
  const sandbox = { console };
  // 引擎里的判定是 typeof global !== 'undefined' ? global : window
  // 让 global 指向沙箱自身即可，既满足判定，也不会写到真实 Node 全局。
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  const loaded = [];
  const missing = [];

  for (const rel of manifest.scripts) {
    const abs = path.join(PROJECT_ROOT, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const code = fs.readFileSync(abs, 'utf8');
    vm.runInContext(code, sandbox, { filename: rel });
    loaded.push(rel);
    if (!quiet) console.log(`  加载 ${rel}`);
  }

  return { sandbox, manifest, loaded, missing };
}

/** 沙箱里所有以 Engine 结尾的全局对象名 */
export function listEngineGlobals(sandbox) {
  return Object.keys(sandbox)
    .filter((k) => /Engine$/.test(k))
    .sort();
}
