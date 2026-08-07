/**
 * 岐黄阁 · 健康综合报告引擎
 * 整合用户档案、症状、营养素、调养记录、健康风险等所有维度
 * 生成个性化健康管理报告
 */
(function(global) {
    'use strict';

    // ========== 报告生成 ==========

    /**
     * 生成综合健康报告
     * @param {object} profile - 用户档案
     * @returns {object} 完整报告
     */
    function generateHealthReport(profile) {
        if (!profile) return { error: '请先创建并选择用户档案' };

        var hp = profile.healthProfile || {};
        var age = profile.birthYear ? new Date().getFullYear() - parseInt(profile.birthYear) : 0;

        // 1. 健康画像摘要
        var profileSummary = buildProfileSummary(profile, hp, age);

        // 2. 健康风险评估
        var riskAssessment = buildRiskAssessment(profile, hp, age);

        // 3. 营养素分析
        var nutritionAnalysis = buildNutritionAnalysis(profile, hp);

        // 4. 症状分析
        var symptomAnalysis = buildSymptomAnalysis(profile, hp);

        // 5. 保健品/药物分析
        var supplementAnalysis = buildSupplementAnalysis(profile, hp);

        // 6. 调养建议
        var regimenAdvice = buildRegimenAdvice(profile, hp, age);

        // 7. 健康目标进度
        var goalProgress = buildGoalProgress(profile, hp);

        // 8. 综合评分
        var overallScore = calculateOverallScore(riskAssessment, nutritionAnalysis, profileSummary);

        return {
            generatedAt: new Date().toISOString(),
            profileName: profile.name,
            overallScore: overallScore,
            sections: {
                profileSummary: profileSummary,
                riskAssessment: riskAssessment,
                nutritionAnalysis: nutritionAnalysis,
                symptomAnalysis: symptomAnalysis,
                supplementAnalysis: supplementAnalysis,
                regimenAdvice: regimenAdvice,
                goalProgress: goalProgress
            },
            // 关键行动项
            actionItems: extractActionItems(riskAssessment, nutritionAnalysis, supplementAnalysis, regimenAdvice)
        };
    }

    /**
     * 健康画像摘要
     */
    function buildProfileSummary(profile, hp, age) {
        var items = [];

        if (profile.gender) items.push('性别：' + profile.gender);
        if (age > 0) items.push('年龄：' + age + '岁');
        if (hp.constitution) items.push('体质：' + hp.constitution);
        if (hp.diet) items.push('饮食：' + hp.diet);
        if (hp.sleep) items.push('睡眠：' + hp.sleep);
        if (hp.exercise) items.push('运动：' + hp.exercise);

        // 健康画像完整性
        var completeness = null;
        if (typeof ArchiveEngine !== 'undefined' && ArchiveEngine.calculateHealthCompleteness) {
            completeness = ArchiveEngine.calculateHealthCompleteness(profile);
        }

        return {
            items: items,
            completeness: completeness,
            age: age,
            hasProfile: items.length > 0
        };
    }

    /**
     * 健康风险评估（综合版）
     */
    function buildRiskAssessment(profile, hp, age) {
        var riskResult = null;
        if (typeof ArchiveEngine !== 'undefined' && ArchiveEngine.assessHealthRisk) {
            riskResult = ArchiveEngine.assessHealthRisk(profile);
        }

        // 扩展：生活习惯风险评分
        var badHabits = [];
        if (hp.sleep === '失眠' || hp.sleep === '较差') badHabits.push('睡眠质量差');
        if (hp.exercise === '很少') badHabits.push('缺乏运动');
        if (hp.diet === '偏肉食') badHabits.push('饮食偏荤');
        if (hp.diet === '生酮/低碳水') badHabits.push('特殊饮食需关注');

        var riskFactors = [];
        if (age >= 65) riskFactors.push('年龄≥65岁，需重点关注骨骼和心血管');
        if (age >= 50) riskFactors.push('年龄≥50岁，建议定期体检');
        if (hp.symptoms && hp.symptoms.length >= 3) riskFactors.push('存在多项症状，建议综合检查');

        return {
            riskResult: riskResult,
            badHabits: badHabits,
            riskFactors: riskFactors,
            riskCount: badHabits.length + riskFactors.length
        };
    }

    /**
     * 营养素分析
     */
    function buildNutritionAnalysis(profile, hp) {
        var result = {
            deficiencyRisks: [],
            recommendations: [],
            interactions: []
        };

        if (typeof VitaminEngine === 'undefined') return result;

        // 检查是否有症状数据
        if (hp.symptoms && hp.symptoms.length > 0) {
            result.deficiencyRisks = VitaminEngine.assessAllDeficiencyRisks(profile) || [];
        }

        // 个性化推荐
        var recs = VitaminEngine.getPersonalizedRecommendations(profile);
        if (recs) {
            result.recommendations = recs.recommendations || [];
            result.interactions = recs.interactionWarnings || [];
        }

        return result;
    }

    /**
     * 症状分析
     */
    function buildSymptomAnalysis(profile, hp) {
        var symptoms = hp.symptoms || [];
        if (symptoms.length === 0) {
            return { hasSymptoms: false, count: 0, bodySystems: [], topSymptoms: [] };
        }

        var bodySystems = [];
        if (typeof VitaminEngine !== 'undefined' && VitaminEngine.getBodySystemsBySymptoms) {
            bodySystems = VitaminEngine.getBodySystemsBySymptoms(symptoms);
        }

        return {
            hasSymptoms: true,
            count: symptoms.length,
            symptoms: symptoms,
            bodySystems: bodySystems,
            topSymptoms: symptoms.slice(0, 5)
        };
    }

    /**
     * 保健品/药物分析
     */
    function buildSupplementAnalysis(profile, hp) {
        var supplements = hp.supplements || [];
        var medications = hp.medications || [];
        var ongoingMeds = medications.filter(function(m) { return m.status === 'ongoing'; });

        var interactions = [];
        if (typeof VitaminEngine !== 'undefined' && VitaminEngine.checkAllSupplementInteractions) {
            interactions = VitaminEngine.checkAllSupplementInteractions(supplements, medications) || [];
        }

        return {
            supplementCount: supplements.length,
            medicationCount: ongoingMeds.length,
            supplements: supplements,
            medications: ongoingMeds,
            interactions: interactions,
            hasInteractionWarnings: interactions.length > 0
        };
    }

    /**
     * 调养建议
     */
    function buildRegimenAdvice(profile, hp, age) {
        var advice = [];

        // 基于风险的通用建议
        if (hp.sleep === '失眠') {
            advice.push({ icon: '🌙', title: '改善睡眠', content: '建议建立规律作息，睡前避免使用电子设备，保持卧室温度适宜。可适量补充镁和B6帮助放松。' });
        } else if (hp.sleep === '较差') {
            advice.push({ icon: '🌙', title: '改善睡眠', content: '建议逐步改善睡眠质量，保持每日固定作息时间。' });
        }

        if (hp.exercise === '很少') {
            advice.push({ icon: '🏃', title: '增加运动', content: '建议每周至少进行3次30分钟以上有氧运动，如快走、慢跑、游泳等。' });
        }

        if (hp.diet === '偏肉食') {
            advice.push({ icon: '🥗', title: '调整饮食', content: '建议增加蔬菜水果摄入，补充维生素C和膳食纤维，促进肠道健康。' });
        } else if (hp.diet === '偏素食' || hp.diet === '素食') {
            advice.push({ icon: '🌱', title: '素食营养', content: '素食者需重点关注B12、铁、钙、锌、Omega-3的摄入，建议定期检测相关指标。' });
        }

        // 年龄相关建议
        if (age >= 65) {
            advice.push({ icon: '🦴', title: '骨骼健康', content: '建议定期检测骨密度，保持适量负重运动，确保钙和维生素D摄入充足。' });
        } else if (age >= 50) {
            advice.push({ icon: '💪', title: '中年养护', content: '建议每年体检，关注心血管健康和骨骼状态，适量补充钙和维生素D。' });
        }

        // 体质相关建议
        if (hp.constitution) {
            var constitutionTips = {
                '气虚质': { icon: '⚡', title: '气虚调养', content: '建议补气健脾，适合食用山药、黄芪、大枣等。避免过度劳累，适量运动。' },
                '阳虚质': { icon: '🔥', title: '阳虚调养', content: '建议温补肾阳，适合食用羊肉、韭菜、生姜等。注意保暖，避免生冷食物。' },
                '阴虚质': { icon: '💧', title: '阴虚调养', content: '建议滋阴润燥，适合食用银耳、百合、枸杞等。避免熬夜，减少辛辣食物。' },
                '痰湿质': { icon: '🌊', title: '痰湿调养', content: '建议健脾祛湿，适合食用薏米、冬瓜、赤小豆等。增加运动，控制饮食。' },
                '湿热质': { icon: '☀️', title: '湿热调养', content: '建议清热利湿，适合食用绿豆、苦瓜、黄瓜等。避免油腻和甜腻食物。' },
                '血瘀质': { icon: '🔄', title: '血瘀调养', content: '建议活血化瘀，适合食用山楂、红糖、黑木耳等。增加运动促进血液循环。' },
                '气郁质': { icon: '😊', title: '气郁调养', content: '建议疏肝理气，适合食用玫瑰花茶、柑橘类水果。保持心情愉悦，适度运动。' },
                '特禀质': { icon: '🛡️', title: '特禀调养', content: '建议增强免疫力，避免接触过敏原。适合食用黄芪、党参、红枣等。' },
                '平和质': { icon: '✅', title: '平和调养', content: '体质均衡，建议保持当前良好的生活习惯，饮食均衡，作息规律。' }
            };
            var tip = constitutionTips[hp.constitution];
            if (tip) advice.push(tip);
        }

        return advice;
    }

    /**
     * 健康目标进度
     */
    function buildGoalProgress(profile, hp) {
        var goals = hp.healthGoals || [];
        if (goals.length === 0) {
            return { hasGoals: false, goals: [], progress: null };
        }

        // 对每个目标，生成对应的营养素推荐和建议
        var goalDetails = goals.map(function(goal) {
            var related = getGoalRelatedInfo(goal);
            return {
                goal: goal,
                relatedNutrients: related.nutrients,
                tips: related.tips
            };
        });

        return {
            hasGoals: true,
            goals: goals,
            goalDetails: goalDetails,
            count: goals.length
        };
    }

    /**
     * 获取目标关联信息
     */
    function getGoalRelatedInfo(goal) {
        var g = goal.toLowerCase();
        var nutrients = [];
        var tips = [];

        if (g.indexOf('免疫力') >= 0 || g.indexOf('免疫') >= 0) {
            nutrients = ['维生素C', '维生素D', '锌', '硒'];
            tips = ['保证充足睡眠，避免熬夜', '适量运动增强免疫功能', '注意保暖，避免受凉'];
        } else if (g.indexOf('睡眠') >= 0) {
            nutrients = ['镁', '维生素B6', '钙'];
            tips = ['睡前1小时避免使用电子设备', '保持卧室温度适宜（18-22°C）', '建立规律的作息时间'];
        } else if (g.indexOf('减重') >= 0 || g.indexOf('减肥') >= 0 || g.indexOf('体重') >= 0) {
            nutrients = ['维生素B族', '辅酶Q10', '镁'];
            tips = ['控制总热量摄入', '增加蛋白质摄入，减少精制碳水', '每周至少3次有氧运动+2次力量训练'];
        } else if (g.indexOf('皮肤') >= 0) {
            nutrients = ['维生素C', '维生素E', '维生素A', '锌'];
            tips = ['注意防晒，适当使用抗氧化护肤品', '多喝水，保持皮肤水润', '避免过度清洁破坏皮肤屏障'];
        } else if (g.indexOf('骨骼') >= 0 || g.indexOf('骨') >= 0) {
            nutrients = ['钙', '维生素D', '镁', '维生素K2'];
            tips = ['适量负重运动（如快走、慢跑）', '多晒太阳促进维生素D合成', '避免碳酸饮料影响钙吸收'];
        } else if (g.indexOf('心血管') >= 0 || g.indexOf('心脏') >= 0 || g.indexOf('血压') >= 0) {
            nutrients = ['Omega-3', '辅酶Q10', '镁'];
            tips = ['控制盐分摄入', '保持适度运动', '定期监测血压和血脂'];
        } else if (g.indexOf('脱发') >= 0 || g.indexOf('头发') >= 0) {
            nutrients = ['铁', '锌', '维生素D', '生物素'];
            tips = ['避免过度烫染', '保持头皮清洁', '减少精神压力'];
        } else if (g.indexOf('精力') >= 0 || g.indexOf('疲劳') >= 0 || g.indexOf('体力') >= 0) {
            nutrients = ['B族维生素', '辅酶Q10', '铁', '镁'];
            tips = ['保证每晚7-8小时睡眠', '规律运动提升体能', '避免过度劳累'];
        } else {
            nutrients = ['均衡饮食，保持多样化营养摄入'];
            tips = ['保持健康的生活方式'];
        }

        return { nutrients: nutrients, tips: tips };
    }

    /**
     * 综合评分计算
     */
    function calculateOverallScore(riskAssessment, nutritionAnalysis, profileSummary) {
        var score = 100;

        // 扣分项：健康风险
        if (riskAssessment.riskResult && riskAssessment.riskResult.overallScore) {
            score = Math.round((score + riskAssessment.riskResult.overallScore) / 2);
        }

        // 扣分项：不良习惯
        score -= riskAssessment.badHabits.length * 5;

        // 加分项：健康画像完整性
        if (profileSummary.completeness && profileSummary.completeness.score >= 80) {
            score += 5;
        } else if (profileSummary.completeness && profileSummary.completeness.score < 30) {
            score -= 5;
        }

        // 扣分项：营养素缺乏风险
        if (nutritionAnalysis.deficiencyRisks) {
            var highRiskCount = nutritionAnalysis.deficiencyRisks.filter(function(r) {
                return r.risk && r.risk.level === 'high';
            }).length;
            score -= highRiskCount * 8;
        }

        // 扣分项：相互作用风险
        if (nutritionAnalysis.interactions) {
            var highInteractionCount = nutritionAnalysis.interactions.filter(function(i) {
                return i.severity === 'high';
            }).length;
            score -= highInteractionCount * 5;
        }

        // 限制在0-100
        score = Math.max(0, Math.min(100, score));

        var level = score >= 85 ? '优秀' : score >= 70 ? '良好' : score >= 55 ? '一般' : '需关注';

        return {
            score: score,
            level: level,
            levelIcon: score >= 85 ? '🌟' : score >= 70 ? '👍' : score >= 55 ? '⚠️' : '🔴'
        };
    }

    /**
     * 提取关键行动项
     */
    function extractActionItems(riskAssessment, nutritionAnalysis, supplementAnalysis, regimenAdvice) {
        var items = [];

        // 高风险行动项
        if (riskAssessment.riskResult && riskAssessment.riskResult.suggestions) {
            riskAssessment.riskResult.suggestions.forEach(function(s) {
                items.push({ priority: 'high', type: '健康风险', content: s });
            });
        }

        // 营养素缺乏风险
        if (nutritionAnalysis.deficiencyRisks) {
            nutritionAnalysis.deficiencyRisks.forEach(function(r) {
                if (r.risk && r.risk.level === 'high') {
                    items.push({ priority: 'high', type: '营养缺乏', content: r.nameCN + '：' + r.risk.advice });
                }
            });
        }

        // 相互作用警告
        if (supplementAnalysis.interactions) {
            supplementAnalysis.interactions.forEach(function(i) {
                items.push({
                    priority: i.severity === 'high' ? 'high' : 'medium',
                    type: '相互作用',
                    content: i.description + '。建议：' + i.advice
                });
            });
        }

        // 调养建议
        regimenAdvice.forEach(function(a) {
            items.push({ priority: 'medium', type: '调养建议', content: a.title + '：' + a.content });
        });

        // 限制最多显示10条
        return items.slice(0, 10);
    }

    // ========== 暴露到全局 ==========

    global.ReportEngine = {
        generateHealthReport: generateHealthReport
    };

    console.log('[岐黄阁] 健康综合报告引擎已加载');

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);