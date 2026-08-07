/**
 * 岐黄阁 · 调养记录组件
 * 每日症状记录 · 趋势分析 · 调养建议
 */
(function(global) {
    'use strict';

    var VIEW = { form: 0, list: 1, trend: 2, advice: 3 };
    var currentView = VIEW.form;
    var currentProfileId = null;

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        var d = new Date(isoStr);
        return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
    }

    function formatTime(isoStr) {
        if (!isoStr) return '';
        var d = new Date(isoStr);
        return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }

    function getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    // ========== 表单视图 ==========
    function renderFormView() {
        var today = getTodayStr();
        var todayRec = window.SymptomEngine.getRecordByDate(currentProfileId, today);
        var symptoms = todayRec ? (todayRec.symptoms || []) : [];
        var sleep = todayRec ? todayRec.sleep : '未选择';
        var mood = todayRec ? todayRec.mood : '未选择';
        var diet = todayRec ? todayRec.diet : '未选择';
        var exercise = todayRec ? todayRec.exercise : '未选择';
        var notes = todayRec ? todayRec.notes : '';

        var html = '<div class="regimen-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.regimenBack()">← 返回</button></div>';
        html += '<h2>📋 每日调养记录</h2>';
        html += '<p class="desc">记录今日症状与起居，系统自动分析调养趋势</p>';

        // 今日概览卡片
        html += '<div class="summary-card">';
        html += '<div class="summary-item"><span class="label">日期</span><span class="value">' + today + '</span></div>';
        html += '<div class="summary-item"><span class="label">已记录症状</span><span class="value">' + (symptoms.length || 0) + ' 项</span></div>';
        html += '<div class="summary-item"><span class="label">睡眠</span><span class="value">' + sleep + '</span></div>';
        html += '<div class="summary-item"><span class="label">情绪</span><span class="value">' + mood + '</span></div>';
        html += '</div>';

        html += '<div class="form-card">';
        // 症状选择
        html += '<div class="form-section"><h4>症状记录</h4>';
        html += '<div class="symptom-grid">';
        window.SymptomEngine.SYMPTOM_LIST.forEach(function(s) {
            var checked = symptoms.indexOf(s) >= 0 ? ' checked' : '';
            html += '<label class="symptom-chip"><input type="checkbox" value="' + s + '"' + checked + '> ' + s + '</label>';
        });
        html += '</div></div>';

        // 睡眠
        html += '<div class="form-section"><h4>睡眠质量</h4>';
        html += '<div class="option-row">';
        window.SymptomEngine.SLEEP_OPTIONS.forEach(function(o) {
            var sel = sleep === o ? ' checked' : '';
            html += '<label class="option-chip"><input type="radio" name="sleep" value="' + o + '"' + sel + '> ' + o + '</label>';
        });
        html += '</div></div>';

        // 情绪
        html += '<div class="form-section"><h4>情绪状态</h4>';
        html += '<div class="option-row">';
        window.SymptomEngine.MOOD_OPTIONS.forEach(function(o) {
            var sel = mood === o ? ' checked' : '';
            html += '<label class="option-chip"><input type="radio" name="mood" value="' + o + '"' + sel + '> ' + o + '</label>';
        });
        html += '</div></div>';

        // 饮食
        html += '<div class="form-section"><h4>饮食状况</h4>';
        html += '<div class="option-row">';
        window.SymptomEngine.DIET_OPTIONS.forEach(function(o) {
            var sel = diet === o ? ' checked' : '';
            html += '<label class="option-chip"><input type="radio" name="diet" value="' + o + '"' + sel + '> ' + o + '</label>';
        });
        html += '</div></div>';

        // 运动
        html += '<div class="form-section"><h4>运动情况</h4>';
        html += '<div class="option-row">';
        window.SymptomEngine.EXERCISE_OPTIONS.forEach(function(o) {
            var sel = exercise === o ? ' checked' : '';
            html += '<label class="option-chip"><input type="radio" name="exercise" value="' + o + '"' + sel + '> ' + o + '</label>';
        });
        html += '</div></div>';

        // 备注
        html += '<div class="form-section"><h4>备注</h4>';
        html += '<textarea id="regimen-notes" rows="2" placeholder="其他想要记录的信息（可选）">' + notes + '</textarea>';
        html += '</div>';

        html += '<div class="form-actions">';
        html += '<button class="btn-primary" onclick="window.regimenSave()">保存记录</button>';
        html += '<button class="btn-secondary" onclick="window.regimenViewTrend()">查看趋势</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // ========== 历史记录列表 ==========
    function renderListView() {
        var records = window.SymptomEngine.getRecentRecords(currentProfileId, 30);
        var html = '<div class="regimen-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.regimenBack()">← 返回</button></div>';
        html += '<h2>📊 历史记录</h2>';
        html += '<p class="desc">近30天调养记录</p>';

        if (records.length === 0) {
            html += '<div class="empty-tip">暂无记录，请先记录今日症状</div>';
        } else {
            html += '<div class="record-list">';
            records.forEach(function(r) {
                html += '<div class="record-item">';
                html += '<div class="record-date">' + r.date + '</div>';
                html += '<div class="record-content">';
                if (r.symptoms && r.symptoms.length > 0) {
                    html += '<div class="record-symptoms">' + r.symptoms.join('、') + '</div>';
                }
                html += '<div class="record-meta">睡眠：' + r.sleep + ' | 情绪：' + r.mood + ' | 饮食：' + r.diet + '</div>';
                if (r.notes) html += '<div class="record-notes">📝 ' + r.notes + '</div>';
                html += '</div>';
                html += '<div class="record-time">' + formatTime(r.timestamp) + '</div>';
                html += '<button class="btn-small btn-danger" onclick="window.regimenDeleteRecord(\'' + r.id + '\')">删除</button>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '<div class="form-actions"><button class="btn-primary" onclick="window.regimenViewTrend()">查看趋势分析</button></div>';
        html += '</div>';
        return html;
    }

    // ========== 趋势分析视图 ==========
    function renderTrendView() {
        var trend = window.SymptomEngine.analyzeTrend(currentProfileId, 30);
        var summary = window.SymptomEngine.getSummary(currentProfileId);

        var html = '<div class="regimen-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.regimenBack()">← 返回</button></div>';
        html += '<h2>📈 调养趋势分析</h2>';
        html += '<p class="desc">基于近30天数据自动生成</p>';

        if (!trend || trend.days === 0) {
            html += '<div class="empty-tip">数据不足，请至少记录7天症状</div>';
        } else {
            // 睡眠评分
            html += '<div class="trend-card">';
            html += '<h4>😴 睡眠评分</h4>';
            var sleepPct = trend.sleepScore * 20;
            html += '<div class="score-bar"><div class="score-bar-fill" style="width:' + sleepPct + '%"></div></div>';
            html += '<div class="score-val">' + trend.sleepScore + '/5 分</div>';
            html += '<p class="trend-note">基于近' + trend.days + '天记录</p>';
            html += '</div>';

            // 情绪评分
            html += '<div class="trend-card">';
            html += '<h4>😊 情绪评分</h4>';
            var moodPct = trend.moodScore * 20;
            html += '<div class="score-bar"><div class="score-bar-fill" style="width:' + moodPct + '%"></div></div>';
            html += '<div class="score-val">' + trend.moodScore + '/5 分</div>';
            html += '</div>';

            // 高频症状
            if (trend.frequentSymptoms.length > 0) {
                html += '<div class="trend-card">';
                html += '<h4>⚠️ 高频症状（出现≥30%天数）</h4>';
                html += '<div class="symptom-tags">';
                trend.frequentSymptoms.forEach(function(s) {
                    html += '<span class="freq-symptom">' + s + ' (' + trend.symptomCount[s] + '次)</span>';
                });
                html += '</div></div>';
            }
        }

        html += '<div class="form-actions">';
        html += '<button class="btn-primary" onclick="window.regimenViewAdvice()">查看调养建议</button>';
        html += '<button class="btn-secondary" onclick="window.regimenViewForm()">返回记录</button>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // ========== 调养建议视图 ==========
    function renderAdviceView() {
        // 获取最近体质记录
        var tizhi = null;
        var records = window.ArchiveEngine ? window.ArchiveEngine.listRecords(currentProfileId) : [];
        var tizhiRec = records.find(function(r) { return r.type === 'tizhi'; });
        if (tizhiRec && tizhiRec.data && tizhiRec.data.type) tizhi = tizhiRec.data.type;

        var advice = window.SymptomEngine.generateAdvice(currentProfileId, tizhi);

        var html = '<div class="regimen-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.regimenBack()">← 返回</button></div>';
        html += '<h2>💡 每日调养建议</h2>';
        html += '<p class="desc">基于您的体质和症状数据生成</p>';

        if (advice.msg) {
            html += '<div class="empty-tip">' + advice.msg + '</div>';
        } else {
            html += '<div class="advice-cards">';
            html += renderAdviceCard('😴', '睡眠建议', advice.sleep);
            html += renderAdviceCard('😊', '情绪调节', advice.mood);
            html += renderAdviceCard('🍵', '饮食调养', advice.diet);
            html += renderAdviceCard('🏃', '运动建议', advice.exercise);
            if (advice.symptoms) {
                html += renderAdviceCard('⚠️', '症状提醒', advice.symptoms);
            }
            html += '</div>';
        }

        html += '<div class="disclaimer">本建议仅供养生参考，不能替代专业医疗诊断和治疗。';
        html += '如有不适请及时就医。</div>';
        html += '</div>';
        return html;
    }

    function renderAdviceCard(icon, title, content) {
        var html = '<div class="advice-card"><div class="advice-icon">' + icon + '</div>';
        html += '<div class="advice-title">' + title + '</div>';
        html += '<div class="advice-content">' + content + '</div>';
        html += '</div>';
        return html;
    }

    // ========== 全局操作 ==========
    window.regimenSave = function() {
        var symptoms = Array.from(document.querySelectorAll('.symptom-grid input:checked')).map(function(el) { return el.value; });
        var sleepEl = document.querySelector('input[name="sleep"]:checked');
        var moodEl = document.querySelector('input[name="mood"]:checked');
        var dietEl = document.querySelector('input[name="diet"]:checked');
        var exerciseEl = document.querySelector('input[name="exercise"]:checked');
        var notesEl = document.getElementById('regimen-notes');

        if (symptoms.length === 0 && (!sleepEl || sleepEl.value === '未选择')) {
            alert('请至少记录一项症状或选择睡眠状态');
            return;
        }

        window.SymptomEngine.addRecord(
            currentProfileId,
            symptoms,
            sleepEl ? sleepEl.value : '未记录',
            moodEl ? moodEl.value : '未记录',
            dietEl ? dietEl.value : '未记录',
            exerciseEl ? exerciseEl.value : '未记录',
            notesEl ? notesEl.value.trim() : ''
        );

        alert('记录已保存！');
        currentView = VIEW.form;
        document.getElementById('page-container').innerHTML = renderFormView();
    };

    window.regimenDeleteRecord = function(id) {
        if (!confirm('确定删除此条记录？')) return;
        window.SymptomEngine.deleteRecord(id);
        document.getElementById('page-container').innerHTML = renderListView();
    };

    window.regimenViewForm = function() {
        currentView = VIEW.form;
        document.getElementById('page-container').innerHTML = renderFormView();
    };

    window.regimenViewList = function() {
        currentView = VIEW.list;
        document.getElementById('page-container').innerHTML = renderListView();
    };

    window.regimenViewTrend = function() {
        currentView = VIEW.trend;
        document.getElementById('page-container').innerHTML = renderTrendView();
    };

    window.regimenViewAdvice = function() {
        currentView = VIEW.advice;
        document.getElementById('page-container').innerHTML = renderAdviceView();
    };

    window.regimenBack = function() {
        currentView = VIEW.form;
        document.getElementById('page-container').innerHTML = renderFormView();
    };

    // ========== 路由注册 ==========
    function render() {
        if (!currentProfileId && window.ArchiveEngine) {
            currentProfileId = window.ArchiveEngine.getCurrentProfileId();
        }
        if (!currentProfileId) {
            alert('请先创建或选择用户档案');
            return '<div class="empty-tip">请先在用户档案中创建或选择档案</div>';
        }
        currentView = VIEW.form;
        return renderFormView();
    }

    if (typeof QiuhuangApp !== 'undefined') {
        QiuhuangApp.registerRoute('#/regimen', render);
    }

    global.RegimenComponent = { render: render };

})(typeof window !== 'undefined' ? window : this);
