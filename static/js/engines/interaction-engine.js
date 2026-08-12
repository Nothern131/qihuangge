/**
 * 岐黄阁 · 配伍规则引擎
 * 十八反、十九畏、妊娠禁忌、毒性标注
 * v20260808c
 */
(function(global) {
    'use strict';

    // 十八反歌诀
    var ANTI_GROUP1 = ['甘草', '大戟', '甘遂', '芫花', '海藻'];
    var ANTI_GROUP2 = ['乌头', '贝母', '瓜蒌', '半夏', '白蔹', '白及'];
    var ANTI_GROUP3 = ['藜芦', '人参', '沙参', '丹参', '玄参', '苦参', '细辛', '芍药'];

    // 十九畏歌诀
    var FEAR_PAIRS = [
        ['硫黄', '朴硝'],
        ['水银', '砒霜'],
        ['狼毒', '密陀僧'],
        ['巴豆', '牵牛'],
        ['丁香', '郁金'],
        ['川乌', '草乌'],
        ['牙硝', '三棱'],
        ['人参', '赤石脂']
    ];

    // 妊娠禁忌（按毒性分级）
    var PREGNANCY_Toxic = ['附子', '乌头', '川乌', '草乌', '天南星', '半夏', '桃仁', '红花', '三棱', '莪术', '麝香', '水蛭', '虻虫', '斑蝥', '巴豆', '大戟', '甘遂', '芫花', '雄黄', '马钱子', '土鳖虫'];
    var PREGNANCY_Mild = ['枳实', '大黄', '芒硝', '桃仁', '红花', '牛膝', '王不留行', '穿山甲', '瞿麦', '滑石', '茵陈', '赭石', '槐花', '蒲黄', '五灵脂', '丹参', '卷柏', '泽泻', '冬葵子'];

    // 毒性标注（按《中国药典》分类）
    var TOXICITY = {
        大毒: ['川乌', '草乌', '马钱子', '斑蝥', '洋金花', '闹羊花', '蟾酥', '全蝎', '蜈蚣'],
        有毒: ['附子', '天南星', '白附子', '苍耳子', '苦杏仁', '桃仁', '红粉', '轻粉', '土鳖虫', '斑蝥', '商陆', '千金子', '千金子霜', '吴茱萸', '枳实', '枳壳', '厚朴', '槟榔', '使君子', '苦楝皮', '巴豆', '巴豆霜', '红大戟', '甘遂', '京大戟', '大戟', '芫花', '狼毒', '常山', '天仙子', '藜芦', '雪上一枝蒿', '野菊花', '洋金花', '马兜铃', '车前草', '关木通', '青木香', '重楼', '徐长卿', '急性子', '吴茱萸'],
        小毒: ['苦杏仁', '桃仁', '苍耳子', '千金子', '补骨脂', '蛇床子', '大风子', '何首乌', '生何首乌', '苦楝皮', '皂荚', '吴茱萸', '使君子', '瓜蒌', '薤白', '榧子', '南瓜子', '马兜铃', '关木通', '青木香', '徐长卿', '细辛', '秦艽', '常山', '商陆', '朱砂', '轻粉', '红粉', '雄黄']
    };

    /**
     * 计算毒性等级
     */
    function getToxicity(name) {
        for (var level in TOXICITY) {
            if (TOXICITY[level].indexOf(name) !== -1) return level;
        }
        return '无毒';
    }

    /**
     * 检查十八反配伍禁忌
     */
    function checkShibaFan(herbs) {
        var warnings = [];
        var herbList = herbs.map(function(h) { return h.name || h; });

        // 甘草反大戟、甘遂、芫花、海藻
        if (herbList.indexOf('甘草') !== -1) {
            ['大戟', '甘遂', '芫花', '海藻'].forEach(function(anti) {
                if (herbList.indexOf(anti) !== -1) {
                    warnings.push({ herbs: ['甘草', anti], type: '十八反', level: 'strong', msg: '甘草反' + anti });
                }
            });
        }
        // 乌头反贝母、瓜蒌、半夏、白蔹、白及
        if (herbList.indexOf('乌头') !== -1 || herbList.indexOf('川乌') !== -1 || herbList.indexOf('草乌') !== -1) {
            var wuhead = '乌头';
            if (herbList.indexOf('川乌') !== -1) wuhead = '川乌';
            if (herbList.indexOf('草乌') !== -1) wuhead = '草乌';
            ['贝母', '瓜蒌', '半夏', '白蔹', '白及'].forEach(function(anti) {
                if (herbList.indexOf(anti) !== -1) {
                    warnings.push({ herbs: [wuhead, anti], type: '十八反', level: 'strong', msg: wuhead + '反' + anti });
                }
            });
        }
        // 藜芦反人参、沙参、丹参、玄参、苦参、细辛、芍药
        if (herbList.indexOf('藜芦') !== -1) {
            ['人参', '沙参', '丹参', '玄参', '苦参', '细辛', '芍药'].forEach(function(anti) {
                if (herbList.indexOf(anti) !== -1) {
                    warnings.push({ herbs: ['藜芦', anti], type: '十八反', level: 'strong', msg: '藜芦反' + anti });
                }
            });
        }
        return warnings;
    }

    /**
     * 检查十九畏配伍禁忌
     */
    function checkShijiuWei(herbs) {
        var warnings = [];
        var herbList = herbs.map(function(h) { return h.name || h; });
        FEAR_PAIRS.forEach(function(pair) {
            if (herbList.indexOf(pair[0]) !== -1 && herbList.indexOf(pair[1]) !== -1) {
                warnings.push({ herbs: pair, type: '十九畏', level: 'moderate', msg: pair[0] + '畏' + pair[1] });
            }
        });
        return warnings;
    }

    /**
     * 检查妊娠禁忌
     */
    function checkPregnancy(herbs) {
        var warnings = [];
        var herbList = herbs.map(function(h) { return h.name || h; });
        PREGNANCY_Toxic.forEach(function(herb) {
            if (herbList.indexOf(herb) !== -1) {
                warnings.push({ herb: herb, level: 'strong', msg: herb + ' — 妊娠禁忌（禁用）' });
            }
        });
        PREGNANCY_Mild.forEach(function(herb) {
            if (herbList.indexOf(herb) !== -1) {
                warnings.push({ herb: herb, level: 'moderate', msg: herb + ' — 妊娠慎用' });
            }
        });
        return warnings;
    }

    /**
     * 全量配伍检查
     */
    function check(herbs, options) {
        options = options || {};
        var result = {
            herbs: herbs,
            fans: options.checkFan !== false ? checkShibaFan(herbs) : [],
            weis: options.checkWei !== false ? checkShijiuWei(herbs) : [],
            pregnancy: options.pregnancy ? checkPregnancy(herbs) : [],
            toxicity: herbs.map(function(h) {
                return {
                    herb: h.name || h,
                    toxicity: getToxicity(h.name || h)
                };
            }),
            totalWarnings: (options.checkFan !== false ? checkShibaFan(herbs) : []).length +
                           (options.checkWei !== false ? checkShijiuWei(herbs) : []).length +
                           (options.pregnancy ? checkPregnancy(herbs) : []).length
        };
        return result;
    }

    global.InteractionEngine = {
        check: check,
        checkShibaFan: checkShibaFan,
        checkShijiuWei: checkShijiuWei,
        checkPregnancy: checkPregnancy,
        getToxicity: getToxicity,
        ANTI_GROUP1: ANTI_GROUP1,
        ANTI_GROUP2: ANTI_GROUP2,
        ANTI_GROUP3: ANTI_GROUP3,
        PREGNANCY_Toxic: PREGNANCY_Toxic,
        PREGNANCY_Mild: PREGNANCY_Mild,
        FEAR_PAIRS: FEAR_PAIRS
    };
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));