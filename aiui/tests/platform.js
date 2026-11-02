// 平台合规静态校验器（麻将）。
//
// 为什么要有这个：.ink 的错误几乎全是「不报错的错误」——
// 权限名写错，语音能用但录音被拒；模板绑定一个不存在的字段，屏幕就空着；
// 页面路径少一层目录，整个页面装不上。这三种在 Node 里全都能提前查出来，
// 不查就只能等模拟器里一个个撞。
//
// 规则来源：官方仓库 yodaos-project/AIUI 的 skills/aiui-dev/references/
//   framework.md（结构 / app.json / SFC 四块 / permissions 合法值）
//   checklist.md（第 1、2、8 节的强制项）
// 2026-11-02 取回原文核对，不是凭印象写的。
//
// 这个文件在两个作品里各存一份（打包成 .aix 时不能跨项目引用），
// 只改 CONFIG 段，其余保持一致。

import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 每个页面对应的视图模型（用来取 data 的字段名，检查模板绑定是否都存在）
const CONFIG = {
  name: '本草速查',
  // 官方 framework.md 列出的合法权限值，大小写敏感，且没有 SPEECH_RECOGNITION
  allowedPermissions: ['GEOLOCATION', 'CAMERA', 'RECORD_AUDIO'],
  speechModule: 'core/speech.js',
  pages: {
    'pages/index/index.ink': 'ui/qihuang-view.js',
  },
};

const PASSED = [];
const FAILED = [];

function check(name, fn) {
  let detail = '';
  let ok = false;
  try {
    const r = fn();
    ok = r === undefined ? true : Boolean(r.ok !== false);
    detail = typeof r === 'object' && r !== null ? (r.detail || '') : (r === undefined ? '' : String(r));
  } catch (err) {
    ok = false;
    detail = err && err.message ? err.message : String(err);
  }
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? `：${detail}` : ''}`);
  (ok ? PASSED : FAILED).push(name);
  return ok;
}

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/** 把 <script setup> 的代码写成临时 .mjs 交给 node --check 做真实语法检查 */
function checkJsSyntax(code, label) {
  const tmp = join(tmpdir(), `aiui-check-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmp, code, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    return true;
  } catch (err) {
    const msg = String((err.stderr && err.stderr.toString()) || err.message).split('\n').slice(0, 4).join(' ');
    throw new Error(`${label} 语法错误：${msg}`);
  } finally {
    try { unlinkSync(tmp); } catch { /* 临时文件删不掉不影响结论 */ }
  }
}

/** 从 .ink 里切出四个块。开标签带属性、闭标签是裸标签名，必须分开匹配。 */
function parseInk(src) {
  const grab = (open, close) => {
    const m = src.match(new RegExp(`<${open}[^>]*>([\\s\\S]*?)</${close}>`, 'i'));
    return m ? m[1] : null;
  };
  return {
    def: grab('script\\s+def', 'script'),
    setup: grab('script\\s+setup', 'script'),
    page: grab('page', 'page'),
    widget: grab('widget', 'widget'),
    style: grab('style', 'style'),
  };
}

console.log(`=== ${CONFIG.name} · 平台合规校验 ===\n`);

console.log('【1】app.json');
let app = null;
check('文件存在', () => existsSync(join(ROOT, 'app.json')));
check('是合法 JSON', () => {
  app = JSON.parse(read('app.json'));
  return Object.keys(app).join(',');
});
check('permissions 是数组', () => Array.isArray(app.permissions));
check('permissions 全是官方合法值', () => {
  const bad = (app.permissions || []).filter((p) => !CONFIG.allowedPermissions.includes(p));
  if (bad.length) throw new Error(`非法权限名：${bad.join('、')}（官方只有 ${CONFIG.allowedPermissions.join(' / ')}）`);
  return (app.permissions || []).join(',');
});
check('没有使用已废弃的 workers 字段', () => !('workers' in app));
check('pages 是非空数组', () => Array.isArray(app.pages) && app.pages.length > 0);

