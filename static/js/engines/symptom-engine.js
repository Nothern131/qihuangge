/**
 * 岐黄阁 · 症状记录引擎
 * 记录每日症状、睡眠、饮食、情绪、运动等调养数据
 * 全部使用 localStorage 本地存储，无外部 API
 */
(function(global) {
    'use strict';

    var SYMPTOM_LIST = [
        '乏力', '畏寒', '口渴', '盗汗', '自汗', '头晕', '头痛',
        '心悸', '失眠', '健忘', '烦躁', '情绪低落',
        '食少', '腹胀', '便溏', '便秘', '恶心',
        '咳嗽', '气喘', '胸闷', '咽痛', '鼻塞',
        '腰膝酸软', '耳鸣', '尿频',
        '皮疹', '瘙痒', '关节痛', '肢体麻木'
    ];

    var SLEEP_OPTIONS = ['不足5小时', '5-6小时', '6-7小时', '7-8小时', '8小时以上'];
    var MOOD_OPTIONS = ['舒畅', '平稳', '轻度焦虑', '中度焦虑', '轻度抑郁', '中度抑郁', '烦躁易怒'];
    var DIET_OPTIONS = ['正常', '食欲减退', '口渴喜饮', '口淡无味', '恶心厌食'];
    var EXERCISE_OPTIONS = ['无', '轻度散步', '中等运动', '剧烈运动'];

    function getStorageKey() {
        return 'qihuangge_symptoms';
    }

    function loadData() {
        var raw = localStorage.getItem(getStorageKey());
        if (!raw) return { records: [], meta: { lastTizhi: null, lastBianzheng: null } };
        try { return JSON.parse(raw); } catch(e) { return { records: [], meta: {} }; }
    }

    function saveData(data) {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
    }

    function genId() {
        var c = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var r = '';
        for (var i = 0; i < 12; i++) r += c[Math.floor(Math.random() * c.length)];
        return r;
    }

    function now() {
        return new Date().toISOString();
    }

    /**
     * 记录当日症状
     */
    function addRecord(profileId, symptoms, sleep, mood, diet, exercise, notes) {
        var data = loadData();
        var record = {
            id: genId(),
            profileId: profileId,
            date: new Date().toISOString().split('T')[0],
            timestamp: now(),
            symptoms: symptoms || [],
            sleep: sleep || '未记录',
            mood: mood || '未记录',
            diet: diet || '未记录',
            exercise: exercise || '未记录',
            notes: notes || ''
        };
        data.records.unshift(record);
        // 最多保留 365 条记录
        if (data.records.length > 365) data.records = data.records.slice(0, 365);
        saveData(data);
        return record;
    }

    /**
     * 查询某天的记录
     */
    function getRecordByDate(profileId, dateStr) {
        var data = loadData();
        var rec = data.records.find(function(r) {
            return r.profileId === profileId && r.date === dateStr;
        });
        return rec || null;
    }

    /**
     * 查询某用户最近 N 天记录
     */
    function getRecentRecords(profileId, days) {
        days = days || 30;
        var data = loadData();
        return data.records.filter(function(r) {
            return r.profileId === profileId;
        }).slice(0, days);
    }

    /**
     * 分析症状趋势（最近30天）
     */
    function analyzeTrend(profileId, days) {
        days = days || 30;
        var records = getRecentRecords(profileId, days);
        if (records.length === 0) return null;

        var symptomCount = {};
        records.forEach(function(r) {
            (r.symptoms || []).forEach(function(s) {
                symptomCount[s] = (symptomCount[s] || 0) + 1;
            });
        });

        // 找出高频症状（出现超过30%天数的）
        var frequentSymptoms = Object.keys(symptomCount)
            .filter(function(s) { return symptomCount[s] >= Math.ceil(records.length * 0.3); })
            .sort(function(a, b) { return symptomCount[b] - symptomCount[a]; });

        // 睡眠评分（1-5分，8小时以上最好）
        var sleepScore = 0;
        records.forEach(function(r) {
            if (r.sleep === '8小时以上') sleepScore += 5;
            else if (r.sleep === '7-8小时') sleepScore += 4;
            else if (r.sleep === '6-7小时') sleepScore += 3;
            else if (r.sleep === '5-6小时') sleepScore += 2;
            else sleepScore += 1;
        });
        sleepScore = Math.round(sleepScore / records.length);

        // 情绪评分（1-5分，舒畅最好）
        var moodScore = 0;
        records.forEach(function(r) {
            if (r.mood === '舒畅') moodScore += 5;
            else if (r.mood === '平稳') moodScore += 4;
            else if (r.mood === '轻度焦虑' || r.mood === '轻度抑郁') moodScore += 3;
            else if (r.mood === '中度焦虑' || r.mood === '中度抑郁') moodScore += 2;
            else moodScore += 1;
        });
        moodScore = Math.round(moodScore / records.length);

        return {
            days: records.length,
            frequentSymptoms: frequentSymptoms,
            symptomCount: symptomCount,
            sleepScore: sleepScore,
            moodScore: moodScore,
            avgSleep: records.map(function(r) { return r.sleep; }).join('、'),
            avgMood: records.map(function(r) { return r.mood; }).join('、')
        };
    }

    /**
     * 基于体质和症状生成调养建议
     */
    function generateAdvice(profileId, tizhi) {
        var trend = analyzeTrend(profileId, 14);
        if (!trend) return { msg: '暂无足够数据生成建议，请记录至少14天症状' };

        var advice = { sleep: '', mood: '', diet: '', exercise: '' };

        // 睡眠建议
        if (trend.sleepScore <= 2) {
            advice.sleep = '睡眠不足，建议调整作息，睡前避免使用电子设备，可尝试艾叶泡脚助眠';
        } else if (trend.sleepScore <= 3) {
            advice.sleep = '睡眠偏少，建议保持规律作息，晚间10点前入睡';
        } else {
            advice.sleep = '睡眠状况良好，保持现有作息习惯';
        }

        // 情绪建议
        if (trend.moodScore <= 2) {
            advice.mood = '情绪波动较大，建议适度运动、深呼吸放松，可饮用玫瑰花茶疏肝解郁';
        } else if (trend.moodScore <= 3) {
            advice.mood = '情绪略有波动，建议增加户外活动，保持心情舒畅';
        } else {
            advice.mood = '情绪平稳，继续保持良好的心理状态';
        }

        // 饮食建议（基于体质）
        var tizhiDiet = {
            '气虚质': '宜食山药、红枣、黄芪煲汤，忌生冷寒凉',
            '阳虚质': '宜食羊肉、生姜、桂圆，忌冷饮寒食',
            '阴虚质': '宜食银耳、百合、枸杞，忌辛辣燥热',
            '痰湿质': '宜食薏米、冬瓜、陈皮，忌油腻甜食',
            '湿热质': '宜食绿豆、苦瓜、赤小豆，忌辛辣油腻',
            '血瘀质': '宜食山楂、黑木耳、玫瑰花茶',
            '气郁质': '宜食玫瑰花茶、陈皮、柑橘类',
            '特禀质': '宜食黄芪、防风，避免已知过敏原',
            '平和质': '饮食均衡，不过偏颇'
        };
        advice.diet = tizhiDiet[tizhi] || '饮食清淡均衡，少吃辛辣油腻';

        // 运动建议
        if (trend.frequentSymptoms.indexOf('乏力') >= 0) {
            advice.exercise = '乏力明显，建议轻度运动如散步、太极，避免过度劳累';
        } else if (trend.frequentSymptoms.indexOf('情绪低落') >= 0) {
            advice.exercise = '情绪低落，建议户外活动、瑜伽、八段锦等舒缓运动';
        } else {
            advice.exercise = '建议每日适度运动30分钟，如散步、八段锦、太极拳';
        }

        // 重点症状提醒
        if (trend.frequentSymptoms.length > 0) {
            advice.symptoms = '近期高频症状：' + trend.frequentSymptoms.slice(0, 3).join('、') + '，建议关注';
        }

        return advice;
    }

    /**
     * 获取统计概览
     */
    function getSummary(profileId) {
        var records = getRecentRecords(profileId, 7);
        if (records.length === 0) return { days: 0, records: [] };

        var today = records.find(function(r) { return r.date === new Date().toISOString().split('T')[0]; });
        var symptoms = [];
        var sleepScores = [];
        var moodScores = [];

        records.forEach(function(r) {
            symptoms = symptoms.concat(r.symptoms || []);
            if (r.sleep === '8小时以上' || r.sleep === '7-8小时') sleepScores.push(1);
            else sleepScores.push(0);
            if (r.mood === '舒畅' || r.mood === '平稳') moodScores.push(1);
            else moodScores.push(0);
        });

        var topSymptoms = {};
        symptoms.forEach(function(s) { topSymptoms[s] = (topSymptoms[s] || 0) + 1; });
        var topS = Object.keys(topSymptoms).sort(function(a, b) { return topSymptoms[b] - topSymptoms[a]; }).slice(0, 3);

        return {
            days: records.length,
            today: today || null,
            topSymptoms: topS,
            sleepRate: Math.round(sleepScores.filter(function(s) { return s === 1; }).length / records.length * 100),
            moodRate: Math.round(moodScores.filter(function(s) { return s === 1; }).length / records.length * 100)
        };
    }

    /**
     * 删除记录
     */
    function deleteRecord(recordId) {
        var data = loadData();
        data.records = data.records.filter(function(r) { return r.id !== recordId; });
        saveData(data);
    }

    /**
     * 更新备注
     */
    function updateNote(recordId, notes) {
        var data = loadData();
        var rec = data.records.find(function(r) { return r.id === recordId; });
        if (rec) { rec.notes = notes; saveData(data); }
    }

    // 暴露到全局
    global.SymptomEngine = {
        SYMPTOM_LIST: SYMPTOM_LIST,
        SLEEP_OPTIONS: SLEEP_OPTIONS,
        MOOD_OPTIONS: MOOD_OPTIONS,
        DIET_OPTIONS: DIET_OPTIONS,
        EXERCISE_OPTIONS: EXERCISE_OPTIONS,
        addRecord: addRecord,
        getRecordByDate: getRecordByDate,
        getRecentRecords: getRecentRecords,
        analyzeTrend: analyzeTrend,
        generateAdvice: generateAdvice,
        getSummary: getSummary,
        deleteRecord: deleteRecord,
        updateNote: updateNote
    };

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
