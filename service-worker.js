/**
 * 岐黄阁 · Service Worker
 * 提供离线缓存支持，加快重复访问速度
 * version: 20260808
 */
var CACHE_NAME = 'qiuhuangge-v20260808';
var CACHE_URLS = [
    '/',
    '/index.html',
    '/static/css/style.css?v=20260808a',
    '/static/js/constants.js?v=20250806n',
    '/static/js/engine-registry.js?v=20250806n',
    '/static/js/app.js?v=20260808a',
    '/static/js/engines/vitamin-engine.js?v=20260808a',
    '/static/js/components/vitamin.js?v=20260808a',
    '/static/icons/icon.svg'
];

// 安装：缓存核心文件
self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(CACHE_URLS);
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// 激活：清理旧缓存
self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(n) { return n !== CACHE_NAME; })
                    .map(function(n) { return caches.delete(n); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// 请求：网络优先，缓存兜底
self.addEventListener('fetch', function(e) {
    e.respondWith(
        fetch(e.request).then(function(res) {
            // 缓存成功的响应
            if (res && res.status === 200 && res.type === 'basic') {
                var cacheCopy = res.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(e.request, cacheCopy);
                });
            }
            return res;
        }).catch(function() {
            // 离线时从缓存读取
            return caches.match(e.request);
        })
    );
});