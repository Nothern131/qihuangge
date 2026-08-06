/**
 * 岐黄阁 · 辨证体质（合并辨证推理+体质辨识+大师解读）
 * 流程：选症状+舌脉 → 八纲辨证 → 体质问卷 → 大师五段式解读
 */
(function(global) {
    'use strict';

    var step = 1;
    var bianzhengResult = null;
    var tizhiResult = null;
    var selectedMaster = null;

    var SYMPTOM_GROUPS = {
        '外感': ['恶寒', '发热', '头痛', '咳嗽', '鼻塞', '喷嚏', '咽痛', '身痛'],
        '消化系统': ['食少', '腹胀', '腹痛', '便溏', '便秘', '嗳气', '恶心', '呕吐'],
        '心系': ['心悸', '失眠', '健忘', '心烦', '胸闷', '胸痛'],
        '肝系': ['胁痛', '头痛眩晕', '情绪波动', '烦躁易怒', '抑郁'],
        '肾系': ['腰膝酸软', '耳鸣', '尿频', '夜尿多', '遗精'],
        '全身': ['乏力', '畏寒', '口渴', '盗汗', '自汗', '气短', '头晕']
    };

    var TONGUE_OPTIONS = [
        '未选择', '舌质淡白', '舌质淡红', '舌质红', '舌质红绛', '舌体胖大',
        '舌体瘦小', '舌有裂纹', '舌苔薄白', '舌苔白腻', '舌苔黄腻', '舌苔少', '舌苔剥落'
    ];
    var PULSE_OPTIONS = [
        '未选择', '脉浮', '脉沉', '脉迟', '脉数', '脉虚', '脉实', '脉滑', '脉涩', '脉弦', '脉细', '脉紧', '脉洪'
    ];

    var SYMPTOM_CORRELATION = {
        '恶寒': { tizhi: ['阳虚质'], formula: ['桂枝汤', '麻黄汤'] },
        '发热': { tizhi: ['阳虚质', '湿热质'], formula: ['麻黄汤', '桂枝汤'] },
        '头痛': { tizhi: ['气郁质', '血瘀质'], formula: ['川芎茶调散'] },
        '咳嗽': { tizhi: ['气虚质', '阴虚质'], formula: ['桂枝汤'] },
        '鼻塞': { tizhi: ['气虚质'], formula: ['桂枝汤', '玉屏风散'] },
        '喷嚏': { tizhi: ['特禀质', '气虚质'], formula: ['玉屏风散'] },
        '咽痛': { tizhi: ['湿热质'], formula: ['银翘散'] },
        '身痛': { tizhi: ['阳虚质', '血瘀质'], formula: ['麻黄汤'] },
        '食少': { tizhi: ['气虚质', '痰湿质'], formula: ['四君子汤', '参苓白术散'] },
        '腹胀': { tizhi: ['气郁质', '痰湿质'], formula: ['逍遥散'] },
        '腹痛': { tizhi: ['阳虚质', '气郁质'], formula: ['四逆散'] },
        '便溏': { tizhi: ['气虚质', '阳虚质', '痰湿质'], formula: ['参苓白术散', '四君子汤'] },
        '便秘': { tizhi: ['气虚质', '阳虚质'], formula: ['麻子仁丸'] },
        '嗳气': { tizhi: ['气郁质'], formula: ['逍遥散'] },
        '恶心': { tizhi: ['痰湿质'], formula: ['半夏厚朴汤'] },
        '呕吐': { tizhi: ['痰湿质', '阳虚质'], formula: ['小柴胡汤'] },
        '心悸': { tizhi: ['气虚质', '血虚质'], formula: ['归脾汤'] },
        '失眠': { tizhi: ['阴虚质', '气郁质'], formula: ['归脾汤', '六味地黄丸'] },
        '健忘': { tizhi: ['气虚质', '肾精亏虚'], formula: ['归脾汤'] },
        '心烦': { tizhi: ['阴虚质', '湿热质'], formula: ['黄连阿胶汤'] },
        '胸闷': { tizhi: ['气郁质', '血瘀质'], formula: ['血府逐瘀汤', '瓜蒌薤白汤'] },
        '胸痛': { tizhi: ['血瘀质'], formula: ['血府逐瘀汤'] },
        '胁痛': { tizhi: ['气郁质', '湿热质'], formula: ['逍遥散', '龙胆泻肝汤'] },
        '头痛眩晕': { tizhi: ['气郁质', '肝阳上亢'], formula: ['天麻钩藤饮'] },
        '情绪波动': { tizhi: ['气郁质'], formula: ['逍遥散'] },
        '烦躁易怒': { tizhi: ['气郁质', '湿热质'], formula: ['丹栀逍遥散', '龙胆泻肝汤'] },
        '抑郁': { tizhi: ['气郁质'], formula: ['逍遥散'] },
        '腰膝酸软': { tizhi: ['肾精亏虚', '阳虚质'], formula: ['六味地黄丸', '肾气丸'] },
        '耳鸣': { tizhi: ['肾精亏虚', '阴虚质'], formula: ['六味地黄丸'] },
        '尿频': { tizhi: ['阳虚质'], formula: ['肾气丸'] },
        '夜尿多': { tizhi: ['阳虚质'], formula: ['金匮肾气丸'] },
        '遗精': { tizhi: ['肾精亏虚'], formula: ['六味地黄丸'] },
        '乏力': { tizhi: ['气虚质'], formula: ['四君子汤', '补中益气汤'] },
        '畏寒': { tizhi: ['阳虚质'], formula: ['四逆汤', '肾气丸'] },
        '口渴': { tizhi: ['阴虚质', '湿热质'], formula: ['六味地黄丸', '白虎汤'] },
        '盗汗': { tizhi: ['阴虚质'], formula: ['六味地黄丸', '当归六黄汤'] },
        '自汗': { tizhi: ['气虚质'], formula: ['玉屏风散', '桂枝汤'] },
        '气短': { tizhi: ['气虚质'], formula: ['补中益气汤', '四君子汤'] },
        '头晕': { tizhi: ['气虚质', '血虚质', '痰湿质'], formula: ['归脾汤', '半夏白术天麻汤'] }
    };

    var STEP_TEMPLATES = {
        'huangdi': {
            opening: [
                '《素问》云：阴阳者，天地之道也，万物之纲纪，变化之父母，生杀之本始，神明之府也。治病必求于本。今观君之症，乃阴阳失调、气血逆乱之象。君之所苦，当审其阴阳，以别柔刚，观其虚实，以决生死。',
                '上古天真论曰：恬淡虚无，真气从之，精神内守，病安从来。今君之疾，非一朝一夕之故，其所由来者渐矣。当究其本源，察其阴阳之偏胜，而后可以言治。',
                '夫人之四季，春生夏长，秋收冬藏。君之症，当观其四时之气，察其脏腑之应。阴阳和合则百病不生，阴阳失调则百病丛生。'
            ],
            overview: [
                '综观君之症候，乃{zhuzheng}之象。君之体质，属{tizhi}，其本在{zangfu}，其标在{biaogan}。阴阳失衡，气血不和，脏腑功能失调，乃致病之根本。当审其病机，调其气机，使阴阳平衡，脏腑调和，则病自愈。',
                '观君之症，虚实夹杂，寒热错杂。{zhuzheng}，此乃{tizhi}之典型表现。其病位在{zangfu}，病性属{biaogan}。当从整体着眼，调其偏胜，扶其不足，以使平秘。',
                '人之气血，与天地相通。君之症，{zhuzheng}，乃{tizhi}之体，兼{biaogan}之变。病起于内，形之于外。当以调和为法，使气血和畅，阴阳平秘，则诸症自消。'
            ],
            specialty: [
                '治则当以{zhize}为主。养生之道，法于阴阳，和于术数，食饮有节，起居有常，不妄作劳，故能形与神俱，而尽终其天年。君之症，非药石一蹴可愈，当调其神志，节其饮食，适其起居，方可根治。',
                '上工治未病，不治已病。君之症，当从本源论治。补其不足，泻其有余，使阴阳复归于平。饮食调摄，情志畅达，起居有常，三者缺一不可。',
                '调治之法，贵在调和。君之{tizhi}，当以{zhize}为纲。然药补不如食补，食补不如神补。调神为先，调食次之，调药再次之。三者合参，方可收全功。'
            ],
            quote: '《素问·生气通天论》：阴平阳秘，精神乃治；阴阳离决，精气乃绝。又云：正气存内，邪不可干；邪之所凑，其气必虚。',
            closing: [
                '故圣人春夏养阳，秋冬养阴，以从其根。愿君法于阴阳，和于术数，饮食有节，起居有常，不妄作劳，故能形与神俱，而尽终其天年，度百岁乃去。',
                '病已至此，当知调养之道。避风寒，节饮食，畅情志，适劳逸。如此则正气存内，邪不可干，病自愈矣。愿君善养天和，以保天年。',
                '治病之道，以调和为本。愿君调饮食以养胃气，节起居以养精气，畅情志以养神气。三气调和，则百病不生。'
            ]
        },
        'bianque': {
            opening: [
                '越人观君之色，察君之脉，已知病之所起。《难经》云：望而知之谓之神，闻而知之谓之工，问而知之谓之智，切而知之谓之巧。四诊合参，方可断病无误。今观君之症，病在{zangfu}，其势{bingshi}，及时治之，可收全功。',
                '君有疾在腠理，不治将深。越人观君面色，又切君之脉，已知病之所起。病在{bingshi}，其位在{zangfu}，其性属{biaogan}。今当{zhize}，防其深入。',
                '越人尝曰：治病必先知其病之所在。今观君之症，{zhuzheng}，此乃{tizhi}之体，兼{biaogan}之变。病在{zangfu}，尚未入里，及时治之，可愈也。'
            ],
            overview: [
                '越人观君之色，望而知君之疾在{zangfu}。切君之脉，知病之深浅。四诊合参，综合判断，此乃{tizhi}之体，{zhuzheng}，{biaogan}之象。病势{bingshi}，尚属可治。及时调治，可收全功。',
                '君之疾，起于{yinyuan}，传于{zangfu}，尚未入脏腑深处。今观君之症，{zhuzheng}，此{tizhi}之典型表现。当{zhize}，防其传变深入。',
                '越人观君之症，乃{zhuzheng}，此{tizhi}之体也。其病位在{zangfu}，病性属{biaogan}。病势{bingshi}，若不及早治疗，将深入难疗。故当{zhize}，及时施治。'
            ],
            specialty: [
                '君之疾，当{zhize}。治病之道，宜早不宜迟。今君之症，尚在表浅，宜速治之。若拖延日久，病邪深入，虽良医难为也。愿君善调饮食起居，以祛病延年。',
                '病有六传，当察其传次，知其安危之处。今君之疾，尚在{zangfu}，未入骨髓。及时治之，可收全功。否则传变他经，则难治矣。',
                '越人治疾，首重四诊。望其色，闻其声，问其状，切其脉。今君之症，{zhuzheng}，{sheMai}。综合判断，此{tizhi}之体，{biaogan}之变。当{zhize}，以收全功。'
            ],
            quote: '《难经·六十一难》：望而知之者，望见其五色，以知其病。闻而知之者，闻其五音，以别其病。问而知之者，问其所欲五味，以知其病所起所在也。切而知之者，切其脉口，知其病也。',
            closing: [
                '疾在腠理，汤熨之所及也；在血脉，针石之所及也；在肠胃，酒醪之所及也；在骨髓，司命之所属，无奈何也。今君之疾，尚在浅表，及时治之，可收全功。愿君善调饮食起居，以祛病延年。',
                '病有六不治：骄恣不论于理，一不治也；轻身重财，二不治也；衣食不能适，三不治也。愿君善调情志，节饮食，适寒温，则病可愈也。',
                '治病之道，宜早不宜迟。愿君谨遵医嘱，按时调治，切勿拖延。病来如山倒，病去如抽丝，贵在坚持，方能根治。'
            ]
        },
        'zhangzhongjing': {
            opening: [
                '观君之脉证，知犯何逆，当随证治之。《伤寒论》云：太阳之为病，脉浮，头项强痛而恶寒。今观君之症，{zhuzheng}，{sheMai}，此{liujing}病也。当以六经辨证为纲，方证对应为目，细审病机，而后处方。',
                '伤寒论曰：观其脉证，知犯何逆，随证治之。此仲景治病之要法也。今观君之症，{zhuzheng}，{tizhi}之体，{biaogan}之象。当辨其六经所在，审其方证对应，而后治之。',
                '君之症，乃{zhuzheng}。此{liujing}病也，{biaogan}之变。仲景云：太阳病，发热汗出，恶风脉缓者，名为中风。今观君之症，当辨其太阳少阳合病，抑或太阴少阴同病。'
            ],
            overview: [
                '观君之脉证，乃{liujing}病也。{zhuzheng}，{sheMai}，此{biaogan}之象。其本在{zangfu}，其标在{tizhi}。当以{zhize}为主，视其加减而定。方证对应者，谓某证当用某方也，不可差池。',
                '观君之症，乃{zhuzheng}。此{tizhi}之体，{biaogan}之变也。病在{zangfu}，当以{zhize}治之。仲景云：观其脉证，知犯何逆，随证治之。君之症，当辨其六经传变，而后处方。',
                '观君之脉证，{liujing}病也。{zhuzheng}，此{biaogan}之象。其病位在{zangfu}，其体质属{tizhi}。当以{zhize}，方证对应，随证治之。'
            ],
            specialty: [
                '方证对应者，谓某证当用某方也。{zhuzheng}，{sheMai}，此{liujing}病，{tizhi}之体。当以{zhize}为主。仲景方药，加减有度，不可妄改。服汤法，当视病情而定，若一服汗出病差，停后服，不必尽剂。',
                '观其脉证，知犯何逆，随证治之。此仲景治病之要法也。君之症，{zhuzheng}，{biaogan}之变，{zangfu}受累。当{zhize}，方证对应，不可执方不通。',
                '伤寒中风，有柴胡证，但见一证便是，不必悉具。今君之症，{zhuzheng}，此{tizhi}之体，{liujing}病也。当{zhize}，随证加减，不可固执一方。'
            ],
            quote: '《伤寒论》：观其脉证，知犯何逆，随证治之。又云：桂枝本为解肌，若其人脉浮紧，发热汗不出者，不可与之也。常须识此，勿令误也。',
            closing: [
                '桂枝汤方后云：服已须臾，啜热稀粥一升余，以助药力。温覆令一时许，遍身漐漐微似有汗者益佳，不可令如水流漓，病必不除。愿君谨遵医嘱，调护得宜，则病可愈也。',
                '伤寒论曰：病痰饮者，当以温药和之。又云：汗吐下后，不可更行桂枝汤。愿君善体仲景之法，随证治之，不可执一方而治百病也。',
                '治病之法，贵在辨证。君之症，{zhize}，当随证加减。愿君谨遵医嘱，按时服药，调护饮食起居，则病可愈矣。'
            ]
        },
        'wangshuhe': {
            opening: [
                '脉为气血之先，今诊得君之脉，可知病之所在。《脉经》云：脉者，气血之先，阴阳之兆也。今观君之症，{zhuzheng}，{sheMai}，此{biaogan}之象。当以脉证合参，断其病之所在。',
                '叔和观君之脉，浮取候皮肤，沉取候骨，中取候脏腑。今君之脉，{sheMai}，此{biaogan}之象也。综合脉证，此{tizhi}之体，{zangfu}受累。',
                '君之症，{zhuzheng}。叔和按：脉浮为在表，脉沉为在里，数为在府，迟为在藏。今观君之脉，当为{biaogan}之变，病在{zangfu}。'
            ],
            overview: [
                '叔和诊君之脉，寸口{cunmai}，关上{guanmai}，尺中{chimai}。综合三部脉象，此{zangfu}之病，{tizhi}之体也。{zhuzheng}，{sheMai}，此{biaogan}之象。病势{bingshi}，当{zhize}。',
                '观君之脉，{sheMai}，此{biaogan}之象也。寸口候上焦，关上候中焦，尺中候下焦。三部合参，此{zangfu}之病，{tizhi}之体。当{zhize}，以收全功。',
                '叔和脉法，以浮中沉三部取之。今君之脉，{cunmai}，{guanmai}，{chimai}。三部合参，此{zhuzheng}，{biaogan}之变，病在{zangfu}，体质属{tizhi}。'
            ],
            specialty: [
                '诊脉之法，当以浮中沉三部取之。今君之脉，{sheMai}，此{biaogan}之象。综合脉证，此{tizhi}之体，{zangfu}之病。当{zhize}，脉证合参，方可断病无误。',
                '脉有二十四形，各有主病。浮为表，沉为里，迟为寒，数为热，虚为虚，实为实，滑为痰，涩为瘀。今君之脉，{sheMai}，此{biaogan}之象，病在{zangfu}。',
                '叔和云：脉证合参，方能断病。有脉病相反者，有脉证相应者。今君之症，{zhuzheng}，{sheMai}，脉证相应，此{tizhi}之体，{zangfu}之病。当{zhize}。'
            ],
            quote: '《脉经》：脉者，气血之先，阴阳之兆也。观其脉证，知犯何逆。又云：寸口脉浮为在表，沉为在里，数为在府，迟为在藏。',
            closing: [
                '脉证合参，方可断病。望闻问切，四诊兼备。愿君善调饮食起居，以养气血。脉为气血之先，气血和则脉象正，脉象正则病自愈。',
                '脉之至也，和柔相离，如缕之相循，名曰平人。今君之脉，{sheMai}，当{zhize}。愿君善养气血，调和阴阳，脉象自和。',
                '调饮食，节起居，畅情志，则气血和，脉象正。愿君谨遵医嘱，按时调治，脉证合一，病自痊愈。'
            ]
        },
        'taohongjing': {
            opening: [
                '药有君臣佐使，七情和合。观君之症，当以君药为主，佐使为辅。《本草经集注》云：药有阴阳配合，子母兄弟，根叶花实，草石男女。今观君之症，{zhuzheng}，此{tizhi}之体，{biaogan}之变。',
                '隐居按《本经》所载，此药主此病。今考诸家，当以君药为主，臣药为辅，佐药制毒，使药引经。观君之症，{zhuzheng}，{sheMai}，此{zangfu}之病，{tizhi}之体。',
                '药有酸咸甘苦辛五味，又有寒热温凉四气，有毒无毒，阴干暴干，采造时月，生熟土地，所产皆异。今观君之症，{zhuzheng}，此{tizhi}之体，当以{zhize}为主。'
            ],
            overview: [
                '隐居考君之症，当以君药为主。观君之症，{zhuzheng}，此{tizhi}之体，{biaogan}之变，病在{zangfu}。当以{zhize}为主，佐以{fuzhi}之品，使君臣佐使，配伍有序。',
                '诸药性味，各有主疗。君之症，{zhuzheng}，此{tizhi}之体也。其病位在{zangfu}，病性属{biaogan}。当以{zhize}为主，辅以{fuzhi}，使阴阳调和，脏腑得养。',
                '隐居按：君之症，{zhuzheng}，{sheMai}，此{biaogan}之象，{zangfu}受累。当以{zhize}为纲，选药当审其性味归经，辨其君臣佐使，方可奏效。'
            ],
            specialty: [
                '药有七情：单行者不与相须相使者同用，则力骏；相须者，同类不可离也；相使者，辅己之不及也；相畏者，受彼之制也；相恶者，夺我之能也；相反者，不相合也；相杀者，制彼之毒也。君之症，{zhuzheng}，当以{zhize}为主。',
                '君臣佐使，配伍有序。君药主病，臣药辅君，佐药制毒，使药引经。今观君之症，{zhuzheng}，此{tizhi}之体，{zangfu}之病。当以{zhize}，选药精当，配伍得宜。',
                '《本经》三品分类法：上药一百二十种为君，主养命；中药一百二十种为臣，主养性；下药一百二十五种为使，主治病。君之症，{zhuzheng}，当以{zhize}，选药当审其品级。'
            ],
            quote: '《本草经集注》：药有君臣佐使，以相宣摄。又若有毒宜制，可用相畏相杀；若无毒宜泻，当须吐利所避。旧丸散，用诸药，皆须精择，去其恶者，取其良者。',
            closing: [
                '凡药，皆须精制。生熟有殊，炮炙各异。愿君善择药材，遵君臣佐使之制，以收良效。药补不如食补，食补不如神补，调摄有方，病自痊愈。',
                '药有七情，合和宜审。君臣佐使，配伍有序。愿君谨遵医嘱，按时服药，不可妄用。善调饮食起居，则气血和，病自愈。',
                '隐居谨按：用药之法，当审病机，辨性味，择君臣，量和使。愿君善用药石，考其性味，审其产地，以为养生之助。'
            ]
        },
        'lishizhen': {
            opening: [
                '时珍按：此药《本经》列为上品，后世多有讹误，今当考订。观君之症，{zhuzheng}，此{tizhi}之体，{biaogan}之变，病在{zangfu}。诸家本草，多所遗漏，今当补入。',
                '时珍谨案：诸家本草，多所谬误，今当正之。观君之症，{zhuzheng}，{sheMai}，此{bizhi}之体也。考诸家之说，当以{zhize}为正。',
                '此药昔人未有记载，时珍尝采之山野，今当补入。观君之症，{zhuzheng}，此{tizhi}之体，当以{zhize}，选药当考其性味归经。'
            ],
            overview: [
                '时珍考君之症，乃{zhuzheng}，此{tizhi}之体也。观诸家本草，当以{zhize}为主治，辅以{fuzhi}。其病位在{zangfu}，病性属{biaogan}。时珍以为，当详加考订，不可妄用。',
                '诸家本草，多所谬误。时珍考之古今，正其讹舛，当以{zhize}为正。君之症，{zhuzheng}，{sheMai}，此{bizhi}之体，{zangfu}受累。当以{zhize}，辨其性味归经。',
                '时珍按：君之症，{zhuzheng}，{bizhi}之体也。考诸家之说，当以{zhize}为正。其病在{zangfu}，其性属{biaogan}。用药之道，当考其本源，不可徒袭旧闻。'
            ],
            specialty: [
                '释名：{bingming}\n集解：{zhuzheng}，{bizhi}之体，{zangfu}受累。\n主治：{zhize}，{biaogan}之变。\n发明：时珍考之，此症当以{zhize}为主，选药当审其性味归经。',
                '时珍按：此药《本经》列为上品，主养命；《别录》主养性；陶隐居云主治病。今考君之症，{zhuzheng}，{bizhi}之体，当以{zhize}，辨其君臣佐使。',
                '时珍谨案：用药之道，当考其性味，辨其真伪，审其产地，察其采收。今观君之症，{zhuzheng}，{bizhi}之体，当以{zhize}，不可妄用。'
            ],
            quote: '《本草纲目》：兰草与泽兰，苗类相似，而气不同。兰草气辛，主消食利膈；泽兰气香，主活血调经。诸家本草，多所遗漏，今当补入。',
            closing: [
                '本草之学，浩如烟海。时珍穷三十年之力，编成本草纲目，冀补前人之未备，正诸家之谬误。愿君善用药石，考其性味，审其产地，以为养生之助。',
                '时珍谨案：此药古今用法，多有不同，当参合而论之。愿君谨遵医嘱，按时服药，调摄有方，则病可愈矣。',
                '用药之道，贵在得法。时珍考之古今，正其讹舛，当以君臣佐使，配伍有序，方可奏效。愿君善体此意，以收良效。'
            ]
        },
        'sunsimiao': {
            opening: [
                '大医精诚，普同一等。观君之症，{zhuzheng}，此{tizhi}之体，病在{zangfu}。药王云：安身之本，必资于食。当以食疗为主，药饵为辅，调养脾胃。',
                '善养生者，常欲小劳。君之疾，乃食饮不节，起居无常所致。当调饮食，适寒温，节喜怒，方可根治。',
                '《千金》云：人命至重，有贵千金。观君之症，{zhuzheng}，{sheMai}，此{bizhi}之体也。当以养生为先，药石为辅。'
            ],
            overview: [
                '吾观君之症，乃食饮不节，起居无常所致。当以食疗为主，药饵为辅，调养脾胃，以资气血。{zhuzheng}，此{tizhi}之体也。',
                '善养生者，常欲小劳，不欲甚劳。君之症，乃劳倦伤脾，当以补脾益气为主。{zhuzheng}，{sheMai}，当{zhize}。',
                '《千金》云：人若善养者，疾罕生。君之症，当以节饮食，慎起居为先。{zhuzheng}，此{bizhi}之体，{zangfu}受累。'
            ],
            specialty: [
                '《千金》云：食能排邪而安脏腑，悦神爽志以资血气。君之症，当以食治之，食疗不愈，然后命药。{zhuzheng}，此{bizhi}之体。',
                '凡食疗，宜专精专意，乃有功效。肝病禁辛，心病禁苦，脾病禁咸，肺病禁甘，肾病禁酸。君之症，当{zhize}。',
                '《千金要方》云：凡居身，不可无药。愿君善择药材，以养生延年。{zhuzheng}，此{tizhi}之体，{zangfu}受累。'
            ],
            quote: '《千金要方》：人命至重，有贵千金，一方济之，德逾于此。凡欲为大医，必须谙《素问》《甲乙》《黄帝针经》……此乃医之宗旨也。',
            closing: [
                '药王有言：德行不修，虽治病无功。愿君修身养性，以保天年。',
                '善言天者，必验于人。愿君调饮食，节起居，则疾病不生。',
                '《千金》云：凡居身，不可无药。愿君善择药材，以养生延年。'
            ]
        },
        'zhangjingyue': {
            opening: [
                '吾观君之症，乃真阴亏损，命门火衰之象也。当以温补为治。{zhuzheng}，此{bizhi}之体也，病在{zangfu}。',
                '人之大宝，惟此一息之火。君之症，当温养命门，益精养血。{zhuzheng}，{sheMai}，此{bizhi}之体。',
                '阳非有余，阴常不足。观君之症，真阴已亏，命门之火衰微。当以温补命门，益精养血为主。'
            ],
            overview: [
                '吾观君之症，乃真阴亏损，命门火衰。当以温补命门，益精养血为主，视其加减而定。{zhuzheng}，此{bizhi}之体。',
                '此证乃阳虚也。{zhuzheng}，{jianzheng}。当以{zhize}温补命门，益精养血。{sheMai}，此{bizhi}之体。',
                '观君之症，乃{bizhi}也。{zhuzheng}，此{bizhi}之体也，当{zhize}。病在{zangfu}，其本在命门。'
            ],
            specialty: [
                '善补阳者，必于阴中求阳，则阳得阴助而生化无穷。善补阴者，必于阳中求阴，则阴得阳升而泉源不竭。{zhuzheng}，当以{zhize}。',
                '壮水之剂，以六味为君；补火之剂，以八味为君。此治虚损之大纲也。{bizhi}之体，{zangfu}受累。',
                '命门者，诸神精之所舍，元气之所系也。为人身之太极，为阴阳之宅窟。君之症，当温养命门，益精养血。'
            ],
            quote: '《景岳全书》：善补阳者，必于阴中求阳，则阳得阴助而生化无穷；善补阴者，必于阳中求阴，则阴得阳升而泉源不竭。',
            closing: [
                '善补阳者，必于阴中求阳。愿君温养命门，益精养血，以保天年。',
                '治病之道，当审阴阳。愿君谨遵医嘱，调摄保养，则病愈矣。',
                '《景岳》云：虚损之证，必得脾胃健旺，然后药力可行。愿君善养脾胃，以收良效。'
            ]
        },
        'yetieshi': {
            opening: [
                '吾观君之症，乃温邪入里，{zangfu}受累。当审其病性，先安未受邪之地。{zhuzheng}，{sheMai}，此{bizhi}之体也。',
                '伤寒仿仲景法，温病须遵养阴息风之旨。君之症，乃温热之邪，由口鼻而入，首先犯肺。若不及早治之，必内传心包。',
                '吾尝谓：热病救阴犹易，通阳最难。君之疾，乃{bizhi}之体，{zhuzheng}，当{zhize}。'
            ],
            overview: [
                '吾观君之症，乃温热之邪，已由卫入气，{zangfu}受累。当以{zhize}为主，防其内传。{zhuzheng}，此{bizhi}之体。',
                '君之症，{bizhi}也。{zhuzheng}，{sheMai}。此{bizhi}之体也，当{zhize}。病在{zangfu}，当先安未受邪之地。',
                '观君之脉证，乃{liujing}病也。此{bizhi}之体也，当{zhize}。温病之要，在于养阴息风。'
            ],
            specialty: [
                '温病之大法，卫之后方言气，营之后方言血。在卫汗之可也，到气才可清气，入营犹可透热转气，入血就恐耗血动血，直须凉血散血。{zhuzheng}，当{zhize}。',
                '舌绛而口渴者，热入营分；舌绛而苔滑者，热入血分。{bizhi}之体，{zangfu}受累，当{zhize}。',
                '吾尝谓：必须先安未受邪之地，防其传入，而后治疗可愈也。{zhuzheng}，此{bizhi}之体。'
            ],
            quote: '《温热论》：温邪上受，首先犯肺，逆传心包。肺主气属卫，心主血属营，辨营卫气血虽与伤寒同，若论治法则与伤寒大异也。',
            closing: [
                '吾尝谓：温病最善伤阴，治当以养阴为主。愿君慎起居，调饮食，以保津液。',
                '温热之病，当先安未受邪之地。愿君谨遵医嘱，及时调治，可保无虞。',
                '《温热论》云：救阴不在血，而在津与汗。愿君善养津液，则病自退矣。'
            ]
        },
        'wujutong': {
            opening: [
                '吾观君之症，乃{zangfu}病也。{bizhi}之邪，当分三焦而治之。{zhuzheng}，{sheMai}，此{bizhi}之体也。',
                '君之疾，起于上焦，传入中焦，乃至于下焦。今当以三焦辨证，{zhize}为主。治上焦如羽，非轻不举。',
                '治上焦如羽，非轻不举；治中焦如衡，非平不安；治下焦如权，非重不沉。君之症，当据此治之。'
            ],
            overview: [
                '吾观君之症，乃上焦温病也。{zhuzheng}，{jianzheng}。当以轻清宣透之剂为主，视其加减而定。此{bizhi}之体。',
                '君之症，{bizhi}也。{zhuzheng}，{sheMai}。此{bizhi}之体也，当{zhize}。病在三焦，当分治之。',
                '观君之脉证，乃{liujing}病也。此{bizhi}之体也，当{zhize}。温病三焦辨证，上焦肺气，中焦脾胃，下焦肝肾。'
            ],
            specialty: [
                '上焦病者，手太阴也。肺居上焦，主皮毛，司呼吸。病在上焦，当用轻清宣透之剂。{zhuzheng}，此{bizhi}之体。',
                '治上焦如羽，非轻不举；治中焦如衡，非平不安；治下焦如权，非重不沉。此治温病之大法也。',
                '温病三焦辨证：上焦肺气，中焦脾胃，下焦肝肾。病在上焦当轻清，在中焦当平调，在下焦当滋补。{zhuzheng}，当{zhize}。'
            ],
            quote: '《温病条辨》：治上焦如羽，非轻不举；治中焦如衡，非平不安；治下焦如权，非重不沉。',
            closing: [
                '温病之三焦辨证，当视病位之浅深，而以轻重缓急治之。愿君善调饮食起居，以保天年。',
                '《温病条辨》云：治上焦如羽，非轻不举。愿君谨遵医嘱，不可过用峻烈之剂。',
                '三焦辨证，分消走泄。愿君调摄得宜，则病自退矣。'
            ]
        },
        'zhudanyu': {
            opening: [
                '吾观君之症，乃相火妄动，阴精亏损之象也。当以滋阴降火为治。{zhuzheng}，{sheMai}，此{bizhi}之体也。',
                '天理人欲，常相胜负。君之症，当清心寡欲，保精养阴。人身始终，不过阳气与阴血而已。',
                '人身始终，不过阳气与阴血而已。阴常不足，阳常有余，此吾之论也。君之疾，乃相火内扰，阴精外耗。'
            ],
            overview: [
                '吾观君之症，乃阴精亏损，相火妄动之证。当以滋阴降火为主，佐以清热凉血之品。{zhuzheng}，此{bizhi}之体。',
                '君之症，{bizhi}也。{zhuzheng}，{sheMai}。此阴虚火旺之象也，当滋阴降火。病在{zangfu}，其本在肾。',
                '此证乃阴虚也。当以{zhize}滋阴清热，视其加减而定。{bizhi}之体，{zangfu}受累。'
            ],
            specialty: [
                '相火妄动，煎熬真阴，阴虚则病，阴绝则死。治当滋阴降火，以保真阴。天下之万病，皆生于气。',
                '四物汤，和血之圣剂也。熟地滋阴，当归养血，白芍敛阴，川芎行气。加减运用，可治诸血证。{zhuzheng}，当{zhize}。',
                '天下之万病，皆生于气。气郁则火动，火动则伤阴。治当解郁清热，滋阴降火。{bizhi}之体，{zangfu}受累。'
            ],
            quote: '《格致余论》：天非此火不能生物，人非此火不能有生。然火一动则耗吾之阴，阴难成而易亏也。',
            closing: [
                '善治斯民者，必先以正心寡欲为本。愿君清心寡欲，保精养阴，则病自愈矣。',
                '相火妄动，耗伤阴精。愿君调摄身心，远声色，节饮食，则阴精自复。',
                '《丹溪心法》云：气血冲和，万病不生。愿君顺四时，节饮食，调情志，以保天年。'
            ]
        },
        'xuexue': {
            opening: [
                '吾观君之症，乃湿热内蕴，阻滞气机之象也。当以分消走泄为治。{zhuzheng}，{sheMai}，此{bizhi}之体也。',
                '吴人多湿，湿热相搏，病多湿热。君之症，当审其{zangfu}，{zhize}为主。湿热之病，起于脾胃。',
                '湿热之病，起于脾胃。湿性重浊，热性炎上，二者相合，如油入面，难分难解。君之疾，乃湿热郁蒸。'
            ],
            overview: [
                '吾观君之症，乃湿热内蕴，{zangfu}受累。当以清热化湿，分消走泄为主，视其加减而定。此{bizhi}之体。',
                '君之症，{bizhi}也。{zhuzheng}，{sheMai}。此湿热之象也，当清热化湿。病在{zangfu}，其本在脾胃。',
                '此证乃{bizhi}也。当{zhize}，佐以理气化湿之品。湿与热合，煎熬成痰，蒙蔽心包。'
            ],
            specialty: [
                '湿热之病，当分上下二焦。上焦湿热宜轻清宣化，中焦湿热宜苦温燥湿，下焦湿热宜淡渗利湿。{zhuzheng}，此{bizhi}之体。',
                '治湿热之病，当辨其偏重。热重于湿者，当清热为主；湿重于热者，当化湿为主。{bizhi}之体，{zangfu}受累。',
                '《湿热条辨》云：治湿不理气，非其治也。气行则湿化，气滞则湿停。理气化湿，分消走泄，此治湿热之要法也。'
            ],
            quote: '《湿热条辨》：湿热之病，多由口鼻而入，或从表入，或从里出。治当分消走泄，不可误用汗下。',
            closing: [
                '湿热之病，缠绵难愈。愿君慎饮食，戒油腻，以绝生湿之源。',
                '《湿热条辨》云：治湿不远温，治热不远寒。愿君谨遵医嘱，调摄得宜，则病自愈矣。',
                '湿热之病，当分消走泄。愿君善调饮食起居，以保脾胃健运。'
            ]
        }
    };

    function render() {
        var html = '<div class="integrated-page">';

        // 流程指示
        html += '<div class="flow-indicator">';
        html += '<div class="flow-step active" id="flow-step-1"><span class="step-num">一</span><span class="step-label">辨证推理</span></div>';
        html += '<div class="flow-arrow">→</div>';
        html += '<div class="flow-step" id="flow-step-2"><span class="step-num">二</span><span class="step-label">体质辨识</span></div>';
        html += '<div class="flow-arrow">→</div>';
        html += '<div class="flow-step" id="flow-step-3"><span class="step-num">三</span><span class="step-label">大师解读</span></div>';
        html += '</div>';

        // 第一阶段：辨证推理
        html += '<div class="phase-section" id="phase-bianzheng">';
        html += '<h2>辨证推理</h2>';
        html += '<p class="desc">选择症状、舌象、脉象，系统进行八纲·六经·脏腑三层辨证</p>';
        html += '<div class="input-group">';
        html += '<label>主要症状 <span style="color:#a09888;font-size:12px;">（至少选2项）</span></label>';
        html += '<div class="symptom-groups">';

        var groups = Object.keys(SYMPTOM_GROUPS);
        groups.forEach(function(g) {
            html += '<div class="symptom-group">';
            html += '<div class="symptom-group-title">' + g + '</div>';
            html += '<div class="symptom-tags">';
            SYMPTOM_GROUPS[g].forEach(function(s) {
                html += '<label class="symptom-tag"><input type="checkbox" value="' + s + '">' + s + '</label>';
            });
            html += '</div></div>';
        });

        html += '</div></div>';
        html += '<div class="input-group">';
        html += '<label>实时关联</label>';
        html += '<div class="correlation-panel" id="correlation-panel"><div class="correlation-hint">选择症状后，此处将显示关联体质与方剂</div></div>';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label>舌象 <span style="color:#a09888;font-size:12px;">（可选）</span></label>';
        html += '<select id="tongue-select">' + TONGUE_OPTIONS.map(function(t, i) { return '<option value="' + (i === 0 ? '未选择' : t) + '">' + t + '</option>'; }).join('') + '</select>';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label>脉象 <span style="color:#a09888;font-size:12px;">（可选）</span></label>';
        html += '<select id="pulse-select">' + PULSE_OPTIONS.map(function(p, i) { return '<option value="' + (i === 0 ? '未选择' : p) + '">' + p + '</option>'; }).join('') + '</select>';
        html += '</div>';
        html += '<button onclick="runIntegratedBianzheng()" class="btn-primary" id="bianzheng-btn">开始辨证</button>';
        html += '<div id="bianzheng-result" class="result-area"></div>';
        html += '</div>';

        // 第二阶段：体质辨识（初始隐藏）
        html += '<div class="phase-section" id="phase-tizhi" style="display:none;">';
        html += '<h2>体质辨识</h2>';
        html += '<p class="desc">回答8个问题，系统将判断您的中医体质类型</p>';
        html += '<div class="question-list">';

        var questions = TizhiEngine.getQuestions();
        questions.forEach(function(q) {
            html += '<div class="question-block">';
            html += '<div class="question-text">' + q.text + '</div>';
            html += '<div class="question-opts">';
            ['从不', '偶尔', '有时', '经常', '总是'].forEach(function(o, i) {
                html += '<label class="opt-label"><input type="radio" name="' + q.id + '" value="' + (i + 1) + '">' + o + '</label>';
            });
            html += '</div></div>';
        });

        html += '</div>';
        html += '<button onclick="runIntegratedTizhi()" class="btn-primary" id="tizhi-btn">开始辨识</button>';
        html += '<div id="tizhi-result" class="result-area"></div>';
        html += '</div>';

        // 第三阶段：大师解读（初始隐藏）
        html += '<div class="phase-section" id="phase-master" style="display:none;">';
        html += '<h2>大师解读</h2>';
        html += '<p class="desc">选择一位历代名医，以大师视角为您综合解读辨证与体质结果</p>';
        html += '<div class="master-grid" id="master-grid">';

        var masterIds = Object.keys(STEP_TEMPLATES);
        masterIds.forEach(function(mid) {
            var m = MASTER_MAP[mid];
            html += '<div class="master-card" data-id="' + mid + '" onclick="selectIntegratedMaster(\'' + mid + '\')">';
            html += '<div class="master-avatar">' + m.avatar + '</div>';
            html += '<div class="master-info">';
            html += '<div class="master-name">' + m.name + '</div>';
            html += '<div class="master-title">' + m.title + '</div>';
            html += '<div class="master-era">' + m.era + '</div>';
            html += '<div class="master-tag">' + m.tag + '</div>';
            html += '</div></div>';
        });
        html += '</div>';

        html += '<div class="analysis-section" id="analysis-section" style="display:none;">';
        html += '<div class="selected-master" id="master-selected"></div>';
        html += '<button onclick="runIntegratedAnalysis()" class="btn-primary" id="analyze-btn">五段式分析</button>';
        html += '<div id="analysis-content"></div>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    function runIntegratedBianzheng() {
        var checked = document.querySelectorAll('.symptom-tags input:checked, .symptom-group input:checked');
        var symptoms = Array.from(checked).map(function(el) { return el.value; });
        var tongue = document.getElementById('tongue-select') ? document.getElementById('tongue-select').value : '未选择';
        var pulse = document.getElementById('pulse-select') ? document.getElementById('pulse-select').value : '未选择';

        if (symptoms.length < 2) {
            alert('请至少选择2个症状，系统才能进行辨证推理');
            return;
        }

        bianzhengResult = BianZhengEngine.bianzheng(symptoms, tongue, pulse);
        window.lastBianzhengResult = bianzhengResult;

        var resultEl = document.getElementById('bianzheng-result');
        if (!resultEl) return;

        var r = bianzhengResult;
        var html = '<div class="bianzheng-result-card">';

        // 辨证结论
        html += '<div class="result-header">';
        html += '<div class="result-header-text">';
        html += '<span class="result-type">辨证结论</span>';
        html += '<span class="result-value">' + r.final_syndrome + '</span>';
        if (r.confidence > 0) {
            html += '<span class="result-confidence">' + r.confidence + '% 置信度</span>';
        }
        html += '</div></div>';

        // 八纲辨证表
        if (r.biaogan && Object.keys(r.biaogan).length > 0) {
            html += '<div class="result-section"><h5>八纲辨证</h5>';
            html += '<div class="biaogan-grid">';
            var bgKeys = ['表', '里', '寒', '热', '虚', '实', '阴', '阳'];
            var maxBg = 0;
            bgKeys.forEach(function(k) { if (r.biaogan[k] > maxBg) maxBg = r.biaogan[k]; });
            bgKeys.forEach(function(k) {
                var score = r.biaogan[k] || 0;
                var pct = maxBg > 0 ? Math.round(score / maxBg * 100) : 0;
                var highlight = score >= maxBg * 0.6 ? ' class="bg-highlight"' : '';
                html += '<div class="biaogan-item"' + highlight + '><span class="bg-label">' + k + '</span><div class="bg-bar-track"><div class="bg-bar-fill" style="width:' + pct + '%"></div></div><span class="bg-score">' + score + '</span></div>';
            });
            html += '</div></div>';
        }

        // 六经辨证
        if (r.liujing) {
            html += '<div class="result-section"><h5>六经辨证</h5>';
            html += '<div class="liujing-result"><span class="jing-name">' + r.liujing.jing + '证</span><span class="jing-score">得分：' + r.liujing.score + '</span></div>';
            html += '</div>';
        }

        // 脏腑辨证
        if (r.zangfu && r.zangfu.length > 0) {
            html += '<div class="result-section"><h5>脏腑辨证</h5>';
            html += '<div class="zangfu-results">';
            r.zangfu.forEach(function(z) {
                html += '<div class="zangfu-item"><span class="zang-name">' + z.zang + '</span><span class="zang-score">' + z.score + '分</span></div>';
            });
            html += '</div></div>';
        }

        // 治则
        if (r.zhize) {
            html += '<div class="result-section"><h5>治则建议</h5><p class="zhize-text">' + r.zhize + '</p></div>';
        }

        // 舌脉信息
        if (tongue !== '未选择' || pulse !== '未选择') {
            html += '<div class="result-section"><h5>四诊信息</h5><p class="sisheng-text">舌象：' + tongue + '，脉象：' + pulse + '</p></div>';
        }

        html += '<div class="next-step-hint">';
        html += '<span class="hint-arrow">↓</span>';
        html += '<span>辨证完成！继续进行体质辨识，获取更全面的健康评估</span>';
        html += '</div>';

        // 辨证逻辑流程图
        html += '<div class="bianzheng-flow" id="bianzheng-flow"></div>';

        html += '</div>';
        resultEl.innerHTML = html;
        _renderBianzhengFlow(bianzhengResult);
        runCorrelationCheck();

        // 更新流程指示
        document.getElementById('flow-step-1').classList.remove('active');
        document.getElementById('flow-step-1').classList.add('done');
        document.getElementById('flow-step-2').classList.add('active');

        // 显示体质辨识阶段
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function() {
            var phase2 = document.getElementById('phase-tizhi');
            if (phase2) { phase2.style.display = 'block'; phase2.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }, 600);
    }

    function runIntegratedTizhi() {
        var questions = TizhiEngine.getQuestions();
        var answers = {};
        var answeredCount = 0;

        questions.forEach(function(q) {
            var radios = document.querySelectorAll('input[name="' + q.id + '"]:checked');
            if (radios.length > 0) {
                answers[q.id] = parseInt(radios[0].value);
                answeredCount++;
            }
        });

        var resultEl = document.getElementById('tizhi-result');
        if (answeredCount === 0) {
            resultEl.innerHTML = '<div class="error-tip">请至少回答一道题</div>';
            return;
        }

        tizhiResult = TizhiEngine.identify(answers);
        window.lastTizhiResult = tizhiResult;
        window.archiveResult('tizhi', '体质辨识：' + (tizhiResult.type || '结果'), tizhiResult);

        var regimen = TizhiEngine.getRegimen(tizhiResult.type);

        var html = '<div class="tizhi-result-card">';
        html += '<div class="result-header">';
        html += '<span class="result-type-icon">' + getBodyTypeIcon(tizhiResult.type) + '</span>';
        html += '<div class="result-header-text">';
        html += '<span class="result-type">' + tizhiResult.type + '</span>';
        html += '<span class="result-confidence">' + tizhiResult.confidence + '% 置信度</span>';
        html += '</div></div>';

        html += '<div class="result-desc">' + regimen.description + '</div>';

        html += '<div class="result-grid">';
        html += '<div class="result-grid-item"><strong>饮食调养</strong><p>' + regimen.diet + '</p></div>';
        html += '<div class="result-grid-item"><strong>运动建议</strong><p>' + regimen.exercise + '</p></div>';
        html += '<div class="result-grid-item"><strong>生活起居</strong><p>' + regimen.life + '</p></div>';
        html += '</div>';

        html += '<div class="score-section"><h5>九种体质得分</h5><div class="score-bars">';
        var sorted = Object.keys(tizhiResult.scores).sort(function(a, b) { return tizhiResult.scores[b] - tizhiResult.scores[a]; });
        sorted.forEach(function(t) {
            var s = tizhiResult.scores[t];
            var pct = Math.min(Math.round(s / 5 * 100), 100);
            var highlight = t === tizhiResult.type ? ' class="score-bar-highlight"' : '';
            html += '<div class="score-bar-row"' + highlight + '>';
            html += '<span class="score-bar-label">' + t + '</span>';
            html += '<div class="score-bar-track"><div class="score-bar-fill" style="width:' + pct + '%"></div></div>';
            html += '<span class="score-bar-val">' + s + '</span>';
            html += '</div>';
        });
        html += '</div></div>';

        var dianjinData = DIANJIN_YINWEN[tizhiResult.type] || [];
        if (dianjinData.length > 0) {
            html += '<div class="score-section dianjin-section"><h5>📜 典籍引文对照</h5><div class="dianjin-list">' +
                dianjinData.map(function(d) {
                    return '<div class="dianjin-item"><span class="dianjin-source">' + d.source + '</span><span class="dianjin-text">' + d.text + '</span></div>';
                }).join('') +
                '</div></div>';
        }

        html += '<div class="next-step-hint">';
        html += '<span class="hint-arrow">↓</span>';
        html += '<span>体质辨识完成！选择下方大师为您综合解读辨证与体质结果</span>';
        html += '</div>';
        html += '</div>';

        resultEl.innerHTML = html;

        document.getElementById('flow-step-2').classList.remove('active');
        document.getElementById('flow-step-2').classList.add('done');
        document.getElementById('flow-step-3').classList.add('active');

        resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function() {
            var phase3 = document.getElementById('phase-master');
            if (phase3) { phase3.style.display = 'block'; phase3.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }, 600);
    }

    function selectIntegratedMaster(masterId) {
        var m = MASTER_MAP[masterId];
        if (!m) return;
        selectedMaster = m;

        document.querySelectorAll('.master-card').forEach(function(card) {
            card.classList.remove('selected');
            card.style.borderColor = 'rgba(44,44,44,0.1)';
            card.style.boxShadow = 'none';
        });
        var activeCard = document.querySelector('.master-card[data-id="' + masterId + '"]');
        if (activeCard) {
            activeCard.classList.add('selected');
            activeCard.style.borderColor = '#b8945c';
            activeCard.style.boxShadow = '0 4px 16px rgba(184,148,92,0.25)';
        }

        var el = document.getElementById('master-selected');
        if (el) {
            el.innerHTML = '<div class="selected-master-content">';
            el.innerHTML += '<span class="avatar">' + m.avatar + '</span>';
            el.innerHTML += '<div><strong>' + m.name + '</strong> · ' + m.title + '（' + m.era + '）</div>';
            el.innerHTML += '<div class="style-desc">' + m.style + '</div>';
            el.innerHTML += '</div>';
        }

        var section = document.getElementById('analysis-section');
        if (section) { section.style.display = 'block'; section.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }

    function runIntegratedAnalysis() {
        if (!selectedMaster) { alert('请先选择一位大师'); return; }
        if (!bianzhengResult && !tizhiResult) { alert('请先完成辨证推理和体质辨识'); return; }

        var template = STEP_TEMPLATES[selectedMaster.id];
        if (!template) return;

        var ctx = buildContext();
        var html = '<div class="five-segment">';
        html += '<div class="segment"><h4>' + selectedMaster.avatar + ' ' + selectedMaster.name + ' · 开篇</h4><p>' + fillTemplate(randomFrom(template.opening), ctx) + '</p></div>';
        html += '<div class="segment"><h4>' + selectedMaster.avatar + ' ' + selectedMaster.name + ' · 总论</h4><p>' + fillTemplate(randomFrom(template.overview), ctx) + '</p></div>';
        html += '<div class="segment"><h4>' + selectedMaster.avatar + ' ' + selectedMaster.name + ' · 论治</h4><p>' + fillTemplate(randomFrom(template.specialty), ctx) + '</p></div>';
        html += '<div class="segment"><h4>' + selectedMaster.avatar + ' ' + selectedMaster.name + ' · 经典</h4><blockquote>' + template.quote + '</blockquote></div>';
        html += '<div class="segment"><h4>' + selectedMaster.avatar + ' ' + selectedMaster.name + ' · 结语</h4><p>' + fillTemplate(randomFrom(template.closing), ctx) + '</p></div>';
        html += '</div>';
        html += '<div style="margin-top:16px; padding:12px; background:rgba(184,148,92,0.1); border-radius:6px; font-size:12px; color:#8a7a5a;">';
        html += '注：大师解读综合辨证推理与体质辨识结果生成，内容为算法模板填充，仅供学习参考，不可替代专业医疗建议。';
        html += '</div>';
        document.getElementById('analysis-content').innerHTML = html;
        window.archiveResult('master', '大师解读：' + selectedMaster.name, { master: selectedMaster.name, content: html });
    }

    function buildContext() {
        var ctx = {};
        if (bianzhengResult) {
            ctx.zhuzheng = bianzhengResult.symptoms ? bianzhengResult.symptoms.join('、') : '';
            ctx.biaogan = Object.keys(bianzhengResult.biaogan || {}).filter(function(k) { return bianzhengResult.biaogan[k] > 0; }).join('');
            ctx.zhize = bianzhengResult.zhize || '';
            ctx.liujing = bianzhengResult.liujing ? bianzhengResult.liujing.jing : '';
            ctx.zangfu = bianzhengResult.zangfu && bianzhengResult.zangfu.length > 0 ? bianzhengResult.zangfu.map(function(z) { return z.zang; }).join('、') : '';
            ctx.sheMai = (bianzhengResult.tongue && bianzhengResult.tongue !== '未选择') ? bianzhengResult.tongue + '，' + (bianzhengResult.pulse || '') : '';
            ctx.cunmai = bianzhengResult.liujing ? '候上焦' : '';
            ctx.guanmai = bianzhengResult.liujing ? '候中焦' : '';
            ctx.chimai = bianzhengResult.liujing ? '候下焦' : '';
            ctx.bingshi = '可治';
            ctx.yinyuan = '外感内伤';
            ctx.fuzhi = '调和气血';
        }
        if (tizhiResult) {
            ctx.tizhi = tizhiResult.type;
        }
        return ctx;
    }

    function fillTemplate(template, ctx) {
        var result = template;
        Object.keys(ctx).forEach(function(key) {
            var val = ctx[key];
            if (val && val !== '') {
                result = result.split('{' + key + '}').join(val);
            } else {
                result = result.split('{' + key + '}').join('');
            }
        });
        return result.trim();
    }

    function randomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function getBodyTypeIcon(type) {
        var icons = {
            '气虚质': '🌬️', '阳虚质': '❄️', '阴虚质': '🔥', '痰湿质': '💧',
            '湿热质': '🌡️', '血瘀质': '🩸', '气郁质': '💭', '特禀质': '🌸'
        };
        return icons[type] || '🧬';
    }

    var MASTER_MAP = {
        'huangdi': { id: 'huangdi', name: '黄帝/岐伯', title: '医道之祖', era: '上古', avatar: '🏔️', style: '阴阳五行，天人相应，从整体气机着眼', tag: '阴阳根本' },
        'bianque': { id: 'bianque', name: '扁鹊', title: '脉学之祖', era: '战国', avatar: '🔍', style: '望闻问切四诊合参，望色切脉，一语中的', tag: '望切为先' },
        'zhangzhongjing': { id: 'zhangzhongjing', name: '张仲景', title: '医圣', era: '东汉', avatar: '📜', style: '六经辨证，方证对应，条理清晰，朴实实用', tag: '方证对应' },
        'wangshuhe': { id: 'wangshuhe', name: '王叔和', title: '脉学大师', era: '西晋', avatar: '💓', style: '脉象细腻，善用比喻，寸关尺分部辨证', tag: '脉诊精微' },
        'taohongjing': { id: 'taohongjing', name: '陶弘景', title: '本草集注者', era: '南朝', avatar: '🌿', style: '考据严谨，分类定品，七情和合，君臣佐使', tag: '药性考据' },
        'lishizhen': { id: 'lishizhen', name: '李时珍', title: '药圣', era: '明代', avatar: '📖', style: '百科全书式，考订精详，溯源求本，纠错正讹', tag: '本草纲目' },
        'sunsimiao': { id: 'sunsimiao', name: '孙思邈', title: '药王', era: '唐代', avatar: '⛰️', style: '大医精诚，博极医源，强调养生防病，推崇食疗药膳', tag: '大医精诚' },
        'zhangjingyue': { id: 'zhangjingyue', name: '张景岳', title: '温补宗师', era: '明代', avatar: '🏠', style: '阳常不足，阴易亏虚，推崇温补，善用熟地', tag: '温补命门' },
        'yetieshi': { id: 'yetieshi', name: '叶天士', title: '温病大家', era: '清代', avatar: '🌡️', style: '卫气营血辨证，先安未受邪之地，辨证精细', tag: '卫气营血' },
        'wujutong': { id: 'wujutong', name: '吴鞠通', title: '温病三焦', era: '清代', avatar: '💧', style: '三焦辨证，分消走泄，治上焦如羽治中焦如衡治下焦如权', tag: '三焦辨证' },
        'zhudanyu': { id: 'zhudanyu', name: '朱丹溪', title: '滋阴派创始人', era: '元代', avatar: '🌙', style: '阳常有余，阴常不足，相火论，善用四物汤加减', tag: '滋阴降火' },
        'xuexue': { id: 'xuexue', name: '薛雪', title: '湿热派大家', era: '清代', avatar: '🌿', style: '湿热致病，分消走泄，治湿不忘理气，治热不忘养阴', tag: '湿热分消' }
    };

    var DIANJIN_YINWEN = {
        '气虚质': [
            { source: '《素问·阴阳应象大论》', text: '清气在下，则生飧泄；浊气在上，则生䐜胀。此阴阳反作，病之逆从也。' },
            { source: '《景岳全书》', text: '人之生死，全由元气。元气既虚，必不能达于四肢，四肢厥冷，故谓之气虚。' }
        ],
        '阳虚质': [
            { source: '《素问·调经论》', text: '阳虚则外寒，阴虚则内热，阳盛则外热，阴盛则内寒。' },
            { source: '《伤寒论》', text: '少阴之为病，脉微细，但欲寐也。阳虚阴盛，当以温之。' }
        ],
        '阴虚质': [
            { source: '《素问·生气通天论》', text: '阴平阳秘，精神乃治；阴阳离决，精气乃绝。' },
            { source: '《景岳全书》', text: '阴虚者，水亏也。水亏则精血不足，故见潮热盗汗、五心烦热之证。' }
        ],
        '痰湿质': [
            { source: '《素问·至真要大论》', text: '诸湿肿满，皆属于脾。脾失健运，湿聚成痰，痰湿内生。' },
            { source: '《丹溪心法》', text: '凡人身上中下有块者，多是痰。痰之为物，随气升降，无处不到。' }
        ],
        '湿热质': [
            { source: '《温热论》', text: '湿与热合，如油入面，缠绵难解。湿热之邪，伤人最速。' },
            { source: '《温病条辨》', text: '湿热互结，阻于气分，当以苦辛通降，清热利湿。' }
        ],
        '血瘀质': [
            { source: '《素问·痹论》', text: '痹在于脉则血凝而不流。血行不畅，瘀滞为患。' },
            { source: '《医林改错》', text: '血瘀之证，必有其因。或寒凝，或热灼，或气滞，或气虚，皆可致瘀。' }
        ],
        '气郁质': [
            { source: '《素问·举痛论》', text: '百病生于气也。怒则气上，喜则气缓，悲则气消，恐则气下，惊则气乱，思则气结。' },
            { source: '《丹溪心法》', text: '气血冲和，万病不生，一有怫郁，诸病生焉。' }
        ],
        '特禀质': [
            { source: '《素问·异法方宜论》', text: '东方之域，天地之所始生也，鱼盐之地，海滨傍水，其民食鱼而嗜咸，皆安其处，美其食，鱼者使人热中，盐者胜血。' },
            { source: '《黄帝内经》', text: '正气存内，邪不可干。先天禀赋不足，正气虚弱，故易感外邪，发为特异之证。' }
        ],
        '平和质': [
            { source: '《素问·上古天真论》', text: '恬淡虚无，真气从之，精神内守，病安从来。阴阳匀平，气血以充，是谓平和。' },
            { source: '《类经》', text: '阴平阳秘，精神乃治。形气相得，谓之可治；色泽以光，谓之可生。' }
        ]
    };

    function runCorrelationCheck() {
        var checked = document.querySelectorAll('.symptom-tags input:checked, .symptom-group input:checked');
        var symptoms = Array.from(checked).map(function(el) { return el.value; });
        var panel = document.getElementById('correlation-panel');
        if (!panel) return;

        if (symptoms.length === 0) {
            panel.innerHTML = '<div class="correlation-hint">选择症状后，此处将显示关联体质与方剂</div>';
            return;
        }

        var tizhiCount = {};
        var formulaCount = {};
        symptoms.forEach(function(s) {
            var corr = SYMPTOM_CORRELATION[s];
            if (!corr) return;
            corr.tizhi.forEach(function(t) { tizhiCount[t] = (tizhiCount[t] || 0) + 1; });
            corr.formula.forEach(function(f) { formulaCount[f] = (formulaCount[f] || 0) + 1; });
        });

        var tizhiSorted = Object.keys(tizhiCount).sort(function(a, b) { return formulaCount[b] - formulaCount[a]; });
        var formulaSorted = Object.keys(formulaCount).sort(function(a, b) { return formulaCount[b] - formulaCount[a]; });

        if (tizhiSorted.length === 0 && formulaSorted.length === 0) {
            panel.innerHTML = '<div class="correlation-hint">暂无关联体质与方剂，请继续选择更多症状</div>';
            return;
        }

        var html = '<div class="correlation-row">';
        html += '<div class="correlation-block"><h6>关联体质</h6><div class="correlation-tags">';
        tizhiSorted.forEach(function(t) { html += '<span class="corr-tag corr-tizhi">' + t + '</span>'; });
        html += '</div></div>';
        html += '<div class="correlation-block"><h6>关联方剂</h6><div class="correlation-tags">';
        formulaSorted.forEach(function(f) { html += '<span class="corr-tag corr-fangji">' + f + '</span>'; });
        html += '</div></div>';
        html += '</div>';
        panel.innerHTML = html;
    }

    function _renderBianzhengFlow(result) {
        var el = document.getElementById('bianzheng-flow');
        if (!el) return;
        var html = '<div class="flow-title">辨证推理路径</div>';
        html += '<div class="bianzheng-flow-chart">';
        // 第一步：症状输入
        html += '<div class="flow-step">';
        html += '<div class="flow-dot"></div><div class="flow-label">症状输入</div>';
        html += '<div class="flow-desc">' + (result.symptoms ? result.symptoms.length + '个症状' : '') + '</div>';
        html += '</div>';
        html += '<div class="flow-arrow">↓</div>';
        // 第二步：八纲评分
        html += '<div class="flow-step">';
        html += '<div class="flow-dot"></div><div class="flow-label">八纲评分</div>';
        var bgKeys = ['表', '里', '寒', '热', '虚', '实', '阴', '阳'];
        var bgItems = bgKeys.filter(function(k) { return result.biaogan && result.biaogan[k] > 0; });
        html += '<div class="flow-tags">' + bgItems.map(function(k) { return '<span class="flow-tag">' + k + '</span>'; }).join('') + '</div>';
        html += '</div>';
        html += '<div class="flow-arrow">↓</div>';
        // 第三步：六经/脏腑
        html += '<div class="flow-step">';
        html += '<div class="flow-dot"></div><div class="flow-label">六经脏腑</div>';
        var jingHtml = result.liujing ? '<span class="flow-tag jing">' + result.liujing.jing + '证</span>' : '';
        var zangHtml = result.zangfu && result.zangfu.length > 0 ? result.zangfu.slice(0, 3).map(function(z) { return '<span class="flow-tag">' + z.zang + '</span>'; }).join('') : '';
        html += '<div class="flow-tags">' + jingHtml + zangHtml + '</div>';
        html += '</div>';
        html += '<div class="flow-arrow">↓</div>';
        // 第四步：辨证结论
        html += '<div class="flow-step flow-step-final">';
        html += '<div class="flow-dot"></div><div class="flow-label">辨证结论</div>';
        html += '<div class="flow-result">' + (result.final_syndrome || '—') + '</div>';
        if (result.confidence > 0) html += '<div class="flow-conf">' + result.confidence + '% 置信度</div>';
        html += '</div>';
        html += '</div>';
        el.innerHTML = html;
    }

    window.runIntegratedBianzheng = runIntegratedBianzheng;
    window.runIntegratedTizhi = runIntegratedTizhi;
    window.selectIntegratedMaster = selectIntegratedMaster;
    window.runIntegratedAnalysis = runIntegratedAnalysis;

    if (typeof QiuhuangApp !== 'undefined') {
        QiuhuangApp.registerRoute('#/tizhi', render);
    }

    global.TizhiComponent = { render: render };

    // 实时关联：症状选择后立即更新关联面板
    var _corrAttached = false;
    function _attachCorrelationListeners() {
        if (_corrAttached) return;
        _corrAttached = true;
        document.querySelectorAll('.symptom-tags input, .symptom-group input').forEach(function(cb) {
            cb.addEventListener('change', runCorrelationCheck);
        });
    }

    // 页面加载后绑定事件
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _attachCorrelationListeners);
    } else {
        setTimeout(_attachCorrelationListeners, 100);
    }
})(typeof window !== 'undefined' ? window : this);