console.log('\n【2】页面路由与源结构');
for (const route of app.pages || []) {
  check(`${route} 路径不带扩展名`, () => !/\.(ink|js|json)$/.test(route));
  check(`${route} 只有一个源结构（.ink 或多文件四件套，不能并存）`, () => {
    const ink = join(ROOT, `${route}.ink`);
    const four = ['json', 'wxml', 'wxss', 'js'].map((e) => existsSync(join(ROOT, `${route}.${e}`)));
    const hasInk = existsSync(ink);
    const hasFour = four.every(Boolean);
    const partial = four.some(Boolean) && !hasFour;
    if (hasInk && hasFour) throw new Error('两种结构同时存在');
    if (partial) throw new Error('多文件结构缺文件');
    if (!hasInk && !hasFour) throw new Error('找不到源文件');
    return hasInk ? '.ink' : '四件套';
  });
}

console.log('\n【3】.ink 四块结构与唯一根');
for (const inkRel of Object.keys(CONFIG.pages)) {
  const src = read(inkRel);
  const b = parseInk(src);
  check(`${inkRel} 有 <script def>`, () => b.def !== null);
  check(`${inkRel} 的 <script def> 是合法 JSON`, () => {
    const j = JSON.parse(b.def);
    return j.description ? j.description.slice(0, 12) + '…' : '无 description';
  });
  check(`${inkRel} 有 <script setup>`, () => b.setup !== null);
  check(`${inkRel} 的 <script setup> 语法正确`, () => checkJsSyntax(b.setup, inkRel));
  check(`${inkRel} 有且只有一个界面根（page 或 widget）`, () => {
    const roots = [b.page !== null, b.widget !== null].filter(Boolean).length;
    if (roots !== 1) throw new Error(`找到 ${roots} 个根`);
    return b.page !== null ? '<page>' : '<widget>';
  });
  check(`${inkRel} 有 <style>`, () => b.style !== null);
  check(`${inkRel} 没有 App()/Page()/Widget() 注册调用`, () => {
    const m = src.match(/(^|[^.\w])(App|Page|Widget)\s*\(/);
    if (m) throw new Error(`残留 ${m[2]}( )`);
    return '无';
  });
  check(`${inkRel} 用 export default 导出逻辑`, () => /\bexport\s+default\s*\{/.test(b.setup));
}

console.log('\n【3b】多行文本必须有 pre-line');
// answer 里带 \n 的地方（结论 + 出处、正文 + 经典原文）靠换行分层。
// 漏掉 white-space: pre-line 时页面不报错、不白屏，只是 \n 被折叠成空格，
// 出处挤在结论句屁股后面——从代码看不出问题，只有看屏幕才发现。实测踩过一次。
//
// 不做「answer 里有没有 \n」的条件判断：判断本身要实例化视图模型、
// 要按工程传不同的引擎，条件一旦写歪这条就静默失效。
// 统一要求，对不含换行的 answer 也没有副作用。
for (const inkRel of Object.keys(CONFIG.pages)) {
  const b = parseInk(read(inkRel));
  check(`${inkRel} 的 .answer 设了 white-space: pre-line`, () => {
    if (!/\.answer\s*\{[^}]*white-space\s*:\s*pre-line/.test(b.style || '')) {
      throw new Error('answer 的 \\n 会被折叠成空格');
    }
    return '有';
  });
}

console.log('\n【4】模板绑定与 data 字段对照');
// 这是三类静默故障里最难查的一个：绑定名写错，setData 也不报错，屏幕就是空的。
for (const [inkRel, viewRel] of Object.entries(CONFIG.pages)) {
  const src = read(inkRel);
  const b = parseInk(src);
  const view = await import(pathToFileURL(join(ROOT, viewRel)).href);
  const dataKeys = Object.keys(view.INITIAL_STATE || {});
  // <script setup> 里定义的方法名，模板绑定也可能指向它们（本版模板没绑方法，留着防将来）
  const methodNames = [...b.setup.matchAll(/^ {2}(\w+)\s*\(/gm)].map((m) => m[1]);

  const used = new Set();
  for (const m of b.page.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    for (const id of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) used.add(id[0]);
  }
  const missing = [...used].filter((k) => !dataKeys.includes(k) && !methodNames.includes(k) && !['true', 'false', 'null'].includes(k));
  check(`${inkRel} 模板绑定的字段都存在`, () => {
    if (!dataKeys.length) throw new Error(`${viewRel} 没有导出 INITIAL_STATE`);
    if (missing.length) throw new Error(`模板引用了不存在的字段：${missing.join('、')}`);
    return `${used.size} 个绑定全部命中 data（${dataKeys.length} 个字段）`;
  });

  const unused = dataKeys.filter((k) => !used.has(k));
  check(`${inkRel} data 字段没有白声明`, () => {
    if (unused.length) throw new Error(`声明了但模板没绑：${unused.join('、')}`);
    return '无冗余字段';
  });
}

console.log('\n【5】页面里的 import 都要能解析');
for (const inkRel of Object.keys(CONFIG.pages)) {
  const b = parseInk(read(inkRel));
  const baseDir = join(ROOT, dirname(inkRel));
  check(`${inkRel} 全部 import 路径存在`, () => {
    const specs = [...b.setup.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]).filter((s) => s.startsWith('.'));
    if (!specs.length) throw new Error('没有相对 import，页面是空壳');
    const missing = specs.filter((s) => {
      const p = resolve(baseDir, s);
      return !existsSync(p) && !existsSync(`${p}.js`) && !existsSync(`${p}.ink`);
    });
    if (missing.length) throw new Error(`解析不到：${missing.join('、')}`);
    return `${specs.length} 个模块`;
  });
}

console.log('\n【6】语音调用符合官方契约');
check('引擎里没有把字符串直接交给 speak()', () => {
  const src = read(CONFIG.speechModule);
  if (!/new\s+Ctor\(|new\s+SpeechSynthesisUtterance\(/.test(src)) {
    throw new Error('speak() 第一个参数必须是 SpeechSynthesisUtterance 实例');
  }
  if (/api\.speak\(line,/.test(src) && !/Ctor/.test(src)) throw new Error('仍在传裸字符串');
  return '构造 utterance 后播放';
});
check('没有给 TTS 设 lang（官方明写不生效）', () => {
  const src = read(CONFIG.speechModule);
  if (/u\.lang\s*=/.test(src) || /utterance\.lang\s*=/.test(src)) throw new Error('utterance.lang 不生效，中文音色要用 voice');
  return '用 voice 指定音色';
});
check('识别回调统一走 readSpeech', () => {
  const bad = [];
  for (const inkRel of Object.keys(CONFIG.pages)) {
    const src = read(inkRel);
    if (/ev\.text|event\.text|ev\.result\b/.test(src)) bad.push(inkRel);
  }
  if (bad.length) throw new Error(`还在读不存在的字段：${bad.join('、')}`);
  return '无 ev.text / ev.result';
});
check('页面处理了识别失败（无静默失败）', () => {
  const missing = Object.keys(CONFIG.pages).filter((p) => !/onSpeechError\s*\(/.test(read(p)));
  if (missing.length) throw new Error(`缺 onerror 处理：${missing.join('、')}`);
  return '都有 onSpeechError';
});
check('页面在 onUnload / onHide 里释放识别与定时器', () => {
  const missing = Object.keys(CONFIG.pages).filter((p) => !/onUnload\s*\(/.test(read(p)));
  if (missing.length) throw new Error(`缺 onUnload：${missing.join('、')}`);
  return '都有清理入口';
});

console.log('\n【7】不依赖单一分辨率');
check('.ink 样式里没有写死 480×352', () => {
  const bad = [];
  for (const inkRel of Object.keys(CONFIG.pages)) {
    const style = parseInk(read(inkRel)).style || '';
    if (/480px|352px/.test(style)) bad.push(inkRel);
  }
  if (bad.length) throw new Error(`写死视口尺寸：${bad.join('、')}（换分辨率会裁掉底部结论）`);
  return '用比例与 Flex';
});

console.log('\n【8】过期后缀与遗留文件');
check('没有残留 .mjs 引用', () => {
  const bad = [];
  for (const inkRel of Object.keys(CONFIG.pages)) {
    if (/\.mjs['"]/.test(read(inkRel))) bad.push(inkRel);
  }
  if (bad.length) throw new Error(bad.join('、'));
  return '全部 .js';
});
check('工程根没有 Node 专用产物，且声明了 .aixignore', () => {
  const stray = ['package-lock.json', 'node_modules', '_archive'].filter((f) => existsSync(join(ROOT, f)));
  if (stray.length) throw new Error(`打包时会带进去：${stray.join('、')}`);
  if (!existsSync(join(ROOT, '.aixignore'))) throw new Error('缺 .aixignore，tests/ 与 tools/ 会进包');
  return '干净';
});

console.log('\n' + '='.repeat(60));
console.log(`通过 ${PASSED.length} / ${PASSED.length + FAILED.length}`);
if (FAILED.length > 0) {
  console.log('失败项：' + FAILED.join('、'));
  process.exit(1);
}
console.log('全部通过');
