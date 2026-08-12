/**
 * 岐黄阁 · 配伍检查组件
 * 十八反、十九畏、妊娠禁忌、毒性标注
 * v20260808c
 */
(function() {
    'use strict';
    var global = (typeof window !== 'undefined' ? window : this);

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render(fans, weis, pregnancy, toxicity) {
        var html = '';
        var hasWarnings = fans.length > 0 || weis.length > 0 || pregnancy.length > 0;

        html += '<div class="interaction-check-result">';

        // 十八反
        if (fans.length > 0) {
            html += '<div class="interaction-check-item">';
            html += '<h4 class="check-section-title danger">⚠ 十八反</h4>';
            fans.forEach(function(w) {
                html += '<div class="check-warning-row">';
                html += '<span class="check-warning-type">禁忌</span>';
                html += '<span class="check-warning-text">' + escHtml(w.msg) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 十九畏
        if (weis.length > 0) {
            html += '<div class="interaction-check-item">';
            html += '<h4 class="check-section-title caution">⚠ 十九畏</h4>';
            weis.forEach(function(w) {
                html += '<div class="check-warning-row">';
                html += '<span class="check-warning-type">忌用</span>';
                html += '<span class="check-warning-text">' + escHtml(w.msg) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 妊娠禁忌
        if (pregnancy.length > 0) {
            html += '<div class="interaction-check-item">';
            html += '<h4 class="check-section-title warning">⚠ 妊娠禁忌</h4>';
            pregnancy.forEach(function(w) {
                html += '<div class="check-warning-row">';
                html += '<span class="check-warning-type">' + (w.level === 'strong' ? '禁用' : '慎用') + '</span>';
                html += '<span class="check-warning-text">' + escHtml(w.msg) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 毒性标注
        if (toxicity.length > 0) {
            html += '<div class="interaction-check-item">';
            html += '<h4 class="check-section-title">☠ 毒性标注</h4>';
            html += '<div class="toxicity-grid">';
            toxicity.forEach(function(t) {
                var cls = t.toxicity === '大毒' ? 'toxic-d' : t.toxicity === '有毒' ? 'toxic-m' : t.toxicity === '小毒' ? 'toxic-l' : 'toxic-n';
                html += '<div class="toxicity-tag ' + cls + '">' + escHtml(t.herb) + '<span class="toxicity-level">' + escHtml(t.toxicity) + '</span></div>';
            });
            html += '</div></div>';
        }

        // 无问题
        if (!hasWarnings) {
            html += '<div class="interaction-check-safe">✅ 未检出配伍禁忌</div>';
        }

        html += '<div class="vitamin-disclaimer">配伍禁忌仅供参考，处方用药请遵医嘱。</div>';
        html += '</div>';
        return html;
    }

    function renderRules() {
        var ie = window.InteractionEngine || {};
        var html = '<div class="rules-section"><h3>配伍禁忌规则说明</h3>';
        html += '<div class="rule-grid">';

        html += '<div class="rule-card"><h4>十八反</h4>';
        html += '<p>甘草反大戟、甘遂、芫花、海藻；乌头反贝母、瓜蒌、半夏、白蔹、白及；藜芦反人参、沙参、丹参、玄参、苦参、细辛、芍药。</p></div>';

        html += '<div class="rule-card"><h4>十九畏</h4>';
        html += '<p>硫黄畏朴硝，水银畏砒霜，狼毒畏密陀僧，巴豆畏牵牛，丁香畏郁金，川乌草乌畏牙硝三棱，人参畏赤石脂。</p></div>';

        html += '<div class="rule-card"><h4>妊娠禁忌</h4>';
        html += '<p>大毒/有毒药多禁用（如附子、乌头、马钱子等），破血逐瘀药慎用（如桃仁、红花等）。</p></div>';

        html += '</div></div>';
        return html;
    }

    function init() {
        // 初始化组件，由路由触发
    }

    function render() {
        var html = '<div class="page-container"><div class="page-header"><h2>⚖ 配伍检查</h2><p>十八反 · 十九畏 · 妊娠禁忌 · 毒性标注</p></div>';
        html += '<div class="interaction-page">';
        html += renderInputForm();
        html += renderRules();
        html += '<div id="interactionResult"></div>';
        html += '</div></div>';
        return html;
    }

    function renderInputForm() {
        var html = '<div class="interaction-check-section">';
        html += '<h3>输入药味（用逗号分隔）</h3>';
        html += '<p class="input-hint">示例：甘草、大戟、川乌、贝母、半夏</p>';
        html += '<input type="text" id="interactionHerbs" placeholder="输入药味，如：人参、细辛、藜芦" class="interaction-check-input">';
        html += '<button onclick="runInteractionCheck()" class="interaction-check-btn">开始检查</button>';
        html += '</div>';
        return html;
    }

    function runInteractionCheck() {
        var input = document.getElementById('interactionHerbs');
        if (!input) return;
        var raw = input.value.trim();
        if (!raw) {
            alert('请输入药味名称');
            return;
        }
        var herbs = raw.split(/[,，、\s]+/).filter(function(h) { return h.trim(); });
        var result = window.InteractionEngine.check(herbs, { checkFan: true, checkWei: true, pregnancy: true });
        var hasWarnings = result.totalWarnings > 0;
        var html = '<div class="interaction-check-summary ' + (hasWarnings ? 'has-warnings' : 'no-warnings') + '">';
        html += '<h3>检查结果：' + (hasWarnings ? '⚠ 发现 ' + result.totalWarnings + ' 条禁忌' : '✅ 未发现禁忌') + '</h3>';
        html += '</div>';
        html += InteractionComponent.render(result.fans, result.weis, result.pregnancy, result.toxicity);
        var resultEl = document.getElementById('interactionResult');
        if (resultEl) resultEl.innerHTML = html;
    }

    global.InteractionComponent = {
        render: render,
        renderRules: renderRules,
        init: init,
        runInteractionCheck: runInteractionCheck
    };

    if (typeof QiuhuangApp !== 'undefined') {
        QiuhuangApp.registerRoute('#/interaction', render);
    }
})(typeof window !== 'undefined' ? window : this);