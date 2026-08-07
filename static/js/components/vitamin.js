/**
 * 岐黄阁 · 智能健康管家组件
 * 营养百科 · 症状匹配 · 补充记录 · 个性化推荐 · 保健品管理
 */
(function(global) {
    'use strict';

    var TAB = { encyclopedia: 0, symptomMatch: 1, supplementRecord: 2, personalized: 3, supplementManage: 4, supplementPlan: 5, timeSchedule: 6, effectiveness: 7 };
    var currentTab = TAB.encyclopedia;
    var currentProfileId = null;
    var showDetail = false;
    var detailVitaminId = null;
    var currentDoseLevel = 'maintenance';

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        var d = new Date(isoStr);
        return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
    }

    function getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    function escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function getSeverityClass(severity) {
        return severity === 'high' ? 'severity-high' : severity === 'medium' ? 'severity-medium' : 'severity-low';
    }

    function getTypeLabel(type) {
        var map = { 'antagonistic': '拮抗', 'synergistic': '协同', 'competitive': '竞争', 'risk': '风险' };
        return map[type] || type;
    }

    // ========== Tab导航 ==========
    function renderTabs() {
        var tabs = ['营养百科', '症状匹配', '补充记录', '个性化推荐', '保健品管理', '补充计划', '服用时间表', '效果跟踪'];
        var html = '<div class="vitamin-nav">';
        tabs.forEach(function(t, i) {
            var active = i === currentTab ? ' active' : '';
            var cls = '';
            if (i === TAB.personalized || i === TAB.supplementPlan || i === TAB.timeSchedule) cls = ' tab-featured';
            html += '<button class="vitamin-tab' + active + cls + '" onclick="window.vitaminShowTab(' + i + ')">' + t + '</button>';
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

        // 细分形态与生物利用度
        var forms = window.VitaminEngine.getNutrientForms(detailVitaminId);
        if (forms) {
            html += '<div class="vitamin-section"><h4>🔬 细分形态与生物利用度</h4>';
            html += '<div class="forms-intro">推荐选择：<strong>' + forms.best + '</strong></div>';
            html += '<div class="forms-table-wrap">';
            html += '<table class="forms-table">';
            html += '<thead><tr><th>形态</th><th>来源</th><th>生物利用度</th><th>说明</th></tr></thead>';
            html += '<tbody>';
            forms.forms.forEach(function(f) {
                var bioClass = f.bioavailability === '高' ? 'bio-high' : f.bioavailability === '中' ? 'bio-mid' : 'bio-low';
                html += '<tr><td>' + f.name + '</td><td>' + f.source + '</td><td class="' + bioClass + '">' + f.bioavailability + '</td><td>' + f.note + '</td></tr>';
            });
            html += '</tbody></table></div>';
            // 服用建议
            html += '<div class="forms-tips">';
            html += '<div><span class="tip-label">⏰ 最佳服用时间：</span>' + forms.bestTime + '</div>';
            if (forms.bestWith) html += '<div><span class="tip-label">👍 搭配建议：</span>' + forms.bestWith + '</div>';
            if (forms.avoidWith) html += '<div><span class="tip-label">⚠️ 避免同服：</span>' + forms.avoidWith + '</div>';
            html += '</div>';
            // 中医关联
            if (forms.chineseMedicine) {
                html += '<div class="forms-cm">';
                html += '<span class="cm-label">☯ 中医关联：</span>';
                html += '性' + forms.chineseMedicine.nature + ' · 归经：' + forms.chineseMedicine.meridians.join('、') + ' · ' + forms.chineseMedicine.note;
                html += '</div>';
            }
            html += '</div>';
        }

        // 剂量分级
        html += '<div class="dose-section"><h4>📊 剂量建议</h4>';
        var doseLevels = window.VitaminEngine.getAllDoseLevels();
        html += '<div class="dose-level-select">';
        doseLevels.forEach(function(l) {
            var active = l.id === currentDoseLevel ? ' active' : '';
            html += '<button class="dose-level-btn' + active + '" onclick="window.vitaminSetDoseLevel(\'' + l.id + '\')">' + l.label + '</button>';
        });
        html += '</div>';
        var dose = window.VitaminEngine.getRecommendedDose(detailVitaminId, currentDoseLevel);
        if (dose) {
            html += '<div class="dose-result">';
            html += '<div class="dose-item"><span>基础推荐</span><strong>' + dose.base + '</strong></div>';
            html += '<div class="dose-item"><span>建议剂量</span><strong class="dose-rec">' + dose.recommended + '</strong></div>';
            html += '<div class="dose-item"><span>最高耐受</span><strong>' + dose.max + '</strong></div>';
            html += '<div class="dose-desc">' + dose.level.desc + '</div>';
            if (dose.warning) html += '<div class="dose-warning">⚠️ 此剂量水平存在风险，建议咨询医生</div>';
            html += '</div>';
        }
        html += '</div>';

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

    // ========== 个性化推荐 Tab (NEW) ==========
    function renderPersonalized() {
        var html = '<div class="vitamin-page">';
        html += renderTabs();

        // 获取当前用户档案
        var profile = null;
        if (window.ArchiveEngine) {
            profile = window.ArchiveEngine.getCurrentProfile();
            if (!profile) {
                // 尝试获取 profileId
                var pid = window.ArchiveEngine.getCurrentProfileId();
                if (pid) profile = window.ArchiveEngine.getProfile(pid);
            }
        }

        if (!profile) {
            html += '<div class="personalized-empty">';
            html += '<div class="empty-icon">👤</div>';
            html += '<h3>请先创建用户档案</h3>';
            html += '<p>个性化推荐需要基于您的健康画像进行分析</p>';
            html += '<button class="btn-primary" onclick="QiuhuangApp.navigate(\'#/archive\')">去创建档案</button>';
            html += '</div>';
            html += '</div>';
            return html;
        }

        var hp = profile.healthProfile || {};
        var recs = window.VitaminEngine.getPersonalizedRecommendations(profile);

        // 健康画像摘要
        html += '<div class="personalized-profile-summary">';
        html += '<h4>👤 ' + escHtml(profile.name) + ' 的健康画像</h4>';
        html += '<div class="pp-grid">';
        if (hp.constitution) html += '<div class="pp-item"><span class="pp-label">体质</span><span class="pp-value">' + hp.constitution + '</span></div>';
        if (hp.symptoms && hp.symptoms.length > 0) html += '<div class="pp-item"><span class="pp-label">症状</span><span class="pp-value">' + hp.symptoms.join('、') + '</span></div>';
        if (hp.diet) html += '<div class="pp-item"><span class="pp-label">饮食</span><span class="pp-value">' + hp.diet + '</span></div>';
        if (hp.sleep) html += '<div class="pp-item"><span class="pp-label">睡眠</span><span class="pp-value">' + hp.sleep + '</span></div>';
        if (hp.exercise) html += '<div class="pp-item"><span class="pp-label">运动</span><span class="pp-value">' + hp.exercise + '</span></div>';
        html += '</div>';
        html += '<button class="btn-small" onclick="QiuhuangApp.navigate(\'#/archive\')">完善健康画像 →</button>';
        html += '</div>';

        // 推荐摘要
        html += '<div class="personalized-summary">';
        html += '<h4>🎯 个性化分析</h4>';
        html += '<p>' + recs.summary + '</p>';
        if (recs.constitutionAdvice) {
            html += '<div class="constitution-advice">' + recs.constitutionAdvice + '</div>';
        }
        html += '</div>';

        // 推荐列表
        if (recs.recommendations.length > 0) {
            html += '<div class="personalized-recs"><h4>📋 推荐营养素（按优先级排序）</h4>';
            recs.recommendations.forEach(function(r, idx) {
                var badge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);
                html += '<div class="rec-card" onclick="window.vitaminShowDetail(\'' + r.id + '\')">';
                html += '<div class="rec-rank">' + badge + '</div>';
                html += '<div class="rec-content">';
                html += '<div class="rec-header"><span class="rec-icon">' + r.icon + '</span>';
                html += '<strong>' + r.nameCN + '</strong>';
                html += '<span class="rec-score">综合评分 ' + r.score + '</span></div>';
                if (r.reasons && r.reasons.length > 0) {
                    html += '<div class="rec-reasons">';
                    r.reasons.forEach(function(reason) {
                        html += '<span class="rec-reason-tag">' + reason + '</span>';
                    });
                    html += '</div>';
                }
                html += '<div class="rec-detail">' + (r.function ? r.function.substring(0, 60) + '…' : '') + '</div>';
                html += '<div class="rec-foods">食物来源：' + (r.foods || '') + '</div>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 相互作用警告
        if (recs.interactionWarnings && recs.interactionWarnings.length > 0) {
            html += '<div class="interaction-section"><h4>⚠️ 相互作用提醒</h4>';
            recs.interactionWarnings.forEach(function(w) {
                html += '<div class="interaction-item ' + getSeverityClass(w.severity) + '">';
                html += '<div class="interaction-header"><span class="interaction-type">' + getTypeLabel(w.type) + '</span>';
                html += '<span class="interaction-severity">' + (w.severity === 'high' ? '高风险' : w.severity === 'medium' ? '中等' : '低风险') + '</span></div>';
                html += '<div class="interaction-desc">' + w.description + '</div>';
                html += '<div class="interaction-advice">💡 ' + w.advice + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // ========== 保健品管理 Tab (NEW) ==========
    function renderSupplementManage() {
        var html = '<div class="vitamin-page">';
        html += renderTabs();

        var profile = null;
        if (window.ArchiveEngine) {
            profile = window.ArchiveEngine.getCurrentProfile();
            if (!profile) {
                var pid = window.ArchiveEngine.getCurrentProfileId();
                if (pid) profile = window.ArchiveEngine.getProfile(pid);
            }
        }

        if (!profile) {
            html += '<div class="personalized-empty">';
            html += '<div class="empty-icon">💊</div>';
            html += '<h3>请先创建用户档案</h3>';
            html += '<p>保健品管理需要关联到您的健康档案</p>';
            html += '<button class="btn-primary" onclick="QiuhuangApp.navigate(\'#/archive\')">去创建档案</button>';
            html += '</div>';
            html += '</div>';
            return html;
        }

        var hp = profile.healthProfile || {};
        var supplements = hp.supplements || [];
        var medications = hp.medications || [];

        // 添加保健品表单
        html += '<div class="form-card">';
        html += '<div class="form-section"><h4>💊 添加保健品</h4></div>';
        html += '<div class="form-section">';
        html += '<label>产品名称 *</label>';
        html += '<input type="text" id="sup-name" class="form-input" placeholder="如：维生素C片" maxlength="50">';
        html += '</div>';
        html += '<div class="form-section">';
        html += '<label>品牌</label>';
        html += '<input type="text" id="sup-brand" class="form-input" placeholder="如：汤臣倍健" maxlength="50">';
        html += '</div>';
        html += '<div class="form-section">';
        html += '<label>剂量</label>';
        html += '<input type="text" id="sup-dosage" class="form-input" placeholder="如：100mg/粒" maxlength="50">';
        html += '</div>';
        html += '<div class="form-section">';
        html += '<label>服用频率</label>';
        html += '<select id="sup-frequency" class="form-input">';
        html += '<option value="">请选择</option>';
        html += '<option value="每天1次">每天1次</option>';
        html += '<option value="每天2次">每天2次</option>';
        html += '<option value="每天3次">每天3次</option>';
        html += '<option value="每周2-3次">每周2-3次</option>';
        html += '<option value="按需服用">按需服用</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="form-actions">';
        html += '<button class="btn-primary" onclick="window.vitaminAddSupplement()">添加</button>';
        html += '</div>';
        html += '</div>';

        // 保健品列表
        html += '<h4>正在服用的保健品（' + supplements.length + '）</h4>';
        if (supplements.length === 0) {
            html += '<div class="empty-tip">暂未添加保健品</div>';
        } else {
            html += '<div class="sup-list">';
            supplements.forEach(function(s) {
                html += '<div class="sup-card">';
                html += '<div class="sup-header">';
                html += '<strong>' + escHtml(s.name || '未命名') + '</strong>';
                html += '<button class="btn-small btn-danger" onclick="window.vitaminRemoveSupplement(\'' + s.id + '\')">删除</button>';
                html += '</div>';
                html += '<div class="sup-details">';
                if (s.brand) html += '<span>' + escHtml(s.brand) + '</span>';
                if (s.dosage) html += '<span>' + escHtml(s.dosage) + '</span>';
                if (s.frequency) html += '<span>' + escHtml(s.frequency) + '</span>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 相互作用检测
        if (supplements.length > 0) {
            var interactions = window.VitaminEngine.checkAllSupplementInteractions(supplements, medications);
            if (interactions.length > 0) {
                html += '<div class="interaction-section"><h4>⚠️ 相互作用检测结果</h4>';
                interactions.forEach(function(w) {
                    html += '<div class="interaction-item ' + getSeverityClass(w.severity) + '">';
                    html += '<div class="interaction-header"><span class="interaction-type">' + getTypeLabel(w.type) + '</span>';
                    html += '<span class="interaction-severity">' + (w.severity === 'high' ? '高风险' : w.severity === 'medium' ? '中等' : '低风险') + '</span></div>';
                    html += '<div class="interaction-desc">' + w.description + '</div>';
                    html += '<div class="interaction-advice">💡 ' + w.advice + '</div>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += '<div class="interaction-safe">✅ 当前保健品组合未检测到相互作用风险</div>';
            }
        }

        html += '</div>';
        return html;
    }

    // ========== 补充计划 Tab (NEW) ==========
    function renderSupplementPlan() {
        var html = '<div class="vitamin-page">';
        html += renderTabs();

        // 获取当前用户档案
        var profile = null;
        if (window.ArchiveEngine) {
            profile = window.ArchiveEngine.getCurrentProfile();
            if (!profile) {
                var pid = window.ArchiveEngine.getCurrentProfileId();
                if (pid) profile = window.ArchiveEngine.getProfile(pid);
            }
        }

        if (!profile) {
            html += '<div class="personalized-empty">';
            html += '<div class="empty-icon">📋</div>';
            html += '<h3>请先创建用户档案</h3>';
            html += '<p>补充计划需要基于您的健康画像和保健品记录生成</p>';
            html += '<button class="btn-primary" onclick="QiuhuangApp.navigate(\'#/archive\')">去创建档案</button>';
            html += '</div>';
            html += '</div>';
            return html;
        }

        // 剂量等级选择
        html += '<div class="dose-plan-select">';
        html += '<div class="dose-plan-header">';
        html += '<h4>📋 每日补充计划</h4>';
        html += '<div class="dose-level-select">';
        var doseLevels = window.VitaminEngine.getAllDoseLevels();
        doseLevels.forEach(function(l) {
            var active = l.id === currentDoseLevel ? ' active' : '';
            html += '<button class="dose-level-btn' + active + '" onclick="window.vitaminSetPlanDoseLevel(\'' + l.id + '\')">' + l.label + '</button>';
        });
        html += '</div></div>';
        html += '<div class="dose-level-desc">当前：' + (doseLevels.find(function(l) { return l.id === currentDoseLevel; }) || {}).desc + ' — ' + (doseLevels.find(function(l) { return l.id === currentDoseLevel; }) || {}).suitable + '</div>';
        html += '</div>';

        // 生成补充计划
        var plan = window.VitaminEngine.generateSupplementPlan(profile, currentDoseLevel);

        // 计划摘要
        html += '<div class="plan-summary">';
        html += '<p>' + plan.summary + '</p>';
        html += '</div>';

        // 风险警告
        if (plan.warnings && plan.warnings.length > 0) {
            html += '<div class="interaction-section"><h4>⚠️ 风险提示</h4>';
            plan.warnings.forEach(function(w) {
                html += '<div class="interaction-item severity-high">';
                html += '<div class="interaction-desc">' + w.message + '</div>';
                html += '<div class="interaction-advice">💡 ' + w.advice + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 每日计划列表
        if (plan.dailyPlan && plan.dailyPlan.length > 0) {
            html += '<div class="plan-list"><h4>📅 每日补充计划</h4>';
            plan.dailyPlan.forEach(function(p) {
                html += '<div class="plan-card" onclick="window.vitaminShowDetail(\'' + p.id + '\')">';
                html += '<div class="plan-card-header">';
                html += '<span class="plan-icon">' + p.icon + '</span>';
                html += '<div class="plan-name">';
                html += '<strong>' + p.nameCN + '</strong>';
                if (p.alreadyTaking) {
                    html += '<span class="plan-tag already">✅ 已在服用</span>';
                } else {
                    html += '<span class="plan-tag new">🆕 建议新增</span>';
                }
                html += '</div>';
                html += '<div class="plan-dose">' + p.dose + '</div>';
                html += '</div>';
                html += '<div class="plan-details">';
                html += '<div class="plan-detail-row"><span class="plan-detail-label">⏰ 服用时间</span><span>' + p.timeAdvice + '</span></div>';
                html += '<div class="plan-detail-row"><span class="plan-detail-label">👍 搭配</span><span>' + p.bestWith + '</span></div>';
                if (p.avoidWith !== '无特殊要求') {
                    html += '<div class="plan-detail-row"><span class="plan-detail-label">⚠️ 避免</span><span class="plan-avoid">' + p.avoidWith + '</span></div>';
                }
                if (p.reasons && p.reasons.length > 0) {
                    html += '<div class="plan-reasons">';
                    p.reasons.forEach(function(r) {
                        html += '<span class="rec-reason-tag">' + r + '</span>';
                    });
                    html += '</div>';
                }
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // 缺乏风险总览
        var risks = window.VitaminEngine.assessAllDeficiencyRisks(profile);
        if (risks.length > 0) {
            html += '<div class="risk-section"><h4>🔍 缺乏风险总览</h4>';
            html += '<div class="risk-grid">';
            risks.slice(0, 8).forEach(function(r) {
                var levelClass = r.risk.level === 'high' ? 'risk-high' : r.risk.level === 'medium' ? 'risk-medium' : 'risk-low';
                html += '<div class="risk-card ' + levelClass + '">';
                html += '<div class="risk-header">';
                html += '<span class="risk-icon">' + r.icon + '</span>';
                html += '<strong>' + r.nameCN + '</strong>';
                html += '<span class="risk-level">' + r.risk.levelInfo.label + '</span>';
                html += '</div>';
                html += '<div class="risk-reasons">' + r.risk.reasons.slice(0, 2).join('；') + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    // ========== 服用时间表 Tab (NEW) ==========
    function renderTimeSchedule() {
        var html = '<div class="vitamin-page">';
        html += renderTabs();

        // 获取用户档案中的保健品列表
        var profile = null;
        if (window.ArchiveEngine) {
            profile = window.ArchiveEngine.getCurrentProfile();
            if (!profile) {
                var pid = window.ArchiveEngine.getCurrentProfileId();
                if (pid) profile = window.ArchiveEngine.getProfile(pid);
            }
        }
        var supplements = (profile && profile.healthProfile && profile.healthProfile.supplements) || [];

        var schedule = window.VitaminEngine.generateTimeSchedule(supplements);

        html += '<div class="schedule-intro">';
        html += '<h4>⏰ 每日最佳服用时间表</h4>';
        html += '<p>根据营养素的吸收特性和生理节律，推荐以下服用时间安排。' + (supplements.length > 0 ? '已标出您正在服用的保健品。' : '') + '</p>';
        html += '</div>';

        schedule.forEach(function(slot) {
            html += '<div class="time-slot-card">';
            html += '<div class="time-slot-header">';
            html += '<div class="time-slot-title">' + slot.slotLabel + '</div>';
            html += '<div class="time-slot-range">' + slot.timeRange + '</div>';
            html += '<div class="time-slot-desc">' + slot.desc + '</div>';
            html += '</div>';

            if (slot.nutrients.length > 0) {
                html += '<div class="time-slot-nutrients">';
                slot.nutrients.forEach(function(n) {
                    var takingClass = n.isTaking ? ' nutrient-taking' : '';
                    html += '<div class="time-slot-nutrient' + takingClass + '" onclick="window.vitaminShowDetail(\'' + n.id + '\')">';
                    html += '<span class="time-nutrient-icon">' + n.icon + '</span>';
                    html += '<div class="time-nutrient-info">';
                    html += '<span class="time-nutrient-name">' + n.nameCN + '</span>';
                    html += '<span class="time-nutrient-reason">' + n.reason + '</span>';
                    html += '</div>';
                    if (n.isTaking) html += '<span class="time-taking-badge">服用中</span>';
                    html += '</div>';
                });
                html += '</div>';
            }

            if (slot.avoid) {
                html += '<div class="time-slot-avoid">⚠️ 避免：' + slot.avoid + '</div>';
            }
            html += '</div>';
        });

        // 通用建议
        html += '<div class="time-schedule-tips">';
        html += '<h4>💡 服用时间小贴士</h4>';
        html += '<ul>';
        html += '<li>脂溶性维生素（A、D、E、K）随含脂肪餐食服用，吸收率提高30-50%</li>';
        html += '<li>水溶性维生素（B族、C）空腹或随餐均可，但部分B族随餐减少胃部刺激</li>';
        html += '<li>钙和铁不能同服，至少间隔2小时</li>';
        html += '<li>茶和咖啡影响铁吸收，补铁前后1小时避免饮用</li>';
        html += '<li>镁和B6同服效果更佳，尤其适合睡前服用</li>';
        html += '</ul>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    // ========== 效果跟踪 Tab (NEW) ==========
    function renderEffectiveness() {
        var html = '<div class="vitamin-page">';
        html += renderTabs();

        // 获取用户保健品列表
        var profile = null;
        if (window.ArchiveEngine) {
            profile = window.ArchiveEngine.getCurrentProfile();
            if (!profile) {
                var pid = window.ArchiveEngine.getCurrentProfileId();
                if (pid) profile = window.ArchiveEngine.getProfile(pid);
            }
        }
        var supplements = (profile && profile.healthProfile && profile.healthProfile.supplements) || [];
        var effectLabels = window.VitaminEngine.getAllEffectLabels();

        // 记录效果表单
        html += '<div class="form-card">';
        html += '<div class="form-section"><h4>📝 记录服用效果</h4></div>';

        if (supplements.length === 0) {
            html += '<div class="empty-tip">请先在用户档案中添加保健品，以便记录效果。</div>';
        } else {
            html += '<div class="form-section">';
            html += '<label>保健品 *</label>';
            html += '<select id="effect-supplement-select" class="form-input">';
            html += '<option value="">请选择</option>';
            supplements.forEach(function(s) {
                html += '<option value="' + escHtml(s.name) + '">' + escHtml(s.name) + (s.brand ? ' (' + escHtml(s.brand) + ')' : '') + '</option>';
            });
            html += '</select>';
            html += '</div>';

            html += '<div class="form-section">';
            html += '<label>效果评分 *</label>';
            html += '<div class="rating-select" id="effect-rating">';
            for (var i = 5; i >= 1; i--) {
                var stars = '';
                for (var j = 0; j < i; j++) stars += '⭐';
                html += '<label class="rating-option"><input type="radio" name="effect-rating" value="' + i + '"> ' + stars + '</label>';
            }
            html += '</div>';
            html += '</div>';

            html += '<div class="form-section">';
            html += '<label>改善效果</label>';
            html += '<div class="effect-label-grid">';
            effectLabels.forEach(function(label) {
                html += '<label class="effect-label-chip"><input type="checkbox" value="' + label + '"> ' + label + '</label>';
            });
            html += '</div>';
            html += '</div>';

            html += '<div class="form-section">';
            html += '<label>备注</label>';
            html += '<textarea id="effect-note" class="form-input" rows="2" placeholder="比如：服用后感觉精力明显提升，睡眠质量改善..."></textarea>';
            html += '</div>';

            html += '<div class="form-actions">';
            html += '<button class="btn-primary" onclick="window.vitaminSaveEffectiveness()">保存记录</button>';
            html += '</div>';
        }
        html += '</div>';

        // 效果历史
        html += '<div class="effect-history"><h4>📊 效果历史</h4>';
        var allRecords = window.VitaminEngine.getEffectivenessHistory(null, 90);
        if (allRecords.length === 0) {
            html += '<div class="empty-tip">暂无效果记录，开始记录后这里会显示历史数据</div>';
        } else {
            // 统计摘要
            var stats = window.VitaminEngine.getEffectivenessStats(null);
            if (stats) {
                html += '<div class="effect-stats">';
                html += '<div class="eff-stat-item"><span class="eff-stat-num">' + stats.totalRecords + '</span><span class="eff-stat-label">总记录</span></div>';
                html += '<div class="eff-stat-item"><span class="eff-stat-num">' + stats.avgRating + '</span><span class="eff-stat-label">平均评分</span></div>';
                if (stats.topEffect) {
                    html += '<div class="eff-stat-item"><span class="eff-stat-num">' + stats.topEffect + '</span><span class="eff-stat-label">最常见效果</span></div>';
                }
                html += '</div>';
            }

            html += '<div class="effect-list">';
            allRecords.slice(0, 20).forEach(function(r) {
                var stars = '';
                for (var k = 0; k < r.rating; k++) stars += '⭐';
                html += '<div class="effect-item">';
                html += '<div class="effect-item-header">';
                html += '<strong>' + escHtml(r.supplementName) + '</strong>';
                html += '<span class="effect-stars">' + stars + '</span>';
                html += '<span class="effect-date">' + formatDate(r.date) + '</span>';
                html += '</div>';
                if (r.effect) html += '<div class="effect-item-tags">' + r.effect.split(',').filter(function(t) { return t.trim(); }).map(function(t) { return '<span class="eff-tag">' + t.trim() + '</span>'; }).join('') + '</div>';
                if (r.note) html += '<div class="effect-item-note">' + escHtml(r.note) + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

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
        } else if (tabIndex === TAB.personalized) {
            html = renderPersonalized();
        } else if (tabIndex === TAB.supplementManage) {
            html = renderSupplementManage();
        } else if (tabIndex === TAB.supplementPlan) {
            html = renderSupplementPlan();
        } else if (tabIndex === TAB.timeSchedule) {
            html = renderTimeSchedule();
        } else if (tabIndex === TAB.effectiveness) {
            html = renderEffectiveness();
        }
        document.getElementById('page-container').innerHTML = html;
    };

    window.vitaminSetDoseLevel = function(levelId) {
        currentDoseLevel = levelId;
        document.getElementById('page-container').innerHTML = renderEncyclopedia();
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
        currentDoseLevel = 'maintenance';
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

    // ========== 保健品管理操作 ==========

    window.vitaminAddSupplement = function() {
        var name = document.getElementById('sup-name').value.trim();
        if (!name) { alert('请输入产品名称'); return; }
        var profile = window.ArchiveEngine.getCurrentProfile();
        if (!profile) { alert('请先选择用户档案'); return; }

        var supplement = {
            name: name,
            brand: document.getElementById('sup-brand').value.trim(),
            dosage: document.getElementById('sup-dosage').value.trim(),
            frequency: document.getElementById('sup-frequency').value
        };

        window.ArchiveEngine.addSupplement(profile.id, supplement);
        alert('已添加：' + name);
        document.getElementById('page-container').innerHTML = renderSupplementManage();
    };

    window.vitaminRemoveSupplement = function(supplementId) {
        if (!confirm('确定移除该保健品？')) return;
        var profile = window.ArchiveEngine.getCurrentProfile();
        if (!profile) return;
        window.ArchiveEngine.removeSupplement(profile.id, supplementId);
        document.getElementById('page-container').innerHTML = renderSupplementManage();
    };

    // ========== 效果跟踪操作 ==========
    window.vitaminSaveEffectiveness = function() {
        var selectEl = document.getElementById('effect-supplement-select');
        var ratingRadios = document.querySelectorAll('input[name="effect-rating"]:checked');
        var effectCheckboxes = document.querySelectorAll('.effect-label-grid input:checked');
        var noteEl = document.getElementById('effect-note');

        if (!selectEl || !selectEl.value) { alert('请选择保健品'); return; }
        if (ratingRadios.length === 0) { alert('请选择效果评分'); return; }

        var rating = parseInt(ratingRadios[0].value);
        var effects = Array.from(effectCheckboxes).map(function(el) { return el.value; }).join(',');
        var note = noteEl ? noteEl.value.trim() : '';

        window.VitaminEngine.saveEffectivenessRating(selectEl.value, rating, effects, note);
        alert('效果记录已保存！');
        document.getElementById('page-container').innerHTML = renderEffectiveness();
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
        currentDoseLevel = 'maintenance';
        return renderEncyclopedia();
    }

    if (typeof QiuhuangApp !== 'undefined') {
        QiuhuangApp.registerRoute('#/vitamin', render);
    }

    global.VitaminComponent = { render: render };

})(typeof window !== 'undefined' ? window : this);