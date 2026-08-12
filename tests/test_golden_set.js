/**
 * 岐黄阁 · 黄金测试集
 * 运行方式:
 *   - 浏览器控制台: window.runTests()
 *   - Node.js: node tests/test_golden_set.js
 */
(function(global) {
    'use strict';

    var TESTS = null;

    // 异步加载 golden_set.json
    function loadTests() {
        var fs = global.fs;
        return Promise.resolve().then(function() {
            if (!fs) {
                return fetch('tests/golden_set.json').then(function(res) {
                    return res.json();
                });
            }
            return JSON.parse(fs.readFileSync('tests/golden_set.json', 'utf8'));
        }).then(function(data) {
            TESTS = data;
            return data;
        });
    }

    function runTest(q) {
        var result = { id: q.id, pass: false, expected: q.expected, actual: null, error: null };
        try {
            if (q.module === 'bencao') {
                var bencao = global.BencaoEngine;
                var herb = (bencao && bencao.DB) ? bencao.DB[q.input] : null;
                result.actual = herb;
                if (herb) {
                    var exp = q.expected;
                    var checks = [];
                    if (exp.xingwei) checks.push((herb.xingwei || '').indexOf(exp.xingwei) !== -1);
                    if (exp.gujing) checks.push((herb.gujing || '').indexOf(exp.gujing) !== -1);
                    if (exp.功效) checks.push((herb.功效 || '').indexOf(exp.功效) !== -1);
                    if (exp.jindu) checks.push((herb.jindu || '').indexOf(exp.jindu) !== -1);
                    result.pass = checks.length > 0 && checks.every(function(c) { return c; });
                }
            } else if (q.module === 'interaction') {
                var ie = global.InteractionEngine;
                if (!ie) return result;
                var herbs = Array.isArray(q.input) ? q.input : [q.input];
                var exp = q.expected;

                // 妊娠禁忌检查
                if (exp.pregnancy_warning) {
                    var preg = ie.checkPregnancy(herbs);
                    result.actual = preg;
                    result.pass = preg.length > 0;
                    return result;
                }

                // 十八反/十九畏检查
                var checkFn = ie.checkShibaFan;
                if (exp.warning === '十九畏') checkFn = ie.checkShijiuWei;
                var fans = checkFn(herbs);
                result.actual = fans;
                var hit = fans.some(function(f) {
                    return f.msg.indexOf(exp.msg || '') !== -1 ||
                           f.msg.indexOf(herbs[0]) !== -1 || herbs.every(function(h) { return f.msg.indexOf(h) !== -1; });
                });
                result.pass = hit;
                if (!exp.msg && herbs.length >= 2) {
                    result.pass = fans.length > 0;
                }
            } else if (q.module === 'fangji') {
                var fe = global.FangjiEngine;
                if (!fe) return result;
                var formula = fe.DB ? fe.DB[q.input] : fe.search(q.input);
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
            console.error('[测试] 测试集尚未加载，请先调用 loadTests()');
            return null;
        }
        var results = TESTS.map(function(q) { return runTest(q); });
        var pass = results.filter(function(r) { return r.pass; }).length;
        var total = results.length;
        console.log('\n========== 岐黄阁 · 黄金测试集 ==========\n');
        results.forEach(function(r) {
            var status = r.pass ? 'PASS' : 'FAIL';
            console.log('[' + status + ']' + r.id + ' ' + r.expected.module + ': ' +
                (r.pass ? 'OK' : 'FAIL - ' + (r.error || '不匹配')));
        });
        console.log('\n通过率: ' + (pass / total * 100).toFixed(1) + '% (' + pass + '/' + total + ')\n');
        return { total: total, pass: pass, rate: (pass / total * 100).toFixed(1) + '%' };
    }

    // Node.js: 直接执行
    if (typeof global.process !== 'undefined' && global.process.versions && global.process.versions.node) {
        var fs = require('fs');
        global.BencaoEngine = null;
        global.InteractionEngine = null;
        global.FangjiEngine = null;
        global.MastersEngine = null;
        var bencao = fs.readFileSync('static/js/engines/bencao-engine.js', 'utf8');
        var interaction = fs.readFileSync('static/js/engines/interaction-engine.js', 'utf8');
        var fangji = fs.readFileSync('static/js/engines/fangji-engine.js', 'utf8');
        var masters = fs.readFileSync('static/js/engines/masters-engine.js', 'utf8');
        new Function('global', bencao)(global);
        new Function('global', interaction)(global);
        new Function('global', fangji)(global);
        new Function('global', masters)(global);
        TESTS = JSON.parse(fs.readFileSync('tests/golden_set.json', 'utf8'));
        runAll();
    }

    global.runTests = runAll;
    global.loadTests = loadTests;
})(typeof global !== 'undefined' ? global : window);
