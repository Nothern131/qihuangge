/**
 * 岐黄阁 · 药膳食谱组件
 * 体质标签 → 药膳按钮 → 详情卡片（含材料、做法、用法用量、注意事项）
 */
(function(global) {
    'use strict';

    var SHIPU_DB = {
        '气虚体质': [
            {
                name: '黄芪炖鸡',
                ingredients: '黄芪30g、母鸡1只（约1000g）、生姜3片、红枣5枚',
                steps: '1. 母鸡宰杀去内脏，洗净切块焯水去腥\n2. 黄芪洗净，红枣去核\n3. 所有材料放入炖盅，加清水没过食材\n4. 大火烧开转小火炖2小时\n5. 加少许盐调味即可',
                usage: '每日1次，每次喝汤1碗（约200ml），吃肉适量。连续食用7-14天为一个疗程。',
                dosage: '黄芪30g为一日量，母鸡半只亦可。',
                suitability: '气虚乏力、气短懒言、易出汗、面色苍白',
                caution: '感冒发热时暂停；阴虚火旺者慎用。',
                source: '《圣济总录》卷十七·食治门'
            },
            {
                name: '山药粥',
                ingredients: '山药50g、粳米100g、红枣3枚',
                steps: '1. 山药去皮切小块，粳米淘洗干净\n2. 所有材料放入锅中，加水约800ml\n3. 大火煮开后转小火煮30分钟\n4. 搅拌至粥稠，加少许冰糖或盐调味',
                usage: '每日早晚各1次，每次1碗（约250ml），可作为主食代替部分米饭。',
                dosage: '山药50g、粳米100g为一人一日量。',
                suitability: '脾虚食少、便溏乏力、消化不良',
                caution: '大便干燥者不宜多食。',
                source: '《本草纲目》引《日华子本草》'
            },
            {
                name: '红枣桂圆茶',
                ingredients: '红枣5枚、桂圆肉10g',
                steps: '1. 红枣撕开去核\n2. 桂圆肉洗净\n3. 放入杯中，冲入沸水300ml\n4. 盖盖焖10分钟即可饮用',
                usage: '每日1-2次，代茶饮，可反复冲泡至味淡。建议下午前饮用。',
                dosage: '红枣5枚、桂圆10g为一日量，可分2次冲泡。',
                suitability: '气血两虚、面色萎黄、失眠健忘',
                caution: '糖尿病患者慎用（含糖）；体质偏热者减量。',
                source: '《神农本草经》'
            },
            {
                name: '人参黄芪粥',
                ingredients: '人参3g、黄芪15g、粳米100g',
                steps: '1. 人参切片，黄芪捣碎\n2. 两味药材加冷水500ml，浸泡30分钟\n3. 大火煮开后小火煎20分钟，滤渣取汁\n4. 用药汁与粳米同煮成粥',
                usage: '每日1次，空腹温热服用，每次1碗（约300ml）。连续7天为一疗程。',
                dosage: '人参3g、黄芪15g为一日量，不宜过量。',
                suitability: '气虚易感、自汗乏力、病后体虚',
                caution: '感冒发热期间停用；高血压患者慎用。'
            },
            {
                name: '黄芪枸杞茶',
                ingredients: '黄芪10g、枸杞10g',
                steps: '1. 黄芪洗净切片\n2. 放入杯中，冲入沸水300ml\n3. 焖5分钟后加入枸杞\n4. 再焖5分钟即可饮用',
                usage: '每日1次，代茶饮，下午前饮用最佳。黄芪可反复冲泡2-3次。',
                dosage: '黄芪10g、枸杞10g为一日量。',
                suitability: '气血两虚、面色萎黄、容易疲劳',
                caution: '有实热者不宜；经期女性慎用。',
                source: '《寿世青编》'
            }
        ],
        '阳虚体质': [
            {
                name: '当归生姜羊肉汤',
                ingredients: '当归15g、生姜30g、羊肉500g、料酒1勺',
                steps: '1. 羊肉切块，冷水下锅焯水去血沫\n2. 当归洗净，生姜切片\n3. 所有材料放入砂锅，加清水1500ml\n4. 大火烧开转小火炖1.5小时\n5. 加少许盐调味即可',
                usage: '每周2-3次，每次喝汤1碗（约250ml），吃肉适量。冬季为佳。',
                dosage: '当归15g、生姜30g、羊肉500g为一剂量。',
                suitability: '阳虚畏寒、四肢不温、腰膝冷痛、面色苍白',
                caution: '体内有热、口干舌燥者慎用；孕妇慎用当归。',
                source: '《金匮要略》'
            },
            {
                name: '肉桂粥',
                ingredients: '肉桂粉3g、粳米100g、红糖适量',
                steps: '1. 粳米淘洗干净，加水800ml\n2. 大火煮开后转小火煮30分钟至粥稠\n3. 加入肉桂粉搅拌均匀\n4. 加红糖调味，再煮2分钟即可',
                usage: '每日1次，早餐或晚餐温热食用，每次1碗（约300ml）。连续7天。',
                dosage: '肉桂粉3g为一日量，不宜久服。',
                suitability: '肾阳不足、腰膝冷痛、畏寒肢冷',
                caution: '孕妇禁用；阴虚火旺者忌服。'
            },
            {
                name: '韭菜炒核桃',
                ingredients: '韭菜200g、核桃仁50g、盐适量、食用油少许',
                steps: '1. 韭菜洗净切段，核桃仁略炒香\n2. 锅中放油烧热，下韭菜快速翻炒\n3. 加入核桃仁，加盐调味\n4. 翻炒均匀即可出锅',
                usage: '每日1次，作为佐餐菜肴食用。每周3-4次。',
                dosage: '韭菜200g、核桃仁50g为一餐量。',
                suitability: '阳虚腰痛、畏寒肢冷、肾气不足',
                caution: '脾胃虚弱、易腹泻者不宜多食韭菜。',
                source: '《食疗本草》'
            },
            {
                name: '附子理中粥',
                ingredients: '制附子3g（先煎）、干姜5g、粳米100g、红枣3枚',
                steps: '1. 制附子先单独煎煮1小时（去毒性）\n2. 加入干姜、红枣再煎20分钟\n3. 滤渣取汁，用药汁与粳米同煮成粥\n4. 粥稠即可食用',
                usage: '每周2次，每次1碗（约300ml），温热服用。不可连续长期服用。',
                dosage: '制附子3g、干姜5g为一日量，必须先煎1小时以上。',
                suitability: '阳虚畏寒、四肢冰凉、腹泻便溏',
                caution: '附子有毒，必须先煎1小时以上去毒；孕妇禁用；用量须遵医嘱。'
            }
        ],
        '阴虚体质': [
            {
                name: '沙参玉竹老鸭汤',
                ingredients: '北沙参20g、玉竹15g、老鸭半只（约500g）、生姜2片',
                steps: '1. 老鸭宰杀去内脏，洗净切块焯水\n2. 沙参、玉竹洗净，生姜切片\n3. 所有材料放入炖盅，加清水1000ml\n4. 大火烧开转小火炖1.5小时\n5. 加少许盐调味即可',
                usage: '每周2-3次，每次喝汤1碗（约250ml），吃肉适量。',
                dosage: '北沙参20g、玉竹15g为一剂量。',
                suitability: '阴虚口干、手足心热、夜间盗汗、干咳少痰',
                caution: '脾胃虚寒、容易腹泻者慎用。',
                source: '《医宗金鉴》'
            },
            {
                name: '银耳百合羹',
                ingredients: '银耳10g、百合20g、冰糖适量',
                steps: '1. 银耳冷水泡发2小时，撕成小朵\n2. 百合洗净，与银耳一起放入锅中\n3. 加水800ml，大火煮开后转小火炖40分钟\n4. 加入百合再煮10分钟\n5. 加冰糖搅拌至融化即可',
                usage: '每日1次，可作甜品或下午茶，每次1碗（约250ml）。',
                dosage: '银耳10g、百合20g、冰糖适量为一日量。',
                suitability: '阴虚咳嗽、皮肤干燥、失眠多梦',
                caution: '风寒咳嗽者不宜；糖尿病人少糖或不加糖。',
                source: '《本草纲目》'
            },
            {
                name: '枸杞桑葚茶',
                ingredients: '枸杞10g、桑葚15g',
                steps: '1. 枸杞、桑葚分别洗净\n2. 放入杯中，冲入沸水300ml\n3. 盖盖焖10分钟即可饮用\n4. 可反复冲泡2-3次',
                usage: '每日1-2次，代茶饮，下午前饮用。',
                dosage: '枸杞10g、桑葚15g为一日量。',
                suitability: '肝肾阴虚、眩晕耳鸣、视力模糊、腰膝酸软',
                caution: '脾胃虚寒、易腹泻者减量。',
                source: '《本草纲目》'
            },
            {
                name: '熟地山药粥',
                ingredients: '熟地黄15g、山药30g、粳米100g',
                steps: '1. 熟地黄用纱布包好，加冷水400ml煎20分钟\n2. 取出药包，加入切块山药和粳米\n3. 再加水400ml，大火煮开后转小火煮30分钟\n4. 粥稠即可，可加少许红糖调味',
                usage: '每日1次，早餐或晚餐温热食用，每次1碗（约300ml）。',
                dosage: '熟地黄15g、山药30g、粳米100g为一日量。',
                suitability: '肝肾阴虚、腰膝酸软、头晕耳鸣',
                caution: '脾胃湿滞、腹胀便溏者慎用。',
                source: '《景岳全书》'
            }
        ],
        '痰湿体质': [
            {
                name: '薏米红豆粥',
                ingredients: '薏苡仁30g、赤小豆30g、粳米50g',
                steps: '1. 薏苡仁、赤小豆提前浸泡4小时\n2. 所有材料洗净放入锅中\n3. 加水1000ml，大火煮开后转小火煮50分钟\n4. 煮至豆烂粥稠即可，可加少许冰糖',
                usage: '每日1次，可作为主食或午餐，每次1碗（约300ml）。连续7天。',
                dosage: '薏苡仁30g、赤小豆30g、粳米50g为一日量。',
                suitability: '痰湿体胖、困倦乏力、舌苔厚腻',
                caution: '孕妇慎用薏苡仁；尿频者少食。',
                source: '《神农本草经》'
            },
            {
                name: '冬瓜薏米汤',
                ingredients: '冬瓜200g（带皮）、薏苡仁30g',
                steps: '1. 冬瓜连皮洗净切块，薏苡仁提前浸泡\n2. 薏苡仁加水600ml，大火煮开后转小火煮30分钟\n3. 加入冬瓜块再煮15分钟\n4. 加少许盐调味即可',
                usage: '每周3-4次，每次喝汤1碗（约250ml），吃冬瓜适量。',
                dosage: '冬瓜200g、薏苡仁30g为一餐量。',
                suitability: '水肿肥胖、舌苔厚腻、肢体困重',
                caution: '体质虚寒者不宜多食冬瓜。'
            },
            {
                name: '陈皮普洱茶',
                ingredients: '陈皮5g、普洱茶5g',
                steps: '1. 陈皮洗净掰碎，普洱茶略洗\n2. 放入茶壶，冲入沸水300ml\n3. 焖5分钟后即可饮用\n4. 可反复冲泡3-5次',
                usage: '每日1-2次，饭后半小时饮用，每次150ml。',
                dosage: '陈皮5g、普洱茶5g为一日量。',
                suitability: '痰湿胸闷、脘腹胀满、食欲不振',
                caution: '空腹不宜饮用；失眠者下午后慎用。',
                source: '《本草纲目》'
            },
            {
                name: '白术茯苓粥',
                ingredients: '白术10g、茯苓15g、粳米100g',
                steps: '1. 白术、茯苓用纱布包好\n2. 药包加水500ml，煎20分钟滤渣取汁\n3. 用药汁与粳米同煮成粥\n4. 粥稠即可，可加少许糖调味',
                usage: '每日1次，早餐温热食用，每次1碗（约300ml）。',
                dosage: '白术10g、茯苓15g、粳米100g为一日量。',
                suitability: '脾虚湿盛、食少便溏、形体肥胖',
                caution: '阴虚燥渴者不宜。',
                source: '《太平惠民和剂局方》'
            }
        ],
        '湿热体质': [
            {
                name: '绿豆薏米汤',
                ingredients: '绿豆30g、薏苡仁30g、冰糖适量',
                steps: '1. 绿豆、薏苡仁提前浸泡2小时\n2. 放入锅中，加水800ml\n3. 大火煮开后转小火煮50分钟至豆烂\n4. 加冰糖调味，放凉后食用更佳',
                usage: '每周3-4次，每次1碗（约250ml），可放凉饮用。夏季最佳。',
                dosage: '绿豆30g、薏苡仁30g为一日量。',
                suitability: '湿热痤疮、口苦口干、面垢油光',
                caution: '脾胃虚寒者少食；经期女性慎用。',
                source: '《本草纲目》'
            },
            {
                name: '苦瓜炒蛋',
                ingredients: '苦瓜1根（约200g）、鸡蛋2个、盐适量、油少许',
                steps: '1. 苦瓜对半切开，去瓤切薄片，加少许盐腌制10分钟去苦味\n2. 鸡蛋打散，加少许盐\n3. 锅中放油烧热，下苦瓜翻炒至软\n4. 倒入蛋液，翻炒至蛋凝固即可出锅',
                usage: '每周2-3次，作为家常菜食用，每次1份。',
                dosage: '苦瓜1根、鸡蛋2个为一餐量。',
                suitability: '湿热内蕴、口苦口臭、痤疮频发',
                caution: '脾胃虚寒、容易腹泻者不宜多食。'
            },
            {
                name: '金银花菊花茶',
                ingredients: '金银花10g、菊花5g',
                steps: '1. 金银花、菊花分别洗净\n2. 放入杯中，冲入沸水300ml\n3. 盖盖焖8分钟即可饮用\n4. 可加少许蜂蜜调味',
                usage: '每日1-2次，代茶饮，下午前饮用。可反复冲泡。',
                dosage: '金银花10g、菊花5g为一日量。',
                suitability: '湿热疮疡、目赤肿痛、咽喉肿痛',
                caution: '脾胃虚寒者减量；孕妇慎用。',
                source: '《温病条辨》'
            },
            {
                name: '黄芩栀子茶',
                ingredients: '黄芩6g、栀子6g',
                steps: '1. 黄芩、栀子分别洗净\n2. 放入锅中，加水400ml\n3. 大火煮开后小火煎10分钟\n4. 滤渣取汁，待温后饮用',
                usage: '每日1次，饭后半小时饮用，每次150ml。连续5-7天。',
                dosage: '黄芩6g、栀子6g为一日量，不宜久服。',
                suitability: '湿热黄疸、肺热咳嗽、心烦失眠',
                caution: '脾胃虚寒者禁用；用量须遵医嘱。',
                source: '《伤寒论》'
            }
        ],
        '血瘀体质': [
            {
                name: '山楂红糖水',
                ingredients: '山楂15g、红糖10g',
                steps: '1. 山楂洗净去核，切碎\n2. 放入锅中，加水300ml\n3. 大火煮开后转小火煮10分钟\n4. 加入红糖搅拌至融化即可',
                usage: '每日1次，经前3-5天开始饮用，每次1杯（约200ml），温热服用。',
                dosage: '山楂15g、红糖10g为一日量。',
                suitability: '血瘀痛经、面色晦暗、唇色紫暗',
                caution: '月经量多者经期停用；胃酸过多者慎用。',
                source: '《本草纲目》'
            },
            {
                name: '黑木耳炒洋葱',
                ingredients: '黑木耳50g（干）、洋葱100g、蒜末少许、盐适量',
                steps: '1. 黑木耳冷水泡发2小时，撕小朵\n2. 洋葱切丝，蒜切末\n3. 锅中放油烧热，下蒜末爆香\n4. 加入洋葱翻炒至软，再加入木耳\n5. 加盐调味，翻炒均匀即可',
                usage: '每周3-4次，作为家常菜食用。',
                dosage: '黑木耳50g、洋葱100g为一餐量。',
                suitability: '血瘀体质、肤色晦暗、痛经有血块',
                caution: '出血倾向者慎用；手术前后停用。',
                source: '《食疗本草》'
            },
            {
                name: '玫瑰花茶',
                ingredients: '干玫瑰花5g',
                steps: '1. 玫瑰花放入杯中\n2. 冲入沸水300ml\n3. 盖盖焖5分钟即可饮用\n4. 可加少许蜂蜜调味',
                usage: '每日1次，代茶饮，可反复冲泡2-3次。',
                dosage: '干玫瑰花5g为一日量。',
                suitability: '气滞血瘀、情绪低落、胸闷胁痛',
                caution: '月经量多者经期停用；孕妇慎用。'
            },
            {
                name: '川芎炖鸡蛋',
                ingredients: '川芎10g、鸡蛋2个、红枣3枚',
                steps: '1. 川芎洗净拍碎，红枣去核\n2. 鸡蛋煮熟剥壳，表面轻划几刀\n3. 所有材料放入碗中，加水300ml\n4. 隔水炖30分钟，加少许盐调味',
                usage: '每周2-3次，每次1份。经前3天开始服用。',
                dosage: '川芎10g、鸡蛋2个为一餐量。',
                suitability: '血瘀头痛、痛经、面色晦暗',
                caution: '月经过多者慎用；孕妇禁用川芎。',
                source: '《太平惠民和剂局方》'
            }
        ],
        '气郁体质': [
            {
                name: '玫瑰花陈皮茶',
                ingredients: '玫瑰花5g、陈皮3g',
                steps: '1. 玫瑰花、陈皮分别洗净\n2. 放入杯中，冲入沸水300ml\n3. 盖盖焖8分钟即可饮用\n4. 可加少许蜂蜜调味',
                usage: '每日1-2次，代茶饮，情绪不佳时饮用效果更佳。',
                dosage: '玫瑰花5g、陈皮3g为一日量。',
                suitability: '气郁胸闷、情绪低落、胸胁胀痛',
                caution: '阴虚火旺者减量；孕妇慎用。',
                source: '《本草纲目》'
            },
            {
                name: '佛手粥',
                ingredients: '佛手10g、粳米100g、冰糖适量',
                steps: '1. 佛手洗净，加冷水300ml煎15分钟滤渣取汁\n2. 用药汁与粳米同煮成粥\n3. 粥稠后加入冰糖调味即可',
                usage: '每日1次，早餐温热食用，每次1碗（约300ml）。',
                dosage: '佛手10g、粳米100g为一日量。',
                suitability: '肝郁气滞、脘腹胀满、食欲不振',
                caution: '气虚者慎用；孕妇不宜多食。',
                source: '《本草纲目》'
            },
            {
                name: '薄荷柠檬水',
                ingredients: '薄荷叶5g、柠檬2片、蜂蜜适量',
                steps: '1. 薄荷叶洗净，柠檬切片\n2. 放入杯中，冲入温水300ml（不宜过烫）\n3. 待水温降至60度以下加入蜂蜜\n4. 搅拌均匀即可饮用',
                usage: '每日1-2次，代茶饮，下午前饮用。',
                dosage: '薄荷5g、柠檬2片为一日量。',
                suitability: '气郁烦躁、胸胁胀满、情绪不畅',
                caution: '胃酸过多者少喝；不宜空腹饮用。'
            },
            {
                name: '柴胡疏肝茶',
                ingredients: '柴胡6g、陈皮3g、玫瑰花3g',
                steps: '1. 柴胡、陈皮分别洗净\n2. 所有材料放入杯中，冲入沸水300ml\n3. 盖盖焖10分钟即可饮用\n4. 可加少许蜂蜜调味',
                usage: '每日1次，饭后半小时饮用，每次150ml。连续5-7天。',
                dosage: '柴胡6g、陈皮3g、玫瑰花3g为一日量。',
                suitability: '肝郁气滞、胸胁胀痛、情绪抑郁',
                caution: '阴虚火旺者慎用；孕妇慎用柴胡。',
                source: '《景岳全书》'
            }
        ],
        '特禀体质': [
            {
                name: '黄芪防风粥',
                ingredients: '黄芪20g、防风10g、粳米100g',
                steps: '1. 黄芪、防风用纱布包好\n2. 药包加水500ml，煎20分钟滤渣取汁\n3. 用药汁与粳米同煮成粥\n4. 粥稠即可，可加少许冰糖',
                usage: '每周2-3次，早餐温热食用，每次1碗（约300ml）。连续14天。',
                dosage: '黄芪20g、防风10g、粳米100g为一日量。',
                suitability: '特禀易过敏、自汗、反复感冒',
                caution: '感冒发热期间停用；对黄芪过敏者禁用。'
            },
            {
                name: '红枣莲子汤',
                ingredients: '红枣10枚、莲子20g、冰糖适量',
                steps: '1. 莲子提前浸泡2小时，去芯\n2. 红枣洗净去核\n3. 所有材料放入锅中，加水600ml\n4. 大火煮开后转小火煮40分钟\n5. 加冰糖搅拌至融化即可',
                usage: '每周2-3次，每次1碗（约250ml），可作甜品。',
                dosage: '红枣10枚、莲子20g为一餐量。',
                suitability: '气虚易感、脾胃虚弱、失眠多梦',
                caution: '糖尿病患者少糖；便秘者慎用莲子。',
                source: '《本草纲目》'
            },
            {
                name: '茯苓山药粥',
                ingredients: '茯苓15g、山药30g、粳米100g',
                steps: '1. 茯苓用纱布包好，加冷水400ml煎15分钟滤渣取汁\n2. 山药去皮切小块\n3. 用药汁与山药、粳米同煮成粥\n4. 粥稠即可，可加少许糖调味',
                usage: '每日1次，早餐温热食用，每次1碗（约300ml）。',
                dosage: '茯苓15g、山药30g、粳米100g为一日量。',
                suitability: '脾虚失眠、心悸健忘、消化不良',
                caution: '便秘者不宜多食茯苓。',
                source: '《太平惠民和剂局方》'
            }
        ]
    };

    function render() {
        var tabs = Object.keys(SHIPU_DB).map(function(t) {
            return '<button class="tab-btn" onclick="showShipu(\'' + t + '\')">' + t + '</button>';
        }).join('');

        return `
            <div class="shipu-page">
                <h2>药膳食谱</h2>
                <p class="desc">药食同源，辨证施膳（本系统仅供科普，不可替代药物或营养干预）</p>
                <div class="tab-nav">${tabs}</div>
                <div id="shipu-content" class="result-section">
                    <p style="color:#a09888;">请选择上方体质标签，查看对应药膳食谱</p>
                </div>
                <div class="nutrition-note">
                    <p><strong>营养学声明：</strong></p>
                    <p>药膳食谱属于中医食疗范畴，不能替代临床营养干预或药物治疗。</p>
                    <p>人体所需营养物质包括：蛋白质、脂肪、碳水化合物、维生素、矿物质、膳食纤维和水，共七大类。</p>
                    <p>本系统食谱仅供参考，特殊体质人群请在医师或营养师指导下食用。</p>
                </div>
            </div>
        `;
    }

    window.showShipu = function(tizhi) {
        var recipes = SHIPU_DB[tizhi] || [];
        var html = '<div class="recipe-tabs">' +
            recipes.map(function(r, i) {
                return '<button class="recipe-tab-btn' + (i === 0 ? ' active' : '') + '" onclick="showRecipeDetail(\'' + tizhi + '\', ' + i + ')">' + r.name + '</button>';
            }).join('') +
            '</div>';
        html += '<div id="recipe-detail-' + tizhi + '" class="recipe-detail"></div>';

        document.getElementById('shipu-content').innerHTML = html;
        showRecipeDetail(tizhi, 0);
    };

    window.showRecipeDetail = function(tizhi, index) {
        var recipes = SHIPU_DB[tizhi] || [];
        if (index < 0 || index >= recipes.length) return;

        var r = recipes[index];

        // 更新按钮状态
        var btns = document.querySelectorAll('#shipu-content .recipe-tab-btn');
        btns.forEach(function(btn, i) {
            btn.classList.toggle('active', i === index);
        });

        var stepsHtml = r.steps.split('\n').map(function(s) {
            return '<div class="step-item">' + s + '</div>';
        }).join('');

        var html = '<div class="recipe-detail-card">';
        html += '<div class="recipe-detail-header"><h4>' + r.name + '</h4></div>';
        html += '<div class="recipe-detail-body">';

        if (r.source) {
            html += '<div class="recipe-source"><span class="source-icon">📜</span>出自《' + r.source + '》</div>';
        }

        html += '<div class="recipe-attr"><strong>材料用量：</strong>' + r.ingredients + '</div>';
        html += '<div class="recipe-attr"><strong>制作步骤：</strong><div class="steps-list">' + stepsHtml + '</div></div>';
        html += '<div class="recipe-attr usage"><strong>用法用量：</strong>' + r.usage + '</div>';
        html += '<div class="recipe-attr dosage"><strong>每日用量：</strong>' + r.dosage + '</div>';
        html += '<div class="recipe-attr suit"><strong>适用人群：</strong>' + r.suitability + '</div>';
        html += '<div class="recipe-attr caution"><strong>注意事项：</strong>' + r.caution + '</div>';

        html += '</div></div>';

        var container = document.getElementById('recipe-detail-' + tizhi);
        if (container) container.innerHTML = html;
    };

    global.ShipuComponent = { render: render };
})(typeof window !== 'undefined' ? window : this);
