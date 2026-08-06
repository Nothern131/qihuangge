/**
 * 岐黄阁 · 方剂解析组件
 * 快捷方剂按钮 → 详情卡片（君臣佐使·主治·用法煎服·加减·禁忌）
 */
(function(global) {
    'use strict';

    var PRESET_FANGJI = ['桂枝汤', '麻黄汤', '小柴胡汤', '四君子汤', '六味地黄丸', '逍遥散', '补中益气汤', '龙胆泻肝汤', '当归补血汤', '血府逐瘀汤'];

    var FANGJI_DB = {
        '桂枝汤': {
            source: '《伤寒论》',
            category: '解表剂·辛温解表',
            composition: [
                { herb: '桂枝', dosage: '9g', role: '君', function: '解肌发表，温通经脉，助卫阳' },
                { herb: '白芍', dosage: '9g', role: '臣', function: '敛阴和营，助桂枝调和营卫，防发散太过' },
                { herb: '生姜', dosage: '9g', role: '佐', function: '助桂枝散表寒，和胃止呕' },
                { herb: '大枣', dosage: '6枚', role: '佐', function: '补脾益气，助芍药和营养血' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中，合桂枝辛甘化阳，合芍药酸甘化阴' }
            ],
            indication: '外感风寒表虚证',
            symptoms: ['恶风', '发热', '汗出', '头痛', '脉浮缓'],
            yongfa: '水煎温服，服后啜热稀粥一碗，助药力发汗。盖被取微汗，不可令如水流漓。',
            jianfu: '上五味，以水七升（约1400ml），微火煮取三升（约600ml），去滓。分三次温服，间隔约4小时。服后啜热粥以助药力。',
            zhuyi: '服药后忌食生冷、油腻、辛辣；避风寒，注意保暖。',
            jianyi: [
                { condition: '兼项背强几几（项背拘紧不舒）', change: '加葛根12g（桂枝加葛根汤）' },
                { condition: '兼喘', change: '加厚朴6g、杏仁9g（桂枝加厚朴杏子汤）' },
                { condition: '阳虚漏汗不止', change: '加附子6g（桂枝加附子汤）' },
                { condition: '兼营血不足', change: '加当归9g、川芎6g' }
            ],
            jinkui: ['表实无汗者禁用', '温病初起、发热口渴者禁用', '阴虚火旺者慎用'],
            peiwu: '桂枝配白芍：一散一收，调和营卫；生姜配大枣：一散一补，调和脾胃；桂枝配甘草：辛甘化阳，温通心阳；白芍配甘草：酸甘化阴，缓急止痛。'
        },
        '麻黄汤': {
            source: '《伤寒论》',
            category: '解表剂·辛温解表',
            composition: [
                { herb: '麻黄', dosage: '9g', role: '君', function: '发汗解表，宣肺平喘，开腠理透毛窍' },
                { herb: '桂枝', dosage: '9g', role: '臣', function: '助麻黄发汗解表，温经通阳' },
                { herb: '杏仁', dosage: '9g', role: '佐', function: '降利肺气，助麻黄宣肺平喘，一宣一降' },
                { herb: '炙甘草', dosage: '3g', role: '使', function: '调和诸药，缓麻桂峻烈之性，防过汗伤正' }
            ],
            indication: '外感风寒表实证',
            symptoms: ['恶寒发热', '头身疼痛', '无汗而喘', '脉浮紧'],
            yongfa: '水煎温服，取微汗即止，不可过汗。汗出即停服，余药勿进。',
            jianfu: '上四味，以水九升（约1800ml），先煮麻黄减二升（约400ml），去上沫，内诸药，煮取二升（约400ml），去滓。分两次温服。',
            zhuyi: '汗出即停服，不可过汗伤阳；表虚自汗者禁用。',
            jianyi: [
                { condition: '兼里有郁热（大青龙汤证）', change: '加石膏18g、生姜3片、大枣4枚（大青龙汤）' },
                { condition: '咳嗽痰多', change: '加半夏9g、陈皮6g' }
            ],
            jinkui: ['表虚自汗者禁用', '疮家、淋家、衄家禁用', '孕妇慎用'],
            peiwu: '麻黄配桂枝：相须为用，发汗力增强；麻黄配杏仁：一宣一降，调理肺气；麻黄配甘草：缓其峻烈，防过汗伤正。'
        },
        '小柴胡汤': {
            source: '《伤寒论》',
            category: '和解剂·和解少阳',
            composition: [
                { herb: '柴胡', dosage: '12g', role: '君', function: '疏解少阳，透散半表之邪，条达肝气' },
                { herb: '黄芩', dosage: '9g', role: '臣', function: '清泄少阳半里之热，柴芩合用和解少阳' },
                { herb: '半夏', dosage: '9g', role: '佐', function: '和胃降逆止呕，散结消痞' },
                { herb: '人参', dosage: '6g', role: '佐', function: '益气扶正，助正祛邪，防邪内传' },
                { herb: '生姜', dosage: '9g', role: '佐', function: '和胃止呕，助柴胡散邪达表' },
                { herb: '大枣', dosage: '4枚', role: '佐', function: '补脾益气，助人参扶正' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中' }
            ],
            indication: '少阳病证',
            symptoms: ['往来寒热', '胸胁苦满', '默默不欲饮食', '心烦喜呕', '口苦', '咽干', '目眩'],
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上七味，以水一斗二升（约2400ml），煮取六升（约1200ml），去滓，再煎取三升（约600ml）。温服一升（约200ml），日三服。',
            zhuyi: '服药期间忌食生冷、油腻；太阳表证未解者慎用。',
            jianyi: [
                { condition: '胸中烦而不呕（热扰胸膈）', change: '去半夏、人参，加瓜蒌实12g' },
                { condition: '腹中痛（肝脾不和）', change: '去黄芩，加芍药12g' },
                { condition: '咳嗽（肺气上逆）', change: '去人参、大枣、生姜，加五味子6g、干姜6g' },
                { condition: '心悸小便不利', change: '加桂枝9g、茯苓12g' }
            ],
            jinkui: ['太阳表证未解者慎用', '里虚寒证者慎用', '孕妇慎用半夏'],
            peiwu: '柴胡配黄芩：一散一清，和解少阳核心配伍；半夏配生姜：和胃降逆，止呕要药；人参配大枣：扶正祛邪，防邪内传。'
        },
        '四君子汤': {
            source: '《太平惠民和剂局方》',
            category: '补益剂·补气',
            composition: [
                { herb: '人参', dosage: '9g', role: '君', function: '大补元气，健脾益肺，为补气要药' },
                { herb: '白术', dosage: '9g', role: '臣', function: '健脾燥湿，助人参益气健脾，运化水湿' },
                { herb: '茯苓', dosage: '9g', role: '佐', function: '渗湿健脾，助白术运化水湿，使补而不滞' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中，合参术增强补气之功' }
            ],
            indication: '脾胃气虚证',
            symptoms: ['面色萎黄', '语声低微', '气短乏力', '食少便溏', '舌淡苔白', '脉虚弱'],
            yongfa: '水煎温服，每日1剂，分早晚两次服用。可作汤剂或丸剂。',
            jianfu: '上四味，以水六升（约1200ml），煮取二升（约400ml），去滓。分两次温服。',
            zhuyi: '实证、热证慎用；感冒发热期间暂停服用。',
            jianyi: [
                { condition: '气虚甚（气短明显）', change: '加重人参用量至12g，或换红参' },
                { condition: '兼湿盛（苔腻便溏）', change: '加陈皮6g（异功散）' },
                { condition: '兼气滞（脘腹胀满）', change: '加陈皮6g、砂仁3g（六君子汤）' },
                { condition: '气血两虚', change: '加熟地12g、当归9g（八珍汤）' },
                { condition: '气阴两虚', change: '加麦冬9g、五味子6g' }
            ],
            jinkui: ['实证慎用', '热证慎用', '气滞胀满者慎用'],
            peiwu: '人参配白术：补气健脾核心，君臣相须；白术配茯苓：健脾燥湿与渗湿利水相伍，标本兼顾；参术配甘草：补气之力倍增，为益气基础方。'
        },
        '六味地黄丸': {
            source: '《小儿药证直诀》',
            category: '补益剂·补阴',
            composition: [
                { herb: '熟地黄', dosage: '24g', role: '君', function: '滋阴补肾，填精益髓，为补肾阴要药' },
                { herb: '山茱萸', dosage: '12g', role: '臣', function: '补养肝肾，涩精固脱，助熟地补阴' },
                { herb: '山药', dosage: '12g', role: '臣', function: '补益脾阴，涩精固肾，脾肾双补' },
                { herb: '泽泻', dosage: '9g', role: '佐', function: '利湿泄浊，防熟地滋腻碍胃' },
                { herb: '牡丹皮', dosage: '9g', role: '佐', function: '清泄相火，制山茱萸之温涩' },
                { herb: '茯苓', dosage: '9g', role: '佐', function: '淡渗脾湿，助山药健运，使补而不滞' }
            ],
            indication: '肝肾阴虚证',
            symptoms: ['腰膝酸软', '头晕耳鸣', '盗汗', '遗精', '消渴', '骨蒸潮热', '手足心热'],
            yongfa: '水煎服或丸剂吞服。丸剂每次6-9g，每日2次，饭前温开水送服。',
            jianfu: '上六味，研为细末，炼蜜为丸，如梧桐子大。每服空心盐汤或温开水送下。',
            zhuyi: '脾胃虚弱、食少便溏者慎用；阳虚畏寒者禁用。',
            jianyi: [
                { condition: '虚火偏旺（潮热盗汗明显）', change: '加知母9g、黄柏9g（知柏地黄丸）' },
                { condition: '肺痨咳嗽（干咳少痰）', change: '加阿胶9g、龟板12g（大补阴丸）' },
                { condition: '肝肾阴虚而目昏（眼干涩）', change: '加枸杞子12g、菊花6g（杞菊地黄丸）' },
                { condition: '肾不纳气（喘促气短）', change: '加五味子6g、蛤蚧1对' }
            ],
            jinkui: ['脾胃虚弱、食少便溏者慎用', '阳虚者禁用', '外感发热期间暂停'],
            peiwu: '熟地配山茱萸、山药：三补肝脾肾，滋而不腻；泽泻配丹皮、茯苓：三泻泄浊清热，补中有泻。三补三泻，以补为主，补而不滞。'
        },
        '逍遥散': {
            source: '《太平惠民和剂局方》',
            category: '和解剂·调和肝脾',
            composition: [
                { herb: '柴胡', dosage: '9g', role: '君', function: '疏肝解郁，条达肝气，为疏肝要药' },
                { herb: '当归', dosage: '9g', role: '臣', function: '养血和血，补肝体助肝用，养血柔肝' },
                { herb: '白芍', dosage: '9g', role: '臣', function: '养血敛阴，柔肝缓急，助当归养肝血' },
                { herb: '白术', dosage: '9g', role: '佐', function: '健脾益气，防肝木乘脾，培土荣木' },
                { herb: '茯苓', dosage: '9g', role: '佐', function: '健脾渗湿，助白术运化，宁心安神' },
                { herb: '薄荷', dosage: '3g', role: '佐', function: '助柴胡疏肝解郁，透达肝经郁热' },
                { herb: '生姜', dosage: '3片', role: '佐', function: '温胃和中，辛散达郁，助运化' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中，合芍药缓急' }
            ],
            indication: '肝郁血虚脾弱证',
            symptoms: ['两胁作痛', '头痛目眩', '口燥咽干', '神疲食少', '月经不调', '乳房胀痛'],
            yongfa: '水煎温服，每日1剂，分早晚两次服用。亦可作丸剂，每次6g，每日2次。',
            jianfu: '上八味，以水六升（约1200ml），煮取三升（约600ml），去滓。分三次温服。',
            zhuyi: '阴虚火旺者慎用；孕妇慎用柴胡、薄荷。',
            jianyi: [
                { condition: '肝郁化热（烦躁易怒、口苦）', change: '加丹皮9g、栀子9g（丹栀逍遥散）' },
                { condition: '月经不调（经行腹痛）', change: '加香附9g、益母草15g' },
                { condition: '乳房胀痛明显', change: '加青皮6g、橘叶9g' },
                { condition: '脾虚便溏', change: '加薏苡仁15g、莲子12g' }
            ],
            jinkui: ['阴虚火旺者慎用', '孕妇慎用柴胡、薄荷'],
            peiwu: '柴胡配当归、白芍：疏肝养肝并举，体用兼顾；柴胡配薄荷：疏肝透热，条达气机；白术配茯苓：健脾渗湿，培土荣木。'
        },
        '补中益气汤': {
            source: '《脾胃论》',
            category: '补益剂·补气',
            composition: [
                { herb: '黄芪', dosage: '18g', role: '君', function: '补中益气，升阳固表，为补气要药' },
                { herb: '人参', dosage: '6g', role: '臣', function: '大补元气，健脾益肺，助黄芪补气' },
                { herb: '白术', dosage: '9g', role: '臣', function: '健脾燥湿，助人参黄芪益气健脾' },
                { herb: '当归', dosage: '9g', role: '佐', function: '养血和营，气中补血，使气有所附' },
                { herb: '陈皮', dosage: '6g', role: '佐', function: '理气和中，防补药滞气，使补而不腻' },
                { herb: '升麻', dosage: '6g', role: '佐使', function: '升举阳气，引药上行，助黄芪升提' },
                { herb: '柴胡', dosage: '6g', role: '佐使', function: '升阳疏肝，助升麻升提下陷之气' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中' }
            ],
            indication: '脾胃气虚、中气下陷证',
            symptoms: ['体倦乏力', '食少便溏', '面色萎黄', '气短懒言', '脱肛', '子宫脱垂', '久泻久痢'],
            yongfa: '水煎温服，每日1剂，分早晚两次服用。饭后半小时服为佳。',
            jianfu: '上八味，以水七升（约1400ml），煮取三升（约600ml），去滓。分三次温服。',
            zhuyi: '阴虚发热者慎用；气滞胀满者慎用。',
            jianyi: [
                { condition: '兼气虚发热（午后低热）', change: '加大黄芪用量至30g，加地骨皮12g' },
                { condition: '久泻不止', change: '加诃子6g、肉豆蔻6g' },
                { condition: '脱肛重者', change: '加金樱子12g、五倍子6g' },
                { condition: '子宫脱垂', change: '加枳壳9g、金樱子12g' }
            ],
            jinkui: ['阴虚发热者慎用', '气滞胀满者慎用', '实证者禁用'],
            peiwu: '黄芪配人参、白术：补气健脾核心，君臣相须；黄芪配升麻、柴胡：补气升阳，升提下陷；人参配当归：气血双补，气中养血。'
        },
        '龙胆泻肝汤': {
            source: '《医方集解》',
            category: '泻火剂·清泻肝胆',
            composition: [
                { herb: '龙胆草', dosage: '6g', role: '君', function: '清泻肝胆实火，除下焦湿热，苦寒直折' },
                { herb: '黄芩', dosage: '9g', role: '臣', function: '清热燥湿，泻火解毒，助龙胆清肝胆' },
                { herb: '栀子', dosage: '9g', role: '臣', function: '清三焦湿热，利尿通淋，引热下行' },
                { herb: '泽泻', dosage: '12g', role: '佐', function: '利水渗湿，泄热，使湿热从水道而出' },
                { herb: '木通', dosage: '6g', role: '佐', function: '清心火，利小便，导热下行' },
                { herb: '车前子', dosage: '9g', role: '佐', function: '清热利湿，通淋，助泽泻木通利水' },
                { herb: '当归', dosage: '9g', role: '佐', function: '养血和血，防苦寒燥湿伤阴' },
                { herb: '生地黄', dosage: '12g', role: '佐', function: '滋阴凉血，防苦寒伤阴，养肝体' },
                { herb: '柴胡', dosage: '6g', role: '使', function: '疏肝胆之气，引药入肝胆经' },
                { herb: '生甘草', dosage: '6g', role: '使', function: '调和诸药，清热解毒' }
            ],
            indication: '肝胆实火上炎证；肝经湿热下注证',
            symptoms: ['头痛目赤', '胁痛口苦', '耳聋耳肿', '阴肿阴痒', '小便淋浊', '妇女带下黄臭'],
            yongfa: '水煎温服，每日1剂，分两次服用。中病即止，不可久服。',
            jianfu: '上十味，以水六升（约1200ml），煮取三升（约600ml），去滓。分三次温服。',
            zhuyi: '本品苦寒，易伤脾胃，中病即止，不可久服。脾胃虚寒者慎用。',
            jianyi: [
                { condition: '湿热重（小便赤涩）', change: '加滑石15g、通草6g' },
                { condition: '肝火旺（目赤头痛）', change: '加夏枯草12g、菊花9g' },
                { condition: '带下黄臭', change: '加黄柏9g、苦参9g' }
            ],
            jinkui: ['脾胃虚寒者慎用', '孕妇慎用', '不可久服'],
            peiwu: '龙胆草配黄芩、栀子：苦寒直折，清肝胆实火；泽泻、木通、车前子：利水渗湿，导热下行；当归、生地：养血滋阴，防苦寒伤阴。'
        },
        '当归补血汤': {
            source: '《内外伤辨惑论》',
            category: '补益剂·补血',
            composition: [
                { herb: '黄芪', dosage: '30g', role: '君', function: '大补脾肺之气，益气生血，气旺则血生' },
                { herb: '当归', dosage: '6g', role: '臣', function: '养血和营，补血和营，为使血有所生' }
            ],
            indication: '血虚发热证（肌热面赤，烦渴欲饮，脉洪大而虚）',
            symptoms: ['肌热面赤', '烦渴欲饮', '脉洪大而虚', '重按无力', '头晕心悸'],
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上二味，以水五升（约1000ml），煮取二升（约400ml），去滓。分两次温服。',
            zhuyi: '实热证、阴虚火旺者禁用；脾胃虚弱者宜加健脾药。',
            jianyi: [
                { condition: '气血两虚明显', change: '加人参6g、白术9g（加味当归补血汤）' },
                { condition: '血虚失眠', change: '加龙眼肉12g、酸枣仁9g' },
                { condition: '月经量少', change: '加熟地12g、川芎6g' }
            ],
            jinkui: ['实热证禁用', '阴虚火旺者禁用', '感冒发热期间暂停'],
            peiwu: '黄芪配当归：黄芪量五倍于当归，益气生血，阳生阴长。此乃李东垣"血虚发热"治法精髓。'
        },
        '血府逐瘀汤': {
            source: '《医林改错》',
            category: '理血剂·活血化瘀',
            composition: [
                { herb: '桃仁', dosage: '12g', role: '君', function: '活血祛瘀，润肠通便，为逐瘀要药' },
                { herb: '红花', dosage: '9g', role: '臣', function: '活血通经，祛瘀止痛，助桃仁化瘀' },
                { herb: '川芎', dosage: '9g', role: '臣', function: '活血行气，祛风止痛，为血中气药' },
                { herb: '赤芍', dosage: '9g', role: '佐', function: '清热凉血，散瘀止痛' },
                { herb: '当归', dosage: '9g', role: '佐', function: '养血活血，使祛瘀不伤正' },
                { herb: '生地黄', dosage: '9g', role: '佐', function: '滋阴清热，养血凉血' },
                { herb: '牛膝', dosage: '9g', role: '佐', function: '活血通经，引血下行' },
                { herb: '桔梗', dosage: '6g', role: '佐', function: '宣肺利气，载药上行' },
                { herb: '柴胡', dosage: '6g', role: '佐', function: '疏肝理气，助气血运行' },
                { herb: '枳壳', dosage: '6g', role: '佐', function: '理气宽中，行气消胀' },
                { herb: '甘草', dosage: '6g', role: '使', function: '调和诸药' }
            ],
            indication: '胸中血瘀证',
            symptoms: ['头痛', '胸痛', '胸憋', '失眠多梦', '急躁易怒', '唇暗', '舌紫暗有瘀斑'],
            yongfa: '水煎温服，每日1剂，分早晚两次服用。饭后半小时服。',
            jianfu: '上十一味，以水七升（约1400ml），煮取三升（约600ml），去滓。分三次温服。',
            zhuyi: '孕妇禁用；月经量多者经期停用。',
            jianyi: [
                { condition: '瘀血重（疼痛剧烈）', change: '加三棱6g、莪术6g' },
                { condition: '气滞明显（胀满）', change: '加香附9g、郁金9g' },
                { condition: '兼气虚（乏力）', change: '加黄芪30g、党参12g' }
            ],
            jinkui: ['孕妇禁用', '月经量多者经期停用', '无瘀血者不宜'],
            peiwu: '桃仁配红花：相须为用，活血祛瘀力强；柴胡配枳壳：一升一降，疏肝理气；桔梗配牛膝：一升一降，调畅气机，引药达病所。'
        }
    };

    function render() {
        var pills = PRESET_FANGJI.map(function(f) {
            return '<button class="fangji-pill" onclick="quickQueryFangji(\'' + f + '\')">' + f + '</button>';
        }).join('');

        return `
            <div class="fangji-page">
                <h2>方剂解析</h2>
                <p class="desc">解析君臣佐使、配伍规律、加减变化、煎服方法</p>
                <div class="search-area">
                    <div class="input-with-btn">
                        <input type="text" id="fangji-input" placeholder="输入方剂名，如：桂枝汤" onkeydown="if(event.key==='Enter')runFangji()">
                        <button onclick="runFangji()" class="search-btn">解析</button>
                    </div>
                    <div class="hint-text">可尝试：桂枝汤、小柴胡汤、四君子汤、麻黄汤、六味地黄丸、逍遥散、补中益气汤</div>
                </div>
                <div class="quick-section">
                    <div class="quick-title">常用方剂</div>
                    <div class="fangji-pills">${pills}</div>
                </div>
                <div id="fangji-result" class="result-area" style="display:none;"></div>
            </div>
        `;
    }

    window.quickQueryFangji = function(name) {
        document.getElementById('fangji-input').value = name;
        runFangji();
    };

    window.runFangji = function() {
        var name = document.getElementById('fangji-input').value.trim();
        if (!name) { alert('请输入方剂名称'); return; }

        var result = FangjiEngine.parse(name);
        if (!result) {
            alert('未找到该方剂，请尝试：桂枝汤、麻黄汤、小柴胡汤、四君子汤、六味地黄丸、逍遥散、补中益气汤、龙胆泻肝汤、当归补血汤、血府逐瘀汤');
            return;
        }

        var jcs = result.jun_chen_zuo_shi;
        var roleColors = { '君': '#c23b22', '臣': '#b8945c', '佐': '#5a7a4a', '使': '#2c4a6e' };
        var jcsHtml = jcs.map(function(item) {
            var color = roleColors[item.role] || '#666';
            return '<div class="jc-item"><span class="role" style="color:' + color + '">' + item.role + '</span><span class="herb">' + item.herb + '</span><span class="dosage">' + item.dosage + '</span><span class="function">' + item.function + '</span></div>';
        }).join('');

        var gaiHtml = result.modifications.map(function(item) {
            var noteHtml = item.note ? '<div class="gai-note">' + item.note + '</div>' : '';
            return '<div class="gai-item"><span class="gai-cond">' + item.condition + '</span><span class="gai-change">→ ' + item.change + '</span>' + noteHtml + '</div>';
        }).join('');

        var jikuangHtml = result.contraindications.map(function(item) {
            return '<div class="jinkui-item">⚠ ' + item + '</div>';
        }).join('');

        var peiwuHtml = result.peiwu ?
            '<div class="fangji-section"><h5>配伍规律</h5><p class="peiwu-text">' + result.peiwu + '</p></div>' : '';

        var yongfaHtml = result.yongfa ?
            '<div class="fangji-section"><h5>用法</h5><p class="yongfa-text">' + result.yongfa + '</p></div>' : '';

        var jianfuHtml = result.jianfu ?
            '<div class="fangji-section"><h5>煎服法</h5><p class="jianfu-text">' + result.jianfu + '</p></div>' : '';

        var zhuyiHtml = result.zhuyi ?
            '<div class="fangji-section warning-section"><h5>注意事项</h5><p>' + result.zhuyi + '</p></div>' : '';

        var html = '<div class="fangji-detail-card">';
        html += '<div class="fangji-header">';
        html += '<div class="fangji-name">' + result.name + '</div>';
        html += '<span class="fangji-source">' + result.source + '</span>';
        html += '<span class="fangji-category">' + result.category + '</span>';
        html += '</div>';

        html += '<div class="fangji-section"><h5>君臣佐使</h5><div class="jc-list">' + jcsHtml + '</div></div>';

        if (result.shanghan_wenyi && result.shanghan_wenyi.length > 0) {
            html += '<div class="fangji-section wenyi-section"><h5>📜 典籍原文</h5><div class="wenyi-list">' +
                result.shanghan_wenyi.map(function(w) {
                    return '<div class="wenyi-item"><span class="wenyi-source">' + w.source + '</span><span class="wenyi-text">' + w.text + '</span></div>';
                }).join('') +
                '</div></div>';
        }

        html += '<div class="fangji-section"><h5>主治</h5><p class="indication-text">' + result.indication + '</p></div>';
        html += '<div class="fangji-section"><h5>主症</h5><div class="symptom-tags">' +
            result.symptoms.map(function(s) { return '<span class="symptom-tag">' + s + '</span>'; }).join('') +
            '</div></div>';

        if (result.modifications.length > 0) {
            html += '<div class="fangji-section"><h5>加减变化</h5><div class="gai-list">' + gaiHtml + '</div></div>';
        }

        if (result.contraindications.length > 0) {
            html += '<div class="fangji-section warning-section"><h5>禁忌</h5><div class="jinkui-list">' + jikuangHtml + '</div></div>';
        }

        html += peiwuHtml + yongfaHtml + jianfuHtml + zhuyiHtml;
        html += _renderSuiZhengJianYi(result);
        html += '</div>';

        var resultEl = document.getElementById('fangji-result');
        if (resultEl) {
            resultEl.innerHTML = html;
            resultEl.style.display = 'block';
            resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    function _renderSuiZhengJianYi(result) {
        if (!result.modifications || result.modifications.length === 0) return '';

        // 选取第一个加减变化作为示例（有note字段的）
        var example = result.modifications.filter(function(m) { return m.note; })[0];
        if (!example) return '';

        var html = '<div class="sui-zheng-section">';
        html += '<div class="sui-zheng-title"><span class="title-icon">📋</span><span>随证加减示例 · ' + result.name + '</span></div>';
        html += '<div class="sui-zheng-flow">';

        // 基础方
        html += '<div class="flow-node base">';
        html += '<div class="flow-node-label">基础方</div>';
        html += '<div class="flow-node-name">' + result.name + '</div>';
        html += '<div class="flow-node-source">' + result.source + '</div>';
        html += '</div>';

        // 箭头
        html += '<div class="flow-arrow">→</div>';

        // 加减条件
        html += '<div class="flow-node change">';
        html += '<div class="flow-node-label">随证加减</div>';
        html += '<div class="flow-node-cond">' + example.condition + '</div>';
        html += '<div class="flow-node-change">→ ' + example.change + '</div>';
        html += '<div class="flow-node-note">' + example.note + '</div>';
        html += '</div>';

        html += '</div>';

        // 完整加减列表
        html += '<div class="all-modifications">';
        html += '<div class="all-mod-title">其他加减变化</div>';
        result.modifications.forEach(function(mod, i) {
            var isExample = mod === example;
            var noteHtml = mod.note ? '<div class="gai-note-small">' + mod.note + '</div>' : '';
            html += '<div class="gai-item' + (isExample ? ' example' : '') + '">';
            html += '<span class="gai-cond">' + mod.condition + '</span>';
            html += '<span class="gai-change">→ ' + mod.change + '</span>';
            html += noteHtml;
            html += '</div>';
        });
        html += '</div>';

        html += '</div>';
        return html;
    }

    global.FangjiComponent = { render: render };
})(typeof window !== 'undefined' ? window : this);
