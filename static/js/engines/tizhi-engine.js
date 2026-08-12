/**
 * 岐黄阁 · 体质辨识引擎
 * 8题精准判别九种体质
 */
(function(global) {
    'use strict';

    function log(tag, msg, data) {
        var ts = new Date().toLocaleTimeString();
        console.log('[岐黄阁][体质引擎][' + tag + '][' + ts + '] ' + msg, data || '');
    }

    /**
     * 8道核心鉴别题
     * 每题措辞精准，避免模糊词，每题对应一个体质
     */
    var QUESTIONS = [
        { id: 'q1', text: '你是否经常感到疲乏无力、气短，稍微活动就喘？', type: '气虚质', key: 'qi' },
        { id: 'q2', text: '你是否特别怕冷，手脚常年冰凉，穿得比别人多？', type: '阳虚质', key: 'yang' },
        { id: 'q3', text: '你是否经常口干舌燥、手足心热，晚上睡不好？', type: '阴虚质', key: 'yin' },
        { id: 'q4', text: '你是否腹部肥胖、身体困重、脸上爱出油？', type: '痰湿质', key: 'tan' },
        { id: 'q5', text: '你是否容易长痘、口苦口臭、面部油腻？', type: '湿热质', key: 'shi' },
        { id: 'q6', text: '你是否肤色暗沉、容易有瘀斑、嘴唇颜色偏暗？', type: '血瘀质', key: 'xue' },
        { id: 'q7', text: '你是否经常心情低落、胸闷叹气、情绪波动大？', type: '气郁质', key: 'yu' },
        { id: 'q8', text: '你是否容易打喷嚏、皮肤起疹子、对季节变化敏感？', type: '特禀质', key: 'te' }
    ];

    /**
     * 体质判定
     * 8题独立计分，每题1-5分
     * 置信度 = (最高分占比 × 0.7 + 清晰度和 × 0.3) × 100
     */
    function identify(answers) {
        log('INPUT', '体质辨识开始', { keys: Object.keys(answers) });

        if (!answers || typeof answers !== 'object') {
            return { type: '待判定', confidence: 0, detail: '请提供问卷作答数据' };
        }

        // 初始化分数
        var scores = {
            '气虚质': 0, '阳虚质': 0, '阴虚质': 0, '痰湿质': 0,
            '湿热质': 0, '血瘀质': 0, '气郁质': 0, '特禀质': 0
        };

        var answeredCount = 0;
        var totalScore = 0;

        QUESTIONS.forEach(function(q) {
            var val = parseInt(answers[q.id]);
            if (isNaN(val) || val < 1) return;
            answeredCount++;
            scores[q.type] = (scores[q.type] || 0) + val;
            totalScore += val;
            log('SCORE', '计分', { q: q.id, val: val, type: q.type, score: scores[q.type] });
        });

        if (answeredCount === 0) {
            return { type: '待判定', confidence: 0, scores: scores, answeredCount: 0 };
        }

        log('SCORE', '计分完成', { answeredCount: answeredCount, scores: scores });

        // 找最高分体质
        var maxType = '气虚质', maxScore = 0;
        Object.keys(scores).forEach(function(t) {
            if (scores[t] > maxScore) { maxScore = scores[t]; maxType = t; }
        });

        // 置信度算法：
        // 1. 最高分占比 = maxScore / totalScore（最高体质占全部得分的比例）
        // 2. 答题完整度 = answeredCount / 8
        // 3. 综合 = 最高分占比 × 0.7 + 完整度 × 0.3
        var ratio = totalScore > 0 ? (maxScore / totalScore) : 0;
        var completeness = answeredCount / 8;
        var rawConfidence = Math.round((ratio * 0.7 + completeness * 0.3) * 100);
        var confidence = Math.min(Math.max(rawConfidence, 10), 95);

        log('RESULT', '体质判定', { type: maxType, maxScore: maxScore, confidence: confidence + '%', ratio: ratio.toFixed(2), answeredCount: answeredCount });

        return {
            type: maxType,
            confidence: confidence,
            scores: scores,
            answeredCount: answeredCount
        };
    }

    function getRegimen(type) {
        var plans = {
            '平和质': {
                description: '体态适中，面色红润，精力充沛，是理想体质。',
                diet: '饮食多样化，不偏嗜。',
                exercise: '保持适度运动，如散步、太极拳。',
                life: '作息规律，劳逸结合。'
            },
            '气虚质': {
                description: '容易疲劳，气短懒言，说话声音低弱，免疫力较弱。',
                diet: '多食补气食物：山药、红枣、黄芪、鸡肉、牛肉、糯米。',
                exercise: '适度运动，避免大汗，推荐八段锦、太极拳。',
                life: '避免过度劳累，保证充足睡眠。'
            },
            '阳虚质': {
                description: '畏寒肢冷，手脚冰凉，喜热饮，不耐寒凉。',
                diet: '多食温热食物：羊肉、牛肉、韭菜、生姜、桂圆、核桃。',
                exercise: '选择温和运动，如散步、太极拳，避免晨练。',
                life: '注意保暖，尤其是腰腹和下肢。'
            },
            '阴虚质': {
                description: '口燥咽干，手足心热，易失眠，皮肤干燥。',
                diet: '多食滋阴食物：银耳、百合、枸杞、鸭肉、桑葚、石斛。',
                exercise: '避免剧烈运动，推荐瑜伽、太极拳。',
                life: '避免熬夜，保持情绪稳定。'
            },
            '痰湿质': {
                description: '腹部肥满，容易困倦，面部皮肤油脂较多。',
                diet: '多食健脾利湿食物：薏米、冬瓜、萝卜、陈皮、赤小豆。',
                exercise: '坚持有氧运动，促进代谢，如快走、游泳。',
                life: '避免久坐，保持室内干燥通风。'
            },
            '湿热质': {
                description: '面垢油光，易生痤疮，口苦口干，大便黏滞。',
                diet: '多食清热利湿食物：绿豆、苦瓜、冬瓜、芹菜、芹菜。',
                exercise: '选择中等强度运动，及时补充水分。',
                life: '保持皮肤清洁，避免辛辣刺激食物。'
            },
            '血瘀质': {
                description: '肤色晦暗，易有瘀斑，唇色偏暗，易痛经。',
                diet: '多食活血化瘀食物：山楂、黑木耳、洋葱、玫瑰花茶。',
                exercise: '选择促进血液循环的运动，如散步、太极拳。',
                life: '注意保暖，避免寒凝血脉。'
            },
            '气郁质': {
                description: '忧郁敏感，胸胁胀满，情绪低落，善太息。',
                diet: '多食行气解郁食物：玫瑰花茶、陈皮、柑橘、葱蒜。',
                exercise: '选择户外运动，如登山、跑步，增进社交。',
                life: '多参与社交活动，保持心情舒畅。'
            },
            '特禀质': {
                description: '过敏体质，易打喷嚏，皮肤易起风团，易脱发。',
                diet: '饮食清淡，避免过敏原，多食益气固表食物。',
                exercise: '适度运动增强体质，避免花粉密集环境。',
                life: '保持室内清洁，避免接触过敏原。'
            }
        };
        return plans[type] || plans['气虚质'];
    }

    function getQuestions() {
        return QUESTIONS;
    }

    global.TizhiEngine = {
        identify: identify,
        getRegimen: getRegimen,
        getQuestions: getQuestions
    };

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
