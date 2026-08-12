/**
 * 岐黄阁 · 用户档案存储引擎
 * 支持多用户隔离存储 + 体验链接自动加载
 * 每个用户通过 uid 参数隔离数据，体验链接可携带完整存档数据
 */
(function(global) {
    'use strict';

    var STORAGE_KEY = 'qhh_archive_v1';
    var PROFILE_KEY = 'qhh_current_profile';
    var UID_PARAM = 'uid';
    var DATA_PARAM = 'data';

    function _genId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    function _now() {
        return new Date().toISOString();
    }

    // ========== URL 参数解析 ==========
    function _getUidFromUrl() {
        var params = new URLSearchParams(window.location.search);
        return params.get(UID_PARAM) || null;
    }

    function _getDataFromUrl() {
        var params = new URLSearchParams(window.location.search);
        var raw = params.get(DATA_PARAM);
        if (!raw) return null;
        try {
            return JSON.parse(decodeURIComponent(raw));
        } catch(e) {
            return null;
        }
    }

    function _getUrlData() {
        var params = new URLSearchParams(window.location.search);
        return {
            uid: params.get(UID_PARAM) || null,
            data: _getDataFromUrl()
        };
    }

    // ========== 存储隔离（按 uid）==========
    function _userKey() {
        var uid = _getUidFromUrl();
        if (uid) {
            return STORAGE_KEY + '_' + uid;
        }
        return STORAGE_KEY;
    }

    function _load() {
        try {
            var raw = localStorage.getItem(_userKey());
            return raw ? JSON.parse(raw) : { profiles: [], records: [] };
        } catch(e) {
            return { profiles: [], records: [] };
        }
    }

    function _save(data) {
        localStorage.setItem(_userKey(), JSON.stringify(data));
    }

    // ========== 体验链接数据注入 ==========
    function _applyUrlData() {
        var uid = _getUidFromUrl();
        if (!uid) return false;

        var urlData = _getDataFromUrl();
        if (!urlData) return false;

        // 检查是否已有该 uid 的数据
        var existing = _load();
        var hasUidProfile = existing.profiles.some(function(p) { return p.uid === uid; });

        if (!hasUidProfile && urlData.profiles) {
            // 注入体验数据
            existing.profiles = (urlData.profiles || []).map(function(p) {
                return Object.assign({}, p, { uid: uid });
            });
            existing.records = (urlData.records || []).map(function(r) {
                return Object.assign({}, r);
            });
            _save(existing);
            return true;
        }
        return false;
    }

    // ========== 生成分享链接 ==========
    function generateShareLink(profileId) {
        var data = _load();
        var profile = data.profiles.find(function(p) { return p.id === profileId; });
        if (!profile) return null;

        var uid = profile.uid || _genId();
        var records = data.records.filter(function(r) { return r.profileId === profileId; });

        var shareData = {
            uid: uid,
            profiles: [profile],
            records: records
        };

        var encoded = encodeURIComponent(JSON.stringify(shareData));
        var baseUrl = window.location.origin + window.location.pathname;
        return baseUrl + '?uid=' + encodeURIComponent(uid) + '&' + DATA_PARAM + '=' + encoded;
    }

    // 生成体验链接（带链接预览）
    function generateExperienceLink(profileId) {
        return generateShareLink(profileId);
    }

    // ========== 档案 CRUD ==========
    function listProfiles() {
        return _load().profiles.sort(function(a, b) { return b.updatedAt - a.updatedAt; });
    }

    function getProfile(id) {
        var data = _load();
        return data.profiles.find(function(p) { return p.id === id; }) || null;
    }

    function createProfile(info) {
        var data = _load();
        var now = _now();
        var profile = {
            id: _genId(),
            name: info.name || 'unnamed',
            gender: info.gender || '',
            birthYear: info.birthYear || '',
            notes: info.notes || '',
            uid: _getUidFromUrl() || null,
            // 健康画像
            healthProfile: {
                constitution: info.constitution || '',        // 体质类型
                symptoms: info.symptoms || [],                // 当前症状
                supplements: info.supplements || [],          // 正在服用的保健品 [{name, brand, dosage, frequency, startDate}]
                medications: info.medications || [],          // 用药史 [{name, dosage, reason, status:'ongoing'|'stopped'}]
                healthGoals: info.healthGoals || [],          // 健康目标
                diet: info.diet || '',                        // 饮食习惯
                sleep: info.sleep || '',                      // 睡眠情况
                exercise: info.exercise || ''                 // 运动情况
            },
            createdAt: now,
            updatedAt: now
        };
        data.profiles.push(profile);
        _save(data);
        return profile;
    }

    function updateProfile(id, info) {
        var data = _load();
        var idx = data.profiles.findIndex(function(p) { return p.id === id; });
        if (idx === -1) return null;
        var p = data.profiles[idx];
        if (info.name !== undefined) p.name = info.name;
        if (info.gender !== undefined) p.gender = info.gender;
        if (info.birthYear !== undefined) p.birthYear = info.birthYear;
        if (info.notes !== undefined) p.notes = info.notes;
        // 健康画像更新
        if (info.healthProfile !== undefined) {
            if (!p.healthProfile) p.healthProfile = {};
            if (info.healthProfile.constitution !== undefined) p.healthProfile.constitution = info.healthProfile.constitution;
            if (info.healthProfile.symptoms !== undefined) p.healthProfile.symptoms = info.healthProfile.symptoms;
            if (info.healthProfile.supplements !== undefined) p.healthProfile.supplements = info.healthProfile.supplements;
            if (info.healthProfile.medications !== undefined) p.healthProfile.medications = info.healthProfile.medications;
            if (info.healthProfile.healthGoals !== undefined) p.healthProfile.healthGoals = info.healthProfile.healthGoals;
            if (info.healthProfile.diet !== undefined) p.healthProfile.diet = info.healthProfile.diet;
            if (info.healthProfile.sleep !== undefined) p.healthProfile.sleep = info.healthProfile.sleep;
            if (info.healthProfile.exercise !== undefined) p.healthProfile.exercise = info.healthProfile.exercise;
        }
        p.updatedAt = _now();
        _save(data);
        return p;
    }

    function deleteProfile(id) {
        var data = _load();
        data.profiles = data.profiles.filter(function(p) { return p.id !== id; });
        data.records = data.records.filter(function(r) { return r.profileId !== id; });
        _save(data);
        var curId = localStorage.getItem(PROFILE_KEY);
        if (curId === id) {
            localStorage.removeItem(PROFILE_KEY);
        }
    }

    // ========== 健康记录 CRUD ==========
    function listRecords(profileId) {
        return _load().records
            .filter(function(r) { return r.profileId === profileId; })
            .sort(function(a, b) { return b.timestamp - a.timestamp; });
    }

    function getRecord(id) {
        return _load().records.find(function(r) { return r.id === id; }) || null;
    }

    function addRecord(profileId, type, title, data) {
        var full = _load();
        var rec = {
            id: _genId(),
            profileId: profileId,
            type: type,
            title: title,
            timestamp: _now(),
            data: data
        };
        full.records.push(rec);
        _save(full);
        return rec;
    }

    function deleteRecord(id) {
        var data = _load();
        data.records = data.records.filter(function(r) { return r.id !== id; });
        _save(data);
    }

    // ========== 趋势分析 ==========
    function getTrend(profileId, type) {
        var records = listRecords(profileId).filter(function(r) { return r.type === type; });
        if (records.length === 0) return null;

        var trend = {
            type: type,
            count: records.length,
            items: records.map(function(r) {
                return {
                    timestamp: r.timestamp,
                    title: r.title,
                    data: r.data
                };
            })
        };

        if (type === 'bianzheng' || type === 'tizhi') {
            trend.summary = {
                last: trend.items[0],
                first: trend.items[trend.items.length - 1],
                changeCount: Math.abs(new Date(trend.items[0].timestamp) - new Date(trend.items[trend.items.length - 1].timestamp))
            };
        }

        return trend;
    }

    // ========== 当前用户 ==========
    function setCurrentProfileId(id) {
        if (id) {
            localStorage.setItem(PROFILE_KEY, id);
        } else {
            localStorage.removeItem(PROFILE_KEY);
        }
    }

    function getCurrentProfileId() {
        return localStorage.getItem(PROFILE_KEY) || null;
    }

    function getCurrentProfile() {
        var id = getCurrentProfileId();
        return id ? getProfile(id) : null;
    }

    // ========== 自动归档 ==========
    function autoArchive(profileId, type, title, result) {
        if (!profileId) return null;
        return addRecord(profileId, type, title, result);
    }

    // ========== 健康画像管理 ==========

    /**
     * 更新健康画像（独立更新，不影响其他字段）
     */
    function updateHealthProfile(profileId, healthData) {
        return updateProfile(profileId, { healthProfile: healthData });
    }

    /**
     * 添加保健品记录
     */
    function addSupplement(profileId, supplement) {
        var p = getProfile(profileId);
        if (!p) return null;
        if (!p.healthProfile) p.healthProfile = {};
        if (!p.healthProfile.supplements) p.healthProfile.supplements = [];
        supplement.id = _genId();
        supplement.createdAt = _now();
        p.healthProfile.supplements.push(supplement);
        return updateProfile(profileId, { healthProfile: p.healthProfile });
    }

    /**
     * 删除保健品记录
     */
    function removeSupplement(profileId, supplementId) {
        var p = getProfile(profileId);
        if (!p || !p.healthProfile) return null;
        p.healthProfile.supplements = (p.healthProfile.supplements || []).filter(function(s) {
            return s.id !== supplementId;
        });
        return updateProfile(profileId, { healthProfile: p.healthProfile });
    }

    // ========== 健康风险评估 ==========

    /**
     * 计算健康画像完整性评分
     * @param {object} profile - 用户档案
     * @returns {object} { score, total, items, completeness }
     */
    function calculateHealthCompleteness(profile) {
        if (!profile) return { score: 0, total: 9, items: [], completeness: '0%' };

        var hp = profile.healthProfile || {};
        var items = [
            { key: 'name', label: '姓名', filled: !!profile.name, weight: 1 },
            { key: 'gender', label: '性别', filled: !!profile.gender, weight: 1 },
            { key: 'birthYear', label: '出生年份', filled: !!profile.birthYear, weight: 1 },
            { key: 'constitution', label: '中医体质', filled: !!hp.constitution, weight: 2 },
            { key: 'symptoms', label: '当前症状', filled: hp.symptoms && hp.symptoms.length > 0, weight: 2 },
            { key: 'supplements', label: '保健品记录', filled: hp.supplements && hp.supplements.length > 0, weight: 2 },
            { key: 'medications', label: '用药史', filled: hp.medications && hp.medications.length > 0, weight: 2 },
            { key: 'healthGoals', label: '健康目标', filled: hp.healthGoals && hp.healthGoals.length > 0, weight: 2 },
            { key: 'diet', label: '饮食/睡眠/运动', filled: !!(hp.diet || hp.sleep || hp.exercise), weight: 1 }
        ];

        var totalWeight = 0;
        var filledWeight = 0;
        items.forEach(function(item) {
            totalWeight += item.weight;
            if (item.filled) filledWeight += item.weight;
        });

        var score = Math.round((filledWeight / totalWeight) * 100);
        var completeness = score >= 80 ? '高' : score >= 50 ? '中' : '低';

        return {
            score: score,
            total: totalWeight,
            filled: filledWeight,
            items: items,
            completeness: completeness
        };
    }

    /**
     * 健康风险评估
     * 基于健康画像各维度给出风险评分
     * @param {object} profile - 用户档案
     * @returns {object} { overallScore, riskLevel, dimensions, suggestions }
     */
    function assessHealthRisk(profile) {
        if (!profile) return { overallScore: 0, riskLevel: '未知', dimensions: [], suggestions: [] };

        var hp = profile.healthProfile || {};
        var age = profile.birthYear ? new Date().getFullYear() - parseInt(profile.birthYear) : 0;
        var dimensions = [];
        var suggestions = [];

        // 1. 睡眠风险
        var sleepScore = 100;
        var sleepRisk = '';
        if (hp.sleep === '失眠') { sleepScore = 30; sleepRisk = '严重失眠，对健康影响大'; suggestions.push('建议改善睡眠质量，可考虑补充镁和B6'); }
        else if (hp.sleep === '较差') { sleepScore = 50; sleepRisk = '睡眠质量差，长期需关注'; suggestions.push('建议改善睡眠环境，增加规律作息'); }
        else if (hp.sleep === '一般') { sleepScore = 70; sleepRisk = '睡眠一般，有改善空间'; }
        else if (hp.sleep === '良好') { sleepScore = 90; sleepRisk = '睡眠良好'; }
        dimensions.push({ name: '睡眠质量', score: sleepScore, risk: sleepRisk, level: sleepScore >= 80 ? 'good' : sleepScore >= 60 ? 'medium' : 'bad' });

        // 2. 运动风险
        var exerciseScore = 100;
        var exerciseRisk = '';
        if (hp.exercise === '很少') { exerciseScore = 40; exerciseRisk = '久坐少动，心血管风险增加'; suggestions.push('建议每周至少进行3次30分钟以上有氧运动'); }
        else if (hp.exercise === '偶尔') { exerciseScore = 65; exerciseRisk = '运动量不足，建议增加频率'; suggestions.push('建议将运动频率提升至每周3次以上'); }
        else if (hp.exercise === '经常') { exerciseScore = 90; exerciseRisk = '运动习惯良好'; }
        dimensions.push({ name: '运动习惯', score: exerciseScore, risk: exerciseRisk, level: exerciseScore >= 80 ? 'good' : exerciseScore >= 60 ? 'medium' : 'bad' });

        // 3. 饮食风险
        var dietScore = 100;
        var dietRisk = '';
        if (hp.diet === '生酮/低碳水') { dietScore = 60; dietRisk = '特殊饮食，需关注营养均衡'; suggestions.push('生酮/低碳水饮食建议补充B族维生素和镁'); }
        else if (hp.diet === '偏肉食') { dietScore = 65; dietRisk = '肉食偏多，蔬果纤维不足'; suggestions.push('建议增加蔬菜水果摄入，补充维生素C和膳食纤维'); }
        else if (hp.diet === '偏素食' || hp.diet === '素食') { dietScore = 70; dietRisk = '素食者需关注B12、铁、钙、锌'; suggestions.push('素食者建议定期检测B12、铁蛋白水平，必要时补充'); }
        else if (hp.diet === '荤素均衡') { dietScore = 90; dietRisk = '饮食结构均衡'; }
        dimensions.push({ name: '饮食结构', score: dietScore, risk: dietRisk, level: dietScore >= 80 ? 'good' : dietScore >= 60 ? 'medium' : 'bad' });

        // 4. 症状风险（症状越多风险越高）
        var symptomCount = (hp.symptoms || []).length;
        var symptomScore = Math.max(100 - symptomCount * 15, 20);
        var symptomRisk = symptomCount === 0 ? '无明显症状' : '存在 ' + symptomCount + ' 项症状，建议关注';
        if (symptomCount >= 3) suggestions.push('您有 ' + symptomCount + ' 项症状，建议综合分析可能的营养缺乏');
        dimensions.push({ name: '症状状况', score: symptomScore, risk: symptomRisk, level: symptomScore >= 80 ? 'good' : symptomScore >= 60 ? 'medium' : 'bad' });

        // 5. 年龄风险
        var ageScore = 100;
        var ageRisk = '';
        if (age >= 65) { ageScore = 50; ageRisk = '老年阶段，需重点关注骨骼、心血管'; suggestions.push('65岁以上建议定期检测维生素D、B12水平'); }
        else if (age >= 50) { ageScore = 70; ageRisk = '中年阶段，代谢开始变化'; suggestions.push('50岁以上建议关注骨骼健康和心血管养护'); }
        else if (age >= 35) { ageScore = 85; ageRisk = '青壮年阶段，维持健康状态'; }
        dimensions.push({ name: '年龄因素', score: ageScore, risk: ageRisk, level: ageScore >= 80 ? 'good' : ageScore >= 60 ? 'medium' : 'bad' });

        // 总体评分
        var overallScore = Math.round(dimensions.reduce(function(sum, d) { return sum + d.score; }, 0) / dimensions.length);
        var riskLevel = overallScore >= 85 ? '低风险' : overallScore >= 65 ? '中风险' : '高风险';

        // 去重建议
        var uniqueSuggestions = [];
        suggestions.forEach(function(s) {
            if (uniqueSuggestions.indexOf(s) < 0) uniqueSuggestions.push(s);
        });

        return {
            overallScore: overallScore,
            riskLevel: riskLevel,
            dimensions: dimensions,
            suggestions: uniqueSuggestions
        };
    }

    /**
     * 添加过敏/不耐受记录
     */
    var ALLERGY_STORAGE_KEY = 'qhh_allergies_v1';

    function getAllergies(profileId) {
        try {
            var raw = localStorage.getItem(ALLERGY_STORAGE_KEY + '_' + profileId);
            return raw ? JSON.parse(raw) : [];
        } catch(e) { return []; }
    }

    function addAllergy(profileId, allergy) {
        var list = getAllergies(profileId);
        allergy.id = _genId();
        allergy.createdAt = _now();
        list.push(allergy);
        localStorage.setItem(ALLERGY_STORAGE_KEY + '_' + profileId, JSON.stringify(list));
        return allergy;
    }

    function removeAllergy(profileId, allergyId) {
        var list = getAllergies(profileId).filter(function(a) { return a.id !== allergyId; });
        localStorage.setItem(ALLERGY_STORAGE_KEY + '_' + profileId, JSON.stringify(list));
    }

    // ========== 初始化 ==========
    function init() {
        _applyUrlData();
        var urlInfo = _getUrlData();
        if (urlInfo.uid) {
            // 体验链接模式：自动选中该 uid 下的第一个档案
            var profiles = listProfiles();
            var profile = profiles.find(function(p) { return p.uid === urlInfo.uid; });
            if (profile) {
                setCurrentProfileId(profile.id);
                return profile.id;
            }
        }
        return null;
    }

    global.ArchiveEngine = {
        listProfiles: listProfiles,
        getProfile: getProfile,
        createProfile: createProfile,
        updateProfile: updateProfile,
        deleteProfile: deleteProfile,
        listRecords: listRecords,
        getRecord: getRecord,
        addRecord: addRecord,
        deleteRecord: deleteRecord,
        getTrend: getTrend,
        setCurrentProfileId: setCurrentProfileId,
        getCurrentProfileId: getCurrentProfileId,
        getCurrentProfile: getCurrentProfile,
        autoArchive: autoArchive,
        generateShareLink: generateShareLink,
        generateExperienceLink: generateExperienceLink,
        getUidFromUrl: _getUidFromUrl,
        initData: init,
        // 健康画像
        updateHealthProfile: updateHealthProfile,
        addSupplement: addSupplement,
        removeSupplement: removeSupplement
    };

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
