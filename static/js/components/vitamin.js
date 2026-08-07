/**
 * 岐黄阁 · 维生素补充建议组件
 * 营养百科 · 症状匹配 · 补充记录
 */
(function(global) {
    'use strict';

    var TAB = { encyclopedia: 0, symptomMatch: 1, supplementRecord: 2 };
    var currentTab = TAB.encyclopedia;
    var currentProfileId = null;
    var showDetail = false;
    var detailVitaminId = null;

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        var d = new Date(isoStr);
        return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
    }

    function getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    // ========== Tab导航 ==========
    function renderTabs() {
        var tabs = ['营养百科', '症状匹配', '补充记录'];
        var html = '<div class="vitamin-nav">';
        tabs.forEach(function(t, i) {
            var active = i === currentTab ? ' active' : '';
            html += '<button class="vitamin-tab' + active + '" onclick="window.vitaminShowTab(' + i + ')">' + t + '</button>';
        });
        html += '</div>';
        return html;
    }

    // ========== 营养百科 Tab ==========
    function renderEncyclopedia() {
        if (showDetail && detailVitaminId) {
            return renderDetailView();
        }
        return renderVitaminList();
    }

    function renderVitaminList() {
        var vitamins = window.VitaminEngine.getAllVitamins();
        var html = '<div class="vitamin-page">';
        html += renderTabs();
        html += '<div class="input-with-btn">';
        html += '<input type="text" id="vitamin-search-input" placeholder="搜索维生素/矿物质名称..." class="form-input">';
        html += '<button class="search-btn" onclick="window.vitaminSearch()">搜索</button>';
        html += '</div>';
        html += '<div class="vitamin-list" id="vitamin-list">';
        vitamins.forEach(function(v) {
            html += '<div class="vitamin-pill" onclick="window.vitaminShowDetail(\'' + v.id + '\')">';
            html += '<span class="vitamin-icon">' + v.icon + '</span>';
            html += '<span class="vitamin-name">' + v.nameCN + '</span>';
            html += '<span class="vitamin-category">' + v.category + '</span>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
        return html;
    }

    function renderDetailView() {
        var v = window.VitaminEngine.getVitaminDetail(detailVitaminId);
        if (!v) {
            var html = '<div class="vitamin-page">';
            html += '<div class="back-nav"><button class="btn-back" onclick="window.vitaminBackFromDetail()">← 返回</button></div>';
            html += '<div class="empty-tip">未找到该营养素信息</div>';
            html += '</div>';
            return html;
        }
        var html = '<div class="vitamin-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.vitaminBackFromDetail()">← 返回列表</button></div>';
        html += '<div class="vitamin-detail-card">';
        html += '<div class="detail-header">';
        html += '<span class="detail-icon">' + v.icon + '</span>';
        html += '<div class="detail-title">';
        html += '<h3>' + v.nameCN + '</h3>';
        html += '<span class="detail-en">' + v.nameEN + '</span>';
        html += '<span class="detail-category">' + v.category + '</span>';
        html += '</div></div>';

        html += '<div class="vitamin-section"><h4>主要功能</h4><p>' + v.function + '</p></div>';
        html += '<div class="vitamin-section"><h4>食物来源</h4><p>' + v.foods + '</p></div>';
        html += '<div class="vitamin-section"><h4>每日推荐摄入量</h4><p>' + v.dailyIntake + '</p></div>';
        html += '<div class="vitamin-section"><h4>缺乏症状</h4><p>' + v.deficiency + '</p></div>';
        html += '<div class="vitamin-warning"><h4>⚠️ 过量风险</h4><p>' + v.overdose + '</p></div>';
        html += '<div class="vitamin-section"><h4>最高耐受量</h4><p>' + (v.maxDaily || '未设定') + '</p></div>';

        html += '</div>';
        html += '<div class="vitamin-disclaimer">本信息仅供养生参考，不能替代专业医疗建议。补充剂量请咨询医师或营养师。</div>';
        html += '</div>';
        return html;
    }

    // ========== 症状匹配 Tab ==========
    function renderSymptomMatch() {
        var symptoms = window.VitaminEngine.getAllSymptoms();
        var html = '<div class="vitamin-page">';
        html += renderTabs();
        html += '<div class="symptom-match-section">';
        html += '<h3>选择您的症状</h3>';
        html += '<div class="symptom-grid">';
        symptoms.forEach(function(s) {
            html += '<label class="symptom-chip"><input type="checkbox" value="' + s + '"> ' + s + '</label>';
        });
        html += '</div>';
        html += '<div class="form-actions">';
        html += '<button class="btn-primary" onclick="window.vitaminMatchSymptoms()">查看推荐</button>';
        html += '</div>';
        html += '<div id="vitamin-match-results"></div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // ========== 补充记录 Tab ==========
    function renderSupplementRecord() {
        var vitamins = window.VitaminEngine.getAllVitamins();
        var records = window.VitaminEngine.getSupplementHistory(currentProfileId, 30);
        var html = '<div class="vitamin-page">';
        html += renderTabs();
        // 记录表单
        html += '<div class="form-card">';
        html += '<div class="form-section"><h4>记录补充</h4></div>';
        html += '<div class="form-section">';
        html += '<label>营养素</label>';
        html += '<select id="vitamin-supplement-select" class="form-input">';
        html += '<option value="">请选择</option>';
        vitamins.forEach(function(v) {
            html += '<option value="' + v.nameCN + '">' + v.icon + ' ' + v.nameCN + '</option>';
        });
        html += '</select>';
        html += '</div>';
        html += '<div class="form-section">';
        html += '<label>剂量</label>';
        html += '<input type="text" id="vitamin-dosage-input" class="form-input" placeholder="如：1粒/400mg">';
        html += '</div>';
        html += '<div class="form-section">';
        html += '<label>日期</label>';
        html += '<input type="date" id="vitamin-date-input" class="form-input" value="' + getTodayStr() + '">';
        html += '</div>';
        html += '<div class="form-actions">';
        html += '<button class="btn-primary" onclick="window.vitaminSaveRecord()">保存记录</button>';
        html += '</div>';
        html += '</div>';
        // 记录列表
        html += '<h3>近期记录</h3>';
        if (records.length === 0) {
            html += '<div class="empty-tip">暂无补充记录</div>';
        } else {
            html += '<div class="record-list">';
            records.forEach(function(r) {
                html += '<div class="record-item">';
                html += '<div class="record-date">' + formatDate(r.date) + '</div>';
                html += '<div class="record-content">';
                html += '<div class="record-symptoms">' + r.vitaminName + (r.dosage ? ' · ' + r.dosage : '') + '</div>';
                html += '</div>';
                html += '<button class="btn-small btn-danger" onclick="window.vitaminDeleteRecord(\'' + r.id + '\')">删除</button>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // ========== 全局操作 ==========

    window.vitaminShowTab = function(tabIndex) {
        currentTab = tabIndex;
        showDetail = false;
        detailVitaminId = null;
        var html = '';
        if (tabIndex === TAB.encyclopedia) {
            html = renderEncyclopedia();
        } else if (tabIndex === TAB.symptomMatch) {
            html = renderSymptomMatch();
        } else if (tabIndex === TAB.supplementRecord) {
            html = renderSupplementRecord();
        }
        document.getElementById('page-container').innerHTML = html;
    };

    window.vitaminSearch = function() {
        var query = document.getElementById('vitamin-search-input').value;
        var vitamins;
        if (query.trim() === '') {
            vitamins = window.VitaminEngine.getAllVitamins();
        } else {
            vitamins = window.VitaminEngine.searchVitamins(query);
        }
        var container = document.getElementById('vitamin-list');
        if (!container) return;
        var html = '';
        if (vitamins.length === 0) {
            html = '<div class="empty-tip">未找到匹配的营养素，请尝试其他关键词</div>';
        } else {
            vitamins.forEach(function(v) {
                html += '<div class="vitamin-pill" onclick="window.vitaminShowDetail(\'' + v.id + '\')">';
                html += '<span class="vitamin-icon">' + v.icon + '</span>';
                html += '<span class="vitamin-name">' + v.nameCN + '</span>';
                html += '<span class="vitamin-category">' + v.category + '</span>';
                html += '</div>';
            });
        }
        container.innerHTML = html;
    };

    window.vitaminShowDetail = function(vitaminId) {
        detailVitaminId = vitaminId;
        showDetail = true;
        document.getElementById('page-container').innerHTML = renderDetailView();
    };

    window.vitaminBackFromDetail = function() {
        showDetail = false;
        detailVitaminId = null;
        document.getElementById('page-container').innerHTML = renderEncyclopedia();
    };

    window.vitaminMatchSymptoms = function() {
        var checked = document.querySelectorAll('.symptom-grid input:checked');
        var symptoms = Array.from(checked).map(function(el) { return el.value; });
        var container = document.getElementById('vitamin-match-results');
        if (symptoms.length === 0) {
            container.innerHTML = '<div class="empty-tip">请至少选择一个症状</div>';
            return;
        }
        var results = window.VitaminEngine.getRecommendationsBySymptoms(symptoms);
        var html = '<div class="match-result">';
        html += '<h4>推荐结果（按匹配度排序）</h4>';
        if (results.length === 0) {
            html += '<div class="empty-tip">未找到匹配的营养素</div>';
        } else {
            results.forEach(function(r) {
                html += '<div class="match-card">';
                html += '<div class="match-vitamins">';
                html += '<span class="vitamin-icon">' + r.icon + '</span>';
                html += '<strong>' + r.nameCN + '</strong>';
                html += '<span class="match-score">匹配症状 ' + r.score + ' 项</span>';
                html += '</div>';
                html += '<div class="match-symptom"><strong>功能：</strong>' + r.function + '</div>';
                html += '<div class="match-symptom"><strong>食物来源：</strong>' + r.foods + '</div>';
                html += '<div class="match-symptom"><strong>匹配症状：</strong>' + r.matchSymptoms.join('、') + '</div>';
                html += '</div>';
            });
        }
        html += '</div>';
        container.innerHTML = html;
    };

    window.vitaminSaveRecord = function() {
        var selectEl = document.getElementById('vitamin-supplement-select');
        var dosageEl = document.getElementById('vitamin-dosage-input');

        if (!selectEl || !selectEl.value) {
            alert('请选择营养素');
            return;
        }

        window.VitaminEngine.saveSupplementRecord(currentProfileId, selectEl.value, dosageEl ? dosageEl.value.trim() : '');
        alert('记录已保存！');
        document.getElementById('page-container').innerHTML = renderSupplementRecord();
    };

    window.vitaminDeleteRecord = function(id) {
        if (!confirm('确定删除此条记录？')) return;
        window.VitaminEngine.deleteSupplementRecord(id);
        document.getElementById('page-container').innerHTML = renderSupplementRecord();
    };

    // ========== 路由注册 ==========

    function render() {
        if (!currentProfileId && window.ArchiveEngine) {
            currentProfileId = window.ArchiveEngine.getCurrentProfileId();
        }
        if (!currentProfileId) {
            currentProfileId = 'default';
        }
        currentTab = TAB.encyclopedia;
        showDetail = false;
        detailVitaminId = null;
        return renderEncyclopedia();
    }

    if (typeof QiuhuangApp !== 'undefined') {
        QiuhuangApp.registerRoute('#/vitamin', render);
    }

    global.VitaminComponent = { render: render };

})(typeof window !== 'undefined' ? window : this);