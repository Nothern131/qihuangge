/**
 * 岐黄阁 · 辨证推理组件
 * 支持 2-3 症状快速测试，结果持久化供大师蒸馏调用
 */
(function(global) {
    'use strict';

    var symptomList = [
        '恶寒', '发热', '头痛', '咳嗽', '胸闷', '心悸',
        '乏力', '食少', '腹胀', '便溏', '腰膝酸软', '耳鸣',
        '失眠', '畏寒', '口渴'
    ];
    var tongueOptions = ['未选择', '舌质淡白', '舌质红', '舌质红绛', '舌体胖大', '舌苔薄白', '舌苔黄腻', '舌苔白腻', '舌苔少'];
    var pulseOptions = ['未选择', '脉浮', '脉沉', '脉迟', '脉数', '脉虚', '脉实', '脉滑', '脉涩', '脉弦', '脉细'];

    function render() {
        var symptomsHtml = symptomList.map(function(s) {
            return `<label class="symptom-tag"><input type="checkbox" value="${s}">${s}</label>`;
        }).join('');

        var tongueOptsHtml = tongueOptions.map(function(t, i) {
            return `<option value="${i === 0 ? '未选择' : t}">${t}</option>`;
        }).join('');

        var pulseOptsHtml = pulseOptions.map(function(p, i) {
            return `<option value="${i === 0 ? '未选择' : p}">${p}</option>`;
        }).join('');

        return `
            <div class="bianzheng-page">
                <h2>辨证推理</h2>
                <p class="desc">输入症状、舌象、脉象，系统进行八纲·六经·脏腑三层辨证</p>
                <div class="input-group">
                    <label>主要症状 <span style="color:#a09888;font-size:12px;">（至少选2项）</span></label>
                    <div class="symptom-tags">${symptomsHtml}</div>
                </div>
                <div class="input-group">
                    <label>舌象描述 <span style="color:#a09888;font-size:12px;">（可选，有助于提高准确率）</span></label>
                    <select id="tongue-select">${tongueOptsHtml}</select>
                </div>
                <div class="input-group">
                    <label>脉象描述 <span style="color:#a09888;font-size:12px;">（可选，有助于提高准确率）</span></label>
                    <select id="pulse-select">${pulseOptsHtml}</select>
                </div>
                <button onclick="runBianzheng()" class="btn-primary">开始辨证</button>
                <div id="bianzheng-result" class="result-area"></div>
            </div>
        `;
    }

    function runBianzheng() {
        var checked = document.querySelectorAll('.symptom-tags input:checked');
        var symptoms = Array.from(checked).map(function(el) { return el.value; });
        var tongue = document.getElementById('tongue-select') ? document.getElementById('tongue-select').value : '未选择';
        var pulse = document.getElementById('pulse-select') ? document.getElementById('pulse-select').value : '未选择';

        console.log('[岐黄阁][辨证组件] 开始辨证', { symptoms: symptoms, tongue: tongue, pulse: pulse });

        if (symptoms.length < 2) {
            alert('请至少选择2个症状，系统才能进行辨证推理');
            return;
        }

        var result = BianZhengEngine.bianzheng(symptoms, tongue, pulse);

        console.log('[岐黄阁][辨证组件] 辨证结果', result);

        // 持久化辨证结果，供大师蒸馏调用
        window.lastBianzhengResult = result;

        var resultEl = document.getElementById('bianzheng-result');
        if (!resultEl) return;

        var html = '<h3>辨证结果</h3>';
        html += '<div class="result-item"><span class="result-label">辨证结论</span><span class="result-value">' + result.final_syndrome + '</span><span style="margin-left:12px;color:#b8945c;font-size:12px;">（置信度：' + result.confidence + '%）</span></div>';

        var biaoganHtml = '<table class="score-table"><thead><tr><th>阴阳</th><th>表里</th><th>寒热</th><th>虚实</th></tr></thead><tbody><tr>';
        Object.keys(result.biaogan).forEach(function(k) {
            html += '<td>' + k + '：' + result.biaogan[k].score + '分</td>';
        });
        html += '</tr></tbody></table>';
        html += '<div class="result-section"><h5>八纲辨证</h5>' + biaoganHtml + '</div>';

        var liujingHtml = '';
        if (result.liujing) {
            liujingHtml = '<table class="score-table"><thead><tr><th>六经</th><th>得分</th></tr></thead><tbody>';
            Object.keys(result.liujing).forEach(function(k) {
                liujingHtml += '<tr><td>' + k + '</td><td>' + result.liujing[k] + '</td></tr>';
            });
            liujingHtml += '</tbody></table>';
        }
        if (liujingHtml) html += '<div class="result-section"><h5>六经辨证</h5>' + liujingHtml + '</div>';

        var zangfuHtml = '';
        if (result.zangfu && result.zangfu.length > 0) {
            zangfuHtml = '<table class="score-table"><thead><tr><th>脏腑</th><th>得分</th></tr></thead><tbody>';
            result.zangfu.forEach(function(z) {
                zangfuHtml += '<tr><td>' + z.org + '</td><td>' + z.score + '</td></tr>';
            });
            zangfuHtml += '</tbody></table>';
        }
        if (zangfuHtml) html += '<div class="result-section"><h5>脏腑辨证</h5>' + zangfuHtml + '</div>';

        html += '<div class="result-section"><h5>治则建议</h5><p>' + (result.zhize || '请结合六经辨证结果') + '</p></div>';
        html += '<div class="result-section" style="margin-top:12px;padding:10px;background:rgba(184,148,92,0.08);border-radius:6px;"><p style="font-size:12px;color:#8a7a5a;">⚠️ 本系统仅供学习参考，不构成医疗建议。请前往正规医疗机构就诊。</p></div>';

        resultEl.innerHTML = html;
    }

    window.runBianzheng = runBianzheng;

    if (typeof QiuhuangApp !== 'undefined') {
        QiuhuangApp.registerRoute('#/bianzheng', render);
    }

    global.BianZhengComponent = { render: render };

})(typeof window !== 'undefined' ? window : this);
