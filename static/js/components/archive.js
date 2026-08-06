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
                if (p.phone) html += '<div class="profile-phone">' + p.phone + '</div>';
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
        html += '<div class="profile-detail-meta">性别：' + (profile.gender || '—') + ' · 出生：' + (profile.birthYear || '—') + ' · 手机：' + (profile.phone || '—') + '</div>';
        html += '<div class="profile-detail-dates">创建：' + formatDate(profile.createdAt) + ' · 更新：' + formatDate(profile.updatedAt) + '</div>';
        html += '</div>';
        html += '</div>';
        if (profile.notes) html += '<div class="profile-notes">备注：' + profile.notes + '</div>';
        html += '<div class="profile-detail-actions">';
        html += '<button class="btn-small" onclick="window.archiveEditProfile(\'' + profile.id + '\')">编辑档案</button>';
        html += '<button class="btn-small" onclick="window.archiveShareLink(\'' + profile.id + '\')">🔗 生成分享链接</button>';
        html += '<button class="btn-small btn-danger" onclick="window.archiveDeleteProfile(\'' + profile.id + '\')">删除档案</button>';
        html += '</div>';
        html += '</div>';

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
        html += '<div class="form-group"><label>姓名 *</label><input type="text" id="archive-name" placeholder="请输入姓名" maxlength="20"></div>';
        html += '<div class="form-group"><label>性别</label><select id="archive-gender"><option value="">未填</option><option value="男">男</option><option value="女">女</option></select></div>';
        html += '<div class="form-group"><label>出生年份</label><input type="number" id="archive-birth" placeholder="如：1990" min="1900" max="2100"></div>';
        html += '<div class="form-group"><label>手机号</label><input type="tel" id="archive-phone" placeholder="可选" maxlength="20"></div>';
        html += '<div class="form-group"><label>备注</label><textarea id="archive-notes" rows="3" placeholder="既往病史、过敏史等（可选）"></textarea></div>';
        html += '<div class="form-actions"><button class="btn-primary" onclick="window.archiveSaveProfile()">保存档案</button><button class="btn-secondary" onclick="window.archiveBack()">取消</button></div>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function renderEditView(profile) {
        var html = '<div class="archive-page">';
        html += '<div class="back-nav"><button class="btn-back" onclick="window.archiveBack()">← 返回</button></div>';
        html += '<h2>编辑档案</h2>';
        html += '<div class="form-card">';
        html += '<input type="hidden" id="edit-profile-id" value="' + profile.id + '"/>';
        html += '<div class="form-group"><label>姓名 *</label><input type="text" id="edit-name" value="' + (profile.name || '') + '" maxlength="20"></div>';
        html += '<div class="form-group"><label>性别</label><select id="edit-gender"><option value="">未填</option><option value="男"' + (profile.gender === '男' ? ' selected' : '') + '>男</option><option value="女"' + (profile.gender === '女' ? ' selected' : '') + '>女</option></select></div>';
        html += '<div class="form-group"><label>出生年份</label><input type="number" id="edit-birth" value="' + (profile.birthYear || '') + '" min="1900" max="2100"></div>';
        html += '<div class="form-group"><label>手机号</label><input type="tel" id="edit-phone" value="' + (profile.phone || '') + '" maxlength="20"></div>';
        html += '<div class="form-group"><label>备注</label><textarea id="edit-notes" rows="3">' + (profile.notes || '') + '</textarea></div>';
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
        var profile = ArchiveEngine.createProfile({
            name: name,
            gender: document.getElementById('archive-gender').value,
            birthYear: document.getElementById('archive-birth').value,
            phone: document.getElementById('archive-phone').value.trim(),
            notes: document.getElementById('archive-notes').value.trim()
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
        var p = ArchiveEngine.updateProfile(id, {
            name: name,
            gender: document.getElementById('edit-gender').value,
            birthYear: document.getElementById('edit-birth').value,
            phone: document.getElementById('edit-phone').value.trim(),
            notes: document.getElementById('edit-notes').value.trim()
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
