js_content = '''/**
 * 岐黄阁 · 养生功法组件
 * 五禽戏、八段锦、太极拳、易筋经等
 */
(function(global) {
    'use strict';

    var EXERCISES = [];
    var currentExercise = null;
    var expandedId = null;

    function loadExercises() {
        return fetch('static/data/health-exercises.json')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                EXERCISES = data;
                populateExerciseList();
                return data;
            });
    }

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render() {
        var html = '<div class="page-container">';
        html += '<div class="page-header"><h2>&#x1f32e; 养生功法</h2><p>五禽戏 · 八段锦 · 太极拳 · 易筋经</p></div>';
        html += '<div class="health-page">';
        html += '<div class="exercise-list" id="exercise-list"></div>';
        html += '<div class="exercise-detail" id="exercise-detail" style="display:none;"></div>';
        html += '</div></div>';
        return html;
    }

    function populateExerciseList() {
        var listEl = document.getElementById('exercise-list');
        if (!listEl || EXERCISES.length === 0) return;
        listEl.innerHTML = renderExerciseList();
    }

    function renderExerciseList() {
        var html = '';
        EXERCISES.forEach(function(ex) {
            html += '<div class="exercise-card" data-id="' + escHtml(ex.id) + '" onclick="showExercise(\'' + escHtml(ex.id) + '\')">';
            html += '<div class="exercise-card-top">';
            html += '<span class="exercise-avatar">' + escHtml(ex.avatar) + '</span>';
            html += '<div class="exercise-card-info">';
            html += '<div class="exercise-card-name">' + escHtml(ex.name) + '</div>';
            html += '<div class="exercise-card-meta">' + escHtml(ex.origin) + ' · ' + escHtml(ex.category) + '</div>';
            html += '</div>';
            html += '<span class="exercise-difficulty ' + escHtml(ex.difficulty) + '">' + escHtml(ex.difficulty) + '</span>';
            html += '</div>';
            html += '<div class="exercise-card-desc">' + escHtml((ex.description || '').substring(0, 60)) + '</div>';
            html += '<div class="exercise-card-benefits">';
            (ex.benefits || []).slice(0, 4).forEach(function(b) {
                html += '<span class="benefit-tag">' + escHtml(b) + '</span>';
            });
            html += '</div>';
            html += '</div>';
        });
        return html;
    }

    function renderExerciseDetail(id) {
        var ex = EXERCISES.find(function(e) { return e.id === id; });
        if (!ex) return '';
        currentExercise = ex;
        var html = '';
        html += '<div class="detail-header">';
        html += '<button class="back-btn" onclick="backToList()">← 返回</button>';
        html += '<div class="detail-title">' + escHtml(ex.avatar) + ' ' + escHtml(ex.name) + '</div>';
        html += '<div class="detail-meta">' + escHtml(ex.origin) + ' · ' + escHtml(ex.category) + ' · ' + escHtml(ex.duration) + '</div>';
        html += '</div>';
        html += '<div class="detail-desc">' + escHtml(ex.description) + '</div>';
        if (ex.video_url) {
            html += '<div class="detail-section video-section">';
            html += '<h3>官方演示视频</h3>';
            html += '<p class="video-link">';
            html += '<a href="' + escHtml(ex.video_url) + '" target="_blank" rel="noopener" class="video-link-btn">';
            html += '&#9654; ' + escHtml(ex.video_title || '观看官方演示视频');
            html += '</a>';
            html += '<span class="video-hint">（点击跳转CCTV官方页面）</span>';
            html += '</p>';
            html += '</div>';
        }
        html += '<div class="detail-section">';
        html += '<h3>功效</h3>';
        html += '<div class="benefits-grid">';
        (ex.benefits || []).forEach(function(b) {
            html += '<span class="benefit-tag large">' + escHtml(b) + '</span>';
        });
        html += '</div></div>';
        html += '<div class="detail-section">';
        html += '<h3>动作详解</h3>';
        html += '<div class="movements-list">';
        (ex.movements || []).forEach(function(m, i) {
            var expanded = expandedId === ex.id + '_' + i;
            html += '<div class="movement-item" onclick="toggleMovement(\'' + escHtml(ex.id + '_' + i) + '\')">';
            html += '<div class="movement-header">';
            html += '<span class="movement-number">' + escHtml(m.number || (i + 1)) + '</span>';
            html += '<div class="movement-name">' + escHtml(m.name) + '</div>';
            html += '<span class="movement-arrow">' + (expanded ? '▲' : '▼') + '</span>';
            html += '</div>';
            if (expanded) {
                html += '<div class="movement-body">';
                html += '<p><strong>动作：</strong>' + escHtml(m.action || m.description) + '</p>';
                html += '<p><strong>功效：</strong>' + escHtml(m.benefit) + '</p>';
                if (m.meridian) html += '<p><strong>经络：</strong>' + escHtml(m.meridian) + '</p>';
                if (m.duration) html += '<p><strong>时长：</strong>' + escHtml(m.duration) + '</p>';
                html += '</div>';
            }
            html += '</div>';
        });
        html += '</div></div>';
        html += '<div class="detail-section">';
        html += '<h3>练习要点</h3>';
        html += '<ul class="tips-list">';
        (ex.practice_tips || []).forEach(function(t) {
            html += '<li>' + escHtml(t) + '</li>';
        });
        html += '</ul></div>';
        if (ex.suitable_for) {
            html += '<div class="detail-section"><h3>适用人群</h3>';
            html += '<p class="suitable">' + escHtml(ex.suitable_for) + '</p></div>';
        }
        if (ex.contraindications) {
            html += '<div class="detail-section warning-section"><h3>⚠ 禁忌</h3>';
            html += '<p class="warning-text">' + escHtml(ex.contraindications) + '</p></div>';
        }
        return html;
    }

    window.showExercise = function(id) {
        var detailEl = document.getElementById('exercise-detail');
        var listEl = document.getElementById('exercise-list');
        if (!detailEl || !listEl) return;
        listEl.style.display = 'none';
        detailEl.style.display = 'block';
        detailEl.innerHTML = renderExerciseDetail(id);
        detailEl.scrollIntoView({ behavior: 'smooth' });
    };

    window.backToList = function() {
        var detailEl = document.getElementById('exercise-detail');
        var listEl = document.getElementById('exercise-list');
        if (!detailEl || !listEl) return;
        detailEl.style.display = 'none';
        detailEl.innerHTML = '';
        listEl.style.display = 'block';
        currentExercise = null;
        expandedId = null;
    };

    window.toggleMovement = function(id) {
        expandedId = expandedId === id ? null : id;
        if (currentExercise) {
            var detailEl = document.getElementById('exercise-detail');
            if (detailEl) detailEl.innerHTML = renderExerciseDetail(currentExercise.id);
        }
    };

    global.HealthExercises = {
        render: render,
        loadExercises: loadExercises
    };

    if (global.QiuhuangApp) {
        global.QiuhuangApp.registerRoute('#/health', function() {
            var html = render();
            loadExercises();
            return html;
        });
    }

})(typeof global !== 'undefined' ? global : window);
'''

with open(r'e:\岐黄阁\static\js\components\health-exercises.js', 'w', encoding='utf-8') as f:
    f.write(js_content)
print('JS written OK, size:', len(js_content))
