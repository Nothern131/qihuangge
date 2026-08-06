// 生成第一个体验链接
var fs = require('fs');

// 模拟浏览器环境
global.window = {
    location: { origin: 'http://localhost', pathname: '/qihuangge/' },
    URLSearchParams: require('url').URLSearchParams
};

// 加载引擎（需要在同一 scope 执行）
var engineScript = fs.readFileSync('E:/岐黄阁/static/js/engines/archive-engine.js', 'utf8');
var fn = new Function('window', 'localStorage', 'global', 'location', 'URLSearchParams', engineScript + '; return global.ArchiveEngine;');
var ArchiveEngine = fn(global.window, global.localStorage, global, global.window.location, global.window.URLSearchParams);

console.log('=== 生成测试体验链接 ===');

// 创建测试档案
var profileId = ArchiveEngine.createProfile({
    name: '测试用户',
    gender: '男',
    age: 30,
    contact: '',
    note: '首次体验存档测试 — 岐黄阁数据库扩充版'
});

console.log('创建档案成功, profileId:', profileId);

// 模拟体质辨识结果
var tizhiResult = {
    type: '气虚质',
    score: 72,
    biasScore: 68,
    zangfu: '脾',
    mainSymptoms: ['气短懒言', '神疲乏力', '容易感冒', '舌淡苔白'],
    advice: '宜补益脾气，适量运动，避免过度劳累',
    fangji: '补中益气汤',
    fangjiSource: '《脾胃论》',
    master: '张景岳',
    masterContent: '张景岳解读：此乃气虚之证，命门火衰，当温补命门...'
};

// 归档体质辨识结果
ArchiveEngine.setCurrentProfileId(profileId);
var record = ArchiveEngine.autoArchive(profileId, 'tizhi', '体质辨识：气虚质', tizhiResult);
console.log('归档记录:', record ? '成功' : '失败');

// 生成体验链接
var link = ArchiveEngine.generateShareLink(profileId);
console.log('\n=== 体验链接 ===');
console.log(link);
console.log('\n链接长度:', link.length, '字符');

// 本地访问
var localLink = 'file:///E:/岐黄阁/index.html?uid=' + profileId.split('-')[0] + '&data=' + encodeURIComponent(JSON.stringify({
    uid: profileId,
    profiles: [ArchiveEngine.getProfile(profileId)],
    records: ArchiveEngine.listRecords(profileId)
}));
console.log('\n本地访问链接:');
console.log(localLink.slice(0, 200) + '...');
