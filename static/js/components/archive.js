/**
 * 岐黄阁 · 用户档案组件
 * 支持：档案列表 / 新建 / 编辑 / 健康记录追溯 / 趋势对比
 */
(function(global) {
    'use strict';

    var VIEW = { list: 0, profile: 1, create: 2, edit: 3, detail: 4 };
    var currentView = VIEW.list;
    var currentProfileId = null;
    var currentRecordId = null;
    var currentProfile = null;

    function formatTime(isoStr) {
        if (!isoStr) return '—';
        var d = new Date(isoStr);
        return d.getFullYear() + '-' +
            String(d.getMonth()+1).padStart(2,'0') + '-' +
            String(d.getDate()).padStart(2,'0') + ' ' +
            String(d.getHours()).padStart(2,'0') + ':' +
            String(d.getMinutes()).padStart(2,'0');
    }

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        var d = new Date(isoStr);
        return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
    }

    function escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function getTypeLabel(type) {
        var map = { 'bianzheng': '辨证推理', 'tizhi': '体质辨识', 'master': '大师蒸馏', 'fangji': '方剂查询', 'bencao': '本草查询' };
        return map[type] || type;
    }

    function getTypeIcon(type) {
        var map = { 'bianzheng': '🔮', 'tizhi': '🧬', 'master': '👨‍⚕️', 'fangji': '📜', 'bencao': '🌿' };
        return map[type] || '📋';
    }

    function getGenderIcon(g) {
        return g === '男' ? '♂' : g === '女' ? '♀' : '';
    }

    // ========== 视图渲染 ==========
    function renderListView() {
        var profiles = ArchiveEngine.listProfiles();
        var html = '<div class="archive-page">';
        html += '<h2>用户档案</h2>';
        html += '<p class="desc">档案管理 · 历史记录追溯 · 体质趋势分析</p>';

        // 体验链接模式提示
        var uid = ArchiveEngine.getUidFromUrl();
        if (uid) {
            html += '<div class="experience-banner">🔗 体验链接模式 — 您正在查看分享存档数据，可继续进行辨证体质测试</div>';
        }

        // 当前选中用户提示
        var curId = ArchiveEngine.getCurrentProfileId();
        if (curId) {
            var cur = ArchiveEngine.getProfile(curId);
            if (cur) {
                html += '<div class="current-profile-bar"><span>当前档案：</span><strong>' + cur.name + '</strong><button class="btn-small" onclick="window.switchProfile(null)">切换</button></div>';
            }
        }

        html += '<div class="archive-actions">';
        html += '<button class="btn-primary" onclick="window.archiveCreate()">+ 新建档案</button>';
        html += '</div>';

        if (profiles.length === 0) {
            html += '<div class="archive-empty"><p>暂无档案</p><p class="empty-hint">新建档案后，辨证体质结果将自动归档</p></div>';
        } else {
            html += '<div class="profile-grid">';
            profiles.forEach(function(p) {
                var records = ArchiveEngine.listRecords(p.id);
                var lastRecord = records[0];
                var lastResult = lastRecord ? (lastRecord.data.final_syndrome || lastRecord.data.type || '—') : '暂无记录';
                var lastTime = lastRecord ? formatTime(lastRecord.timestamp) : '暂无记录';

                html += '<div class="profile-card" onclick="window.archiveOpenProfile(\'' + p.id + '\')">';
                html += '<div class="profile-card-header">';
                html += '<div class="profile-avatar">' + getGenderIcon(p.gender) + '</div>';
                html += '<div class="profile-card-info">';
                html += '<div class="profile-name">' + p.name + '</div>';
                html += '<div class="profile-meta">性别：' + (p.gender || '未填') + ' · 出生：' + (p.birthYear || '未填') + '</div>';
                var hp = p.healthProfile || {};
                if (hp.constitution) html += '<div class="profile-health-tag">' + hp.constitution + '</div>';
                if (hp.symptoms && hp.symptoms.length > 0) html += '<div class="profile-health-tag">' + hp.symptoms.slice(0, 2).join('、') + (hp.symptoms.length > 2 ? '…' : '') + '</div>';
                html += '</div>';
                if (p.id === curId) html += '<div class="profile-current-badge">当前</div>';
                html += '</div>';
                html += '<div class="profile-card-footer">';
                html += '<span class="profile-record-count">记录 ' + records.length + ' 条</span>';
                html += '<span class="profile-last-result">最近：' + lastResult + '</span>';
                html += '</div>';
                html += '<div class="profile-card-actions" onclick="event.stopPropagation()">';
                html += '<button class="btn-small" onclick="window.archiveEditProfile(\'' + p.id + '\')">编辑</button>';
                html += '<button class="btn-small btn-danger" onclick="window.archiveDeleteProfile(\'' + p.id + '\')">删除</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function renderProfileView(profile) {
        currentProfile = profile;
        var records = ArchiveEngine.listRecords(profile.id);
        var bianzhengRecs = records.filter(function(r) { return r.type === 'bianzheng'; });
        var tizhiRecs = records.filter(function(r) { return r.type === 'tizhi'; });
        var masterRecs = records.filter(function(r) { return r.type === 'master'; });

        var html = '<div class="archive-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.archiveBack()">← 返回档案列表</button></div>';

        // 档案信息
        html += '<div class="profile-detail-card">';
        html += '<div class="profile-detail-header">';
        html += '<div class="profile-detail-avatar">' + getGenderIcon(profile.gender) + '</div>';
        html += '<div class="profile-detail-info">';
        html += '<h3>' + profile.name + '</h3>';
        html += '<div class="profile-detail-meta">性别：' + (profile.gender || '—') + ' · 出生：' + (profile.birthYear || '—') + '</div>';
        html += '<div class="profile-detail-dates">创建：' + formatDate(profile.createdAt) + ' · 更新：' + formatDate(profile.updatedAt) + '</div>';
        html += '</div>';
        html += '</div>';
        // 健康画像
        var hp = profile.healthProfile || {};
        html += '<div class="health-profile-section">';
        html += '<h4>🏥 健康画像</h4>';
        html += '<div class="health-profile-grid">';
        if (hp.constitution) html += '<div class="health-profile-item"><span class="hp-label">中医体质</span><span class="hp-value">' + hp.constitution + '</span></div>';
        if (hp.symptoms && hp.symptoms.length > 0) html += '<div class="health-profile-item"><span class="hp-label">当前症状</span><span class="hp-value">' + hp.symptoms.join('、') + '</span></div>';
        if (hp.diet) html += '<div class="health-profile-item"><span class="hp-label">饮食</span><span class="hp-value">' + hp.diet + '</span></div>';
        if (hp.sleep) html += '<div class="health-profile-item"><span class="hp-label">睡眠</span><span class="hp-value">' + hp.sleep + '</span></div>';
        if (hp.exercise) html += '<div class="health-profile-item"><span class="hp-label">运动</span><span class="hp-value">' + hp.exercise + '</span></div>';
        html += '</div>';
        if (hp.supplements && hp.supplements.length > 0) {
            html += '<div class="hp-subsection"><h5>💊 正在服用的保健品</h5>';
            hp.supplements.forEach(function(s) {
                html += '<div class="hp-item-row"><span class="hp-item-name">' + escHtml(s.name) + '</span>';
                if (s.brand) html += '<span class="hp-item-detail">' + escHtml(s.brand) + '</span>';
                if (s.dosage) html += '<span class="hp-item-detail">' + escHtml(s.dosage) + '</span>';
                if (s.frequency) html += '<span class="hp-item-detail">' + escHtml(s.frequency) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }
        if (hp.medications && hp.medications.length > 0) {
            html += '<div class="hp-subsection"><h5>💊 用药史</h5>';
            hp.medications.forEach(function(m) {
                html += '<div class="hp-item-row"><span class="hp-item-name">' + escHtml(m.name) + '</span>';
                if (m.dosage) html += '<span class="hp-item-detail">' + escHtml(m.dosage) + '</span>';
                if (m.reason) html += '<span class="hp-item-detail">' + escHtml(m.reason) + '</span>';
                html += '<span class="hp-item-status ' + (m.status === 'ongoing' ? 'status-ongoing' : 'status-stopped') + '">' + (m.status === 'ongoing' ? '服用中' : '已停用') + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }
        if (hp.healthGoals && hp.healthGoals.length > 0) {
            html += '<div class="hp-subsection"><h5>🎯 健康目标</h5><div class="hp-goals">';
            hp.healthGoals.forEach(function(g) {
                html += '<span class="hp-goal-tag">' + escHtml(g) + '</span>';
            });
            html += '</div></div>';
        }
        html += '</div>';
        if (profile.notes) html += '<div class="profile-notes">备注：' + profile.notes + '</div>';
        html += '<div class="profile-detail-actions">';
        html += '<button class="btn-small" onclick="window.archiveEditProfile(\'' + profile.id + '\')">编辑档案</button>';
        html += '<button class="btn-small" onclick="window.archiveShareLink(\'' + profile.id + '\')">🔗 生成分享链接</button>';
        html += '<button class="btn-small btn-danger" onclick="window.archiveDeleteProfile(\'' + profile.id + '\')">删除档案</button>';
        html += '</div>';
        html += '</div>';

        // ====== 保健品直接管理 ======
        html += '<div class="health-dashboard-card">';
        html += '<div class="dashboard-header"><h4>💊 保健品管理</h4></div>';
        // 当前保健品列表
        html += '<div class="supplement-manage-section">';
        if (hp.supplements && hp.supplements.length > 0) {
            html += '<div class="sup-manage-list">';
            hp.supplements.forEach(function(s) {
                html += '<div class="sup-manage-item">';
                html += '<div class="sup-manage-info">';
                html += '<strong>' + escHtml(s.name) + '</strong>';
                var details = [];
                if (s.brand) details.push(escHtml(s.brand));
                if (s.dosage) details.push(escHtml(s.dosage));
                if (s.frequency) details.push(escHtml(s.frequency));
                if (details.length > 0) html += '<div class="sup-manage-detail">' + details.join(' · ') + '</div>';
                if (s.createdAt) html += '<div class="sup-manage-date">添加于 ' + formatDate(s.createdAt) + '</div>';
                html += '</div>';
                html += '<button class="btn-small btn-danger" onclick="window.archiveRemoveSupplementInline(\'' + profile.id + '\',\'' + s.id + '\')">删除</button>';
                html += '</div>';
            });
            html += '</div>';
        } else {
            html += '<div class="sup-empty">暂未添加保健品</div>';
        }
        // 快速添加
        html += '<div class="sup-quick-add">';
        html += '<div class="sup-quick-row">';
        html += '<input type="text" id="sup-quick-name" class="form-input sup-quick-input" placeholder="产品名称" maxlength="50">';
        html += '<input type="text" id="sup-quick-brand" class="form-input sup-quick-input" placeholder="品牌" maxlength="50">';
        html += '<input type="text" id="sup-quick-dosage" class="form-input sup-quick-input" placeholder="剂量" maxlength="50">';
        html += '<input type="text" id="sup-quick-reason" class="form-input sup-quick-input" placeholder="服用原因" maxlength="50">';
        html += '<select id="sup-quick-frequency" class="form-input sup-quick-select">';
        html += '<option value="">频率</option><option value="每天1次">每天1次</option><option value="每天2次">每天2次</option><option value="每天3次">每天3次</option><option value="每周2-3次">每周2-3次</option><option value="按需服用">按需服用</option>';
        html += '</select>';
        html += '<button class="btn-primary btn-small" onclick="window.archiveAddSupplementInline(\'' + profile.id + '\')">+ 添加</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        // ====== 健康仪表盘 ======
        html += '<div class="health-dashboard-card">';
        html += '<div class="dashboard-header"><h4>📊 健康仪表盘</h4></div>';
        html += '<div class="dashboard-grid">';

        // 健康画像完整性
        var completeness = ArchiveEngine.calculateHealthCompleteness(profile);
        html += '<div class="dashboard-metric">';
        html += '<div class="metric-label">画像完整性</div>';
        html += '<div class="metric-value">' + completeness.score + '%</div>';
        html += '<div class="metric-bar"><div class="metric-bar-fill" style="width:' + completeness.score + '%"></div></div>';
        html += '<div class="metric-desc">' + (completeness.score >= 80 ? '信息完善' : completeness.score >= 50 ? '还需完善' : '信息较少') + '</div>';
        html += '</div>';

        // 健康风险评估
        var risk = ArchiveEngine.assessHealthRisk(profile);
        html += '<div class="dashboard-metric">';
        html += '<div class="metric-label">健康风险评分</div>';
        html += '<div class="metric-value ' + (risk.overallScore >= 85 ? 'metric-good' : risk.overallScore >= 65 ? 'metric-medium' : 'metric-bad') + '">' + risk.overallScore + '</div>';
        html += '<div class="metric-bar"><div class="metric-bar-fill ' + (risk.overallScore >= 85 ? 'fill-green' : risk.overallScore >= 65 ? 'fill-yellow' : 'fill-red') + '" style="width:' + risk.overallScore + '%"></div></div>';
        html += '<div class="metric-desc">' + risk.riskLevel + '</div>';
        html += '</div>';

        // 保健品数量
        html += '<div class="dashboard-metric">';
        html += '<div class="metric-label">保健品数量</div>';
        html += '<div class="metric-value">' + (hp.supplements ? hp.supplements.length : 0) + '</div>';
        html += '<div class="metric-desc">' + ((hp.supplements && hp.supplements.length > 0) ? '继续管理 →' : '尚未添加') + '</div>';
        html += '</div>';

        // 症状数量
        html += '<div class="dashboard-metric">';
        html += '<div class="metric-label">当前症状</div>';
        html += '<div class="metric-value ' + ((hp.symptoms && hp.symptoms.length >= 3) ? 'metric-bad' : '') + '">' + (hp.symptoms ? hp.symptoms.length : 0) + '</div>';
        html += '<div class="metric-desc">' + ((hp.symptoms && hp.symptoms.length > 0) ? hp.symptoms.slice(0, 2).join('、') + (hp.symptoms.length > 2 ? '…' : '') : '无') + '</div>';
        html += '</div>';

        html += '</div>';

        // 健康报告按钮
        html += '<div class="dashboard-actions">';
        html += '<button class="btn-primary" onclick="window.archiveShowReport(\'' + profile.id + '\')">📋 生成健康综合报告</button>';
        html += '<button class="btn-secondary" onclick="window.archiveEditProfile(\'' + profile.id + '\')">✏️ 完善健康画像</button>';
        html += '</div>';

        // 风险建议
        if (risk.suggestions && risk.suggestions.length > 0) {
            html += '<div class="dashboard-suggestions">';
            html += '<div class="suggestions-title">💡 改善建议</div>';
            risk.suggestions.forEach(function(s) {
                html += '<div class="suggestion-item">· ' + s + '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        // ====== 保健品效果摘要 ======
        if (hp.supplements && hp.supplements.length > 0 && typeof VitaminEngine !== 'undefined') {
            html += '<div class="health-dashboard-card">';
            html += '<div class="dashboard-header"><h4>📈 保健品效果摘要</h4></div>';
            html += '<div class="eff-summary-grid">';
            hp.supplements.forEach(function(s) {
                var stats = VitaminEngine.getEffectivenessStats(s.name);
                if (stats && stats.totalRecords > 0) {
                    html += '<div class="eff-summary-item">';
                    html += '<div class="eff-summary-name">' + escHtml(s.name) + '</div>';
                    html += '<div class="eff-summary-rating">';
                    var avg = stats.avgRating;
                    for (var si = 0; si < Math.round(avg); si++) html += '⭐';
                    html += ' <span class="eff-summary-num">' + avg + '</span>';
                    html += '</div>';
                    html += '<div class="eff-summary-count">' + stats.totalRecords + ' 次记录 · 主要效果：' + (stats.topEffect || '—') + '</div>';
                    html += '</div>';
                }
            });
            html += '</div>';
            html += '<div class="dashboard-actions">';
            html += '<button class="btn-small" onclick="QiuhuangApp.navigate(\'#/vitamin\');setTimeout(function(){window.vitaminShowTab(7);},200)">查看详细效果跟踪 →</button>';
            html += '</div>';
            html += '</div>';
        }

        // 趋势分析
        if (bianzhengRecs.length >= 2) {
            html += renderTrendSection(profile.id, 'bianzheng', bianzhengRecs, '辨证推理趋势');
        }
        if (tizhiRecs.length >= 2) {
            html += renderTrendSection(profile.id, 'tizhi', tizhiRecs, '体质辨识趋势');
        }

        // 记录列表
        html += '<div class="records-section"><h4>历史记录（' + records.length + ' 条）</h4>';
        if (records.length === 0) {
            html += '<div class="empty-hint">暂无历史记录。完成辨证推理或体质辨识后会自动归档。</div>';
        } else {
            html += '<div class="record-list">';
            records.forEach(function(r) {
                var data = r.data || {};
                var summary = '';
                if (r.type === 'bianzheng') {
                    summary = data.final_syndrome || data.type || '—';
                } else if (r.type === 'tizhi') {
                    summary = data.type || data.tizhi || '—';
                } else if (r.type === 'master') {
                    summary = data.master || '—';
                }
                html += '<div class="record-item" onclick="window.archiveOpenRecord(\'' + r.id + '\')">';
                html += '<div class="record-icon">' + getTypeIcon(r.type) + '</div>';
                html += '<div class="record-info">';
                html += '<div class="record-title">' + r.title + '</div>';
                html += '<div class="record-summary">' + summary + '</div>';
                html += '</div>';
                html += '<div class="record-time">' + formatTime(r.timestamp) + '</div>';
                html += '<button class="btn-small btn-danger record-delete" onclick="event.stopPropagation();window.archiveDeleteRecord(\'' + r.id + '\')">删除</button>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        html += '</div>';
        return html;
    }

    function renderTrendSection(profileId, type, records, title) {
        var first = records[records.length - 1];
        var last = records[0];
        var firstData = first.data || {};
        var lastData = last.data || {};

        var html = '<div class="trend-section"><h4>📊 ' + title + '（共 ' + records.length + ' 次）</h4>';
        html += '<div class="trend-compare">';
        html += '<div class="trend-item"><div class="trend-label">首次（' + formatDate(first.timestamp) + '）</div>';
        if (type === 'bianzheng') {
            html += '<div class="trend-value">' + (firstData.final_syndrome || '—') + '</div>';
            html += '<div class="trend-meta">八纲：' + JSON.stringify(firstData.biaogan || {}).replace(/["{}]/g, '').replace(/,/g, ', ') + '</div>';
        } else if (type === 'tizhi') {
            html += '<div class="trend-value">' + (firstData.type || firstData.tizhi || '—') + ' (' + (firstData.confidence || '—') + '%)</div>';
        }
        html += '</div>';
        html += '<div class="trend-arrow">→</div>';
        html += '<div class="trend-item"><div class="trend-label">最近（' + formatDate(last.timestamp) + '）</div>';
        if (type === 'bianzheng') {
            html += '<div class="trend-value">' + (lastData.final_syndrome || '—') + '</div>';
            html += '<div class="trend-meta">八纲：' + JSON.stringify(lastData.biaogan || {}).replace(/["{}]/g, '').replace(/,/g, ', ') + '</div>';
        } else if (type === 'tizhi') {
            html += '<div class="trend-value">' + (lastData.type || lastData.tizhi || '—') + ' (' + (lastData.confidence || '—') + '%)</div>';
        }
        html += '</div>';
        html += '</div>';

        // 趋势分析文字
        if (type === 'tizhi' && lastData.type && firstData.type && lastData.type !== firstData.type) {
            html += '<div class="trend-analysis">体质从「' + firstData.type + '」转为「' + lastData.type + '」，建议关注体质变化原因。</div>';
        } else if (type === 'bianzheng' && lastData.final_syndrome && firstData.final_syndrome && lastData.final_syndrome !== firstData.final_syndrome) {
            html += '<div class="trend-analysis">辨证结论从「' + firstData.final_syndrome + '」转为「' + lastData.final_syndrome + '」，建议复诊对比。</div>';
        } else if (records.length >= 3) {
            html += '<div class="trend-analysis">已记录 ' + records.length + ' 次，可作为长期健康跟踪参考。</div>';
        }

        html += '</div>';
        return html;
    }

    function renderCreateView() {
        var html = '<div class="archive-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.archiveBack()">← 返回</button></div>';
        html += '<h2>新建档案</h2>';
        html += '<div class="form-card">';
        html += '<div class="form-section"><h4>基本信息</h4></div>';
        html += '<div class="form-group"><label>姓名 *</label><input type="text" id="archive-name" placeholder="请输入姓名" maxlength="20"></div>';
        html += '<div class="form-group"><label>性别</label><select id="archive-gender"><option value="">未填</option><option value="男">男</option><option value="女">女</option></select></div>';
        html += '<div class="form-group"><label>出生年份</label><input type="number" id="archive-birth" placeholder="如：1990" min="1900" max="2100"></div>';
        html += '<div class="form-section"><h4>健康画像</h4></div>';
        html += '<div class="form-group"><label>中医体质</label><select id="archive-constitution"><option value="">未填</option><option value="平和质">平和质</option><option value="气虚质">气虚质</option><option value="阳虚质">阳虚质</option><option value="阴虚质">阴虚质</option><option value="痰湿质">痰湿质</option><option value="湿热质">湿热质</option><option value="血瘀质">血瘀质</option><option value="气郁质">气郁质</option><option value="特禀质">特禀质</option></select></div>';
        html += '<div class="form-group"><label>当前症状（可选多个，用逗号分隔）</label><input type="text" id="archive-symptoms" placeholder="如：乏力、失眠、头痛" maxlength="100"></div>';
        html += '<div class="form-group"><label>正在服用的保健品</label><textarea id="archive-supplements" rows="2" placeholder="每行一个，格式：名称|品牌|剂量|频率&#10;如：维生素C|汤臣倍健|100mg|每天1次"></textarea></div>';
        html += '<div class="form-group"><label>用药史</label><textarea id="archive-medications" rows="2" placeholder="每行一个，格式：药物名|剂量|原因|状态&#10;如：二甲双胍|500mg|糖尿病|服用中"></textarea></div>';
        html += '<div class="form-group"><label>健康目标</label><textarea id="archive-goals" rows="2" placeholder="每行一个，如：&#10;改善睡眠&#10;增强免疫力&#10;减重"></textarea></div>';
        html += '<div class="form-group"><label>饮食习惯</label><select id="archive-diet"><option value="">未填</option><option value="荤素均衡">荤素均衡</option><option value="偏素食">偏素食</option><option value="偏肉食">偏肉食</option><option value="素食">素食</option><option value="keto">生酮/低碳水</option></select></div>';
        html += '<div class="form-group"><label>睡眠情况</label><select id="archive-sleep"><option value="">未填</option><option value="良好">良好（7-8小时）</option><option value="一般">一般（5-6小时）</option><option value="较差">较差（<5小时/多梦易醒）</option><option value="失眠">失眠</option></select></div>';
        html += '<div class="form-group"><label>运动情况</label><select id="archive-exercise"><option value="">未填</option><option value="经常">经常（每周3次+）</option><option value="偶尔">偶尔（每周1-2次）</option><option value="很少">很少（几乎不运动）</option></select></div>';
        html += '<div class="form-group"><label>备注</label><textarea id="archive-notes" rows="2" placeholder="既往病史、过敏史等（可选）"></textarea></div>';
        html += '<div class="form-actions"><button class="btn-primary" onclick="window.archiveSaveProfile()">保存档案</button><button class="btn-secondary" onclick="window.archiveBack()">取消</button></div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function renderEditView(profile) {
        var hp = profile.healthProfile || {};
        var symptomsStr = (hp.symptoms || []).join('、');
        var supplementsStr = (hp.supplements || []).map(function(s) {
            return (s.name || '') + '|' + (s.brand || '') + '|' + (s.dosage || '') + '|' + (s.frequency || '');
        }).join('\n');
        var medicationsStr = (hp.medications || []).map(function(m) {
            return (m.name || '') + '|' + (m.dosage || '') + '|' + (m.reason || '') + '|' + (m.status === 'ongoing' ? '服用中' : '已停用');
        }).join('\n');
        var goalsStr = (hp.healthGoals || []).join('\n');

        var html = '<div class="archive-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.archiveBack()">← 返回</button></div>';
        html += '<h2>编辑档案</h2>';
        html += '<div class="form-card">';
        html += '<input type="hidden" id="edit-profile-id" value="' + profile.id + '"/>';
        html += '<div class="form-section"><h4>基本信息</h4></div>';
        html += '<div class="form-group"><label>姓名 *</label><input type="text" id="edit-name" value="' + escHtml(profile.name || '') + '" maxlength="20"></div>';
        html += '<div class="form-group"><label>性别</label><select id="edit-gender"><option value="">未填</option><option value="男"' + (profile.gender === '男' ? ' selected' : '') + '>男</option><option value="女"' + (profile.gender === '女' ? ' selected' : '') + '>女</option></select></div>';
        html += '<div class="form-group"><label>出生年份</label><input type="number" id="edit-birth" value="' + escHtml(profile.birthYear || '') + '" min="1900" max="2100"></div>';
        html += '<div class="form-section"><h4>健康画像</h4></div>';
        html += '<div class="form-group"><label>中医体质</label><select id="edit-constitution"><option value="">未填</option>';
        ['平和质','气虚质','阳虚质','阴虚质','痰湿质','湿热质','血瘀质','气郁质','特禀质'].forEach(function(c) {
            html += '<option value="' + c + '"' + (hp.constitution === c ? ' selected' : '') + '>' + c + '</option>';
        });
        html += '</select></div>';
        html += '<div class="form-group"><label>当前症状（逗号分隔）</label><input type="text" id="edit-symptoms" value="' + escHtml(symptomsStr) + '" maxlength="100"></div>';
        html += '<div class="form-group"><label>正在服用的保健品</label><textarea id="edit-supplements" rows="2" placeholder="名称|品牌|剂量|频率">' + escHtml(supplementsStr) + '</textarea></div>';
        html += '<div class="form-group"><label>用药史</label><textarea id="edit-medications" rows="2" placeholder="药物名|剂量|原因|状态">' + escHtml(medicationsStr) + '</textarea></div>';
        html += '<div class="form-group"><label>健康目标</label><textarea id="edit-goals" rows="2" placeholder="每行一个">' + escHtml(goalsStr) + '</textarea></div>';
        html += '<div class="form-group"><label>饮食习惯</label><select id="edit-diet"><option value="">未填</option><option value="荤素均衡"' + (hp.diet === '荤素均衡' ? ' selected' : '') + '>荤素均衡</option><option value="偏素食"' + (hp.diet === '偏素食' ? ' selected' : '') + '>偏素食</option><option value="偏肉食"' + (hp.diet === '偏肉食' ? ' selected' : '') + '>偏肉食</option><option value="素食"' + (hp.diet === '素食' ? ' selected' : '') + '>素食</option><option value="keto"' + (hp.diet === 'keto' ? ' selected' : '') + '>生酮/低碳水</option></select></div>';
        html += '<div class="form-group"><label>睡眠情况</label><select id="edit-sleep"><option value="">未填</option><option value="良好"' + (hp.sleep === '良好' ? ' selected' : '') + '>良好（7-8小时）</option><option value="一般"' + (hp.sleep === '一般' ? ' selected' : '') + '>一般（5-6小时）</option><option value="较差"' + (hp.sleep === '较差' ? ' selected' : '') + '>较差（<5小时/多梦易醒）</option><option value="失眠"' + (hp.sleep === '失眠' ? ' selected' : '') + '>失眠</option></select></div>';
        html += '<div class="form-group"><label>运动情况</label><select id="edit-exercise"><option value="">未填</option><option value="经常"' + (hp.exercise === '经常' ? ' selected' : '') + '>经常（每周3次+）</option><option value="偶尔"' + (hp.exercise === '偶尔' ? ' selected' : '') + '>偶尔（每周1-2次）</option><option value="很少"' + (hp.exercise === '很少' ? ' selected' : '') + '>很少（几乎不运动）</option></select></div>';
        html += '<div class="form-group"><label>备注</label><textarea id="edit-notes" rows="2">' + escHtml(profile.notes || '') + '</textarea></div>';
        html += '<div class="form-actions"><button class="btn-primary" onclick="window.archiveSaveEdit()">保存修改</button><button class="btn-secondary" onclick="window.archiveBack()">取消</button></div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function renderRecordDetailView(record) {
        currentRecordId = record.id;
        var data = record.data || {};
        var html = '<div class="archive-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.archiveBack()">← 返回</button></div>';
        html += '<div class="record-detail-card">';
        html += '<div class="record-detail-header">';
        html += '<span class="record-detail-icon">' + getTypeIcon(record.type) + '</span>';
        html += '<div><h3>' + record.title + '</h3><div class="record-detail-meta">' + getTypeLabel(record.type) + ' · ' + formatTime(record.timestamp) + '</div></div>';
        html += '</div>';

        // 根据类型渲染不同内容
        if (record.type === 'bianzheng') {
            html += renderBianzhengDetail(data);
        } else if (record.type === 'tizhi') {
            html += renderTizhiDetail(data);
        } else if (record.type === 'master') {
            html += renderMasterDetail(data);
        }

        html += '</div>';
        html += '</div>';
        return html;
    }

    function renderBianzhengDetail(data) {
        var html = '<div class="record-detail-body">';
        if (data.final_syndrome) html += '<div class="detail-field"><strong>辨证结论：</strong>' + data.final_syndrome + '</div>';
        if (data.confidence) html += '<div class="detail-field"><strong>置信度：</strong>' + data.confidence + '%</div>';
        if (data.biaogan && Object.keys(data.biaogan).length > 0) {
            html += '<div class="detail-field"><strong>八纲评分：</strong>';
            html += '<div class="biaogan-mini">';
            Object.keys(data.biaogan).forEach(function(k) {
                html += '<span class="biaogan-mini-item">' + k + '：' + data.biaogan[k] + '</span>';
            });
            html += '</div></div>';
        }
        if (data.liujing) html += '<div class="detail-field"><strong>六经辨证：</strong>' + data.liujing.jing + '证（' + data.liujing.score + '分）</div>';
        if (data.zangfu && data.zangfu.length > 0) {
            html += '<div class="detail-field"><strong>脏腑辨证：</strong>';
            html += '<div class="zangfu-mini">';
            data.zangfu.forEach(function(z) {
                html += '<span class="zangfu-mini-item">' + z.zang + ' ' + z.score + '分</span>';
            });
            html += '</div></div>';
        }
        if (data.zhize) html += '<div class="detail-field"><strong>治则：</strong>' + data.zhize + '</div>';
        if (data.symptoms && data.symptoms.length > 0) html += '<div class="detail-field"><strong>症状：</strong>' + data.symptoms.join('、') + '</div>';
        html += '</div>';
        return html;
    }

    function renderTizhiDetail(data) {
        var html = '<div class="record-detail-body">';
        if (data.type) html += '<div class="detail-field"><strong>体质类型：</strong>' + data.type + '</div>';
        if (data.confidence) html += '<div class="detail-field"><strong>置信度：</strong>' + data.confidence + '%</div>';
        if (data.description) html += '<div class="detail-field"><strong>体质描述：</strong>' + data.description + '</div>';
        if (data.score) {
            html += '<div class="detail-field"><strong>各维度得分：</strong>';
            html += '<div class="score-mini">';
            Object.keys(data.score).forEach(function(k) {
                html += '<span class="score-mini-item">' + k + '：' + data.score[k] + '</span>';
            });
            html += '</div></div>';
        }
        html += '</div>';
        return html;
    }

    function renderMasterDetail(data) {
        var html = '<div class="record-detail-body">';
        if (data.master) html += '<div class="detail-field"><strong>大师：</strong>' + data.master + '</div>';
        if (data.content) html += '<div class="detail-field"><strong>解读：</strong><div class="master-content">' + data.content + '</div></div>';
        html += '</div>';
        return html;
    }

    // ========== 全局操作 ==========
    window.archiveCreate = function() {
        currentView = VIEW.create;
        document.getElementById('page-container').innerHTML = renderCreateView();
    };

    window.archiveEditProfile = function(id) {
        var p = ArchiveEngine.getProfile(id);
        if (!p) return;
        currentView = VIEW.edit;
        currentProfileId = id;
        document.getElementById('page-container').innerHTML = renderEditView(p);
    };

    window.archiveSaveProfile = function() {
        var name = document.getElementById('archive-name').value.trim();
        if (!name) { alert('请输入姓名'); return; }

        // 解析保健品的文本输入
        var supplementsLines = document.getElementById('archive-supplements').value.trim().split('\n').filter(function(l) { return l.trim(); });
        var supplements = supplementsLines.map(function(line) {
            var parts = line.split('|');
            return { name: parts[0] || '', brand: parts[1] || '', dosage: parts[2] || '', frequency: parts[3] || '' };
        });

        // 解析用药史的文本输入
        var medsLines = document.getElementById('archive-medications').value.trim().split('\n').filter(function(l) { return l.trim(); });
        var medications = medsLines.map(function(line) {
            var parts = line.split('|');
            return { name: parts[0] || '', dosage: parts[1] || '', reason: parts[2] || '', status: (parts[3] === '服用中' || parts[3] === 'ongoing') ? 'ongoing' : 'stopped' };
        });

        // 解析健康目标
        var goals = document.getElementById('archive-goals').value.trim().split('\n').filter(function(l) { return l.trim(); }).map(function(l) { return l.trim(); });

        // 解析症状
        var symptoms = document.getElementById('archive-symptoms').value.trim().split(/[,，、]/).filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); });

        var profile = ArchiveEngine.createProfile({
            name: name,
            gender: document.getElementById('archive-gender').value,
            birthYear: document.getElementById('archive-birth').value,
            notes: document.getElementById('archive-notes').value.trim(),
            constitution: document.getElementById('archive-constitution').value,
            symptoms: symptoms,
            supplements: supplements,
            medications: medications,
            healthGoals: goals,
            diet: document.getElementById('archive-diet').value,
            sleep: document.getElementById('archive-sleep').value,
            exercise: document.getElementById('archive-exercise').value
        });
        ArchiveEngine.setCurrentProfileId(profile.id);
        currentProfileId = profile.id;
        currentView = VIEW.profile;
        document.getElementById('page-container').innerHTML = renderProfileView(profile);
    };

    window.archiveSaveEdit = function() {
        var id = document.getElementById('edit-profile-id').value;
        var name = document.getElementById('edit-name').value.trim();
        if (!name) { alert('请输入姓名'); return; }

        // 解析保健品的文本输入
        var supplementsLines = document.getElementById('edit-supplements').value.trim().split('\n').filter(function(l) { return l.trim(); });
        var supplements = supplementsLines.map(function(line) {
            var parts = line.split('|');
            return { name: parts[0] || '', brand: parts[1] || '', dosage: parts[2] || '', frequency: parts[3] || '' };
        });

        // 解析用药史的文本输入
        var medsLines = document.getElementById('edit-medications').value.trim().split('\n').filter(function(l) { return l.trim(); });
        var medications = medsLines.map(function(line) {
            var parts = line.split('|');
            return { name: parts[0] || '', dosage: parts[1] || '', reason: parts[2] || '', status: (parts[3] === '服用中' || parts[3] === 'ongoing') ? 'ongoing' : 'stopped' };
        });

        // 解析健康目标
        var goals = document.getElementById('edit-goals').value.trim().split('\n').filter(function(l) { return l.trim(); }).map(function(l) { return l.trim(); });

        // 解析症状
        var symptoms = document.getElementById('edit-symptoms').value.trim().split(/[,，、]/).filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); });

        var p = ArchiveEngine.updateProfile(id, {
            name: name,
            gender: document.getElementById('edit-gender').value,
            birthYear: document.getElementById('edit-birth').value,
            notes: document.getElementById('edit-notes').value.trim(),
            healthProfile: {
                constitution: document.getElementById('edit-constitution').value,
                symptoms: symptoms,
                supplements: supplements,
                medications: medications,
                healthGoals: goals,
                diet: document.getElementById('edit-diet').value,
                sleep: document.getElementById('edit-sleep').value,
                exercise: document.getElementById('edit-exercise').value
            }
        });
        currentView = VIEW.profile;
        document.getElementById('page-container').innerHTML = renderProfileView(p);
    };

    window.archiveDeleteProfile = function(id) {
        if (!confirm('确定删除该档案？所有历史记录也将一并删除。')) return;
        ArchiveEngine.deleteProfile(id);
        currentView = VIEW.list;
        document.getElementById('page-container').innerHTML = renderListView();
    };

    window.archiveOpenProfile = function(id) {
        currentView = VIEW.profile;
        currentProfileId = id;
        document.getElementById('page-container').innerHTML = renderProfileView(ArchiveEngine.getProfile(id));
    };

    window.archiveOpenRecord = function(id) {
        var record = ArchiveEngine.getRecord(id);
        if (!record) return;
        currentView = VIEW.detail;
        currentRecordId = id;
        document.getElementById('page-container').innerHTML = renderRecordDetailView(record);
    };

    window.archiveDeleteRecord = function(id) {
        if (!confirm('确定删除此条记录？')) return;
        ArchiveEngine.deleteRecord(id);
        if (currentProfileId) {
            document.getElementById('page-container').innerHTML = renderProfileView(ArchiveEngine.getProfile(currentProfileId));
        } else {
            currentView = VIEW.list;
            document.getElementById('page-container').innerHTML = renderListView();
        }
    };

    window.archiveBack = function() {
        if (currentView === VIEW.detail || currentView === VIEW.edit || currentView === VIEW.create) {
            currentView = currentProfileId ? VIEW.profile : VIEW.list;
            if (currentProfileId) {
                document.getElementById('page-container').innerHTML = renderProfileView(ArchiveEngine.getProfile(currentProfileId));
            } else {
                document.getElementById('page-container').innerHTML = renderListView();
            }
        } else if (currentView === VIEW.profile) {
            currentView = VIEW.list;
            document.getElementById('page-container').innerHTML = renderListView();
        }
    };

    window.switchProfile = function(id) {
        ArchiveEngine.setCurrentProfileId(id);
        if (id) {
            currentProfileId = id;
            currentView = VIEW.profile;
            document.getElementById('page-container').innerHTML = renderProfileView(ArchiveEngine.getProfile(id));
        } else {
            currentProfileId = null;
            currentView = VIEW.list;
            document.getElementById('page-container').innerHTML = renderListView();
        }
    };

    // 自动归档函数（供 tizhi.js 调用）
    window.archiveResult = function(type, title, result) {
        var profileId = ArchiveEngine.getCurrentProfileId();
        if (!profileId) {
            alert('请先创建或选择档案，结果将不会归档');
            return null;
        }
        return ArchiveEngine.autoArchive(profileId, type, title, result);
    };

    // ========== 保健品内联管理 ==========
    window.archiveAddSupplementInline = function(profileId) {
        var name = document.getElementById('sup-quick-name');
        var brand = document.getElementById('sup-quick-brand');
        var dosage = document.getElementById('sup-quick-dosage');
        var reason = document.getElementById('sup-quick-reason');
        var freq = document.getElementById('sup-quick-frequency');
        if (!name || !name.value.trim()) { alert('请输入产品名称'); return; }
        var supplement = {
            name: name.value.trim(),
            brand: brand ? brand.value.trim() : '',
            dosage: dosage ? dosage.value.trim() : '',
            reason: reason ? reason.value.trim() : '',
            frequency: freq ? freq.value : ''
        };
        ArchiveEngine.addSupplement(profileId, supplement);
        // 清空输入
        name.value = ''; brand.value = ''; dosage.value = ''; reason.value = ''; freq.value = '';
        // 刷新页面
        currentView = VIEW.profile;
        currentProfileId = profileId;
        document.getElementById('page-container').innerHTML = renderProfileView(ArchiveEngine.getProfile(profileId));
    };

    window.archiveRemoveSupplementInline = function(profileId, supplementId) {
        if (!confirm('确定移除该保健品？')) return;
        ArchiveEngine.removeSupplement(profileId, supplementId);
        currentView = VIEW.profile;
        currentProfileId = profileId;
        document.getElementById('page-container').innerHTML = renderProfileView(ArchiveEngine.getProfile(profileId));
    };

    // ========== 健康报告 ==========
    window.archiveShowReport = function(profileId) {
        var profile = ArchiveEngine.getProfile(profileId);
        if (!profile) { alert('档案不存在'); return; }
        var report = null;
        if (typeof ReportEngine !== 'undefined') {
            report = ReportEngine.generateHealthReport(profile);
        }
        if (!report || report.error) {
            alert('生成报告失败，请确保档案信息完整');
            return;
        }
        document.getElementById('page-container').innerHTML = renderReportView(profile, report);
    };

    function renderReportView(profile, report) {
        var html = '<div class="archive-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.archiveOpenProfile(\'' + profile.id + '\')">← 返回档案</button></div>';
        html += '<div class="report-card">';
        html += '<div class="report-header">';
        html += '<div class="report-icon">📋</div>';
        html += '<div class="report-title-group">';
        html += '<h3>' + escHtml(report.profileName) + ' 的健康综合报告</h3>';
        html += '<div class="report-date">生成时间：' + formatTime(report.generatedAt) + '</div>';
        html += '</div></div>';

        // 综合评分
        if (report.overallScore) {
            html += '<div class="report-score-section">';
            html += '<div class="report-score-big">' + report.overallScore.levelIcon + ' ' + report.overallScore.score + ' 分</div>';
            html += '<div class="report-score-level">' + report.overallScore.level + '</div>';
            html += '<div class="metric-bar"><div class="metric-bar-fill ' + (report.overallScore.score >= 70 ? 'fill-green' : report.overallScore.score >= 55 ? 'fill-yellow' : 'fill-red') + '" style="width:' + report.overallScore.score + '%"></div></div>';
            html += '</div>';
        }

        // 健康画像摘要
        if (report.sections.profileSummary) {
            var ps = report.sections.profileSummary;
            html += '<div class="report-section"><h4>👤 健康画像摘要</h4>';
            if (ps.items && ps.items.length > 0) {
                html += '<div class="report-tags">';
                ps.items.forEach(function(item) {
                    html += '<span class="report-tag">' + item + '</span>';
                });
                html += '</div>';
            }
            if (ps.completeness) {
                html += '<div class="report-completeness">画像完整性：' + ps.completeness.score + '%（' + ps.completeness.completeness + '）</div>';
            }
            html += '</div>';
        }

        // 健康风险评估
        if (report.sections.riskAssessment) {
            var ra = report.sections.riskAssessment;
            html += '<div class="report-section"><h4>⚠️ 健康风险评估</h4>';
            if (ra.riskResult) {
                html += '<div class="report-risk-dimensions">';
                ra.riskResult.dimensions.forEach(function(d) {
                    var levelClass = d.level === 'good' ? 'dimension-good' : d.level === 'medium' ? 'dimension-medium' : 'dimension-bad';
                    html += '<div class="report-dimension ' + levelClass + '">';
                    html += '<div class="dimension-name">' + d.name + '</div>';
                    html += '<div class="dimension-score">' + d.score + '</div>';
                    html += '<div class="dimension-bar"><div class="dimension-bar-fill" style="width:' + d.score + '%"></div></div>';
                    html += '<div class="dimension-risk">' + d.risk + '</div>';
                    html += '</div>';
                });
                html += '</div>';
            }
            if (ra.badHabits && ra.badHabits.length > 0) {
                html += '<div class="report-risk-bad">不良习惯：' + ra.badHabits.join('、') + '</div>';
            }
            html += '</div>';
        }

        // 营养素分析
        if (report.sections.nutritionAnalysis) {
            var na = report.sections.nutritionAnalysis;
            if (na.deficiencyRisks && na.deficiencyRisks.length > 0) {
                html += '<div class="report-section"><h4>🔍 营养素缺乏风险</h4>';
                html += '<div class="report-risk-grid">';
                na.deficiencyRisks.slice(0, 6).forEach(function(r) {
                    var levelClass = r.risk.level === 'high' ? 'risk-high' : r.risk.level === 'medium' ? 'risk-medium' : 'risk-low';
                    html += '<div class="report-risk-card ' + levelClass + '">';
                    html += '<div class="risk-card-header">' + r.icon + ' ' + r.nameCN + '</div>';
                    html += '<div class="risk-card-level">' + r.risk.levelInfo.label + '</div>';
                    html += '<div class="risk-card-reason">' + (r.risk.reasons.slice(0, 1).join('；') || '—') + '</div>';
                    html += '</div>';
                });
                html += '</div></div>';
            }
        }

        // 相互作用提醒
        if (report.sections.supplementAnalysis && report.sections.supplementAnalysis.interactions && report.sections.supplementAnalysis.interactions.length > 0) {
            html += '<div class="report-section"><h4>⚠️ 相互作用提醒</h4>';
            report.sections.supplementAnalysis.interactions.forEach(function(w) {
                html += '<div class="report-interaction">';
                html += '<div class="interaction-desc">' + w.description + '</div>';
                html += '<div class="interaction-advice">💡 ' + w.advice + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 调养建议
        if (report.sections.regimenAdvice && report.sections.regimenAdvice.length > 0) {
            html += '<div class="report-section"><h4>💡 调养建议</h4>';
            report.sections.regimenAdvice.forEach(function(a) {
                html += '<div class="report-advice-card">';
                html += '<div class="advice-icon">' + a.icon + '</div>';
                html += '<div class="advice-content">';
                html += '<strong>' + a.title + '</strong>';
                html += '<p>' + a.content + '</p>';
                html += '</div></div>';
            });
            html += '</div>';
        }

        // 健康目标
        if (report.sections.goalProgress && report.sections.goalProgress.hasGoals) {
            html += '<div class="report-section"><h4>🎯 健康目标</h4>';
            report.sections.goalProgress.goalDetails.forEach(function(g) {
                html += '<div class="report-goal">';
                html += '<div class="goal-name">' + escHtml(g.goal) + '</div>';
                if (g.relatedNutrients && g.relatedNutrients.length > 0) {
                    html += '<div class="goal-nutrients">相关营养素：' + g.relatedNutrients.join('、') + '</div>';
                }
                if (g.tips && g.tips.length > 0) {
                    html += '<div class="goal-tips"><ul>';
                    g.tips.forEach(function(t) { html += '<li>' + t + '</li>'; });
                    html += '</ul></div>';
                }
                html += '</div>';
            });
            html += '</div>';
        }

        // 关键行动项
        if (report.actionItems && report.actionItems.length > 0) {
            html += '<div class="report-section"><h4>📌 关键行动项</h4><div class="report-action-items">';
            report.actionItems.forEach(function(item, idx) {
                var priorityClass = item.priority === 'high' ? 'action-high' : 'action-medium';
                html += '<div class="action-item ' + priorityClass + '">';
                html += '<div class="action-num">' + (idx + 1) + '</div>';
                html += '<div class="action-content"><span class="action-type">[' + item.type + ']</span> ' + item.content + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        html += '<div class="report-footer">本报告基于您提供的健康信息生成，仅供学习参考，不构成医疗建议。</div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // 生成分享/体验链接
    window.archiveShareLink = function(profileId) {
        var link = ArchiveEngine.generateShareLink(profileId);
        if (!link) { alert('生成链接失败'); return; }
        var profile = ArchiveEngine.getProfile(profileId);
        var html = '<div class="share-modal-mask" onclick="window.archiveCloseModal()"><div class="share-modal" onclick="event.stopPropagation()"><h4>🔗 分享链接</h4><p class="share-desc">将此链接分享给他人，对方打开后可查看您的完整档案和健康记录</p><textarea class="share-link-input" readonly onclick="this.select()">' + link + '</textarea><div class="share-modal-actions"><button class="btn-primary" onclick="window.archiveCopyLink()">复制链接</button><button class="btn-secondary" onclick="window.archiveCloseModal()">关闭</button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    };

    window.archiveCopyLink = function() {
        var el = document.querySelector('.share-link-input');
        if (el) { el.select(); document.execCommand('copy'); alert('链接已复制！可分享给他人体验。'); }
    };

    window.archiveCloseModal = function() {
        var mask = document.querySelector('.share-modal-mask');
        if (mask) mask.remove();
    };

    // ========== 路由渲染 ==========
    function render() {
        // 初始化：处理体验链接
        ArchiveEngine.initData();

        if (currentView === VIEW.list || !currentProfileId) {
            return renderListView();
        } else {
            var p = ArchiveEngine.getProfile(currentProfileId);
            if (p) return renderProfileView(p);
            return renderListView();
        }
    }

    if (typeof QiuhuangApp !== 'undefined') {
        QiuhuangApp.registerRoute('#/archive', render);
    }

    global.ArchiveComponent = { render: render };

})(typeof window !== 'undefined' ? window : this);
