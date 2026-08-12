/**
 * 岐黄阁 · 方剂解析引擎
 * 君臣佐使分析 · 配伍规律 · 加减变化 · 随证加减示例
 */
(function(global) {
    'use strict';

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
            禁忌: ['表实无汗者禁用', '温病初起者禁用', '阴虚火旺者慎用'],
            加减: [
                { condition: '兼项背强几几（项背拘紧不舒）', change: '加葛根12g，方名：桂枝加葛根汤', note: '葛根解肌发表，升津舒筋，专治项背强痛' },
                { condition: '兼喘（肺气上逆）', change: '加厚朴6g、杏仁9g，方名：桂枝加厚朴杏子汤', note: '厚朴降气平喘，杏仁降利肺气，一宣一降' },
                { condition: '阳虚漏汗不止', change: '加附子6g（先煎），方名：桂枝加附子汤', note: '附子温经扶阳，固表止汗，治阳虚漏汗' },
                { condition: '营血不足', change: '加当归9g、川芎6g', note: '当归补血活血，川芎行气活血，补血调经' }
            ],
            peiwu: '桂枝配白芍：一散一收，调和营卫核心配伍；生姜配大枣：一散一补，调和脾胃；桂枝配甘草：辛甘化阳，温通心阳；白芍配甘草：酸甘化阴，缓急止痛。',
            yongfa: '水煎温服，每日1剂，分三次服。服后啜热稀粥一碗，助药力发汗。盖被取微汗，不可令如水流漓。',
            jianfu: '上五味，以水七升（约1400ml），微火煮取三升（约600ml），去滓。分三次温服，间隔约4小时。服后啜热粥以助药力。',
            shanghan_wenyi: [
                { source: '《伤寒论》第12条', text: '太阳中风，阳浮而阴弱，阳浮者热自发，阴弱者汗自出，啬啬恶寒，淅淅恶风，翕翕发热，鼻鸣干呕者，桂枝汤主之。' },
                { source: '《伤寒论》桂枝汤方后注', text: '服已须臾，啜热稀粥一升余，以助药力。温覆令一时许，遍身漐漐微似有汗者益佳，不可令如水流漓，病必不除。' }
            ]
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
            禁忌: ['表虚自汗者禁用', '疮家、淋家、衄家禁用', '孕妇慎用'],
            加减: [
                { condition: '兼里有郁热（大热大烦）', change: '加石膏18g、生姜3片、大枣4枚，方名：大青龙汤', note: '石膏清里热，姜枣护胃气，治外寒内热' },
                { condition: '咳嗽痰多白稀', change: '加半夏9g、陈皮6g', note: '半夏燥湿化痰，陈皮理气化痰，治痰湿咳嗽' }
            ],
            peiwu: '麻黄配桂枝：相须为用，发汗力倍增；麻黄配杏仁：一宣一降，调理肺气；麻黄配甘草：缓其峻烈，防过汗伤正。',
            yongfa: '水煎温服，取微汗即止，不可过汗。汗出即停服，余药勿进。',
            jianfu: '上四味，以水九升（约1800ml），先煮麻黄减二升（约400ml），去上沫，内诸药，煮取二升（约400ml），去滓。分两次温服。',
            shanghan_wenyi: [
                { source: '《伤寒论》第3条', text: '太阳病，或已发热，或未发热，必恶寒，体痛，呕逆，脉阴阳俱紧者，名为伤寒。' },
                { source: '《伤寒论》第35条', text: '太阳病，头痛发热，身痛腰痛，骨节疼痛，恶风无汗而喘者，麻黄汤主之。' }
            ]
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
            禁忌: ['太阳表证未解者慎用', '里虚寒证者慎用', '孕妇慎用半夏'],
            加减: [
                { condition: '胸中烦而不呕（热扰胸膈）', change: '去半夏、人参，加瓜蒌实12g', note: '瓜蒌实清热化痰散结，去人参防助热' },
                { condition: '腹中痛（肝脾不和）', change: '去黄芩，加芍药12g', note: '芍药柔肝缓急止痛，去黄芩防寒伤脾' },
                { condition: '咳嗽（肺气上逆）', change: '去人参、大枣、生姜，加五味子6g、干姜6g', note: '五味子敛肺止咳，干姜温肺化饮' },
                { condition: '心悸小便不利', change: '加桂枝9g、茯苓12g', note: '桂枝通阳化气，茯苓利水宁心' }
            ],
            peiwu: '柴胡配黄芩：一散一清，和解少阳核心配伍；半夏配生姜：和胃降逆，止呕要药；人参配大枣：扶正祛邪，防邪内传。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上七味，以水一斗二升（约2400ml），煮取六升（约1200ml），去滓，再煎取三升（约600ml）。温服一升（约200ml），日三服。',
            shanghan_wenyi: [
                { source: '《伤寒论》第96条', text: '伤寒五六日中风，往来寒热，胸胁苦满，默默不欲饮食，心烦喜呕，或胸中烦而不呕，或渴，或腹中痛，或胁下痞硬，或心下悸小便不利，或不渴身有微热，或咳者，小柴胡汤主之。' },
                { source: '《伤寒论》第265条', text: '伤寒，脉弦细，头痛发热者，属少阳。少阳不可发汗，发汗则谵语，此属胃。胃和则愈，胃不和，烦而悸。' }
            ]
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
            禁忌: ['实证、热证慎用', '气滞胀满者慎用'],
            加减: [
                { condition: '气虚甚（气短明显）', change: '加重人参用量至12g，或换红参', note: '重用人参增强补气之力' },
                { condition: '兼湿盛（苔腻便溏）', change: '加陈皮6g，方名：异功散', note: '陈皮理气化湿，使补而不滞' },
                { condition: '兼气滞（脘腹胀满）', change: '加陈皮6g、砂仁3g，方名：六君子汤', note: '砂仁化湿醒脾，行气宽中' },
                { condition: '气血两虚', change: '加熟地12g、当归9g，方名：八珍汤', note: '气血双补，治气血两虚证' },
                { condition: '气阴两虚', change: '加麦冬9g、五味子6g', note: '麦冬养阴，五味子敛气' }
            ],
            peiwu: '人参配白术：补气健脾核心，君臣相须；白术配茯苓：健脾燥湿与渗湿利水相伍，标本兼顾；参术配甘草：补气之力倍增，为益气基础方。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。可作汤剂或丸剂。',
            jianfu: '上四味，以水六升（约1200ml），煮取二升（约400ml），去滓。分两次温服。'
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
            禁忌: ['脾胃虚弱、食少便溏者慎用', '阳虚者禁用', '外感发热期间暂停'],
            加减: [
                { condition: '虚火偏旺（潮热盗汗明显）', change: '加知母9g、黄柏9g，方名：知柏地黄丸', note: '知母清热泻火，黄柏泻相火' },
                { condition: '肺痨咳嗽（干咳少痰）', change: '加阿胶9g、龟板12g，方名：大补阴丸', note: '阿胶润肺止血，龟板滋阴潜阳' },
                { condition: '肝肾阴虚而目昏（眼干涩）', change: '加枸杞子12g、菊花6g，方名：杞菊地黄丸', note: '枸杞养肝明目，菊花清肝泻火' },
                { condition: '肾不纳气（喘促气短）', change: '加五味子6g、蛤蚧1对', note: '五味子敛肺补肾，蛤蚧纳气平喘' }
            ],
            peiwu: '熟地配山茱萸、山药：三补肝脾肾，滋而不腻；泽泻配丹皮、茯苓：三泻泄浊清热，补中有泻。三补三泻，以补为主，补而不滞。',
            yongfa: '水煎服或丸剂吞服。丸剂每次6-9g，每日2次，饭前温开水送服。',
            jianfu: '上六味，研为细末，炼蜜为丸，如梧桐子大。每服空心盐汤或温开水送下。'
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
            禁忌: ['阴虚火旺者慎用', '孕妇慎用柴胡、薄荷'],
            加减: [
                { condition: '肝郁化热（烦躁易怒、口苦）', change: '加丹皮9g、栀子9g，方名：丹栀逍遥散', note: '丹皮清血中伏火，栀子清三焦之热' },
                { condition: '月经不调（经行腹痛）', change: '加香附9g、益母草15g', note: '香附理气调经，益母草活血调经' },
                { condition: '乳房胀痛明显', change: '加青皮6g、橘叶9g', note: '青皮疏肝破气，橘叶理气散结' },
                { condition: '脾虚便溏', change: '加薏苡仁15g、莲子12g', note: '薏苡仁健脾利湿，莲子健脾止泻' }
            ],
            peiwu: '柴胡配当归、白芍：疏肝养肝并举，体用兼顾；柴胡配薄荷：疏肝透热，条达气机；白术配茯苓：健脾渗湿，培土荣木。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。亦可作丸剂，每次6g，每日2次。',
            jianfu: '上八味，以水六升（约1200ml），煮取三升（约600ml），去滓。分三次温服。'
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
            禁忌: ['阴虚发热者慎用', '气滞胀满者慎用'],
            加减: [
                { condition: '兼气虚发热（午后低热）', change: '加大黄芪用量至30g，加地骨皮12g', note: '重用人参黄芪补气退热，地骨皮清虚热' },
                { condition: '久泻不止', change: '加诃子6g、肉豆蔻6g', note: '诃子涩肠止泻，肉豆蔻温中涩肠' },
                { condition: '脱肛重者', change: '加金樱子12g、五倍子6g', note: '金樱子涩精缩尿，五倍子涩肠固脱' },
                { condition: '子宫脱垂', change: '加枳壳9g、金樱子12g', note: '枳壳理气升提，金樱子固摄' }
            ],
            peiwu: '黄芪配人参、白术：补气健脾核心，君臣相须；黄芪配升麻、柴胡：补气升阳，升提下陷；人参配当归：气血双补，气中养血。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。饭后半小时服为佳。',
            jianfu: '上八味，以水七升（约1400ml），煮取三升（约600ml），去滓。分三次温服。'
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
            禁忌: ['脾胃虚寒者慎用', '孕妇慎用', '不可久服'],
            加减: [
                { condition: '湿热重（小便赤涩）', change: '加滑石15g、通草6g', note: '滑石利水通淋，通草通利血脉' },
                { condition: '肝火旺（目赤头痛剧烈）', change: '加夏枯草12g、菊花9g', note: '夏枯草清肝泻火，菊花清肝明目' },
                { condition: '带下黄臭', change: '加黄柏9g、苦参9g', note: '黄柏清下焦湿热，苦参清热燥湿' }
            ],
            peiwu: '龙胆草配黄芩、栀子：苦寒直折，清肝胆实火；泽泻、木通、车前子：利水渗湿，导热下行；当归、生地：养血滋阴，防苦寒伤阴。',
            yongfa: '水煎温服，每日1剂，分两次服用。中病即止，不可久服。',
            jianfu: '上十味，以水六升（约1200ml），煮取三升（约600ml），去滓。分三次温服。'
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
            禁忌: ['实热证禁用', '阴虚火旺者禁用', '感冒发热期间暂停'],
            加减: [
                { condition: '气血两虚明显', change: '加人参6g、白术9g', note: '参术增强补气健脾之力' },
                { condition: '血虚失眠', change: '加龙眼肉12g、酸枣仁9g', note: '龙眼肉补血安神，酸枣仁养心安神' },
                { condition: '月经量少', change: '加熟地12g、川芎6g', note: '熟地补血填精，川芎活血行气' }
            ],
            peiwu: '黄芪配当归：黄芪量五倍于当归，益气生血，阳生阴长。此乃李东垣"血虚发热"治法精髓。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上二味，以水五升（约1000ml），煮取二升（约400ml），去滓。分两次温服。'
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
            禁忌: ['孕妇禁用', '月经量多者经期停用', '无瘀血者不宜'],
            加减: [
                { condition: '瘀血重（疼痛剧烈）', change: '加三棱6g、莪术6g', note: '三棱莪术破血行气，祛瘀止痛力强' },
                { condition: '气滞明显（胀满）', change: '加香附9g、郁金9g', note: '香附理气调经，郁金行气解郁' },
                { condition: '兼气虚（乏力）', change: '加黄芪30g、党参12g', note: '黄芪大补元气，党参健脾益气' }
            ],
            peiwu: '桃仁配红花：相须为用，活血祛瘀力强；柴胡配枳壳：一升一降，疏肝理气；桔梗配牛膝：一升一降，调畅气机，引药达病所。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。饭后半小时服。',
            jianfu: '上十一味，以水七升（约1400ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '参苓白术散': {
            source: '《太平惠民和剂局方》',
            category: '补益剂·补气',
            composition: [
                { herb: '人参', dosage: '9g', role: '君', function: '大补元气，健脾益肺' },
                { herb: '白术', dosage: '9g', role: '臣', function: '健脾燥湿，助人参益气' },
                { herb: '茯苓', dosage: '9g', role: '臣', function: '健脾渗湿，助白术运化' },
                { herb: '山药', dosage: '9g', role: '佐', function: '补脾益肾，涩肠止泻' },
                { herb: '白扁豆', dosage: '9g', role: '佐', function: '健脾化湿，消暑解毒' },
                { herb: '莲子', dosage: '9g', role: '佐', function: '健脾止泻，养心安神' },
                { herb: '薏苡仁', dosage: '9g', role: '佐', function: '健脾渗湿，清热排脓' },
                { herb: '砂仁', dosage: '3g', role: '佐', function: '化湿醒脾，行气和中' },
                { herb: '桔梗', dosage: '6g', role: '佐使', function: '宣肺利气，载药上行，通调水道' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中' }
            ],
            indication: '脾虚湿盛证',
            symptoms: ['饮食不化', '胸脘痞闷', '肠鸣泄泻', '四肢乏力', '形体消瘦', '面色萎黄'],
            禁忌: ['实证泄泻慎用', '阴虚火旺者慎用'],
            加减: [
                { condition: '湿重苔白厚腻', change: '加苍术6g、厚朴6g', note: '苍术燥湿健脾，厚朴行气除满' },
                { condition: '久泻不止', change: '加诃子6g、罂粟壳3g', note: '诃子涩肠止泻，罂粟壳收敛止泻' },
                { condition: '兼气虚发热', change: '加黄芪15g、地骨皮9g', note: '黄芪补气升阳，地骨皮清虚热' }
            ],
            peiwu: '人参配白术、茯苓：健脾益气核心；山药配莲子：健脾止泻，脾肾双补；砂仁配桔梗：一升一降，调畅气机。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。亦可作散剂，每次6-9g，每日2次，大枣煎汤送服。',
            jianfu: '上十味，研为细末。每服二钱（约6g），大枣煎汤调下。'
        },
        '麻黄杏仁甘草石膏汤': {
            source: '《伤寒论》',
            category: '解表剂·辛凉解表',
            composition: [
                { herb: '麻黄', dosage: '9g', role: '君', function: '发汗解表，宣肺平喘' },
                { herb: '杏仁', dosage: '9g', role: '臣', function: '降利肺气，助麻黄宣肺平喘' },
                { herb: '石膏', dosage: '24g', role: '臣', function: '清泄肺热，除烦止渴，制麻黄温性' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中' }
            ],
            indication: '外感风邪，邪热壅肺证',
            symptoms: ['身热不解', '咳逆气急', '鼻煽', '口渴', '有汗或无汗', '舌苔薄白或黄', '脉浮数'],
            禁忌: ['表虚自汗者慎用', '脾胃虚寒者慎用'],
            加减: [
                { condition: '热重（高热烦渴）', change: '加大石膏用量至40g', note: '重用石膏清泄肺胃实热' },
                { condition: '咳嗽痰多', change: '加浙贝母9g、瓜蒌12g', note: '浙贝母清热化痰，瓜蒌宽胸化痰' },
                { condition: '咽痛', change: '加射干9g、桔梗6g', note: '射干利咽消肿，桔梗宣肺利咽' }
            ],
            peiwu: '麻黄配石膏：辛温与辛寒相伍，麻黄得石膏则发散不助热，石膏得麻黄则清泄不伤阳，为清宣肺热核心配伍。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上四味，以水七升（约1400ml），煮麻黄减二升，去上沫，内诸药，煮取二升（约400ml），去滓。分三次温服。'
        },
        '玉屏风散': {
            source: '《医方类聚》',
            category: '补益剂·补气',
            composition: [
                { herb: '黄芪', dosage: '30g', role: '君', function: '补肺益气，固表止汗' },
                { herb: '白术', dosage: '12g', role: '臣', function: '健脾益气，助黄芪补气固表' },
                { herb: '防风', dosage: '6g', role: '佐使', function: '走表祛风，御风邪，为黄芪之佐使' }
            ],
            indication: '表虚自汗证；体虚易感证',
            symptoms: ['自汗恶风', '面色㿠白', '舌淡苔白', '脉浮虚'],
            禁忌: ['阴虚盗汗者禁用', '外感发热者禁用'],
            加减: [
                { condition: '气虚甚（气短乏力）', change: '加人参6g、党参12g', note: '参类增强补气之力' },
                { condition: '易感冒', change: '加紫苏叶6g、生姜3片', note: '苏叶生姜解表散邪，防外感' },
                { condition: '兼阴虚', change: '加五味子6g、麦冬9g', note: '五味子敛阴止汗，麦冬养阴润肺' }
            ],
            peiwu: '黄芪配白术：补气健脾，固表止汗；黄芪配防风：补中寓散，固表不留邪，祛邪不伤正，如玉屏藩。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。亦可作散剂，每次3-6g，每日2次。',
            jianfu: '上三味，以水五升（约1000ml），煮取二升（约400ml），去滓。分两次温服。'
        },
        '归脾汤': {
            source: '《济生方》',
            category: '补益剂·补气',
            composition: [
                { herb: '人参', dosage: '6g', role: '君', function: '大补元气，健脾养心' },
                { herb: '黄芪', dosage: '12g', role: '臣', function: '补中益气，健脾生血' },
                { herb: '白术', dosage: '9g', role: '臣', function: '健脾燥湿，助人参黄芪补气' },
                { herb: '当归', dosage: '9g', role: '佐', function: '养血活血，补而不滞' },
                { herb: '龙眼肉', dosage: '9g', role: '佐', function: '补益心脾，养血安神' },
                { herb: '酸枣仁', dosage: '9g', role: '佐', function: '养心安神，敛汗' },
                { herb: '远志', dosage: '6g', role: '佐', function: '安神益智，交通心肾' },
                { herb: '茯神', dosage: '9g', role: '佐', function: '宁心安神' },
                { herb: '木香', dosage: '3g', role: '佐', function: '理气醒脾，防补药滞气' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中' },
                { herb: '生姜', dosage: '3片', role: '佐', function: '调和脾胃' },
                { herb: '大枣', dosage: '3枚', role: '佐', function: '补脾益气' }
            ],
            indication: '心脾气血两虚证；脾不统血证',
            symptoms: ['心悸怔忡', '失眠多梦', '体倦食少', '面色萎黄', '崩漏便血'],
            禁忌: ['实证、热证慎用', '阴虚火旺者慎用'],
            加减: [
                { condition: '失眠严重', change: '加夜交藤15g、合欢花9g', note: '夜交藤养心安神，合欢花解郁安神' },
                { condition: '崩漏不止', change: '加棕榈炭9g、侧柏炭9g', note: '炭类药增强收敛止血之力' },
                { condition: '食欲不振', change: '加陈皮6g、砂仁3g', note: '陈皮理气化湿，砂仁醒脾开胃' }
            ],
            peiwu: '人参配黄芪：补气核心；当归配龙眼肉：补血要药；酸枣仁配远志：养心安神；木香配参术：理气醒脾，使补而不滞。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上十二味，以水六升（约1200ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '四逆散': {
            source: '《伤寒论》',
            category: '和解剂·疏肝理气',
            composition: [
                { herb: '柴胡', dosage: '9g', role: '君', function: '疏肝解郁，升发阳气' },
                { herb: '白芍', dosage: '9g', role: '臣', function: '养血柔肝，缓急止痛' },
                { herb: '枳实', dosage: '9g', role: '佐', function: '行气破结，降浊消痞' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中' }
            ],
            indication: '阳郁厥逆证；肝郁脾虚证',
            symptoms: ['手足不温', '胁肋胀痛', '脘腹疼痛', '泄利下重', '脉弦'],
            禁忌: ['阴虚火旺者慎用', '孕妇慎用枳实'],
            加减: [
                { condition: '咳嗽', change: '加五味子6g、干姜6g', note: '五味子敛肺，干姜温肺化饮' },
                { condition: '心悸', change: '加桂枝9g、龙骨15g', note: '桂枝通阳，龙骨镇心安神' },
                { condition: '小便不利', change: '加茯苓12g', note: '茯苓利水渗湿，健脾宁心' }
            ],
            peiwu: '柴胡配白芍：一散一收，疏肝养肝；柴胡配枳实：一升一降，疏肝理气；白芍配甘草：酸甘化阴，缓急止痛。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上四味，以水五升（约1000ml），煮取二升（约400ml），去滓。分两次温服。'
        },
        '大承气汤': {
            source: '《伤寒论》',
            category: '泻下剂·寒下',
            composition: [
                { herb: '大黄', dosage: '12g', role: '君', function: '泻热通便，荡涤肠胃，后下' },
                { herb: '芒硝', dosage: '9g', role: '臣', function: '软坚润燥，泻热通便，冲服' },
                { herb: '枳实', dosage: '12g', role: '佐', function: '破气消痞，行气导滞' },
                { herb: '厚朴', dosage: '12g', role: '佐', function: '行气除满，助硝黄推荡积滞' }
            ],
            indication: '阳明腑实证；热结旁流证',
            symptoms: ['大便秘结', '脘腹痞满', '腹痛拒按', '潮热谵语', '舌苔黄燥', '脉沉实'],
            禁忌: ['表证未解者禁用', '孕妇禁用', '年老体弱者慎用', '病后脾胃虚弱者禁用'],
            加减: [
                { condition: '热盛伤阴', change: '加玄参12g、麦冬12g', note: '增液承气，养阴通便' },
                { condition: '瘀热互结', change: '加桃仁12g、丹皮9g', note: '活血逐瘀，泄热通腑' }
            ],
            peiwu: '大黄配芒硝：泻热通便，相须为用；枳实配厚朴：行气除满，气行则便通。急下行阴，釜底抽薪。',
            yongfa: '水煎，先煮枳实、厚朴，后下大黄，去滓，内芒硝，微火煮沸，服后得下止后服。',
            jianfu: '上四味，以水一斗（约2000ml），先煮枳实、厚朴，取五升（约1000ml），去滓，内大黄，煮取二升（约400ml），去滓，内芒硝，微火一沸。分两次温服。'
        },
        '桂枝茯苓丸': {
            source: '《金匮要略》',
            category: '理血剂·活血化瘀',
            composition: [
                { herb: '桂枝', dosage: '9g', role: '君', function: '温通经脉，活血化瘀' },
                { herb: '茯苓', dosage: '9g', role: '臣', function: '渗湿利水，健脾宁心' },
                { herb: '牡丹皮', dosage: '9g', role: '臣', function: '清热凉血，活血散瘀' },
                { herb: '桃仁', dosage: '9g', role: '佐', function: '活血祛瘀，润肠通便' },
                { herb: '白芍', dosage: '9g', role: '佐', function: '养血和营，缓急止痛' }
            ],
            indication: '瘀阻胞宫证；癥块积聚',
            symptoms: ['小腹疼痛', '痛经', '月经不调', '经色紫暗有块', '舌紫暗或有瘀斑'],
            禁忌: ['孕妇禁用', '月经过多者经期停用'],
            加减: [
                { condition: '血瘀重（疼痛剧烈）', change: '加三棱6g、莪术6g', note: '三棱莪术破血行气，祛瘀力强' },
                { condition: '兼气虚（乏力）', change: '加黄芪15g、党参12g', note: '补气以行血，气行则瘀化' }
            ],
            peiwu: '桂枝配桃仁：温通血脉，活血化瘀；牡丹皮配赤芍：凉血散瘀，治瘀热互结；茯苓配白芍：健脾养血，扶正祛邪。',
            yongfa: '水煎服或丸剂吞服。丸剂每次6g，每日2次。',
            jianfu: '上五味，研为细末，炼蜜为丸，如梧桐子大。每服十丸，渐加至二十丸，温开水送下，日三服。'
        },
        '半夏厚朴汤': {
            source: '《金匮要略》',
            category: '理气剂·行气',
            composition: [
                { herb: '半夏', dosage: '12g', role: '君', function: '燥湿化痰，降逆止呕，散结消痞' },
                { herb: '厚朴', dosage: '9g', role: '臣', function: '行气除满，下气消痰' },
                { herb: '茯苓', dosage: '9g', role: '佐', function: '健脾渗湿，杜生痰之源' },
                { herb: '生姜', dosage: '9g', role: '佐', function: '和胃止呕，制半夏之毒' },
                { herb: '苏叶', dosage: '6g', role: '使', function: '疏肝理气，宣通郁结' }
            ],
            indication: '梅核气；痰气互结证',
            symptoms: ['咽喉中有异物感', '咳之不出', '咽之不下', '胸胁满闷', '苔白腻', '脉弦滑'],
            禁忌: ['阴虚火旺者慎用', '痰热咳嗽者禁用'],
            加减: [
                { condition: '兼气郁化火', change: '加黄芩9g、栀子9g', note: '清热泻火，防痰气郁而化火' },
                { condition: '气郁甚（情绪抑郁）', change: '加香附9g、郁金9g', note: '香附疏肝理气，郁金解郁清心' }
            ],
            peiwu: '半夏配厚朴：化痰行气，散结消痞为君；茯苓配生姜：健脾和胃，降逆止呕；苏叶助厚朴疏肝理气。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上五味，以水七升（约1400ml），煮取四升（约800ml），去滓。分四次温服，日三夜一。'
        },
        '半夏泻心汤': {
            source: '《伤寒论》',
            category: '和解剂·调和寒热',
            composition: [
                { herb: '半夏', dosage: '12g', role: '君', function: '燥湿化痰，降逆止呕，消痞散结' },
                { herb: '黄芩', dosage: '9g', role: '臣', function: '清热燥湿，泻火解毒' },
                { herb: '黄连', dosage: '3g', role: '臣', function: '清热燥湿，泻心火' },
                { herb: '干姜', dosage: '9g', role: '佐', function: '温中散寒，助半夏散结' },
                { herb: '人参', dosage: '6g', role: '佐', function: '补气健脾，扶正祛邪' },
                { herb: '炙甘草', dosage: '9g', role: '佐使', function: '益气和中，调和诸药' },
                { herb: '大枣', dosage: '4枚', role: '佐', function: '补脾益气，调和营卫' }
            ],
            indication: '寒热错杂之痞证',
            symptoms: ['心下痞满', '呕吐', '肠鸣泄泻', '苔腻微黄', '脉弦数'],
            禁忌: ['纯热无寒者慎用', '纯寒无热者慎用'],
            加减: [
                { condition: '寒重（呕吐清涎）', change: '加附子6g（先煎）', note: '附子温阳散寒，治寒重呕吐' },
                { condition: '热重（口苦苔黄）', change: '加黄芩至12g', note: '加重清热之力' }
            ],
            peiwu: '半夏配干姜：辛开散结，温化痰饮；黄芩配黄连：苦寒清热，泻火燥湿；人参配甘草大枣：益气和中，扶正祛邪。寒热并用，辛开苦降。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上七味，以水一斗（约2000ml），煮取六升（约1200ml），去滓，再煎取三升（约600ml）。温服一升，日三服。'
        },
        '茵陈蒿汤': {
            source: '《伤寒论》',
            category: '泻下剂·清热利湿',
            composition: [
                { herb: '茵陈', dosage: '30g', role: '君', function: '清热利湿，退黄，为治黄疸要药' },
                { herb: '栀子', dosage: '9g', role: '臣', function: '清利三焦湿热，导热下行' },
                { herb: '大黄', dosage: '6g', role: '佐', function: '泻热逐瘀，通利大便' }
            ],
            indication: '阳黄证（湿热黄疸）',
            symptoms: ['身黄目黄', '小便黄赤', '发热', '口渴', '苔黄腻', '脉弦数'],
            禁忌: ['阴黄（寒湿黄疸）禁用', '脾胃虚寒者慎用'],
            加减: [
                { condition: '湿重于热（苔白腻）', change: '加茯苓15g、猪苓12g', note: '加强利水渗湿' },
                { condition: '热重于湿（高热口渴）', change: '加黄芩9g、黄柏9g', note: '加强清热燥湿' }
            ],
            peiwu: '茵陈为君，清热利湿退黄；栀子通利三焦，引湿热从小便出；大黄泻热逐瘀，通利大便。二便分消，湿热得去。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上三味，以水一斗（约2000ml），先煮茵陈，减六升（约1200ml），内栀子、大黄，煮取二升（约400ml），去滓。分三次温服。'
        },
        '理中丸': {
            source: '《伤寒论》',
            category: '温里剂·温中祛寒',
            composition: [
                { herb: '人参', dosage: '9g', role: '君', function: '大补元气，健脾益气' },
                { herb: '干姜', dosage: '9g', role: '臣', function: '温中散寒，助阳守中' },
                { herb: '白术', dosage: '9g', role: '臣', function: '健脾燥湿，助人参益气' },
                { herb: '炙甘草', dosage: '9g', role: '使', function: '益气和中，调和诸药' }
            ],
            indication: '太阴虚寒证；中焦虚寒证',
            symptoms: ['腹痛喜温喜按', '吐泻', '畏寒肢冷', '口淡不渴', '舌淡苔白', '脉沉细'],
            禁忌: ['实热腹痛者禁用', '阴虚内热者禁用'],
            加减: [
                { condition: '寒重（腹痛剧烈）', change: '干姜加至12g，加附子6g', note: '姜附温阳散寒力强' },
                { condition: '吐甚', change: '加生姜12g、半夏9g', note: '生姜半夏和胃降逆止呕' }
            ],
            peiwu: '人参配白术：益气健脾；干姜配甘草：辛甘化阳，温中散寒。四药相合，温中散寒，健脾益气。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。或作丸剂，每次9g，每日2次。',
            jianfu: '上四味，以水八升（约1600ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '小承气汤': {
            source: '《伤寒论》',
            category: '泻下剂·轻下热结',
            composition: [
                { herb: '大黄', dosage: '12g', role: '君', function: '泻热通便，荡涤积滞' },
                { herb: '枳实', dosage: '9g', role: '臣', function: '破气消痞，行气导滞' },
                { herb: '厚朴', dosage: '6g', role: '佐', function: '行气除满' }
            ],
            indication: '阳明腑实轻证',
            symptoms: ['大便秘结', '脘腹痞满', '潮热谵语', '舌苔老黄', '脉滑数'],
            禁忌: ['表证未解者禁用', '孕妇禁用', '年老体弱者慎用'],
            加减: [
                { condition: '气虚明显', change: '加人参6g', note: '益气扶正，防泻下伤正' },
                { condition: '热盛口渴', change: '加石膏18g、知母9g', note: '清热生津，治热盛伤津' }
            ],
            peiwu: '大黄泻热通便为主；枳实厚朴行气除满为辅。比大承气汤少芒硝，泻下之力较缓。',
            yongfa: '水煎温服，每日1剂，分两次服用。得下止后服。',
            jianfu: '上三味，以水四升（约800ml），煮取二升（约400ml），去滓。分两次温服。'
        },
        '平胃散': {
            source: '《太平惠民和剂局方》',
            category: '祛湿剂·燥湿和胃',
            composition: [
                { herb: '苍术', dosage: '15g', role: '君', function: '燥湿健脾，祛风散寒' },
                { herb: '厚朴', dosage: '9g', role: '臣', function: '行气除满，燥湿消积' },
                { herb: '陈皮', dosage: '9g', role: '佐', function: '理气燥湿，和胃止呕' },
                { herb: '炙甘草', dosage: '3g', role: '使', function: '调和诸药，益气和中' },
                { herb: '生姜', dosage: '3片', role: '佐', function: '和中养胃' },
                { herb: '大枣', dosage: '2枚', role: '佐', function: '补脾和中' }
            ],
            indication: '湿滞脾胃证',
            symptoms: ['脘腹胀满', '不思饮食', '口淡无味', '恶心呕吐', '肢体沉重', '舌苔白腻'],
            禁忌: ['阴虚津亏者慎用', '孕妇慎用'],
            加减: [
                { condition: '湿郁化热', change: '加黄连3g、黄芩9g', note: '清热燥湿，治湿热并重' },
                { condition: '食滞腹胀', change: '加山楂12g、神曲9g', note: '消食化积，理气除胀' }
            ],
            peiwu: '苍术为君，燥湿健脾；厚朴为臣，行气除满；陈皮为佐，理气化湿。燥湿与行气并举，以燥为主。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。或为散剂，每次6g，姜枣煎汤调下。',
            jianfu: '上六味，以水三升（约600ml），煮取一升（约200ml），去滓。温服。'
        },
        '真武汤': {
            source: '《伤寒论》',
            category: '温里剂·温阳利水',
            composition: [
                { herb: '附子', dosage: '9g', role: '君', function: '温肾助阳，化气行水（先煎1小时）' },
                { herb: '茯苓', dosage: '9g', role: '臣', function: '健脾渗湿，利水消肿' },
                { herb: '白术', dosage: '9g', role: '臣', function: '健脾燥湿，助茯苓利水' },
                { herb: '白芍', dosage: '9g', role: '佐', function: '敛阴和营，防附子燥烈伤阴' },
                { herb: '生姜', dosage: '9g', role: '佐', function: '温散水气，助附子温阳' }
            ],
            indication: '脾肾阳虚水泛证',
            symptoms: ['小便不利', '肢体浮肿', '畏寒肢冷', '腹痛下利', '心悸', '舌淡胖苔白滑'],
            禁忌: ['阴虚水肿者禁用', '实热证禁用'],
            加减: [
                { condition: '水肿甚', change: '加泽泻12g、猪苓9g', note: '加强利水消肿' },
                { condition: '喘息', change: '加五味子6g、细辛3g', note: '敛肺平喘，温化寒饮' }
            ],
            peiwu: '附子为君，温肾助阳化气；茯苓白术为臣，健脾渗湿利水；白芍敛阴防燥，生姜温散水气。温阳与利水并用。',
            yongfa: '水煎温服，每日1剂，分三次服用。附子先煎1小时以上去毒性。',
            jianfu: '上五味，以水八升（约1600ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '实脾散': {
            source: '《济生方》',
            category: '祛湿剂·温阳健脾利水',
            composition: [
                { herb: '附子', dosage: '6g', role: '君', function: '温肾助阳，化气行水（先煎）' },
                { herb: '干姜', dosage: '9g', role: '臣', function: '温脾散寒，助附子温阳' },
                { herb: '白术', dosage: '9g', role: '臣', function: '健脾燥湿' },
                { herb: '茯苓', dosage: '12g', role: '佐', function: '健脾渗湿利水' },
                { herb: '厚朴', dosage: '6g', role: '佐', function: '行气除满' },
                { herb: '木香', dosage: '3g', role: '佐', function: '理气醒脾' },
                { herb: '大腹子', dosage: '9g', role: '佐', function: '行气利水消肿' },
                { herb: '木瓜', dosage: '9g', role: '佐', function: '化湿和胃，舒筋活络' },
                { herb: '炙甘草', dosage: '3g', role: '使', function: '调和诸药' },
                { herb: '生姜', dosage: '3片', role: '佐使', function: '温散水气' },
                { herb: '大枣', dosage: '3枚', role: '佐', function: '补脾和中' }
            ],
            indication: '脾肾阳虚水肿（阴水）',
            symptoms: ['身半以下肿甚', '胸腹胀满', '小便短少', '畏寒肢冷', '大便溏薄'],
            禁忌: ['阳水（湿热水肿）禁用', '阴虚水肿者禁用'],
            加减: [
                { condition: '气虚明显', change: '加黄芪15g、人参6g', note: '补气行水，气行则水行' },
                { condition: '气短乏力', change: '加党参12g', note: '健脾益气' }
            ],
            peiwu: '附子干姜温阳散寒为君；白术茯苓健脾利水为臣；木香厚朴行气导滞为佐。温阳健脾，行气利水。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上十一味，以水五升（约1000ml），煮取二升（约400ml），去滓。分两次温服。'
        },
        '五苓散': {
            source: '《伤寒论》',
            category: '祛湿剂·利水渗湿',
            composition: [
                { herb: '泽泻', dosage: '15g', role: '君', function: '利水渗湿，直达膀胱' },
                { herb: '茯苓', dosage: '9g', role: '臣', function: '健脾渗湿，利水消肿' },
                { herb: '猪苓', dosage: '9g', role: '臣', function: '利水渗湿，助泽泻利水' },
                { herb: '白术', dosage: '9g', role: '佐', function: '健脾燥湿，助运化水湿' },
                { herb: '桂枝', dosage: '6g', role: '佐使', function: '温阳化气，解表散邪' }
            ],
            indication: '太阳蓄水证；水湿内停证',
            symptoms: ['小便不利', '头痛微热', '烦渴欲饮', '水入则吐', '水肿泄泻'],
            禁忌: ['阴虚津亏者慎用', '无水印者慎用'],
            加减: [
                { condition: '水肿明显', change: '加车前子12g、薏苡仁15g', note: '加强利水消肿' },
                { condition: '脾虚明显', change: '加人参6g、黄芪12g', note: '补气健脾，气行水行' }
            ],
            peiwu: '泽泻为君，利水渗湿；茯苓猪苓为臣，协同利水；白术健脾燥湿；桂枝温阳化气，兼解表邪。化气行水，表里同治。',
            yongfa: '散剂每次6-9g，每日2次，温开水送服。或水煎服。',
            jianfu: '上五味，研为细末。每服二钱（约6g），白饮（米汤）调下，日三服。多饮暖水，汗出愈。'
        },
        '十枣汤': {
            source: '《伤寒论》',
            category: '泻下剂·攻逐水饮',
            composition: [
                { herb: '芫花', dosage: '3g', role: '君', function: '逐水祛痰，泻胸胁积饮' },
                { herb: '甘遂', dosage: '3g', role: '臣', function: '泻水逐饮，消肿散结' },
                { herb: '大戟', dosage: '3g', role: '臣', function: '泻水逐饮，消肿散结' }
            ],
            indication: '悬饮；水肿腹胀实证',
            symptoms: ['咳唾胸胁引痛', '呼吸困难', '心下痞硬', '干呕短气', '二便不利'],
            禁忌: ['体虚者禁用', '孕妇禁用', '表证未解者禁用', '脾胃虚弱者禁用'],
            加减: [
                { condition: '正虚明显', change: '加人参6g、茯苓12g', note: '扶正祛邪，防攻逐伤正' }
            ],
            peiwu: '三药均为峻下逐水药，合用逐水力猛。以大枣十枚煎汤送服，护胃气，缓峻烈之性。',
            yongfa: '三药研末，大枣十枚煎汤，清晨空腹调服药末。得快下利后，食粥养胃。',
            jianfu: '芫花、甘遂、大戟各等分，研为细末。以大枣十枚，水二升（约400ml），煮取一升（约200ml），去滓。调药末一钱匕（约1.5g），温开水送下。强人服一钱半（约2.5g），弱人减半。得快下利后，糜粥自养。'
        },
        '橘皮竹茹汤': {
            source: '《金匮要略》',
            category: '理气剂·降逆止呕',
            composition: [
                { herb: '橘皮', dosage: '12g', role: '君', function: '理气健脾，和胃止呕' },
                { herb: '竹茹', dosage: '9g', role: '臣', function: '清热化痰，除烦止呕' },
                { herb: '大枣', dosage: '5枚', role: '佐', function: '补脾益气，和中缓急' },
                { herb: '生姜', dosage: '9g', role: '佐', function: '和胃止呕，助橘皮理气' },
                { herb: '人参', dosage: '6g', role: '佐', function: '补气健脾，扶正祛邪' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药，益气和中' }
            ],
            indication: '胃虚有热之呃逆',
            symptoms: ['呃逆', '干呕', '烦渴', '少气', '舌红苔少', '脉虚数'],
            禁忌: ['胃寒呃逆者慎用'],
            加减: [
                { condition: '热重（烦渴明显）', change: '加麦冬12g、石斛9g', note: '养阴清热，生津止渴' },
                { condition: '气虚甚', change: '加大人参用量至9g', note: '增强补气之力' }
            ],
            peiwu: '橘皮理气止呕；竹茹清热止呕，二者相伍，理气清热止呕；人参大枣甘草益气健脾；生姜和胃止呕。胃虚清热，气降则呃止。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上六味，以水一斗（约2000ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '百合固金汤': {
            source: '《慎斋遗书》',
            category: '补益剂·补阴',
            composition: [
                { herb: '百合', dosage: '12g', role: '君', function: '养阴润肺，清热止咳' },
                { herb: '生地黄', dosage: '12g', role: '臣', function: '滋阴清热，凉血止血' },
                { herb: '熟地黄', dosage: '12g', role: '臣', function: '滋补肝肾，养血填精' },
                { herb: '麦冬', dosage: '9g', role: '佐', function: '养阴润肺，清心除烦' },
                { herb: '玄参', dosage: '9g', role: '佐', function: '滋阴清热，凉血解毒' },
                { herb: '当归', dosage: '9g', role: '佐', function: '养血活血' },
                { herb: '白芍', dosage: '9g', role: '佐', function: '养血敛阴，柔肝止痛' },
                { herb: '川贝母', dosage: '6g', role: '佐', function: '清热化痰，润肺止咳' },
                { herb: '桔梗', dosage: '6g', role: '佐使', function: '宣肺利咽，载药上行' },
                { herb: '炙甘草', dosage: '6g', role: '使', function: '调和诸药' }
            ],
            indication: '肺肾阴虚，虚火上炎证',
            symptoms: ['咳嗽气喘', '痰中带血', '咽喉燥痛', '午后潮热', '盗汗', '舌红少苔', '脉细数'],
            禁忌: ['风寒咳嗽者禁用', '脾胃虚寒者慎用'],
            加减: [
                { condition: '咳血甚', change: '加白及9g、仙鹤草15g', note: '收敛止血，治咳血要药' },
                { condition: '潮热明显', change: '加地骨皮12g、银柴胡9g', note: '清虚热，退骨蒸' }
            ],
            peiwu: '百合为君，润肺止咳；二地为臣，滋阴降火；麦冬玄参助二地滋阴；贝母润肺化痰；归芍养血柔肝；桔梗甘草宣肺利咽。肺肾同治，金水相生。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上十味，以水七升（约1400ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '清燥救肺汤': {
            source: '《医门法律》',
            category: '祛燥剂·清燥润肺',
            composition: [
                { herb: '桑叶', dosage: '9g', role: '君', function: '清宣肺燥，透热外出' },
                { herb: '石膏', dosage: '9g', role: '臣', function: '清泄肺热，除烦止渴' },
                { herb: '麦冬', dosage: '9g', role: '臣', function: '养阴润肺，清心除烦' },
                { herb: '人参', dosage: '3g', role: '佐', function: '益气生津，扶正祛邪' },
                { herb: '胡麻仁', dosage: '9g', role: '佐', function: '润燥养阴，滑肠通便' },
                { herb: '阿胶', dosage: '6g', role: '佐', function: '滋阴润肺，养血止血' },
                { herb: '杏仁', dosage: '6g', role: '佐', function: '降利肺气，止咳平喘' },
                { herb: '枇杷叶', dosage: '9g', role: '佐', function: '清肺止咳，降逆止呕' },
                { herb: '炙甘草', dosage: '3g', role: '使', function: '调和诸药' }
            ],
            indication: '温燥伤肺证',
            symptoms: ['头痛发热', '干咳无痰', '气逆而喘', '咽喉干燥', '鼻燥', '胸满胁痛', '舌干少苔'],
            禁忌: ['风寒咳嗽者禁用', '阴虚久咳者慎用'],
            加减: [
                { condition: '热重', change: '加大石膏用量至15g', note: '增强清泄肺热之力' },
                { condition: '痰中带血', change: '加白及9g、侧柏叶9g', note: '收敛止血' }
            ],
            peiwu: '桑叶为君，清宣肺燥；石膏麦冬为臣，清肺润燥；人参阿胶胡麻仁益气滋阴；杏仁枇杷叶降气止咳。清燥与润肺并用，气阴两顾。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上十味，以水七升（约1400ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '青蒿鳖甲汤': {
            source: '《温病条辨》',
            category: '清虚热剂·养阴透热',
            composition: [
                { herb: '青蒿', dosage: '9g', role: '君', function: '清透虚热，凉血除蒸' },
                { herb: '鳖甲', dosage: '12g', role: '臣', function: '滋阴潜阳，退热除蒸' },
                { herb: '生地黄', dosage: '9g', role: '佐', function: '滋阴清热，凉血养阴' },
                { herb: '知母', dosage: '6g', role: '佐', function: '清热泻火，滋阴润燥' },
                { herb: '牡丹皮', dosage: '6g', role: '佐使', function: '清热凉血，活血散瘀' }
            ],
            indication: '温病后期，阴液已伤，邪伏阴分证',
            symptoms: ['夜热早凉', '热退无汗', '形体消瘦', '舌红少苔', '脉细数'],
            禁忌: ['实热证禁用', '外感发热者禁用'],
            加减: [
                { condition: '阴虚甚', change: '加麦冬12g、玉竹9g', note: '增强养阴之力' },
                { condition: '余热未尽', change: '加地骨皮12g、白薇9g', note: '清虚热，退骨蒸' }
            ],
            peiwu: '青蒿配鳖甲：青蒿引邪外出，鳖甲入阴分滋阴退热，透热而不伤阴，滋阴而不恋邪；生地知母助鳖甲滋阴清热；丹皮凉血散瘀。养阴透热，标本兼顾。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上五味，以水五升（约1000ml），煮取二升（约400ml），去滓。分两次温服。'
        },
        '犀角地黄汤': {
            source: '《备急千金要方》',
            category: '清热剂·清热解毒',
            composition: [
                { herb: '水牛角', dosage: '30g', role: '君', function: '清热凉血，解毒定惊（代犀角，先煎）' },
                { herb: '生地黄', dosage: '24g', role: '臣', function: '清热凉血，养阴生津' },
                { herb: '芍药', dosage: '9g', role: '佐', function: '清热凉血，散瘀止痛' },
                { herb: '牡丹皮', dosage: '9g', role: '佐', function: '清热凉血，活血散瘀' }
            ],
            indication: '热入血分证；蓄血证',
            symptoms: ['身热谵语', '斑色紫黑', '吐血衄血', '便血', '舌绛起刺', '脉细数'],
            禁忌: ['脾胃虚寒者慎用', '孕妇慎用'],
            加减: [
                { condition: '热毒甚', change: '加玄参12g、金银花15g', note: '清热解毒，凉血散结' },
                { condition: '神昏谵语', change: '加安宫牛黄丸1粒', note: '清热开窍，治热入心包' }
            ],
            peiwu: '水牛角为君，清热凉血解毒；生地为臣，凉血养阴；芍药牡丹皮为佐，清热凉血散瘀。凉血与散瘀并用，治热入血分。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上四味，以水九升（约1800ml），煮取三升（约600ml），去滓。分三次温服。'
        },
        '银翘散': {
            source: '《温病条辨》',
            category: '解表剂·辛凉解表',
            composition: [
                { herb: '金银花', dosage: '15g', role: '君', function: '清热解毒，疏散风热' },
                { herb: '连翘', dosage: '15g', role: '臣', function: '清热解毒，疏散风热，清心泻火' },
                { herb: '薄荷', dosage: '6g', role: '佐', function: '疏散风热，清利头目' },
                { herb: '荆芥穗', dosage: '6g', role: '佐', function: '辛散表邪，透热外出' },
                { herb: '淡豆豉', dosage: '9g', role: '佐', function: '解表除烦，宣发郁热' },
                { herb: '牛蒡子', dosage: '9g', role: '佐', function: '疏散风热，利咽消肿' },
                { herb: '桔梗', dosage: '6g', role: '佐', function: '宣肺利咽，祛痰排脓' },
                { herb: '竹叶', dosage: '6g', role: '佐', function: '清热除烦，利尿' },
                { herb: '甘草', dosage: '6g', role: '使', function: '调和诸药，清热利咽' }
            ],
            indication: '风热表证；温病初起',
            symptoms: ['发热', '微恶风寒', '头痛', '咳嗽', '咽喉肿痛', '口渴', '舌苔薄白或薄黄', '脉浮数'],
            禁忌: ['风寒表证者禁用', '脾胃虚寒者慎用'],
            加减: [
                { condition: '咽痛甚', change: '加马勃6g、玄参12g', note: '清热利咽，解毒消肿' },
                { condition: '咳嗽痰多', change: '加杏仁9g、贝母9g', note: '润肺化痰止咳' },
                { condition: '热盛口渴', change: '加石膏15g、知母9g', note: '清热泻火，生津止渴' }
            ],
            peiwu: '金银花连翘为君，清热解毒疏散风热；薄荷荆芥穗淡豆豉为臣，辛散表邪；牛蒡子桔梗甘草利咽消肿。辛凉透表，清热解毒。',
            yongfa: '水煎温服，每日1剂，分三次服用。香气大出即取服，勿过煮。',
            jianfu: '上十味，以水五升（约1000ml），煮取二升（约400ml），去滓。分三次温服。'
        },
        '补阳还五汤': {
            source: '《医林改错》',
            category: '理血剂·益气活血',
            composition: [
                { herb: '黄芪', dosage: '30g', role: '君', function: '大补元气，益气行血，为益气活血要药' },
                { herb: '当归尾', dosage: '6g', role: '臣', function: '活血化瘀，养血和营' },
                { herb: '赤芍', dosage: '6g', role: '佐', function: '活血散瘀，清热凉血' },
                { herb: '川芎', dosage: '6g', role: '佐', function: '活血行气，祛风止痛' },
                { herb: '桃仁', dosage: '6g', role: '佐', function: '活血祛瘀，润肠通便' },
                { herb: '红花', dosage: '6g', role: '佐', function: '活血通经，祛瘀止痛' },
                { herb: '地龙', dosage: '6g', role: '佐使', function: '通经活络，善走窜' }
            ],
            indication: '气虚血瘀之中风后遗症',
            symptoms: ['半身不遂', '口舌歪斜', '言语謇涩', '口角流涎', '小便频数', '舌淡紫', '脉缓无力'],
            禁忌: ['中风急性期禁用', '肝阳上亢者禁用', '孕妇禁用'],
            加减: [
                { condition: '下肢瘫软无力', change: '加牛膝12g、杜仲9g', note: '补肝肾强筋骨' },
                { condition: '上肢不利', change: '加姜黄6g、桂枝6g', note: '温经通络，引药上行' }
            ],
            peiwu: '黄芪大补元气为君，气旺则血行；归尾赤芍川芎桃仁红花为臣佐，活血化瘀；地龙通经活络。益气活血，祛瘀通络。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上七味，以水五升（约1000ml），煮取二升（约400ml），去滓。分两次温服。'
        },
        '导赤散': {
            source: '《小儿药证直诀》',
            category: '清热剂·清心利水',
            composition: [
                { herb: '生地黄', dosage: '9g', role: '君', function: '凉血滋阴，清心热' },
                { herb: '木通', dosage: '6g', role: '臣', function: '上清心火，下利小便' },
                { herb: '竹叶', dosage: '6g', role: '佐', function: '清心除烦，利尿通淋' },
                { herb: '生甘草梢', dosage: '6g', role: '使', function: '清热泻火，直达茎末端止淋痛' }
            ],
            indication: '心经火热证；心移热于小肠证',
            symptoms: ['心胸烦热', '口渴面赤', '口舌生疮', '小便赤涩刺痛', '舌红脉数'],
            禁忌: ['脾胃虚寒者慎用', '孕妇慎用木通'],
            加减: [
                { condition: '心火甚（口舌生疮）', change: '加黄连3g、栀子9g', note: '清心泻火，导热下行' },
                { condition: '小便涩痛', change: '加白茅根15g、滑石12g', note: '清热利尿通淋' }
            ],
            peiwu: '生地凉血滋阴清心；木通竹叶上清心火下利小便；甘草梢直达茎末止淋痛。心与小肠相表里，清心利水，导热下行。',
            yongfa: '水煎温服，每日1剂，分三次服用。',
            jianfu: '上四味，以水一升（约200ml），煎至五合（约100ml），去滓。温服，日三服。'
        },
        '清胃散': {
            source: '《脾胃论》',
            category: '清热剂·清胃凉血',
            composition: [
                { herb: '黄连', dosage: '6g', role: '君', function: '清胃泻火，燥湿解毒' },
                { herb: '生地黄', dosage: '9g', role: '臣', function: '凉血滋阴，治胃火伤阴' },
                { herb: '牡丹皮', dosage: '9g', role: '臣', function: '清热凉血，活血散瘀' },
                { herb: '当归', dosage: '6g', role: '佐', function: '养血活血，和营止痛' },
                { herb: '升麻', dosage: '9g', role: '佐使', function: '清热解毒，升散郁火，引药上行' }
            ],
            indication: '胃火牙痛证',
            symptoms: ['牙痛牵引头顶', '牙龈红肿溃烂', '出血', '口臭', '口渴喜冷饮', '舌红苔黄', '脉滑数'],
            禁忌: ['胃寒牙痛者禁用', '阴虚火旺者慎用'],
            加减: [
                { condition: '牙龈肿痛甚', change: '加石膏15g、知母9g', note: '清胃泻火，治阳明实火' },
                { condition: '口臭便秘', change: '加大黄6g', note: '通腑泻热，釜底抽薪' }
            ],
            peiwu: '黄连为君，清胃泻火；生地牡丹皮为臣，凉血滋阴；当归养血和营；升麻清热解毒，散火升散。清胃凉血，升散郁火。',
            yongfa: '水煎温服，每日1剂，分两次服用。',
            jianfu: '上五味，以水二升（约400ml），煮取一升（约200ml），去滓。分两次温服。'
        },
        '芍药甘草汤': {
            source: '《伤寒论》',
            category: '和解剂·缓急止痛',
            composition: [
                { herb: '白芍', dosage: '12g', role: '君', function: '养血敛阴，柔肝止痛' },
                { herb: '炙甘草', dosage: '12g', role: '臣', function: '益气和中，缓急止痛' }
            ],
            indication: '阴血不足，筋脉失养之挛急疼痛',
            symptoms: ['腿脚挛急', '腹痛', '胁痛', '头痛', '舌红少苔', '脉细弦'],
            禁忌: ['湿盛中满者慎用', '腹胀便溏者慎用'],
            加减: [
                { condition: '腹痛明显', change: '加木香6g、砂仁3g', note: '理气止痛' },
                { condition: '腿脚挛急', change: '加牛膝12g、木瓜9g', note: '强筋骨，舒筋活络' }
            ],
            peiwu: '白芍酸寒敛阴，柔肝缓急；甘草甘平益气，缓急止痛。酸甘化阴，养阴柔肝，缓急止痛，为治疗挛急疼痛基础方。',
            yongfa: '水煎温服，每日1剂，分早晚两次服用。',
            jianfu: '上二味，以水三升（约600ml），煮取一升（约200ml），去滓。分两次温服。'
        }
    };

    function parse(name) {
        if (!name) return null;
        var key = _findKey(name);
        if (!key || !FANGJI_DB[key]) return null;

        var data = FANGJI_DB[key];
        return {
            name: key,
            source: data.source,
            category: data.category,
            jun_chen_zuo_shi: _analyzeJunChenZuoShi(data),
            indication: data.indication,
            symptoms: data.symptoms,
            contraindications: data.禁忌,
            modifications: data.加减,
            peiwu: data.peiwu || '',
            yongfa: data.yongfa || '',
            jianfu: data.jianfu || '',
            zhuyi: data.zhuyi || '',
            shanghan_wenyi: data.shanghan_wenyi || []
        };
    }

    function search(keyword) {
        if (!keyword) return [];
        var results = [];
        Object.keys(FANGJI_DB).forEach(function(name) {
            if (name.indexOf(keyword) !== -1) results.push(name);
        });
        return results;
    }

    function _analyzeJunChenZuoShi(data) {
        return data.composition.map(function(item) {
            return {
                herb: item.herb,
                dosage: item.dosage,
                role: item.role,
                function: item.function
            };
        });
    }

    function _findKey(name) {
        if (FANGJI_DB[name]) return name;
        var keys = Object.keys(FANGJI_DB);
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].indexOf(name) !== -1 || name.indexOf(keys[i]) !== -1) {
                return keys[i];
            }
        }
        return null;
    }

    global.FangjiEngine = {
        DB: FANGJI_DB,
        parse: parse,
        search: search
    };

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
