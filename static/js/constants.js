/**
 * 岐黄阁 · 共享常量
 * 五行、天干地支、证型、体质等基础常量
 */
(function(global) {
    'use strict';

    var Qiuhuang = {};

    // ========== 五行 ==========
    Qiuhuang.WUXING = {
        '木': { color: '#5a8a4a', sheng: '火', ke: '土', organ: '肝', emotion: '怒' },
        '火': { color: '#c23b22', sheng: '土', ke: '金', organ: '心', emotion: '喜' },
        '土': { color: '#b8945c', sheng: '金', ke: '水', organ: '脾', emotion: '思' },
        '金': { color: '#d4d4d4', sheng: '水', ke: '木', organ: '肺', emotion: '悲' },
        '水': { color: '#2c4a6e', sheng: '木', ke: '火', organ: '肾', emotion: '恐' }
    };

    // ========== 天干地支 ==========
    Qiuhuang.TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    Qiuhuang.DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    Qiuhuang.WU_XING_TIANGAN = {
        '甲': '木', '乙': '木', '丙': '火', '丁': '火',
        '戊': '土', '己': '土', '庚': '金', '辛': '金',
        '壬': '水', '癸': '水'
    };
    Qiuhuang.WU_XING_DIZHI = {
        '子': '水', '丑': '土', '寅': '木', '卯': '木',
        '辰': '土', '巳': '火', '午': '火', '未': '土',
        '申': '金', '酉': '金', '戌': '土', '亥': '水'
    };

    // ========== 八纲 ==========
    Qiuhuang.BAGA = {
        '表': { description: '病位浅，在皮毛腠理', symptoms: ['恶寒', '发热', '脉浮', '头痛'] },
        '里': { description: '病位深，在脏腑气血', symptoms: ['内热', '便秘', '腹痛', '脉沉'] },
        '寒': { description: '阴盛或阳虚', symptoms: ['畏寒', '肢冷', '口淡不渴', '脉迟'] },
        '热': { description: '阳盛或阴虚', symptoms: ['发热', '口渴', '面红', '脉数'] },
        '虚': { description: '正气不足', symptoms: ['神疲', '乏力', '气短', '脉弱'] },
        '实': { description: '邪气盛实', symptoms: ['胀痛', '拒按', '声高气粗', '脉实'] },
        '阴': { description: '寒、里、虚的总称', symptoms: [] },
        '阳': { description: '热、表、实的总称', symptoms: [] }
    };

    // ========== 六经辨证 ==========
    Qiuhuang.LIUJING = {
        '太阳': {
            description: '主表证，外邪初袭',
            syndrome: '太阳经证',
            main_symptoms: ['恶寒发热', '头项强痛', '脉浮'],
            formula: '麻黄汤/桂枝汤'
        },
        '阳明': {
            description: '里热实证',
            syndrome: '阳明经证/腑证',
            main_symptoms: ['大热', '大渴', '大汗', '脉洪大'],
            formula: '白虎汤/承气汤'
        },
        '少阳': {
            description: '半表半里',
            syndrome: '少阳证',
            main_symptoms: ['往来寒热', '胸胁苦满', '默默不欲饮食'],
            formula: '小柴胡汤'
        },
        '太阴': {
            description: '脾虚寒湿',
            syndrome: '太阴病',
            main_symptoms: ['腹满而吐', '食不下', '自利'],
            formula: '理中汤'
        },
        '少阴': {
            description: '心肾虚衰',
            syndrome: '少阴病',
            main_symptoms: ['脉微细', '但欲寐'],
            formula: '四逆汤/黄连阿胶汤'
        },
        '厥阴': {
            description: '阴阳错杂',
            syndrome: '厥阴病',
            main_symptoms: ['消渴', '气上撞心', '饥而不欲食'],
            formula: '乌梅丸'
        }
    };

    // ========== 脏腑辨证 ==========
    Qiuhuang.ZANGFU = {
        '肺': {
            symptoms: ['咳嗽', '气喘', '胸闷', '鼻塞'],
            syndrome_pattern: ['肺气虚', '肺阴虚', '风寒犯肺', '风热犯肺', '痰热壅肺'],
            formula: '六君子汤/沙参麦冬汤/三拗汤'
        },
        '心': {
            symptoms: ['心悸', '失眠', '健忘', '胸痛'],
            syndrome_pattern: ['心气虚', '心血虚', '心阴虚', '心阳虚', '心火亢盛'],
            formula: '归脾汤/天王补心丹/黄连解毒汤'
        },
        '脾': {
            symptoms: ['食少', '腹胀', '便溏', '乏力'],
            syndrome_pattern: ['脾气虚', '脾阳虚', '中气下陷', '脾不统血'],
            formula: '四君子汤/理中丸/补中益气汤'
        },
        '肝': {
            symptoms: ['胁痛', '情绪抑郁', '头痛眩晕', '月经不调'],
            syndrome_pattern: ['肝气郁结', '肝火上炎', '肝阳上亢', '肝血虚'],
            formula: '逍遥散/龙胆泻肝汤/天麻钩藤饮'
        },
        '肾': {
            symptoms: ['腰膝酸软', '耳鸣', '尿频', '遗精'],
            syndrome_pattern: ['肾阳虚', '肾阴虚', '肾气不固', '肾精不足'],
            formula: '金匮肾气丸/六味地黄丸/五子衍宗丸'
        }
    };

    // ========== 九种体质 ==========
    Qiuhuang.TIZHI = {
        '平和质': {
            rate: '32.75%',
            description: '体态适中，面色红润，精力充沛',
            regimen: '饮食多样化，作息规律，适度运动'
        },
        '气虚质': {
            rate: '13.31%',
            description: '气短懒言，容易疲乏，精神不振',
            regimen: '补气健脾，多食山药、红枣、黄芪'
        },
        '阳虚质': {
            rate: '6.27%',
            description: '畏寒肢冷，手足不温，易汗出',
            regimen: '温补脾肾，多食温热食物，少食寒凉'
        },
        '阴虚质': {
            rate: '8.22%',
            description: '口燥咽干，手足心热，大便干燥',
            regimen: '滋阴清热，多食银耳、百合、枸杞'
        },
        '痰湿质': {
            rate: '8.13%',
            description: '腹部肥满，口黏苔腻，易困倦',
            regimen: '健脾利湿，多食冬瓜、萝卜、薏米'
        },
        '湿热质': {
            rate: '5.42%',
            description: '面垢油光，易生痤疮，口苦口干',
            regimen: '清热利湿，多食绿豆、苦瓜、冬瓜'
        },
        '血瘀质': {
            rate: '4.74%',
            description: '肤色晦暗，色素沉着，易瘀斑',
            regimen: '活血化瘀，多食山楂、黑木耳、洋葱'
        },
        '气郁质': {
            rate: '7.93%',
            description: '忧郁敏感，胸胁胀满，情绪低落',
            regimen: '行气解郁，多食玫瑰花、陈皮、柑橘'
        },
        '特禀质': {
            rate: '5.42%',
            description: '过敏体质，易喷嚏，皮肤易起风团',
            regimen: '益气固表，避免过敏原，增强体质'
        }
    };

    // ========== 28脉象 ==========
    Qiuhuang.MAIXIANG = {
        '浮': { position: '轻取即得', disease: '表证', character: '如水漂木' },
        '沉': { position: '重按始得', disease: '里证', character: '如石投水' },
        '迟': { rate: '一息三至', disease: '寒证', character: '来去缓慢' },
        '数': { rate: '一息六至', disease: '热证', character: '来去快速' },
        '虚': { quality: '三部脉举按皆无力', disease: '虚证', character: '应指松软' },
        '实': { quality: '三部脉举按皆有力', disease: '实证', character: '应指充实' },
        '滑': { quality: '往来流利，如珠走盘', disease: '痰湿、食积、实热', character: '圆滑流利' },
        '涩': { quality: '往来艰涩，如轻刀刮竹', disease: '气滞、血瘀、精伤', character: '滞涩不畅' },
        '细': { quality: '脉细如线，应指明显', disease: '气血两虚、湿证', character: '细直如丝' },
        '洪': { quality: '来盛去衰，如波涛汹涌', disease: '气分热盛', character: '洪大有力' },
        '弦': { quality: '端直以长，如按琴弦', disease: '肝胆病、痛证、痰饮', character: '弦直有力' },
        '紧': { quality: '绷急弹指，如牵绳转索', disease: '寒证、痛证、宿食', character: '紧张有力' },
        '濡': { quality: '浮而细软，应指即沉', disease: '虚证、湿证', character: '浮细无力' },
        '缓': { quality: '一息四至，来去从容', disease: '脾虚、湿证', character: '和缓从容' },
        '弱': { quality: '沉而细软，应指无力', disease: '气血两虚', character: '沉细无力' },
        '结': { quality: '脉来缓慢，时有中止', disease: '阴盛气结、寒痰血瘀', character: '缓而中止' },
        '代': { quality: '脉来一止，止有定数', disease: '脏气衰微', character: '中止有定数' },
        '促': { quality: '脉来急数，时有中止', disease: '阳盛实热、气血痰食停滞', character: '数而中止' },
        '芤': { quality: '浮大中空，如按葱管', disease: '失血、伤阴', character: '浮大中空' },
        '革': { quality: '浮而搏指，中空外坚', disease: '亡血、失精、半产、漏下', character: '浮大中空' },
        '微': { quality: '极细极软，似有似无', disease: '阳气衰微、气血大虚', character: '细软难寻' },
        '散': { quality: '浮散无根，至数不齐', disease: '元气离散、脏腑之气将绝', character: '散漫无根' },
        '长': { quality: '首尾端直，超过本位', disease: '阳证、实证、热证', character: '长而有力' },
        '短': { quality: '首尾俱短，不能满部', disease: '气病', character: '短而无力' },
        '大': { quality: '脉体宽大，有力', disease: '实证、热证', character: '大而有力' },
        '紧': { quality: '绷急弹指', disease: '寒痛', character: '紧张有力' },
        '动': { quality: '滑数有力，如豆转动', disease: '痛证、惊证', character: '厥厥动摇' },
        '伏': { quality: '重按着骨始得', disease: '邪闭、厥证', character: '深伏于里' }
    };

    // ========== 舌诊分类 ==========
    Qiuhuang.SHEZHEN = {
        '舌质淡白': { meaning: '气血两虚、阳虚', type: '虚寒' },
        '舌质红': { meaning: '热证、阴虚', type: '实热/虚热' },
        '舌质红绛': { meaning: '热入营血、阴虚火旺', type: '热盛' },
        '舌质紫暗': { meaning: '血瘀、寒凝', type: '瘀血' },
        '舌体胖大': { meaning: '脾虚湿盛、阳虚水泛', type: '虚证' },
        '舌体瘦薄': { meaning: '气血两虚、阴虚火旺', type: '虚证' },
        '舌苔薄白': { meaning: '正常苔、表证', type: '正常/表证' },
        '舌苔薄黄': { meaning: '风热表证、里热初起', type: '热证' },
        '舌苔黄腻': { meaning: '湿热、痰热、食积化热', type: '湿热' },
        '舌苔白腻': { meaning: '寒湿、痰饮、食积', type: '寒湿' },
        '舌苔黄燥': { meaning: '热盛伤津', type: '实热' },
        '舌苔少或无苔': { meaning: '胃气阴两虚、阴虚', type: '阴虚' },
        '舌苔灰黑干燥': { meaning: '热极伤阴', type: '热盛' },
        '舌苔灰黑润': { meaning: '寒湿内盛', type: '寒湿' }
    };

    // ========== 声明常量 ==========
    Qiuhuang.DISCLAIMER = {
        title: '重要声明',
        content: [
            '本系统仅供中医药文化学习与知识科普使用，不构成任何医疗建议。',
            '中医辨证论治需结合四诊合参，线上系统无法替代专业医师面诊。',
            '所有方剂、剂量、用法仅供参考，请在执业中医师指导下使用。',
            '中药材食谱属于食疗范畴，不能替代药物或临床营养干预。',
            '如遇身体不适，请及时前往正规医疗机构就诊。',
            '本系统不对因使用本系统信息而产生的任何后果承担责任。'
        ]
    };

    // 暴露全局
    global.Qiuhuang = Qiuhuang;

})(typeof window !== 'undefined' ? window : this);
