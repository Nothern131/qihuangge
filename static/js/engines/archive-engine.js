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
            phone: info.phone || '',
            notes: info.notes || '',
            uid: _getUidFromUrl() || null,
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
        if (info.phone !== undefined) p.phone = info.phone;
        if (info.notes !== undefined) p.notes = info.notes;
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
        initData: init
    };

})(typeof window !== 'undefined' ? window : this);
