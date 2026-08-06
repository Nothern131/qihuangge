/**
 * 岐黄阁 · 引擎注册中心
 * 所有推理引擎统一注册，供组件层调用
 */
(function(global) {
    'use strict';

    var EngineRegistry = {
        _engines: {},

        /**
         * 注册引擎
         * @param {Object} config
         * @param {string} config.id - 引擎唯一标识
         * @param {string} config.name - 引擎显示名称
         * @param {string} config.category - 分类：bianzheng|fangji|bencao|maizhen|shezhen|jingluo|tizhi|reverse
         * @param {Object} config.engine - 引擎对象
         * @param {Function} config.render - 渲染函数
         */
        register: function(config) {
            this._engines[config.id] = {
                name: config.name,
                category: config.category,
                engine: config.engine,
                render: config.render
            };
        },

        /**
         * 获取已注册的引擎
         * @param {string} id
         * @returns {Object|null}
         */
        get: function(id) {
            return this._engines[id] || null;
        },

        /**
         * 获取所有引擎列表
         * @returns {Array}
         */
        list: function() {
            return Object.keys(this._engines).map(function(id) {
                return { id: id, name: this._engines[id].name, category: this._engines[id].category };
            }.bind(this));
        },

        /**
         * 按分类获取引擎
         * @param {string} category
         * @returns {Array}
         */
        listByCategory: function(category) {
            var result = [];
            Object.keys(this._engines).forEach(function(id) {
                if (this._engines[id].category === category) {
                    result.push({ id: id, name: this._engines[id].name });
                }
            }.bind(this));
            return result;
        },

        /**
         * 初始化所有引擎（自动暴露到全局）
         */
        init: function() {
            var self = this;
            Object.keys(this._engines).forEach(function(id) {
                var engine = this._engines[id].engine;
                // 将引擎对象暴露到全局，键名为下划线前缀+ID
                global['_' + id] = engine;
            }.bind(this));
        }
    };

    global.EngineRegistry = EngineRegistry;

})(typeof window !== 'undefined' ? window : this);
