/**
 * 岐黄阁 · 首页入口
 */
(function(global) {
    'use strict';

    // ========== 路由注册 ==========
    var routes = {};

    function registerRoute(hash, renderFn) {
        routes[hash] = renderFn;
    }

    function navigateTo(hash) {
        var container = document.getElementById('page-container');
        if (!container) return;
        container.innerHTML = '';

        var renderFn = routes[hash];
        if (renderFn) {
            var html = renderFn();
            container.innerHTML = html;
        } else {
            renderHome();
        }
    }

    // ========== 首页渲染 ==========
    function renderHome() {
        var html = `
            <div class="home-page">
                <div class="hero">
                    <h1>岐黄阁</h1>
                    <p class="subtitle">中医药古籍知识推理系统</p>
                    <p class="tagline">古籍分析 · 辨证推理 · 方剂解析 · 本草查询 · 大师蒸馏</p>
                </div>
                <div class="modules">
                    <div class="module-card" onclick="QiuhuangApp.navigate('#/bianzheng')">
                        <div class="icon">🔮</div>
                        <h3>辨证推理</h3>
                        <p>八纲 · 六经 · 脏腑辨证</p>
                    </div>
                    <div class="module-card" onclick="QiuhuangApp.navigate('#/fangji')">
                        <div class="icon">📜</div>
                        <h3>方剂解析</h3>
                        <p>君臣佐使 · 配伍规律</p>
                    </div>
                    <div class="module-card" onclick="QiuhuangApp.navigate('#/bencao')">
                        <div class="icon">🌿</div>
                        <h3>本草查询</h3>
                        <p>四气五味 · 归经功效</p>
                    </div>
                    <div class="module-card" onclick="QiuhuangApp.navigate('#/tizhi')">
                        <div class="icon">🧬</div>
                        <h3>体质辨识</h3>
                        <p>九种体质 · 调养方案</p>
                    </div>
                    <div class="module-card" onclick="QiuhuangApp.navigate('#/masters')">
                        <div class="icon">👨‍⚕️</div>
                        <h3>大师蒸馏</h3>
                        <p>历代名医 · 风格复刻</p>
                    </div>
                    <div class="module-card" onclick="QiuhuangApp.navigate('#/food')">
                        <div class="icon">🍲</div>
                        <h3>药膳食谱</h3>
                        <p>药食同源 · 养生调理</p>
                    </div>
                </div>
                <div class="disclaimer">
                    <p><strong>⚠️ 重要声明</strong></p>
                    <p>本系统仅供中医药文化学习与知识科普使用，不构成任何医疗建议。</p>
                    <p>中医辨证论治需结合四诊合参，线上系统无法替代专业医师面诊。</p>
                    <p>所有方剂、剂量、用法仅供参考，请在执业中医师指导下使用。</p>
                    <p>中药材食谱属于食疗范畴，不能替代药物或临床营养干预。</p>
                    <p>本系统不对因使用本系统信息而产生的任何后果承担责任。</p>
                    <p style="margin-top:10px; color:#b8945c;">如需医疗帮助，请及时前往正规医疗机构就诊。</p>
                </div>
            </div>
        `;
        return html;
    }

    // ========== 全局 API ==========
    global.QiuhuangApp = {
        routes: routes,
        registerRoute: registerRoute,
        navigate: navigateTo,
        _renderHome: renderHome
    };

    // ========== 路由监听 ==========
    window.addEventListener('hashchange', function() {
        var hash = window.location.hash || '#/home';
        navigateTo(hash);
    });

    // 初始加载
    window.addEventListener('DOMContentLoaded', function() {
        var hash = window.location.hash || '#/home';
        navigateTo(hash);
    });

    // 暴露常量
    if (typeof Qiuhuang !== 'undefined' && Qiuhuang.DISCLAIMER) {
        // 常量已加载
    }

    // ========== 日志全局开关 ==========
    console.log('[岐黄阁] 系统初始化完成，所有引擎已加载');

})(typeof window !== 'undefined' ? window : this);
