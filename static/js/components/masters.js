/**
 * 岐黄阁 · 大师蒸馏组件
 */
(function(global) {
    'use strict';

    function render() {
        var masters = MastersEngine.MASTERS;
        var masterCards = masters.map(function(m) {
            return `<div class="master-card" data-id="${m.id}" onclick="selectMaster('${m.id}')">
                <div class="master-avatar">${m.avatar}</div>
                <div class="master-info">
                    <div class="master-name">${m.name}</div>
                    <div class="master-title">${m.title}</div>
                    <div class="master-era">${m.era}</div>
                </div>
            </div>`;
        }).join('');

        // 检查是否有辨证结果
        var raw = window.lastBianzhengResult || {};
        var hasResult = raw && Object.keys(raw).length > 0;
        var resultHint = hasResult
            ? `<span style="margin-left:12px;color:#6a9a6a;font-size:13px;">✓ 已检测到辨证结果：${raw.final_syndrome || '待定'}</span>`
            : `<span style="margin-left:12px;color:#8a8a7a;font-size:13px;">请先完成辨证推理</span>`;

        return `
            <div class="masters-page">
                <h2>大师蒸馏</h2>
                <p class="desc">历代名医辨证思维数字化，与张仲景、李时珍等对话</p>
                <div class="master-grid">
                    ${masterCards}
                </div>
                <div class="analysis-section" id="analysis-section" style="display:none;">
                    <h3>大师分析</h3>
                    <div class="selected-master" id="master-selected"></div>
                    <div style="margin-bottom:16px;">
                        <button onclick="runMasterAnalysis()" id="analyze-btn">五段式分析</button>
                        ${resultHint}
                    </div>
                    <div id="analysis-content"></div>
                </div>
            </div>
        `;
    }

    var selectedMaster = null;

    window.selectMaster = function(masterId) {
        selectedMaster = MastersEngine.getMasterById(masterId);
        if (!selectedMaster) {
            alert('大师加载失败，请刷新页面重试');
            return;
        }
        var el = document.getElementById('master-selected');
        if (!el) return;
        el.innerHTML = `
            <div class="selected-master-content">
                <span class="avatar">${selectedMaster.avatar}</span>
                <div>
                    <strong>${selectedMaster.name}</strong> · ${selectedMaster.title}
                    <div class="style-desc">${selectedMaster.style}</div>
                </div>
            </div>
        `;

        document.querySelectorAll('.master-card').forEach(function(card) {
            card.style.borderColor = 'rgba(44,44,44,0.1)';
            card.style.boxShadow = 'none';
        });
        var activeCard = document.querySelector('.master-card[data-id="' + masterId + '"]');
        if (activeCard) {
            activeCard.style.borderColor = '#b8945c';
            activeCard.style.boxShadow = '0 4px 12px rgba(184,148,92,0.2)';
        }

        document.getElementById('analysis-section').style.display = 'block';
        document.getElementById('analysis-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    /**
     * 将辨证结果映射到模板占位符
     */
    function _mapContext(raw) {
        return {
            bingwei: raw.final_syndrome || '待定',
            bingxing: '待定',
            zhengxing: raw.final_syndrome || '待定',
            zhize: '辨证论治',
            yinyuan: '外感六淫',
            bingshi: '轻浅',
            zhuzheng: (raw.symptoms && raw.symptoms.length > 0) ? raw.symptoms.join('、') : '',
            jianzheng: '',
            zhuangmiaozhuangshu: raw.symptoms ? raw.symptoms.join('、') : '',
            sheMai: (raw.tongue && raw.tongue !== '未选择') ? raw.tongue + '，' + (raw.pulse || '') : '暂未提供',
            zhuYao: '待定',
            fuYao: '待定',
            confidence: raw.confidence || 0
        };
    }

    window.runMasterAnalysis = function() {
        if (!selectedMaster) {
            alert('请先点击选择一位大师');
            return;
        }

        var raw = window.lastBianzhengResult || {};
        var context = _mapContext(raw);

        var result = MastersEngine.analyze(selectedMaster.id, context);
        if (!result) {
            alert('大师蒸馏失败，请检查控制台日志');
            return;
        }

        var html = `
            <div class="five-segment">
                <div class="segment">
                    <h4>${result.master.avatar} ${result.master.name} · 开篇</h4>
                    <p>${result.opening}</p>
                </div>
                <div class="segment">
                    <h4>${result.master.avatar} ${result.master.name} · 总论</h4>
                    <p>${result.overview}</p>
                </div>
                <div class="segment">
                    <h4>${result.master.avatar} ${result.master.name} · 论治</h4>
                    <p>${result.specialty}</p>
                </div>
                <div class="segment">
                    <h4>${result.master.avatar} ${result.master.name} · 经典</h4>
                    <blockquote>${result.quote}</blockquote>
                </div>
                <div class="segment">
                    <h4>${result.master.avatar} ${result.master.name} · 结语</h4>
                    <p>${result.closing}</p>
                </div>
            </div>
            <div style="margin-top:16px; padding:12px; background:rgba(184,148,92,0.1); border-radius:6px; font-size:12px; color:#8a7a5a;">
                注：大师分析基于当前辨证结果自动生成，内容为算法模板填充，仅供学习参考。
            </div>
        `;

        document.getElementById('analysis-content').innerHTML = html;
    };

    global.MastersComponent = { render: render };

    function log(tag, msg, data) {
        var ts = new Date().toLocaleTimeString();
        console.log('[岐黄阁][大师组件][' + tag + '][' + ts + '] ' + msg, data || '');
    }
})(typeof window !== 'undefined' ? window : this);
