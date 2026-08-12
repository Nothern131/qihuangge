/**
 * 岐黄阁 · 辨证推理引擎
 * 八纲 + 六经 + 脏腑 三层辨证
 */
(function(global) {
    'use strict';

    // ========== 日志工具 ==========
    function log(tag, msg, data) {
        var ts = new Date().toLocaleTimeString();
        console.log('[岐黄阁][辨证引擎][' + tag + '][' + ts + '] ' + msg, data || '');
    }
    function logWarn(tag, msg, data) {
        var ts = new Date().toLocaleTimeString();
        console.warn('[岐黄阁][辨证引擎][WARN][' + ts + '] ' + msg, data || '');
    }

    /**
     * 主入口：辨证推理
     * @param {Object} params
     * @param {string[]} params.symptoms - 症状列表
     * @param {string} params.tongue - 舌象描述（可选）
     * @param {string} params.pulse - 脉象描述（可选）
     * @returns {Object} 辨证结果
     */
    function bianzheng(params) {
        var symptoms = (params && params.symptoms) || [];
        var tongue = (params && params.tongue) || '';
        var pulse = (params && params.pulse) || '';

        log('INPUT', '辨证推理启动', {
            symptoms: symptoms,
            symptomCount: symptoms.length,
            tongue: tongue || '(未提供)',
            pulse: pulse || '(未提供)'
        });

        if (symptoms.length === 0) {
            logWarn('INPUT', '未选择任何症状，将仅输出默认结论');
        }

        var result = {
            method: '辨证推理',
            timestamp: new Date().toISOString(),
            symptoms: symptoms,
            tongue: tongue,
            pulse: pulse,
            scores: {},
            biaogan: {},
            liujing: null,
            zangfu: null,
            final_syndrome: '',
            confidence: 0,
            zhize: ''
        };

        // 第一步：八纲辨证
        log('STEP1', '开始八纲辨证...');
        result.biaogan = _inferBiaogan(symptoms, tongue, pulse);
        log('STEP1', '八纲辨证完成', { biaogan: result.biaogan });

        // 第二步：六经辨证（如果八纲指向表里，则进一步判断六经）
        if (result.biaogan['表'] || result.biaogan['里']) {
            log('STEP2', '八纲指向表/里，开始六经辨证...');
            result.liujing = _inferLiujing(symptoms, result.biaogan);
            log('STEP2', '六经辨证完成', result.liujing);
        } else {
            log('STEP2', '八纲未指向表/里，跳过六经辨证');
        }

        // 第三步：脏腑辨证
        log('STEP3', '开始脏腑辨证...');
        result.zangfu = _inferZangfu(symptoms);
        log('STEP3', '脏腑辨证完成', result.zangfu);

        // 第四步：综合判断
        log('STEP4', '综合判断...');
        result.final_syndrome = _synthesizeSyndrome(result);
        result.confidence = _calcConfidence(result, symptoms);
        result.zhize = _calcZhize(result);
        log('STEP4', '综合判断完成', { final_syndrome: result.final_syndrome, confidence: result.confidence + '%', zhize: result.zhize });

        return result;
    }

    /**
     * 八纲辨证推理
     */
    function _inferBiaogan(symptoms, tongue, pulse) {
        var scores = {
            '表': 0, '里': 0, '寒': 0, '热': 0,
            '虚': 0, '实': 0, '阴': 0, '阳': 0
        };

        // 症状关键词匹配
        var symptomKeywords = {
            '表': ['恶寒', '发热', '脉浮', '头痛', '鼻塞', '咳嗽', '喷嚏'],
            '里': ['腹痛', '便秘', '尿赤', '内热', '口渴', '烦躁', '谵语'],
            '寒': ['畏寒', '肢冷', '口淡', '喜热饮', '小便清长', '大便溏薄', '舌淡苔白'],
            '热': ['发热', '口渴', '面红', '尿黄', '便秘', '舌红苔黄', '脉数'],
            '虚': ['神疲', '乏力', '气短', '懒言', '自汗', '盗汗', '舌淡'],
            '实': ['胀痛', '拒按', '声高气粗', '脉实', '舌苔厚腻'],
            '阴': ['畏寒', '肢冷', '面色苍白', '神疲', '脉沉迟'],
            '阳': ['发热', '面红', '烦躁', '口渴', '脉浮数']
        };

        // 舌象关键词
        var tongueKeywords = {
            '寒': ['舌淡白', '苔白'],
            '热': ['舌红', '苔黄'],
            '虚': ['舌淡', '舌体胖大', '苔少'],
            '实': ['舌苔厚腻', '舌质老']
        };

        // 脉象关键词
        var pulseKeywords = {
            '表': ['脉浮'],
            '里': ['脉沉'],
            '寒': ['脉迟', '脉紧'],
            '热': ['脉数', '脉洪'],
            '虚': ['脉虚', '脉细', '脉弱'],
            '实': ['脉实', '脉滑']
        };

        // 症状计分
        symptoms.forEach(function(s) {
            Object.keys(symptomKeywords).forEach(function(pattern) {
                symptomKeywords[pattern].forEach(function(kw) {
                    if (s.indexOf(kw) !== -1) scores[pattern] += 2;
                });
            });
        });

        // 舌象计分
        if (tongue) {
            log('TONGUE', '舌象已提供，开始舌象匹配', tongue);
            Object.keys(tongueKeywords).forEach(function(pattern) {
                tongueKeywords[pattern].forEach(function(kw) {
                    if (tongue.indexOf(kw) !== -1) {
                        scores[pattern] += 3;
                        log('TONGUE', '匹配到舌象关键词', { keyword: kw, pattern: pattern, newScore: scores[pattern] });
                    }
                });
            });
        } else {
            log('TONGUE', '舌象未提供，跳过舌象匹配');
        }

        // 脉象计分
        if (pulse) {
            log('PULSE', '脉象已提供，开始脉象匹配', pulse);
            Object.keys(pulseKeywords).forEach(function(pattern) {
                pulseKeywords[pattern].forEach(function(kw) {
                    if (pulse.indexOf(kw) !== -1) {
                        scores[pattern] += 3;
                        log('PULSE', '匹配到脉象关键词', { keyword: kw, pattern: pattern, newScore: scores[pattern] });
                    }
                });
            });
        } else {
            log('PULSE', '脉象未提供，跳过脉象匹配');
        }

        log('BIAOGAN_RESULT', '八纲辨证最终得分', scores);
        return scores;
    }

    /**
     * 六经辨证推理
     */
    function _inferLiujing(symptoms, biaogan) {
        log('LIUJING', '六经辨证开始', { symptoms: symptoms });
        var liujingKeywords = {
            '太阳': ['恶寒发热', '头项强痛', '脉浮', '无汗', '项背强几几'],
            '阳明': ['大热', '大渴', '大汗', '脉洪大', '便秘', '腹满痛'],
            '少阳': ['往来寒热', '胸胁苦满', '默默不欲饮食', '心烦喜呕'],
            '太阴': ['腹满而吐', '食不下', '自利益甚', '时腹自痛'],
            '少阴': ['脉微细', '但欲寐', '四肢厥冷', '下利清谷'],
            '厥阴': ['消渴', '气上撞心', '饥而不欲食', '食则吐蛔']
        };

        var scores = {};
        Object.keys(liujingKeywords).forEach(function(jing) {
            scores[jing] = 0;
            liujingKeywords[jing].forEach(function(kw) {
                symptoms.forEach(function(s) {
                    if (s.indexOf(kw) !== -1) {
                        scores[jing] += 3;
                        log('LIUJING', jing + '匹配到关键词', { keyword: kw, currentScore: scores[jing] });
                    }
                });
            });
        });

        // 返回最高分
        var max = 0, maxJing = null;
        Object.keys(scores).forEach(function(j) {
            log('LIUJING_SCORE', j + '得分', scores[j]);
            if (scores[j] > max) { max = scores[j]; maxJing = j; }
        });

        var finalResult = maxJing ? {jing: maxJing, score: max} : null;
        log('LIUJING', '六经辨证结果', finalResult);
        return finalResult;
    }

    /**
     * 脏腑辨证推理
     */
    function _inferZangfu(symptoms) {
        log('ZANGFU', '脏腑辨证开始', { symptoms: symptoms });
        var zangfuKeywords = {
            '肺': ['咳嗽', '气喘', '胸闷', '鼻塞', '流涕', '喷嚏', '声音嘶哑'],
            '心': ['心悸', '失眠', '健忘', '胸痛', '烦躁', '神昏', '谵语'],
            '脾': ['食少', '腹胀', '便溏', '乏力', '消瘦', '水肿', '出血'],
            '肝': ['胁痛', '情绪抑郁', '头痛眩晕', '月经不调', '抽搐', '黄疸'],
            '肾': ['腰膝酸软', '耳鸣', '尿频', '遗精', '月经不调', '发育迟缓']
        };

        var scores = {};
        Object.keys(zangfuKeywords).forEach(function(zang) {
            scores[zang] = 0;
            zangfuKeywords[zang].forEach(function(kw) {
                symptoms.forEach(function(s) {
                    if (s.indexOf(kw) !== -1) {
                        scores[zang] += 2;
                        log('ZANGFU', zang + '匹配到关键词', { keyword: kw, currentScore: scores[zang] });
                    }
                });
            });
        });

        // 返回高分的脏腑
        var result = [];
        Object.keys(scores).forEach(function(z) {
            log('ZANGFU_SCORE', z + '得分', scores[z]);
            if (scores[z] >= 3) result.push({zang: z, score: scores[z]});
        });
        result.sort(function(a, b) { return b.score - a.score; });
        log('ZANGFU', '脏腑辨证结果', result.length > 0 ? result : '无匹配脏腑');
        return result.slice(0, 2);
    }

    /**
     * 综合辨证结果
     */
    function _synthesizeSyndrome(result) {
        log('SYNTHESIZE', '综合判断开始', { biaogan: result.biaogan, liujing: result.liujing, zangfu: result.zangfu });
        var parts = [];

        // 八纲结论
        var ba = result.biaogan;
        var maxPatterns = [];
        var maxScore = 0;
        Object.keys(ba).forEach(function(k) {
            if (ba[k] > maxScore) maxScore = ba[k];
        });
        Object.keys(ba).forEach(function(k) {
            if (ba[k] >= maxScore * 0.6) maxPatterns.push(k);
        });
        if (maxPatterns.length > 0) {
            parts.push(maxPatterns.join(''));
            log('SYNTHESIZE', '八纲结论', { patterns: maxPatterns, maxScore: maxScore });
        }

        // 六经结论
        if (result.liujing) {
            parts.push(result.liujing.jing + '证');
            log('SYNTHESIZE', '六经结论', result.liujing);
        }

        // 脏腑结论
        if (result.zangfu && result.zangfu.length > 0) {
            parts.push(result.zangfu[0].zang + '病');
            log('SYNTHESIZE', '脏腑结论', result.zangfu[0]);
        }

        var finalResult = parts.length > 0 ? parts.join(' · ') : '待定';
        log('SYNTHESIZE', '综合判断完成', { finalSyndrome: finalResult });
        return finalResult;
    }

    /**
     * 计算置信度
     */
    function _calcConfidence(result, symptoms) {
        var totalSymptoms = symptoms.length;
        if (totalSymptoms === 0) {
            log('CONFIDENCE', '无症状，置信度为0');
            return 0;
        }

        var maxScore = 0;
        Object.keys(result.biaogan).forEach(function(k) {
            if (result.biaogan[k] > maxScore) maxScore = result.biaogan[k];
        });

        var confidence = Math.min(95, Math.round((maxScore / totalSymptoms) * 30));
        log('CONFIDENCE', '置信度计算', { maxScore: maxScore, symptomCount: totalSymptoms, confidence: confidence + '%' });
        return confidence;
    }

    function _calcZhize(result) {
        var zhize = '';
        var bg = result.biaogan || {};
        var jing = result.liujing || {};

        // 基于八纲生成治则
        if (bg['热'] && bg['里']) {
            zhize = '清热泻火，通腑泄热';
        } else if (bg['寒'] && bg['里']) {
            zhize = '温阳散寒，补火助阳';
        } else if (bg['热'] && bg['表']) {
            zhize = '疏风清热，解表透邪';
        } else if (bg['寒'] && bg['表']) {
            zhize = '辛温解表，发散风寒';
        } else if (bg['虚']) {
            zhize = '扶正补虚，益气养血';
        } else if (bg['实']) {
            zhize = '祛邪泻实，通腑导滞';
        }

        // 结合六经辨证细化
        if (jing.jing === '太阳') {
            zhize = (zhize ? zhize + '，' : '') + '解表散邪，调和营卫';
        } else if (jing.jing === '阳明') {
            zhize = (zhize ? zhize + '，' : '') + '清热生津，通腑泄热';
        } else if (jing.jing === '少阳') {
            zhize = (zhize ? zhize + '，' : '') + '和解少阳，疏利枢机';
        } else if (jing.jing === '太阴') {
            zhize = (zhize ? zhize + '，' : '') + '温中健脾，化湿和胃';
        } else if (jing.jing === '少阴') {
            zhize = (zhize ? zhize + '，' : '') + '温阳救逆，滋阴清热';
        } else if (jing.jing === '厥阴') {
            zhize = (zhize ? zhize + '，' : '') + '寒热并调，厥阴和解';
        }

        // 结合脏腑辨证细化
        if (result.zangfu && result.zangfu.length > 0) {
            var zang = result.zangfu[0].zang;
            if (zang === '肝') {
                zhize = (zhize ? zhize + '，' : '') + '疏肝理气，养血柔肝';
            } else if (zang === '脾') {
                zhize = (zhize ? zhize + '，' : '') + '健脾益气，化湿和中';
            } else if (zang === '肾') {
                zhize = (zhize ? zhize + '，' : '') + '补肾填精，滋阴温阳';
            } else if (zang === '心') {
                zhize = (zhize ? zhize + '，' : '') + '养心安神，清心泻火';
            } else if (zang === '肺') {
                zhize = (zhize ? zhize + '，' : '') + '宣肺益气，润肺止咳';
            }
        }

        if (!zhize) zhize = '辨证论治，随证加减';
        return zhize;
    }

    global.BianZhengEngine = {
        bianzheng: bianzheng
    };

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
