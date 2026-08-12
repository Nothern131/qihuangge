/**
 * 岐黄阁 · 黄金测试集
 * 运行方式: 在浏览器控制台执行 window.runTests()
 * 或在 Node 环境中引用 engine 并调用 runTests()
 */
(function() {
    'use strict';
    var global = (typeof window !== 'undefined' ? window : this);

    var TESTS = null;

    // 异步加载 golden_set.json
    function loadTests() {
        return fetch('tests/golden_set.json').then(function(res) {
            return res.json();
        }).then(function(data) {
            TESTS = data;
            return data;
        });
    }

    function runTest(q) {
        var result = { id: q.id, pass: false, expected: q.expected, actual: null, error: null };
        try {
            if (q.module === 'bencao') {
                var herb = (global.BencaoEngine && global.BencaoEngine.DB) ?
                    global.BencaoEngine.DB[q.input] : null;
                result.actual = herb;
                if (herb) {
                    var exp = q.expected;
                    var checks = [];
                    if (exp.xingwei) checks.push((herb.xingwei || '').indexOf(exp.xingwei) !== -1);
                    if (exp.gujing) checks.push((herb.guojing || '').indexOf(exp.gujing) !== -1);
                    if (exp.功效) checks.push((herb.功效 || '').indexOf(exp.功效) !== -1);
                    if (exp.jindu) checks.push((herb.jindu || '').indexOf(exp.jindu) !== -1);
                    result.pass = checks.every(function(c) { return c; });
                }
            } else if (q.module === 'interaction') {
                var ie = global.InteractionEngine;
                if (!ie) return result;
                var herbs = Array.isArray(q.input) ? q.input : [q.input];
                var checkFn = ie.checkShibaFan;
                if (q.expected.warning === '十九畏') checkFn = ie.checkShijiuWei;
                var fans = checkFn(herbs);
                result.actual = fans;
                var hit = fans.some(function(f) {
                    return f.msg.indexOf(q.expected.msg || '') !== -1 ||
                           f.msg.indexOf(herbs[0]) !== -1 || herbs.every(function(h) { return f.msg.indexOf(h) !== -1; });
                });
                result.pass = hit;
                if (!q.expected.msg && herbs.length >= 2) {
                    result.pass = fans.length > 0;
                }
            } else if (q.module === 'fangji') {
                var fe = global.FangjiEngine;
                if (!fe) return result;
                var formula = fe.DB[q.input];
                result.actual = formula;
                if (formula) {
                    result.pass = true;
                }
            } else if (q.module === 'master') {
                var me = global.MastersEngine;
                if (!me) return result;
                var master = me.getMasterById(q.input);
                result.actual = master;
                if (master) {
                    result.pass = master.name === q.expected.name;
                }
            }
        } catch (e) {
            result.error = e.message;
        }
        return result;
    }

    function runAll() {
        if (!TESTS) {
            console.error('[测试] 测试集尚未加载，请先调用 runTests()（需等待引擎加载）');
            return;
        }
        var results = TESTS.map(function(q) { return runTest(q); });
        var pass = results.filter(function(r) { return r.pass; }).length;
        var total = results.length;
        console.log('\n========== 岐黄阁 · 黄金测试集 ==========\n');
        results.forEach(function(r) {
            var status = r.pass ? 'PASS' : 'FAIL';
            console.log('[' + status + ']' + r.id + ' ' + r.expected.module + ': ' +
                (r.pass ? '✓' : '✗ ' + (r.error || '实际值不匹配')));
        });
        console.log('\n通过率: ' + (pass / total * 100).toFixed(1) + '% (' + pass + '/' + total + ')\n');
        return { total: total, pass: pass, rate: (pass / total * 100).toFixed(1) + '%' };
    }

    // 页面加载后自动运行
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
                loadTests().then(function() { runAll(); });
            }, 500);
        });
    }

    global.runTests = runAll;
    global.loadTests = loadTests;
})(typeof window !== 'undefined' ? window : this);