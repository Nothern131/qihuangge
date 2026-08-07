/**
 * 岐黄阁 · 维生素补充建议引擎
 * 提供维生素矿物质百科查询、症状-营养素匹配、补充记录追踪
 * 全部使用 localStorage 本地存储，无外部 API
 */
(function(global) {
    'use strict';

    // ========== 维生素矿物质数据库 ==========

    var VITAMIN_LIST = [
        {
            id: 'vitamin-a',
            nameCN: '维生素A',
            nameEN: 'Vitamin A',
            icon: '🥕',
            category: '维生素',
            function: '维持视力健康，尤其是夜视能力；保护皮肤和黏膜完整性；增强免疫力；促进生长发育。',
            foods: '胡萝卜、南瓜、红薯、菠菜、动物肝脏、鸡蛋、牛奶、芒果',
            dailyIntake: '男性 800μg RAE，女性 700μg RAE',
            deficiency: '夜盲症、干眼症、皮肤干燥粗糙、毛囊角化、免疫力下降、生长发育迟缓',
            overdose: '长期超量（>3000μg/天）可致中毒，表现为头痛、恶心、皮肤脱屑、肝损伤、骨痛。孕妇过量可致胎儿畸形。',
            maxDaily: '3000μg RAE（可耐受最高摄入量）'
        },
        {
            id: 'vitamin-b1',
            nameCN: '维生素B1',
            nameEN: 'Thiamine (Vitamin B1)',
            icon: '🌾',
            category: '维生素',
            function: '参与能量代谢，帮助碳水化合物转化为能量；维持神经系统正常功能；促进食欲。',
            foods: '糙米、全麦、燕麦、猪肉、花生、大豆、葵花籽、酵母',
            dailyIntake: '男性 1.4mg，女性 1.2mg',
            deficiency: '脚气病（神经系统和心血管系统症状）、食欲不振、疲劳、肌肉无力、周围神经炎、记忆障碍',
            overdose: '水溶性维生素，过量多随尿液排出，毒性极低。极少数人可能对注射剂产生过敏反应。',
            maxDaily: '50mg（口服一般安全）'
        },
        {
            id: 'vitamin-b2',
            nameCN: '维生素B2',
            nameEN: 'Riboflavin (Vitamin B2)',
            icon: '🥛',
            category: '维生素',
            function: '参与体内氧化还原反应，维持皮肤、黏膜和眼睛健康；帮助铁的吸收和利用。',
            foods: '牛奶、鸡蛋、动物肝脏、瘦肉、鱼类、绿叶蔬菜、杏仁、酵母',
            dailyIntake: '男性 1.4mg，女性 1.2mg',
            deficiency: '口角炎、唇炎、舌炎、口腔溃疡、脂溢性皮炎、角膜炎、畏光、视力模糊',
            overdose: '水溶性维生素，过量随尿液排出，尿液呈黄色属正常现象。毒性极低。',
            maxDaily: '40mg'
        },
        {
            id: 'vitamin-b3',
            nameCN: '维生素B3',
            nameEN: 'Niacin (Vitamin B3)',
            icon: '🐟',
            category: '维生素',
            function: '参与能量代谢和DNA修复；维持皮肤健康；降低血脂；改善血液循环。',
            foods: '动物肝脏、鸡肉、鱼肉、花生、全麦、蘑菇、咖啡、绿茶',
            dailyIntake: '男性 15mg NE，女性 12mg NE',
            deficiency: '糙皮病（皮炎、腹泻、痴呆）、口腔溃疡、舌炎、疲劳、食欲不振、情绪低落',
            overdose: '过量（>50mg/天）可致面部潮红、瘙痒、头痛、肝损伤。缓释型可减轻潮红反应。',
            maxDaily: '35mg NE（烟酰胺形式可达 900mg/天，但需医嘱）'
        },
        {
            id: 'vitamin-b6',
            nameCN: '维生素B6',
            nameEN: 'Pyridoxine (Vitamin B6)',
            icon: '🍌',
            category: '维生素',
            function: '参与氨基酸代谢和神经递质合成；维持神经系统功能；帮助血红蛋白合成；调节情绪。',
            foods: '鸡肉、鱼肉、香蕉、土豆、鹰嘴豆、坚果、菠菜、全麦',
            dailyIntake: '1.4mg（男女相同）',
            deficiency: '情绪低落、失眠、皮炎、口腔溃疡、贫血、免疫力下降、神经炎、孕吐加重',
            overdose: '长期超量（>100mg/天）可致神经毒性，表现为四肢麻木、行走不稳。',
            maxDaily: '60mg'
        },
        {
            id: 'vitamin-b9',
            nameCN: '叶酸（维生素B9）',
            nameEN: 'Folate (Vitamin B9)',
            icon: '🥬',
            category: '维生素',
            function: '参与DNA合成和细胞分裂；预防胎儿神经管畸形；促进红细胞生成；降低同型半胱氨酸。',
            foods: '深绿色蔬菜（菠菜、西兰花）、动物肝脏、豆类、鸡蛋、柑橘、全麦',
            dailyIntake: '400μg DFE（孕妇 600μg，哺乳期 550μg）',
            deficiency: '巨幼细胞性贫血、疲劳、舌炎、胎儿神经管畸形、同型半胱氨酸升高、口腔溃疡',
            overdose: '长期超量（>1000μg/天）可掩盖维生素B12缺乏症状，延误恶性贫血诊断。',
            maxDaily: '1000μg DFE'
        },
        {
            id: 'vitamin-b12',
            nameCN: '维生素B12',
            nameEN: 'Cobalamin (Vitamin B12)',
            icon: '🥩',
            category: '维生素',
            function: '维持神经系统健康；参与红细胞生成；帮助DNA合成；维持能量代谢。',
            foods: '动物肝脏、牛肉、鱼类、鸡蛋、牛奶、奶酪、蛤蜊（素食者易缺乏）',
            dailyIntake: '2.4μg',
            deficiency: '巨幼细胞性贫血、疲劳乏力、手脚麻木、记忆力下降、情绪低落、舌炎、行走不稳',
            overdose: '水溶性维生素，毒性极低。过量多随尿液排出，未见明显毒性报道。',
            maxDaily: '未设定（吸收率随剂量下降）'
        },
        {
            id: 'vitamin-c',
            nameCN: '维生素C',
            nameEN: 'Vitamin C',
            icon: '🍊',
            category: '维生素',
            function: '抗氧化，清除自由基；促进胶原蛋白合成；增强免疫力；促进铁吸收；参与伤口愈合。',
            foods: '柑橘类水果、猕猴桃、草莓、番茄、青椒、西兰花、红枣、刺梨',
            dailyIntake: '100mg（吸烟者需增加 35mg）',
            deficiency: '坏血病（牙龈出血、皮下瘀斑、伤口愈合不良）、免疫力低下、疲劳、关节疼痛、皮肤干燥',
            overdose: '过量（>2000mg/天）可致腹泻、胃肠不适、腹痛。长期大量可能增加肾结石风险。',
            maxDaily: '2000mg'
        },
        {
            id: 'vitamin-d',
            nameCN: '维生素D',
            nameEN: 'Vitamin D',
            icon: '☀️',
            category: '维生素',
            function: '促进钙吸收，维持骨骼健康；调节免疫功能；改善情绪；预防骨质疏松。',
            foods: '鱼肝油、三文鱼、沙丁鱼、蛋黄、动物肝脏、强化牛奶、晒太阳（主要来源）',
            dailyIntake: '10μg（400 IU，65岁以上 15μg）',
            deficiency: '骨质疏松、佝偻病（儿童）、肌肉无力、畏寒、免疫力低下、情绪低落、易骨折',
            overdose: '过量（>100μg/天）可致高钙血症、肾结石、恶心呕吐、食欲不振、肾损伤。',
            maxDaily: '50μg（2000 IU）'
        },
        {
            id: 'vitamin-e',
            nameCN: '维生素E',
            nameEN: 'Vitamin E',
            icon: '🌻',
            category: '维生素',
            function: '强效抗氧化，保护细胞膜；延缓衰老；保护心血管健康；改善皮肤弹性。',
            foods: '坚果（杏仁、核桃）、葵花籽、植物油、菠菜、牛油果、全麦',
            dailyIntake: '14mg α-TE',
            deficiency: '皮肤干燥、肌肉无力、神经损伤、贫血、免疫力下降、生殖功能障碍',
            overdose: '过量（>1000mg/天）可增加出血风险，抑制血小板聚集。维生素K缺乏者需谨慎。',
            maxDaily: '700mg'
        },
        {
            id: 'vitamin-k',
            nameCN: '维生素K',
            nameEN: 'Vitamin K',
            icon: '🥦',
            category: '维生素',
            function: '参与凝血因子合成，维持正常凝血功能；促进骨骼钙化，预防骨质疏松。',
            foods: '深绿色蔬菜（菠菜、西兰花、羽衣甘蓝）、纳豆、动物肝脏、鸡蛋、绿茶',
            dailyIntake: '男性 120μg，女性 90μg',
            deficiency: '出血倾向（易瘀伤、牙龈出血、伤口止血慢）、骨质疏松、凝血功能障碍',
            overdose: '天然维生素K毒性极低。过量合成维生素K（K3）可致溶血性贫血、肝损伤。',
            maxDaily: '未设定（天然形式安全性高）'
        },
        {
            id: 'calcium',
            nameCN: '钙',
            nameEN: 'Calcium',
            icon: '🦴',
            category: '矿物质',
            function: '构成骨骼和牙齿；维持神经肌肉正常兴奋性；参与凝血；调节心跳节律。',
            foods: '牛奶、酸奶、奶酪、豆腐、豆制品、芝麻、小鱼干、深绿色蔬菜',
            dailyIntake: '800mg（50岁以上及孕妇 1000mg）',
            deficiency: '骨质疏松、抽筋、手足抽搐、失眠、心悸、牙齿易松动、儿童佝偻病',
            overdose: '长期超量（>2000mg/天）可致高钙血症、肾结石、便秘、影响铁锌吸收。',
            maxDaily: '2000mg'
        },
        {
            id: 'iron',
            nameCN: '铁',
            nameEN: 'Iron',
            icon: '🩸',
            category: '矿物质',
            function: '构成血红蛋白和肌红蛋白，运输氧气；参与能量代谢；维持免疫功能。',
            foods: '动物肝脏、红肉、动物血、菠菜、黑木耳、红枣、蛋黄、豆类',
            dailyIntake: '男性 12mg，女性 20mg（孕妇 29mg）',
            deficiency: '缺铁性贫血、疲劳乏力、头晕、畏寒、面色苍白、心悸、脱发、指甲脆薄易裂',
            overdose: '过量可致铁中毒，表现为恶心呕吐、腹痛、肝损伤。遗传性血色病者需严格控制。',
            maxDaily: '50mg（男性）/ 50mg（女性）'
        },
        {
            id: 'zinc',
            nameCN: '锌',
            nameEN: 'Zinc',
            icon: '🦪',
            category: '矿物质',
            function: '参与多种酶活性；促进伤口愈合；维持味觉和嗅觉；增强免疫力；促进生长发育。',
            foods: '牡蛎、贝类、红肉、动物肝脏、南瓜籽、芝麻、蛋黄、豆类',
            dailyIntake: '男性 15mg，女性 11.5mg（孕妇 16.5mg）',
            deficiency: '食欲不振、味觉减退、伤口愈合慢、口腔溃疡、脱发、免疫力低下、生长发育迟缓',
            overdose: '过量（>40mg/天）可致恶心呕吐、腹痛、铜吸收障碍、免疫力下降。',
            maxDaily: '40mg'
        },
        {
            id: 'magnesium',
            nameCN: '镁',
            nameEN: 'Magnesium',
            icon: '🌰',
            category: '矿物质',
            function: '参与300多种酶反应；维持神经肌肉正常功能；调节心律；改善睡眠质量；缓解肌肉紧张。',
            foods: '坚果、种子、全麦、菠菜、香蕉、黑巧克力、豆类、海藻',
            dailyIntake: '男性 360mg，女性 310mg（孕妇 350mg）',
            deficiency: '失眠、肌肉抽筋、心悸、焦虑、疲劳、便秘、偏头痛、血压升高',
            overdose: '过量（>350mg/天补充剂）可致腹泻、腹痛。严重过量可致低血压、心律失常。',
            maxDaily: '350mg（补充剂，食物来源无上限）'
        },
        {
            id: 'selenium',
            nameCN: '硒',
            nameEN: 'Selenium',
            icon: '🥜',
            category: '矿物质',
            function: '抗氧化，保护细胞免受氧化损伤；维持甲状腺功能；增强免疫力；保护心血管。',
            foods: '巴西坚果、海鲜、动物肝脏、鸡蛋、大蒜、蘑菇、全麦',
            dailyIntake: '60μg',
            deficiency: '免疫力下降、甲状腺功能减退、男性不育、肌肉无力、心肌病（克山病）',
            overdose: '过量（>400μg/天）可致硒中毒，表现为脱发、指甲变形、大蒜味呼吸、神经损伤。',
            maxDaily: '400μg'
        },
        {
            id: 'omega-3',
            nameCN: 'Omega-3脂肪酸',
            nameEN: 'Omega-3 Fatty Acids',
            icon: '🐟',
            category: '脂肪酸',
            function: '抗炎，降低心血管疾病风险；改善认知功能；维持大脑健康；调节情绪；保护视力。',
            foods: '深海鱼（三文鱼、鲭鱼、沙丁鱼）、亚麻籽、奇亚籽、核桃、鱼油、藻油',
            dailyIntake: '250-500mg EPA+DHA',
            deficiency: '皮肤干燥、记忆力下降、情绪低落、视力疲劳、关节炎症、心血管风险增加',
            overdose: '过量（>5000mg/天）可增加出血风险，降低免疫功能。抗凝血药物使用者需谨慎。',
            maxDaily: '3000mg（EPA+DHA，无明确上限，但建议不超过此量）'
        },
        {
            id: 'coq10',
            nameCN: '辅酶Q10',
            nameEN: 'Coenzyme Q10',
            icon: '⚡',
            category: '类维生素',
            function: '参与细胞能量（ATP）生成；抗氧化，保护线粒体；维护心血管健康；缓解疲劳。',
            foods: '动物心脏、动物肝脏、牛肉、沙丁鱼、西兰花、花生、大豆油',
            dailyIntake: '30-100mg（建议范围，非必需营养素）',
            deficiency: '疲劳乏力、心悸、肌肉无力、牙龈问题、心血管功能下降、随年龄增长自然减少',
            overdose: '安全性高，偶有轻度胃肠不适、恶心。高剂量（>300mg/天）可能引起失眠。',
            maxDaily: '300mg'
        },
        {
            id: 'vitamin-b7',
            nameCN: '生物素（维生素B7）',
            nameEN: 'Biotin (Vitamin B7)',
            icon: '💇',
            category: '维生素',
            function: '参与脂肪酸合成和糖异生；维持头发、皮肤和指甲健康；促进能量代谢。',
            foods: '蛋黄、动物肝脏、坚果、大豆、全麦、香蕉、蘑菇、花椰菜',
            dailyIntake: '30μg',
            deficiency: '脱发、指甲脆薄易裂、皮肤干燥、皮炎、疲劳、情绪低落、肌肉疼痛',
            overdose: '水溶性维生素，毒性极低。过量多随尿液排出。',
            maxDaily: '未设定（安全性高）'
        },
        {
            id: 'chromium',
            nameCN: '铬',
            nameEN: 'Chromium',
            icon: '📊',
            category: '矿物质',
            function: '增强胰岛素功能，调节血糖代谢；参与蛋白质和脂肪代谢；帮助控制食欲。',
            foods: '西兰花、全麦、葡萄汁、苹果、牛肉、鸡蛋、黑胡椒、蘑菇',
            dailyIntake: '30μg（男性）/ 25μg（女性）',
            deficiency: '血糖波动、胰岛素抵抗、体重增加、疲劳、焦虑、食欲异常',
            overdose: '食品来源安全性高。补充剂过量（>1000μg/天）可致肾损伤、皮肤刺激。',
            maxDaily: '200μg（补充剂建议上限）'
        },
        {
            id: 'potassium',
            nameCN: '钾',
            nameEN: 'Potassium',
            icon: '🍌',
            category: '矿物质',
            function: '维持神经肌肉正常兴奋性；调节细胞内外渗透压；维持血压稳定；参与心脏节律调节。',
            foods: '香蕉、土豆、牛油果、菠菜、番茄、豆类、橙子、椰子水',
            dailyIntake: '2000mg（推荐摄入量 4700mg/天）',
            deficiency: '疲劳乏力、抽筋、心律失常、便秘、肌肉无力、血压升高、水肿',
            overdose: '肾功能正常者不易过量。严重过量（>18000mg）可致心律失常甚至心脏骤停。',
            maxDaily: '未设定（食物来源安全性高，补充剂需谨慎）'
        }
    ];

    // ========== 症状-营养素映射 ==========

    var SYMPTOM_MAP = {
        '乏力': ['vitamin-b12', 'iron', 'vitamin-d', 'coq10'],
        '畏寒': ['iron', 'vitamin-b12', 'vitamin-d'],
        '失眠': ['magnesium', 'vitamin-b6', 'calcium'],
        '情绪低落': ['vitamin-d', 'vitamin-b6', 'omega-3'],
        '健忘': ['vitamin-b12', 'omega-3', 'coq10'],
        '心悸': ['magnesium', 'coq10'],
        '头晕': ['iron', 'vitamin-b12'],
        '便秘': ['magnesium', 'vitamin-c'],
        '免疫力低下': ['vitamin-c', 'vitamin-d', 'zinc', 'selenium'],
        '皮肤干燥': ['vitamin-a', 'vitamin-e', 'vitamin-c'],
        '脱发': ['iron', 'zinc', 'vitamin-d', 'vitamin-b7'],
        '贫血': ['iron', 'vitamin-b12', 'vitamin-b9'],
        '抽筋': ['calcium', 'magnesium', 'vitamin-d'],
        '口腔溃疡': ['vitamin-b2', 'vitamin-b3', 'vitamin-c', 'zinc'],
        '食欲不振': ['vitamin-b1', 'zinc'],
        // 新增症状
        '腰酸背痛': ['calcium', 'vitamin-d', 'magnesium'],
        '关节疼痛': ['vitamin-d', 'calcium', 'omega-3', 'vitamin-c'],
        '手脚冰凉': ['iron', 'vitamin-b12', 'magnesium'],
        '眼睛干涩': ['vitamin-a', 'omega-3', 'vitamin-b2'],
        '视力模糊': ['vitamin-a', 'vitamin-b2', 'zinc'],
        '耳鸣': ['vitamin-b12', 'magnesium', 'zinc'],
        '口干舌燥': ['vitamin-b2', 'vitamin-b3', 'zinc'],
        '消化不良': ['vitamin-b1', 'vitamin-b3', 'magnesium', 'zinc'],
        '腹胀': ['vitamin-b1', 'vitamin-b6', 'magnesium'],
        '腹泻': ['zinc', 'vitamin-b3', 'magnesium'],
        '易感冒': ['vitamin-c', 'vitamin-d', 'zinc', 'selenium'],
        '过敏性鼻炎': ['vitamin-c', 'vitamin-d', 'quercetin', 'zinc'],
        '皮肤瘙痒': ['vitamin-a', 'vitamin-e', 'zinc', 'omega-3'],
        '伤口愈合慢': ['vitamin-c', 'zinc', 'vitamin-a'],
        '指甲脆': ['iron', 'zinc', 'vitamin-b7', 'calcium'],
        '月经不调': ['iron', 'vitamin-b6', 'magnesium', 'vitamin-b9'],
        '痛经': ['magnesium', 'calcium', 'vitamin-b6', 'omega-3'],
        '更年期潮热': ['vitamin-e', 'vitamin-b6', 'magnesium', 'calcium'],
        '注意力不集中': ['omega-3', 'iron', 'vitamin-b12', 'coq10'],
        '焦虑': ['magnesium', 'vitamin-b6', 'omega-3', 'vitamin-d'],
        '偏头痛': ['magnesium', 'vitamin-b2', 'coq10'],
        '牙龈出血': ['vitamin-c', 'vitamin-k', 'vitamin-d'],
        '口臭': ['zinc', 'vitamin-c', 'vitamin-b3'],
        '疲劳': ['coq10', 'iron', 'vitamin-b12', 'magnesium'],
        '体重增加': ['vitamin-d', 'chromium', 'vitamin-b1', 'magnesium'],
        '水肿': ['vitamin-b6', 'magnesium', 'potassium'],
        '夜尿频繁': ['vitamin-d', 'magnesium', 'calcium'],
        '多梦': ['vitamin-b6', 'magnesium', 'calcium'],
        '打呼噜': ['magnesium', 'vitamin-c', 'omega-3'],
        '血压偏高': ['magnesium', 'omega-3', 'coq10', 'calcium'],
        '血脂偏高': ['omega-3', 'coq10', 'vitamin-b3'],
        '血糖偏高': ['chromium', 'magnesium', 'vitamin-d', 'zinc'],
        '尿酸偏高': ['vitamin-c', 'vitamin-b9', 'omega-3']
    };

    // ========== 存储工具 ==========

    function getStorageKey() {
        return 'qihuangge_vitamins';
    }

    function loadData() {
        var raw = localStorage.getItem(getStorageKey());
        if (!raw) return { records: [] };
        try { return JSON.parse(raw); } catch(e) { return { records: [] }; }
    }

    function saveData(data) {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
    }

    function genId() {
        var c = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var r = '';
        for (var i = 0; i < 12; i++) r += c[Math.floor(Math.random() * c.length)];
        return r;
    }

    function now() {
        return new Date().toISOString();
    }

    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    // ========== 维生素查询 ==========

    /**
     * 获取所有维生素/矿物质数据
     */
    function getAllVitamins() {
        return VITAMIN_LIST.map(function(v) { return Object.assign({}, v); });
    }

    /**
     * 获取单个维生素/矿物质详情
     */
    function getVitaminDetail(name) {
        if (!name) return null;
        var q = name.trim().toLowerCase();
        // 按 id、中文名、英文名匹配
        return VITAMIN_LIST.find(function(v) {
            return v.id === q ||
                   v.nameCN === name.trim() ||
                   v.nameEN.toLowerCase() === q ||
                   v.nameEN.toLowerCase().indexOf(q) >= 0 ||
                   v.nameCN.indexOf(name.trim()) >= 0;
        }) || null;
    }

    /**
     * 根据症状列表推荐营养素
     */
    function getRecommendationsBySymptoms(symptoms) {
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) return [];

        // 统计每个营养素被匹配到的次数
        var vitaminScore = {};
        var matchedSymptoms = {};

        symptoms.forEach(function(symptom) {
            var vitaminIds = SYMPTOM_MAP[symptom];
            if (vitaminIds) {
                matchedSymptoms[symptom] = true;
                vitaminIds.forEach(function(id) {
                    vitaminScore[id] = (vitaminScore[id] || 0) + 1;
                });
            }
        });

        // 按匹配次数排序，返回完整信息
        var sortedIds = Object.keys(vitaminScore).sort(function(a, b) {
            return vitaminScore[b] - vitaminScore[a];
        });

        var result = sortedIds.map(function(id) {
            var detail = VITAMIN_LIST.find(function(v) { return v.id === id; });
            if (!detail) return null;
            return {
                id: id,
                nameCN: detail.nameCN,
                nameEN: detail.nameEN,
                icon: detail.icon,
                category: detail.category,
                function: detail.function,
                foods: detail.foods,
                dailyIntake: detail.dailyIntake,
                deficiency: detail.deficiency,
                score: vitaminScore[id],
                matchSymptoms: symptoms.filter(function(s) {
                    return SYMPTOM_MAP[s] && SYMPTOM_MAP[s].indexOf(id) >= 0;
                })
            };
        }).filter(function(r) { return r !== null; });

        return result;
    }

    /**
     * 搜索维生素（按名称或功能描述）
     */
    function searchVitamins(query) {
        if (!query || typeof query !== 'string') return [];
        var q = query.trim().toLowerCase();
        if (q === '') return [];

        return VITAMIN_LIST.filter(function(v) {
            return v.nameCN.indexOf(q) >= 0 ||
                   v.nameEN.toLowerCase().indexOf(q) >= 0 ||
                   v.id.indexOf(q) >= 0 ||
                   v.function.indexOf(q) >= 0 ||
                   v.foods.indexOf(q) >= 0 ||
                   v.deficiency.indexOf(q) >= 0;
        }).map(function(v) {
            return Object.assign({}, v);
        });
    }

    /**
     * 获取所有症状列表
     */
    function getAllSymptoms() {
        return Object.keys(SYMPTOM_MAP).sort();
    }

    /**
     * 获取某症状对应的营养素ID列表
     */
    function getSymptomsForVitamin(vitaminId) {
        if (!vitaminId) return [];
        var result = [];
        var q = vitaminId.trim().toLowerCase();
        Object.keys(SYMPTOM_MAP).forEach(function(symptom) {
            if (SYMPTOM_MAP[symptom].indexOf(q) >= 0) {
                result.push(symptom);
            }
        });
        return result;
    }

    // ========== 补充记录追踪 ==========

    /**
     * 保存补充记录
     */
    function saveSupplementRecord(userId, vitaminName, dosage) {
        var data = loadData();
        var record = {
            id: genId(),
            userId: userId || 'default',
            vitaminName: vitaminName,
            dosage: dosage || '',
            date: todayStr(),
            timestamp: now()
        };
        data.records.push(record);
        // 最多保留 500 条记录
        if (data.records.length > 500) {
            data.records = data.records.slice(data.records.length - 500);
        }
        saveData(data);
        return record;
    }

    /**
     * 获取补充历史
     */
    function getSupplementHistory(userId, days) {
        days = days || 30;
        var data = loadData();
        var cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        return data.records.filter(function(r) {
            if (userId && r.userId !== userId) return false;
            if (days > 0) {
                var recDate = new Date(r.date);
                if (recDate < cutoff) return false;
            }
            return true;
        }).sort(function(a, b) {
            return b.timestamp.localeCompare(a.timestamp);
        });
    }

    /**
     * 获取补充统计
     */
    function getSupplementStats(userId, days) {
        days = days || 30;
        var records = getSupplementHistory(userId, days);
        if (records.length === 0) return null;

        var stats = {
            totalDays: 0,
            vitaminCount: {},
            dailyCount: {},
            mostUsed: null
        };

        var uniqueDates = {};
        records.forEach(function(r) {
            // 统计每种营养素被补充的次数
            stats.vitaminCount[r.vitaminName] = (stats.vitaminCount[r.vitaminName] || 0) + 1;
            // 统计每日补充次数
            stats.dailyCount[r.date] = (stats.dailyCount[r.date] || 0) + 1;
            uniqueDates[r.date] = true;
        });

        stats.totalDays = Object.keys(uniqueDates).length;

        // 找出最常补充的营养素
        var maxCount = 0;
        Object.keys(stats.vitaminCount).forEach(function(name) {
            if (stats.vitaminCount[name] > maxCount) {
                maxCount = stats.vitaminCount[name];
                stats.mostUsed = name;
            }
        });

        return stats;
    }

    /**
     * 删除补充记录
     */
    function deleteSupplementRecord(recordId) {
        var data = loadData();
        data.records = data.records.filter(function(r) { return r.id !== recordId; });
        saveData(data);
    }

    // ========== 营养素细分形态与生物利用度 ==========

    /**
     * 营养素细分形态数据库
     * 包含：不同形态、生物利用度排名、吸收条件、注意事项
     */
    var NUTRIENT_FORMS = {
        'vitamin-d': {
            best: '维生素D3（胆钙化醇）',
            forms: [
                { name: '维生素D2（麦角钙化醇）', source: '植物/真菌', bioavailability: '较低', note: '植物来源，生物利用度约为D3的60%' },
                { name: '维生素D3（胆钙化醇）', source: '动物/羊毛脂', bioavailability: '高', note: '人体自身合成的形式，推荐补充形式' }
            ],
            bestTime: '随餐（含脂肪食物）',
            bestWith: '脂肪类食物',
            avoidWith: '',
            chineseMedicine: {
                nature: '温性',
                meridians: ['肾经', '膀胱经'],
                note: '维生素D与中医"肾主骨"理论契合，温补肾阳，适合阳虚体质、畏寒怕冷者'
            }
        },
        'vitamin-a': {
            best: 'β-胡萝卜素（植物来源，更安全）',
            forms: [
                { name: '视黄醇（预成型维生素A）', source: '动物肝脏、蛋黄', bioavailability: '高', note: '直接活性形式，但长期超量易中毒' },
                { name: 'β-胡萝卜素', source: '胡萝卜、南瓜', bioavailability: '中', note: '前体形式，身体按需转化，安全性高，但转化率个体差异大' }
            ],
            bestTime: '随餐',
            bestWith: '脂肪类食物',
            avoidWith: '',
            chineseMedicine: {
                nature: '平性',
                meridians: ['肝经', '肺经'],
                note: '维生素A与中医"肝开窍于目"对应，养肝明目，适合肝血不足、视力减退者'
            },
            
        },
        'vitamin-c': {
            best: '天然维生素C复合物',
            forms: [
                { name: 'L-抗坏血酸', source: '合成/天然', bioavailability: '高', note: '最常见形式，酸性强，对肠胃敏感者可能有刺激' },
                { name: '抗坏血酸钠', source: '合成', bioavailability: '高', note: '缓冲型，pH中性，对肠胃刺激小，适合胃酸过多者' },
                { name: '抗坏血酸钙', source: '合成', bioavailability: '中', note: '与钙结合形式，兼具补钙效果' },
                { name: '酯化维生素C', source: '合成', bioavailability: '中', note: '缓释型，对肠胃温和，白细胞亲和力更高' }
            ],
            bestTime: '空腹或随餐均可',
            bestWith: '',
            avoidWith: '茶、咖啡（间隔1小时）',
            chineseMedicine: {
                nature: '微寒',
                meridians: ['肺经', '胃经'],
                note: '维生素C与中医"酸甘化阴"理论相关，生津润肺，适合阴虚燥热、易上火者'
            },
            
        },
        'vitamin-b12': {
            best: '甲钴胺（活性形式）',
            forms: [
                { name: '氰钴胺', source: '合成', bioavailability: '高', note: '最稳定、最常用形式，需在体内转化为活性形式' },
                { name: '甲钴胺', source: '合成', bioavailability: '高', note: '活性形式，直接可用，适合神经系统支持' },
                { name: '腺苷钴胺', source: '合成', bioavailability: '高', note: '另一种活性形式，主要参与能量代谢' }
            ],
            bestTime: '空腹或随餐',
            bestWith: '叶酸、维生素B6',
            avoidWith: '',
            chineseMedicine: {
                nature: '平性',
                meridians: ['心经', '脾经'],
                note: 'B12与中医"心主血脉""脾主运化"相关，补血养心，适合气血不足、记忆力减退者'
            },
            
        },
        'iron': {
            best: '螯合铁（甘氨酸亚铁）',
            forms: [
                { name: '硫酸亚铁', source: '合成', bioavailability: '中', note: '传统形式，价格低廉，但肠胃刺激大，易便秘' },
                { name: '富马酸亚铁', source: '合成', bioavailability: '中', note: '含铁量高，刺激比硫酸亚铁小' },
                { name: '甘氨酸亚铁（螯合铁）', source: '合成', bioavailability: '高', note: '吸收率高，肠胃刺激小，不干扰其他矿物质吸收，推荐' },
                { name: '血红素铁', source: '动物', bioavailability: '高', note: '来自动物血液，直接吸收，不依赖维生素C，吸收率稳定' }
            ],
            bestTime: '空腹（吸收最好）或随餐（减少刺激）',
            bestWith: '维生素C（促进吸收）',
            avoidWith: '茶、咖啡、钙剂（间隔2小时）',
            chineseMedicine: {
                nature: '温性',
                meridians: ['心经', '肝经', '脾经'],
                note: '铁与中医"气血"理论直接对应，补血养血，适合血虚、面色萎黄、月经量少者'
            },
            
        },
        'calcium': {
            best: '柠檬酸钙（适合胃酸不足者）',
            forms: [
                { name: '碳酸钙', source: '矿物', bioavailability: '中', note: '含钙量高（40%），需胃酸辅助吸收，随餐服用效果好' },
                { name: '柠檬酸钙', source: '合成', bioavailability: '高', note: '吸收不依赖胃酸，空腹可服，适合老年人、胃酸不足者' },
                { name: '乳酸钙', source: '合成', bioavailability: '中', note: '含钙量较低（13%），但吸收好，刺激性小' },
                { name: '海藻钙', source: '海藻', bioavailability: '高', note: '天然来源，含多种微量元素，吸收率较高' }
            ],
            bestTime: '随餐或睡前',
            bestWith: '维生素D、维生素K2、镁',
            avoidWith: '铁剂、高草酸食物（间隔2小时）',
            chineseMedicine: {
                nature: '微温',
                meridians: ['肾经', '肝经'],
                note: '钙与中医"肾主骨"理论对应，强筋健骨，适合肾虚骨弱、腰膝酸软者'
            },
            
        },
        'magnesium': {
            best: '甘氨酸镁（高吸收，助眠）',
            forms: [
                { name: '氧化镁', source: '矿物', bioavailability: '低', note: '含镁量高（60%），但吸收率低，易致腹泻' },
                { name: '柠檬酸镁', source: '合成', bioavailability: '中', note: '吸收较好，柠檬酸助代谢，轻微通便' },
                { name: '甘氨酸镁（螯合镁）', source: '合成', bioavailability: '高', note: '吸收率高，对肠胃温和，有助眠效果，推荐' },
                { name: '苏糖酸镁', source: '合成', bioavailability: '高', note: '能穿透血脑屏障，改善认知功能最佳' }
            ],
            bestTime: '睡前（助眠）或随餐',
            bestWith: '维生素B6（促进吸收）',
            avoidWith: '高剂量锌、钙（间隔1小时）',
            chineseMedicine: {
                nature: '微寒',
                meridians: ['心经', '肝经'],
                note: '镁与中医"心神""肝气"相关，安神定志，适合心神不宁、失眠多梦、肝气郁结者'
            },
            
        },
        'zinc': {
            best: '吡啶甲酸锌（高吸收）',
            forms: [
                { name: '硫酸锌', source: '合成', bioavailability: '低', note: '传统形式，价格低，但吸收率低，肠胃刺激大' },
                { name: '葡萄糖酸锌', source: '合成', bioavailability: '中', note: '常见形式，吸收较好，对肠胃刺激较小' },
                { name: '吡啶甲酸锌', source: '合成', bioavailability: '高', note: '吸收率最高，生物利用度优秀，推荐' },
                { name: '柠檬酸锌', source: '合成', bioavailability: '中', note: '口味较好，适合儿童剂型，吸收率稳定' }
            ],
            bestTime: '随餐（减少刺激）',
            bestWith: '蛋白质食物',
            avoidWith: '高剂量钙、铁、铜（间隔2小时）',
            chineseMedicine: {
                nature: '温性',
                meridians: ['肾经', '脾经'],
                note: '锌与中医"肾精"理论相关，益精填髓，适合肾精不足、味觉减退、免疫力低下者'
            },
            
        },
        'omega-3': {
            best: '高纯度EPA+DHA（鱼油/藻油）',
            forms: [
                { name: '甘油三酯型（TG型）', source: '天然鱼油', bioavailability: '高', note: '天然形态，吸收率最高，推荐' },
                { name: '乙酯型（EE型）', source: '浓缩鱼油', bioavailability: '中', note: '浓度高但吸收率略低，需随餐服用' },
                { name: '再酯化甘油三酯型（rTG型）', source: '再处理', bioavailability: '高', note: '高浓度+高吸收，最优质但价格最高' },
                { name: '藻油DHA', source: '藻类', bioavailability: '高', note: '植物来源，适合素食者，DHA含量高' }
            ],
            bestTime: '随餐（含脂肪食物）',
            bestWith: '脂肪类食物、维生素E',
            avoidWith: '抗凝血药物（需咨询医生）',
            chineseMedicine: {
                nature: '平性',
                meridians: ['心经', '肝经', '肾经'],
                note: 'Omega-3与中医"养阴润燥"理论相关，滋养心脉，适合阴虚体质、心血管需养护者'
            },
            
        },
        'selenium': {
            best: '硒代蛋氨酸（有机硒）',
            forms: [
                { name: '硒代蛋氨酸', source: '有机合成', bioavailability: '高', note: '有机硒形式，吸收率高，可在体内转化为活性硒蛋白，推荐' },
                { name: '硒酵母', source: '天然发酵', bioavailability: '高', note: '天然有机硒，含多种硒化物，吸收稳定' },
                { name: '亚硒酸钠', source: '无机合成', bioavailability: '中', note: '无机硒，价格低但吸收率较低，过量毒性大' }
            ],
            bestTime: '随餐',
            bestWith: '维生素E',
            avoidWith: '高剂量维生素C（可能降低硒吸收）',
            chineseMedicine: {
                nature: '微寒',
                meridians: ['肾经', '肝经'],
                note: '硒与中医"肾藏精"理论相关，益肾填精，适合肾虚、免疫力低下者'
            },
            
        },
        'vitamin-b9': {
            best: '甲基叶酸（活性叶酸）',
            forms: [
                { name: '叶酸（蝶酰谷氨酸）', source: '合成', bioavailability: '中', note: '合成叶酸，需在体内转化为活性形式，部分人群转化效率低' },
                { name: '甲基叶酸（5-MTHF）', source: '合成', bioavailability: '高', note: '活性形式，可直接利用，适合MTHFR基因突变人群，推荐' },
                { name: '亚叶酸钙', source: '合成', bioavailability: '高', note: '还原型叶酸，无需二氢叶酸还原酶，医学用途广泛' }
            ],
            bestTime: '随餐',
            bestWith: '维生素B12、维生素B6',
            avoidWith: '',
            chineseMedicine: {
                nature: '平性',
                meridians: ['脾经', '肝经'],
                note: '叶酸与中医"脾统血"理论相关，养血安胎，适合孕产妇、气血不足者'
            },
            
        },
        'vitamin-b3': {
            best: '烟酰胺（缓释型，无潮红反应）',
            forms: [
                { name: '烟酸（尼克酸）', source: '合成/天然', bioavailability: '高', note: '传统形式，大剂量（>50mg）可致皮肤潮红，但有降脂效果' },
                { name: '烟酰胺（尼克酰胺）', source: '合成', bioavailability: '高', note: '无潮红反应，但不能降脂，适合日常保健' },
                { name: '肌醇六烟酸酯（缓释型）', source: '合成', bioavailability: '中', note: '缓释型，潮红反应轻，释放平稳' }
            ],
            bestTime: '随餐',
            bestWith: '其他B族维生素',
            avoidWith: '酒精（加重皮肤潮红）',
            chineseMedicine: {
                nature: '温性',
                meridians: ['脾经', '胃经'],
                note: 'B3与中医"脾主运化"相关，促进运化，适合脾胃虚弱、消化不良者'
            },
            
        },
        'vitamin-e': {
            best: '天然d-α-生育酚（混合生育酚更佳）',
            forms: [
                { name: '天然d-α-生育酚', source: '植物油提取', bioavailability: '高', note: '天然形式，人体吸收率是合成的2倍，推荐' },
                { name: '合成dl-α-生育酚', source: '化学合成', bioavailability: '中', note: '合成形式，生物利用度约为天然的50%' },
                { name: '混合生育酚', source: '天然提取', bioavailability: '高', note: '含α/β/γ/δ四种生育酚，抗氧化谱更广，推荐' }
            ],
            bestTime: '随餐（含脂肪食物）',
            bestWith: '维生素C、硒、脂肪类食物',
            avoidWith: '抗凝血药物（需谨慎）',
            chineseMedicine: {
                nature: '温性',
                meridians: ['肝经', '肾经'],
                note: '维生素E与中医"养肝血"理论相关，养血润肤，适合肝血不足、皮肤干燥者'
            },
            
        },
        'vitamin-k': {
            best: '维生素K2（MK-7，纳豆来源）',
            forms: [
                { name: '维生素K1（叶绿醌）', source: '绿叶蔬菜', bioavailability: '中', note: '植物来源，主要参与凝血，半衰期短' },
                { name: '维生素K2（MK-4）', source: '合成', bioavailability: '中', note: '短链甲萘醌，半衰期短，需多次服用' },
                { name: '维生素K2（MK-7）', source: '纳豆提取', bioavailability: '高', note: '长链甲萘醌，半衰期长，吸收好，最佳骨骼健康形式，推荐' }
            ],
            bestTime: '随餐（含脂肪食物）',
            bestWith: '维生素D、钙、脂肪类食物',
            avoidWith: '抗凝血药物（华法林等）',
            chineseMedicine: {
                nature: '平性',
                meridians: ['肝经', '肾经'],
                note: '维生素K与中医"肝藏血""肾主骨"理论相关，活血养骨，适合血瘀、骨质疏松者'
            },
            
        },
        'vitamin-b6': {
            best: '吡哆醛-5-磷酸（P5P，活性形式）',
            forms: [
                { name: '盐酸吡哆醇', source: '合成', bioavailability: '中', note: '最常见形式，需在肝脏转化为活性P5P' },
                { name: '吡哆醛-5-磷酸（P5P）', source: '合成', bioavailability: '高', note: '活性形式，直接可用，适合肝功能不佳者，推荐' }
            ],
            bestTime: '随餐',
            bestWith: '镁、B族维生素',
            avoidWith: '',
            chineseMedicine: {
                nature: '平性',
                meridians: ['脾经', '肝经'],
                note: 'B6与中医"脾主运化""肝主疏泄"相关，调畅气机，适合气郁、情绪波动者'
            },
            
        },
        'vitamin-b1': {
            best: '苯磷硫胺（脂溶性，高吸收）',
            forms: [
                { name: '硫胺素盐酸盐', source: '合成', bioavailability: '中', note: '水溶性形式，吸收受剂量限制，过量随尿排出' },
                { name: '苯磷硫胺（脂溶性B1）', source: '合成', bioavailability: '高', note: '脂溶性形式，生物利用度高，可穿透细胞膜，适合神经系统支持，推荐' },
                { name: '硫胺素二磷酸酯（TDP）', source: '合成', bioavailability: '中', note: '磷酸化形式，直接参与能量代谢' }
            ],
            bestTime: '随餐',
            bestWith: '其他B族维生素、镁',
            avoidWith: '茶、咖啡（可能降低B1吸收）',
            chineseMedicine: {
                nature: '温性',
                meridians: ['脾经', '胃经', '心经'],
                note: 'B1与中医"脾主运化"相关，健脾益气，适合脾虚乏力、食欲不振者'
            },
            
        },
        'vitamin-b2': {
            best: '核黄素-5-磷酸（活性形式）',
            forms: [
                { name: '核黄素', source: '合成/天然', bioavailability: '中', note: '标准形式，需在体内磷酸化后使用' },
                { name: '核黄素-5-磷酸（FAD前体）', source: '合成', bioavailability: '高', note: '活性形式，直接可用，吸收更好，推荐' }
            ],
            bestTime: '随餐',
            bestWith: '其他B族维生素、铁',
            avoidWith: '酒精（影响B2吸收）、光照（B2遇光分解）',
            chineseMedicine: {
                nature: '平性',
                meridians: ['脾经', '胃经', '心经'],
                note: 'B2与中医"脾开窍于口"相关，健脾祛湿，适合口疮、唇炎、脾胃湿热者'
            },
            
        },
        'chromium': {
            best: '吡啶甲酸铬（高吸收）',
            forms: [
                { name: '吡啶甲酸铬', source: '合成', bioavailability: '高', note: '有机铬，吸收率最高，推荐用于血糖管理' },
                { name: '烟酸铬', source: '合成', bioavailability: '中', note: '铬与烟酸结合，对血脂有额外益处' },
                { name: '氯化铬', source: '无机', bioavailability: '低', note: '无机铬，吸收率极低（<1%），不推荐' }
            ],
            bestTime: '随餐（尤其是含碳水的餐食）',
            bestWith: '维生素C（促进吸收）',
            avoidWith: '高剂量维生素C（>1000mg，可能降低铬效果）',
            chineseMedicine: {
                nature: '平性',
                meridians: ['脾经', '肾经'],
                note: '铬与中医"脾主运化"相关，调节糖脂代谢，适合脾虚痰湿、血糖偏高者'
            },
            
        },
        'potassium': {
            best: '柠檬酸钾（高吸收，对肠胃温和）',
            forms: [
                { name: '氯化钾', source: '矿物', bioavailability: '高', note: '最常见形式，但可能刺激肠胃，适合随餐服用' },
                { name: '柠檬酸钾', source: '合成', bioavailability: '高', note: '对肠胃温和，柠檬酸助代谢，适合长期服用，推荐' },
                { name: '葡萄糖酸钾', source: '合成', bioavailability: '中', note: '吸收稳定，口感好，适合液体剂型' }
            ],
            bestTime: '随餐',
            bestWith: '镁（维持钾平衡）',
            avoidWith: '保钾利尿剂、ACE抑制剂（需咨询医生）',
            chineseMedicine: {
                nature: '寒性',
                meridians: ['心经', '肾经', '膀胱经'],
                note: '钾与中医"心主血脉"相关，养心利尿，适合心火旺、水肿、高血压者'
            },
            
        },
        'vitamin-b7': {
            best: 'd-生物素（天然活性形式）',
            forms: [
                { name: 'd-生物素', source: '天然/合成', bioavailability: '高', note: '天然活性形式，吸收率高，推荐' },
                { name: 'dl-生物素', source: '合成', bioavailability: '中', note: '混合形式，部分为左旋体，活性较低' }
            ],
            bestTime: '随餐',
            bestWith: 'B族维生素',
            avoidWith: '生鸡蛋清（含抗生物素蛋白，抑制吸收）',
            chineseMedicine: {
                nature: '平性',
                meridians: ['肝经', '肾经'],
                note: '生物素与中医"肝藏血""肾藏精"相关，养肝益肾，适合脱发、指甲脆、皮肤干燥者'
            },
            
        },
        'coq10': {
            best: '泛醇（还原型，高吸收）',
            forms: [
                { name: '泛醌（氧化型）', source: '合成/发酵', bioavailability: '中', note: '标准形式，需在体内还原为泛醇使用' },
                { name: '泛醇（还原型）', source: '发酵', bioavailability: '高', note: '活性形式，直接可用，吸收率是泛醌的3-4倍，推荐' },
                { name: '水溶性辅酶Q10', source: '纳米技术', bioavailability: '高', note: '水溶形式，吸收不受脂肪影响，适合老年人' }
            ],
            bestTime: '随餐（含脂肪食物）',
            bestWith: '脂肪类食物、黑胡椒素',
            avoidWith: '降脂药（他汀类，会抑制体内CoQ10合成）',
            chineseMedicine: {
                nature: '温性',
                meridians: ['心经', '肾经'],
                note: '辅酶Q10与中医"心主血脉"理论相关，强心益气，适合心气虚、心悸、疲劳乏力者'
            },
            
        }
    };

    /**
     * 身体系统映射
     * 症状 → 营养素 → 身体系统
     */
    var BODY_SYSTEM_MAP = {
        '消化系统': {
            symptoms: ['食欲不振', '消化不良', '腹胀', '便秘', '腹泻', '恶心'],
            relatedNutrients: ['vitamin-b1', 'vitamin-b3', 'vitamin-b6', 'magnesium', 'zinc'],
            description: '消化系统的健康依赖于多种B族维生素和矿物质的协同作用'
        },
        '神经系统': {
            symptoms: ['失眠', '焦虑', '健忘', '头痛', '头晕', '手脚麻木', '情绪低落'],
            relatedNutrients: ['vitamin-b1', 'vitamin-b6', 'vitamin-b12', 'magnesium', 'omega-3', 'coq10'],
            description: '神经系统需要B族维生素、镁和Omega-3脂肪酸的充分支持'
        },
        '免疫系统': {
            symptoms: ['免疫力低下', '易感冒', '反复感染', '口腔溃疡', '过敏'],
            relatedNutrients: ['vitamin-c', 'vitamin-d', 'vitamin-a', 'zinc', 'selenium'],
            description: '免疫系统功能依赖于维生素C、D、A和锌、硒等微量元素的协同作用'
        },
        '循环系统': {
            symptoms: ['心悸', '气短', '头晕', '手脚冰凉', '面色苍白', '血压偏高'],
            relatedNutrients: ['iron', 'coq10', 'omega-3', 'magnesium', 'vitamin-b9', 'vitamin-b12'],
            description: '循环系统健康需要铁、辅酶Q10和Omega-3的充足供应'
        },
        '骨骼系统': {
            symptoms: ['抽筋', '关节疼痛', '腰背酸痛', '牙齿松动', '易骨折'],
            relatedNutrients: ['calcium', 'vitamin-d', 'magnesium', 'vitamin-k', 'vitamin-c'],
            description: '骨骼健康依赖钙、维生素D、镁和维生素K的协同作用'
        },
        '皮肤系统': {
            symptoms: ['皮肤干燥', '脱发', '皮疹', '伤口愈合慢', '口腔溃疡', '指甲脆'],
            relatedNutrients: ['vitamin-a', 'vitamin-c', 'vitamin-e', 'zinc', 'biotin', 'omega-3'],
            description: '皮肤健康需要维生素A、C、E和锌的充足供应'
        },
        '内分泌系统': {
            symptoms: ['畏寒', '怕热', '情绪波动', '体重变化', '疲劳', '月经不调'],
            relatedNutrients: ['vitamin-d', 'selenium', 'zinc', 'iodine', 'magnesium'],
            description: '内分泌系统功能依赖于维生素D、硒、锌等微量元素的调节'
        }
    };

    /**
     * 获取营养素细分形态信息
     */
    function getNutrientForms(nutrientId) {
        return NUTRIENT_FORMS[nutrientId] || null;
    }

    /**
     * 获取所有身体系统列表
     */
    function getBodySystems() {
        return Object.keys(BODY_SYSTEM_MAP).sort();
    }

    /**
     * 根据症状匹配身体系统
     */
    function getBodySystemsBySymptoms(symptoms) {
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) return [];
        var result = [];
        Object.keys(BODY_SYSTEM_MAP).forEach(function(system) {
            var info = BODY_SYSTEM_MAP[system];
            var matched = symptoms.filter(function(s) {
                return info.symptoms.indexOf(s) >= 0;
            });
            if (matched.length > 0) {
                result.push({
                    system: system,
                    matchedSymptoms: matched,
                    matchCount: matched.length,
                    relatedNutrients: info.relatedNutrients,
                    description: info.description
                });
            }
        });
        return result.sort(function(a, b) { return b.matchCount - a.matchCount; });
    }

    // ========== 缺乏风险评估 ==========

    /**
     * 缺乏风险等级
     */
    var DEFICIENCY_RISK_LEVELS = [
        { id: 'high', label: '高风险', color: 'var(--cinnabar)', score: 3, desc: '存在明显缺乏症状，建议补充' },
        { id: 'medium', label: '中等风险', color: 'var(--gold-dark)', score: 2, desc: '有轻度症状或风险因素，建议关注' },
        { id: 'low', label: '低风险', color: 'var(--herb-green)', score: 1, desc: '无明显缺乏风险，维持日常摄入即可' },
        { id: 'none', label: '无风险', color: 'var(--text-muted)', score: 0, desc: '摄入充足，无需额外补充' }
    ];

    /**
     * 评估营养素缺乏风险
     * @param {string} vitaminId - 营养素ID
     * @param {object} profile - 用户档案
     * @returns {object} { level, score, reasons, advice }
     */
    function assessDeficiencyRisk(vitaminId, profile) {
        if (!vitaminId || !profile) return { level: 'none', score: 0, reasons: [], advice: '信息不足，无法评估' };

        var v = getVitaminDetail(vitaminId);
        if (!v) return { level: 'none', score: 0, reasons: [], advice: '未知营养素' };

        var hp = profile.healthProfile || {};
        var riskScore = 0;
        var reasons = [];

        // 1. 症状匹配（权重最高）
        if (hp.symptoms && hp.symptoms.length > 0) {
            var matchedSymptoms = [];
            hp.symptoms.forEach(function(symptom) {
                var vitaminIds = SYMPTOM_MAP[symptom];
                if (vitaminIds && vitaminIds.indexOf(vitaminId) >= 0) {
                    matchedSymptoms.push(symptom);
                }
            });
            if (matchedSymptoms.length > 0) {
                riskScore += matchedSymptoms.length * 2;
                reasons.push('症状相关：' + matchedSymptoms.join('、'));
            }
        }

        // 2. 饮食因素
        if (hp.diet) {
            if (vitaminId === 'vitamin-b12' && (hp.diet === '素食' || hp.diet === '偏素食')) {
                riskScore += 3;
                reasons.push('素食者B12缺乏风险高');
            }
            if (vitaminId === 'iron' && (hp.diet === '素食' || hp.diet === '偏素食')) {
                riskScore += 2;
                reasons.push('植物性铁吸收率低');
            }
            if (vitaminId === 'calcium' && hp.diet === '素食') {
                riskScore += 1;
                reasons.push('素食者钙摄入需关注');
            }
            if (vitaminId === 'vitamin-d' && hp.diet === '素食') {
                riskScore += 1;
                reasons.push('素食者VD食物来源少');
            }
        }

        // 3. 年龄因素
        var age = 0;
        if (profile.birthYear) {
            age = new Date().getFullYear() - parseInt(profile.birthYear);
        }
        if (age >= 65) {
            if (vitaminId === 'vitamin-d') { riskScore += 2; reasons.push('65岁以上VD合成能力下降'); }
            if (vitaminId === 'vitamin-b12') { riskScore += 2; reasons.push('65岁以上B12吸收能力下降'); }
            if (vitaminId === 'calcium') { riskScore += 1; reasons.push('老年人钙需求增加'); }
        } else if (age >= 50) {
            if (vitaminId === 'vitamin-d') { riskScore += 1; reasons.push('50岁以上VD合成能力开始下降'); }
            if (vitaminId === 'calcium') { riskScore += 1; reasons.push('中年钙流失加速'); }
        }

        // 4. 体质关联
        if (hp.constitution && CONSTITUTION_MAP[hp.constitution]) {
            var constitutionInfo = CONSTITUTION_MAP[hp.constitution];
            if (constitutionInfo.priority && constitutionInfo.priority.indexOf(vitaminId) >= 0) {
                riskScore += 1;
                reasons.push('体质相关：' + hp.constitution);
            }
        }

        // 5. 睡眠/运动因素
        if (hp.sleep === '失眠' || hp.sleep === '较差') {
            if (vitaminId === 'magnesium') { riskScore += 1; reasons.push('睡眠差，镁需求增加'); }
            if (vitaminId === 'vitamin-b6') { riskScore += 1; reasons.push('睡眠差，B6助眠需求'); }
        }
        if (hp.exercise === '很少') {
            if (vitaminId === 'vitamin-d') { riskScore += 1; reasons.push('户外活动少，VD缺乏风险高'); }
        }

        // 6. 健康目标关联
        if (hp.healthGoals && hp.healthGoals.length > 0) {
            hp.healthGoals.forEach(function(goal) {
                if (goal.indexOf('免疫力') >= 0 && ['vitamin-c', 'vitamin-d', 'zinc', 'selenium'].indexOf(vitaminId) >= 0) {
                    riskScore += 1;
                }
                if (goal.indexOf('骨骼') >= 0 && ['calcium', 'vitamin-d', 'magnesium', 'vitamin-k'].indexOf(vitaminId) >= 0) {
                    riskScore += 1;
                }
            });
        }

        // 确定风险等级
        var level = 'none';
        if (riskScore >= 5) level = 'high';
        else if (riskScore >= 3) level = 'medium';
        else if (riskScore >= 1) level = 'low';

        var levelInfo = DEFICIENCY_RISK_LEVELS.find(function(l) { return l.id === level; });
        var advice = '';
        if (level === 'high') {
            advice = '存在明显缺乏风险，建议补充' + v.nameCN + '。' + (v.foods ? '食物来源：' + v.foods : '');
        } else if (level === 'medium') {
            advice = '有中度缺乏风险，建议通过饮食增加摄入。' + (v.foods ? '推荐食物：' + v.foods.split('、').slice(0, 3).join('、') : '');
        } else if (level === 'low') {
            advice = '基本安全，建议保持均衡饮食即可。';
        } else {
            advice = '无缺乏风险，无需额外补充。';
        }

        return {
            level: level,
            levelInfo: levelInfo,
            score: riskScore,
            reasons: reasons,
            advice: advice
        };
    }

    /**
     * 批量评估所有营养素的缺乏风险
     * @param {object} profile - 用户档案
     * @returns {array} 排序后的风险评估列表
     */
    function assessAllDeficiencyRisks(profile) {
        if (!profile) return [];
        var results = [];
        VITAMIN_LIST.forEach(function(v) {
            var risk = assessDeficiencyRisk(v.id, profile);
            if (risk.level !== 'none') {
                results.push({
                    id: v.id,
                    nameCN: v.nameCN,
                    icon: v.icon,
                    category: v.category,
                    risk: risk
                });
            }
        });
        return results.sort(function(a, b) {
            return b.risk.score - a.risk.score;
        });
    }

    // ========== 智能补充计划生成 ==========

    /**
     * 生成每日补充计划
     * @param {object} profile - 用户档案
     * @param {string} doseLevel - 剂量等级ID
     * @returns {object} { dailyPlan: [], warnings: [], summary: '' }
     */
    function generateSupplementPlan(profile, doseLevel) {
        if (!profile) return { dailyPlan: [], warnings: [], summary: '请先创建用户档案' };

        doseLevel = doseLevel || 'maintenance';
        var recs = getPersonalizedRecommendations(profile);
        var hp = profile.healthProfile || {};
        var existingSupplements = (hp.supplements || []).map(function(s) { return s.name || ''; });

        var dailyPlan = [];
        var warnings = [];

        // 取前5个推荐营养素生成计划
        var topRecs = recs.recommendations.slice(0, 5);

        topRecs.forEach(function(r) {
            var v = getVitaminDetail(r.id);
            if (!v) return;
            var dose = getRecommendedDose(r.id, doseLevel);
            var forms = getNutrientForms(r.id);

            // 检查是否已在服用
            var alreadyTaking = false;
            existingSupplements.forEach(function(s) {
                if (s.indexOf(v.nameCN) >= 0 || s.indexOf(v.nameEN) >= 0) {
                    alreadyTaking = true;
                }
            });

            // 最佳服用时间建议
            var timeAdvice = forms ? forms.bestTime : '随餐服用';
            var withAdvice = forms ? (forms.bestWith || '无特殊要求') : '无特殊要求';
            var avoidAdvice = forms ? (forms.avoidWith || '无特殊要求') : '无特殊要求';

            dailyPlan.push({
                id: v.id,
                nameCN: v.nameCN,
                icon: v.icon,
                dose: dose ? dose.recommended : '—',
                timeAdvice: timeAdvice,
                bestWith: withAdvice,
                avoidWith: avoidAdvice,
                alreadyTaking: alreadyTaking,
                priority: r.score,
                reasons: r.reasons
            });

            // 检查与现有保健品的相互作用
            var interactions = checkInteractions(r.id, existingSupplements, []);
            interactions.forEach(function(w) {
                if (w.severity === 'high') {
                    warnings.push({
                        type: 'high',
                        message: w.name + '：' + w.description,
                        advice: w.advice
                    });
                }
            });
        });

        // 生成总结
        var summary = '';
        if (dailyPlan.length > 0) {
            var addCount = dailyPlan.filter(function(p) { return !p.alreadyTaking; }).length;
            var existingCount = dailyPlan.filter(function(p) { return p.alreadyTaking; }).length;
            summary = '建议补充 ' + dailyPlan.length + ' 种营养素';
            if (addCount > 0) summary += '（其中 ' + addCount + ' 种尚未在您的保健品清单中）';
            if (existingCount > 0) summary += '，您已在服用 ' + existingCount + ' 种，注意核对剂量';
            if (warnings.length > 0) summary += '。检测到 ' + warnings.length + ' 项风险提示，请仔细查看。';
        } else {
            summary = '根据您当前的健康画像，暂无明显补充建议。';
        }

        return {
            dailyPlan: dailyPlan,
            warnings: warnings,
            summary: summary
        };
    }

    // ========== 剂量分级系统 ==========

    /**
     * 剂量等级定义
     */
    var DOSE_LEVELS = [
        {
            id: 'maintenance',
            label: '维持剂量',
            desc: '日常保健，预防缺乏',
            factor: 1.0,
            warning: false,
            suitable: '饮食均衡、无明显缺乏症状的健康人群'
        },
        {
            id: 'wellness',
            label: '保健剂量',
            desc: '针对性补充，改善亚健康',
            factor: 1.5,
            warning: false,
            suitable: '存在轻度缺乏风险、特定时期（换季/压力大/恢复期）'
        },
        {
            id: 'therapeutic',
            label: '治疗剂量',
            desc: '短期强化，需谨慎使用',
            factor: 2.5,
            warning: true,
            suitable: '经医生诊断存在明确缺乏或治疗需求，需短期使用'
        }
    ];

    /**
     * 获取推荐剂量
     * @param {string} vitaminId - 营养素ID
     * @param {string} levelId - 剂量等级ID
     * @returns {object} { base, recommended, max, warning }
     */
    function getRecommendedDose(vitaminId, levelId) {
        var v = getVitaminDetail(vitaminId);
        if (!v) return null;
        var level = DOSE_LEVELS.find(function(l) { return l.id === levelId; }) || DOSE_LEVELS[0];
        // 从 dailyIntake 提取数值
        var baseMatch = v.dailyIntake.match(/(\d+(?:\.\d+)?)\s*(μg|mg|IU)/);
        if (!baseMatch) {
            return { base: '—', recommended: '—', max: v.maxDaily || '—', level: level, warning: level.warning };
        }
        var baseNum = parseFloat(baseMatch[1]);
        var unit = baseMatch[2];
        var recNum = Math.round(baseNum * level.factor);
        var maxNum = null;
        var maxMatch = v.maxDaily ? v.maxDaily.match(/(\d+(?:\.\d+)?)\s*(μg|mg|IU)/) : null;
        if (maxMatch) maxNum = parseFloat(maxMatch[1]);
        var warning = level.warning || (maxNum && recNum > maxNum) ? true : false;
        return {
            base: baseNum + unit,
            recommended: recNum + unit,
            max: v.maxDaily || '未设定',
            level: level,
            warning: warning
        };
    }

    /**
     * 获取所有剂量等级
     */
    function getAllDoseLevels() {
        return DOSE_LEVELS.map(function(l) { return Object.assign({}, l); });
    }

    // ========== 营养素相互作用检测 ==========

    /**
     * 相互作用数据库
     * type: 'antagonistic'(拮抗) | 'synergistic'(协同) | 'competitive'(竞争) | 'risk'(风险)
     * severity: 'high' | 'medium' | 'low'
     */
    var INTERACTION_DB = [
        // ===== 竞争吸收 =====
        { nutrientA: 'calcium', nutrientB: 'iron', type: 'competitive', severity: 'high', description: '钙和铁在肠道竞争吸收，建议间隔2小时服用', advice: '钙和铁剂应分开服用，至少间隔2小时' },
        { nutrientA: 'calcium', nutrientB: 'magnesium', type: 'competitive', severity: 'medium', description: '高剂量钙镁竞争吸收，理想比例约2:1', advice: '钙镁同时补充时保持2:1的比例，钙不超过1000mg单次' },
        { nutrientA: 'zinc', nutrientB: 'copper', type: 'competitive', severity: 'high', description: '长期高剂量锌（>40mg/天）会抑制铜吸收', advice: '补锌超过30mg/天超过一个月，建议同时补充铜2mg' },
        { nutrientA: 'zinc', nutrientB: 'iron', type: 'competitive', severity: 'medium', description: '锌和铁在肠道存在竞争吸收', advice: '锌和铁剂建议分开在不同时间服用' },
        { nutrientA: 'zinc', nutrientB: 'calcium', type: 'competitive', severity: 'medium', description: '高剂量钙（>800mg）会抑制锌的吸收', advice: '锌和钙补充剂建议分开服用，间隔2小时以上' },
        { nutrientA: 'vitamin-a', nutrientB: 'vitamin-d', type: 'competitive', severity: 'medium', description: '维生素A和D在肠道存在竞争吸收', advice: '高剂量维生素A和D不建议同时服用，可错开时间' },
        { nutrientA: 'copper', nutrientB: 'vitamin-c', type: 'competitive', severity: 'medium', description: '高剂量维生素C（>500mg）会干扰铜的吸收', advice: '维生素C补充剂和含铜食物建议间隔1小时以上' },
        { nutrientA: 'manganese', nutrientB: 'iron', type: 'competitive', severity: 'medium', description: '铁和锰在肠道存在竞争吸收', advice: '铁和锰补充剂建议分开服用' },
        // ===== 拮抗作用 =====
        { nutrientA: 'vitamin-e', nutrientB: 'vitamin-k', type: 'antagonistic', severity: 'medium', description: '高剂量维生素E会拮抗维生素K的凝血作用', advice: '正在服用抗凝药者，高剂量维生素E需谨慎' },
        { nutrientA: 'vitamin-c', nutrientB: 'vitamin-b12', type: 'antagonistic', severity: 'medium', description: '高剂量维生素C（>1000mg）可降低维生素B12的稳定性', advice: '维生素C和B12建议错开2小时服用，避免相互干扰' },
        { nutrientA: 'vitamin-b3', nutrientB: 'vitamin-b3', type: 'antagonistic', severity: 'medium', description: '烟酸（维生素B3）大剂量（>500mg）可致皮肤潮红', advice: '建议从低剂量开始，或使用缓释型烟酰胺形式' },
        // ===== 药物相互作用 =====
        { nutrientA: 'vitamin-k', nutrientB: 'medication_anticoagulant', type: 'risk', severity: 'high', description: '维生素K会降低华法林等抗凝药物的效果', advice: '服用抗凝药者应保持维生素K摄入量稳定，避免大幅波动' },
        { nutrientA: 'vitamin-e', nutrientB: 'medication_anticoagulant', type: 'risk', severity: 'high', description: '高剂量维生素E（>400IU/天）增加出血风险', advice: '服用抗凝药者，维生素E补充不超过15mg/天' },
        { nutrientA: 'omega-3', nutrientB: 'medication_anticoagulant', type: 'risk', severity: 'medium', description: '高剂量Omega-3（>3000mg/天）增加出血风险', advice: '服用抗凝药者，Omega-3补充不超过2000mg/天' },
        { nutrientA: 'vitamin-b3', nutrientB: 'medication_statin', type: 'risk', severity: 'medium', description: '烟酸与他汀类药物合用可增加肌病风险', advice: '正在服用他汀类降脂药者，补充烟酸前请咨询医生' },
        { nutrientA: 'magnesium', nutrientB: 'medication_diuretic', type: 'risk', severity: 'medium', description: '某些利尿剂会增加镁的排泄，导致镁缺乏', advice: '服用利尿剂者需关注镁水平，必要时补充' },
        { nutrientA: 'potassium', nutrientB: 'medication_ace_inhibitor', type: 'risk', severity: 'high', description: 'ACE抑制剂（普利类降压药）与钾补充剂合用可致高钾血症', advice: '服用普利类降压药者，补充钾前必须咨询医生' },
        { nutrientA: 'calcium', nutrientB: 'medication_thyroid', type: 'competitive', severity: 'high', description: '钙剂会干扰甲状腺药物的吸收', advice: '甲状腺药物和钙剂需间隔至少4小时服用' },
        // ===== 协同作用 =====
        { nutrientA: 'vitamin-d', nutrientB: 'calcium', type: 'synergistic', severity: 'low', description: '维生素D促进钙的吸收和利用', advice: '补钙时配合维生素D效果更佳' },
        { nutrientA: 'vitamin-c', nutrientB: 'iron', type: 'synergistic', severity: 'low', description: '维生素C显著促进非血红素铁的吸收', advice: '补铁时配合维生素C（如橙汁）可提高吸收率' },
        { nutrientA: 'magnesium', nutrientB: 'vitamin-d', type: 'synergistic', severity: 'low', description: '镁参与维生素D的活化过程', advice: '补充维生素D时确保镁摄入充足' },
        { nutrientA: 'vitamin-k', nutrientB: 'vitamin-d', type: 'synergistic', severity: 'low', description: '维生素K2引导钙进入骨骼，与维生素D协同维持骨骼健康', advice: '补钙时建议同时补充维生素D和维生素K2，形成"钙三角"' },
        { nutrientA: 'vitamin-d', nutrientB: 'vitamin-k', type: 'synergistic', severity: 'low', description: '维生素D和K2协同作用，D促进钙吸收，K2引导钙入骨', advice: '维生素D3+K2组合是骨骼健康的最佳拍档' },
        { nutrientA: 'vitamin-a', nutrientB: 'zinc', type: 'synergistic', severity: 'low', description: '锌参与维生素A的转运和代谢，缺锌影响维生素A利用', advice: '补充维生素A时确保锌摄入充足，可提高效果' },
        { nutrientA: 'vitamin-b6', nutrientB: 'magnesium', type: 'synergistic', severity: 'low', description: '维生素B6促进镁的细胞内转运，提高镁的生物利用度', advice: '镁和B6同服效果更佳，尤其适合助眠' },
        { nutrientA: 'vitamin-e', nutrientB: 'vitamin-c', type: 'synergistic', severity: 'low', description: '维生素C可再生被氧化的维生素E，两者协同抗氧化', advice: '维生素C和E同服可增强抗氧化效果' },
        { nutrientA: 'selenium', nutrientB: 'vitamin-e', type: 'synergistic', severity: 'low', description: '硒和维生素E协同抗氧化，保护细胞膜', advice: '硒和维生素E同补可增强抗氧化效果' },
        { nutrientA: 'vitamin-b2', nutrientB: 'iron', type: 'synergistic', severity: 'low', description: '维生素B2促进铁的吸收和利用', advice: '补铁时注意B2的摄入，可以提高铁的生物利用度' },
        { nutrientA: 'vitamin-b9', nutrientB: 'vitamin-b12', type: 'synergistic', severity: 'low', description: '叶酸和B12协同参与同型半胱氨酸代谢', advice: '降低同型半胱氨酸需同时补充叶酸和B12' },
        { nutrientA: 'iodine', nutrientB: 'selenium', type: 'synergistic', severity: 'low', description: '硒参与甲状腺激素代谢，与碘协同维持甲状腺功能', advice: '补碘同时确保硒摄入充足，对甲状腺健康至关重要' },
        { nutrientA: 'vitamin-b5', nutrientB: 'vitamin-b-complex', type: 'synergistic', severity: 'low', description: '泛酸（B5）与其他B族维生素协同参与能量代谢', advice: 'B族维生素建议同补，效果优于单独补充' },
        // ===== 过量风险 =====
        { nutrientA: 'vitamin-b9', nutrientB: 'vitamin-b12', type: 'risk', severity: 'medium', description: '高剂量叶酸（>1000μg/天）可掩盖维生素B12缺乏的血液学表现', advice: '长期大剂量补充叶酸时应同时检测B12水平' },
        { nutrientA: 'vitamin-b6', nutrientB: 'vitamin-b6', type: 'risk', severity: 'high', description: '维生素B6长期超过100mg/天可致神经毒性', advice: 'B6补充不超过60mg/天，如需更高剂量需医生指导' },
        { nutrientA: 'vitamin-a', nutrientB: 'vitamin-a', type: 'risk', severity: 'high', description: '维生素A长期超过3000μg/天可致慢性中毒', advice: '孕妇尤其注意，维生素A补充不超过3000μg/天' },
        { nutrientA: 'vitamin-d', nutrientB: 'vitamin-d', type: 'risk', severity: 'high', description: '维生素D长期超过100μg（4000IU）/天可致高钙血症', advice: '维生素D补充不超过50μg（2000IU）/天，除非医生指导' },
        { nutrientA: 'selenium', nutrientB: 'selenium', type: 'risk', severity: 'high', description: '硒长期超过400μg/天可致硒中毒', advice: '硒补充不超过200μg/天，巴西坚果每日不超过2颗' },
        { nutrientA: 'calcium', nutrientB: 'calcium', type: 'risk', severity: 'medium', description: '钙长期超过2000mg/天可致肾结石和血管钙化', advice: '钙补充不超过1000mg/天，优先通过饮食获取' },
        // ===== 食物/成分影响 =====
        { nutrientA: 'iron', nutrientB: 'food_tea_coffee', type: 'antagonistic', severity: 'medium', description: '茶和咖啡中的鞣酸会抑制铁的吸收', advice: '补铁前后1小时内避免饮茶和咖啡' },
        { nutrientA: 'calcium', nutrientB: 'food_oxalate', type: 'antagonistic', severity: 'low', description: '草酸（菠菜、甜菜中）会影响钙的吸收', advice: '高钙食物与高草酸食物分开食用' },
        { nutrientA: 'calcium', nutrientB: 'food_phytate', type: 'antagonistic', severity: 'low', description: '植酸（全谷物、豆类中）会抑制钙和锌的吸收', advice: '豆类谷物浸泡或发酵后再食用可降低植酸含量' },
        { nutrientA: 'zinc', nutrientB: 'food_phytate', type: 'antagonistic', severity: 'low', description: '植酸会抑制锌的吸收', advice: '素食者锌吸收率较低，建议适当增加锌摄入量' },
        { nutrientA: 'vitamin-d', nutrientB: 'food_fat', type: 'synergistic', severity: 'low', description: '维生素D是脂溶性维生素，随餐服用吸收更好', advice: '维生素D随含脂肪的餐食服用，吸收率可提高30-50%' },
        { nutrientA: 'vitamin-k', nutrientB: 'food_fat', type: 'synergistic', severity: 'low', description: '维生素K是脂溶性维生素，随餐服用吸收更好', advice: '维生素K随含脂肪的餐食服用效果更佳' },
        { nutrientA: 'curcumin', nutrientB: 'piperine', type: 'synergistic', severity: 'low', description: '黑胡椒素（胡椒碱）可提高姜黄素吸收率20倍', advice: '食用姜黄/姜黄素时搭配黑胡椒，可大幅提高吸收' }
    ];

    /**
     * 检测营养素与保健品/药物的相互作用
     * @param {string} vitaminId - 要查询的营养素ID
     * @param {array} supplementNames - 正在服用的保健品名称列表
     * @param {array} medicationNames - 正在服用的药物名称列表
     * @returns {array} 交互结果列表
     */
    function checkInteractions(vitaminId, supplementNames, medicationNames) {
        supplementNames = supplementNames || [];
        medicationNames = medicationNames || [];
        var results = [];

        // 检查营养素-营养素相互作用
        INTERACTION_DB.forEach(function(interaction) {
            var matchA = interaction.nutrientA === vitaminId;
            var matchB = interaction.nutrientB === vitaminId;
            if (!matchA && !matchB) return;

            // 如果另一方是营养素，检查是否在补充
            var otherId = matchA ? interaction.nutrientB : interaction.nutrientA;
            if (otherId.indexOf('medication_') === 0 && otherId.indexOf('food_') !== 0) {
                // 药物相互作用：检查用户是否在服用相关药物
                var drugKeyword = otherId.replace('medication_', '');
                var hasMedication = medicationNames.some(function(m) {
                    return m.toLowerCase().indexOf(drugKeyword) >= 0;
                });
                if (!hasMedication) return;
            } else if (otherId.indexOf('food_') === 0) {
                // 食物相互作用：总是显示
            } else {
                // 营养素相互作用：检查另一方是否在服用
                var otherDetail = VITAMIN_LIST.find(function(v) { return v.id === otherId; });
                if (otherDetail) {
                    var hasOther = supplementNames.some(function(s) {
                        return s.indexOf(otherDetail.nameCN) >= 0 || s.indexOf(otherDetail.nameEN) >= 0;
                    });
                    if (!hasOther) return;
                }
            }

            results.push({
                type: interaction.type,
                severity: interaction.severity,
                description: interaction.description,
                advice: interaction.advice,
                name: matchA ? (interaction.nutrientB.indexOf('medication_') === 0 ? '药物' : interaction.nutrientB.indexOf('food_') === 0 ? '食物' : '') : (interaction.nutrientA.indexOf('medication_') === 0 ? '药物' : interaction.nutrientA.indexOf('food_') === 0 ? '食物' : '')
            });
        });

        // 检测过量风险（用户正在补充同一种营养素）
        var v = getVitaminDetail(vitaminId);
        if (v) {
            var sameNameCount = supplementNames.filter(function(s) {
                return s.indexOf(v.nameCN) >= 0 || s.indexOf(v.nameEN) >= 0;
            }).length;
            if (sameNameCount > 1) {
                results.push({
                    type: 'risk',
                    severity: 'high',
                    description: '您正在服用多种含' + v.nameCN + '的产品，总剂量可能超标',
                    advice: '请检查所有产品的标签，计算总剂量是否超过可耐受最高摄入量'
                });
            }
        }

        return results;
    }

    /**
     * 批量检测所有保健品之间的相互作用
     * @param {array} supplements - 保健品列表 [{name, brand, dosage, frequency}]
     * @param {array} medications - 用药史列表 [{name, dosage, reason, status}]
     * @returns {array} 所有检测到的相互作用
     */
    function checkAllSupplementInteractions(supplements, medications) {
        supplements = supplements || [];
        medications = medications || [];
        var allResults = [];
        var supplementNames = supplements.map(function(s) { return s.name || ''; }).filter(function(n) { return n; });
        var medicationNames = medications.filter(function(m) { return m.status === 'ongoing'; }).map(function(m) { return m.name || ''; }).filter(function(n) { return n; });

        // 对每个营养素检测相互作用
        supplementNames.forEach(function(supName) {
            var v = getVitaminDetail(supName);
            if (v) {
                var results = checkInteractions(v.id, supplementNames, medicationNames);
                allResults = allResults.concat(results);
            }
        });

        // 去重
        var unique = {};
        allResults.forEach(function(r) {
            var key = r.description;
            if (!unique[key]) {
                unique[key] = r;
            }
        });

        return Object.keys(unique).map(function(k) { return unique[k]; });
    }

    // ========== 个性化推荐引擎 ==========

    /**
     * 基于年龄的推荐调整
     */
    var AGE_ADJUSTMENT = {
        'child': { minAge: 0, maxAge: 12, adjustments: { calcium: '增加', 'vitamin-d': '增加', iron: '适量' } },
        'teen': { minAge: 13, maxAge: 17, adjustments: { calcium: '增加', iron: '增加（女）', 'vitamin-d': '增加', zinc: '增加' } },
        'adult': { minAge: 18, maxAge: 49, adjustments: { 'vitamin-d': '适量', calcium: '适量' } },
        'middle': { minAge: 50, maxAge: 64, adjustments: { calcium: '增加', 'vitamin-d': '增加', 'vitamin-b12': '增加', magnesium: '适量' } },
        'elderly': { minAge: 65, maxAge: 150, adjustments: { calcium: '增加', 'vitamin-d': '增加', 'vitamin-b12': '增加', 'vitamin-b6': '适量', magnesium: '适量' } }
    };

    /**
     * 中医体质与营养素关联
     */
    var CONSTITUTION_MAP = {
        '气虚质': { priority: [ 'vitamin-b1', 'vitamin-b12', 'iron', 'zinc' ], desc: '气虚者能量代谢偏弱，注重B族维生素和铁锌补充' },
        '阳虚质': { priority: [ 'vitamin-d', 'calcium', 'vitamin-b1' ], desc: '阳虚者畏寒怕冷，注重维生素D和钙补充' },
        '阴虚质': { priority: [ 'magnesium', 'vitamin-b6', 'vitamin-c', 'omega-3' ], desc: '阴虚者易燥热，注重镁和维生素C补充' },
        '痰湿质': { priority: [ 'vitamin-b6', 'magnesium', 'vitamin-c' ], desc: '痰湿者代谢偏慢，注重B6和镁促进代谢' },
        '湿热质': { priority: [ 'vitamin-c', 'zinc', 'vitamin-b6' ], desc: '湿热者注重抗氧化和锌的补充' },
        '血瘀质': { priority: [ 'vitamin-e', 'omega-3', 'vitamin-c' ], desc: '血瘀者注重抗氧化和血液循环' },
        '气郁质': { priority: [ 'vitamin-b6', 'magnesium', 'omega-3', 'vitamin-d' ], desc: '气郁者注重情绪调节相关的营养素' },
        '特禀质': { priority: [ 'vitamin-c', 'vitamin-d', 'zinc', 'selenium' ], desc: '特禀质（过敏体质）注重免疫调节' },
        '平和质': { priority: [], desc: '平和质体质均衡，注重常规营养维持即可' }
    };

    /**
     * 获取个性化推荐
     * @param {object} profile - 用户档案对象（含healthProfile）
     * @returns {object} { recommendations: [], constitutionAdvice: '', interactionWarnings: [], summary: '' }
     */
    function getPersonalizedRecommendations(profile) {
        if (!profile) return { recommendations: [], constitutionAdvice: '', interactionWarnings: [], summary: '请先创建用户档案以获取个性化推荐' };

        var hp = profile.healthProfile || {};
        var age = 0;
        if (profile.birthYear) {
            age = new Date().getFullYear() - parseInt(profile.birthYear);
        }

        // 1. 症状匹配
        var symptomRecs = [];
        if (hp.symptoms && hp.symptoms.length > 0) {
            symptomRecs = getRecommendationsBySymptoms(hp.symptoms) || [];
        }

        // 2. 体质推荐
        var constitutionAdvice = '';
        var constitutionPriorities = [];
        if (hp.constitution && CONSTITUTION_MAP[hp.constitution]) {
            constitutionAdvice = CONSTITUTION_MAP[hp.constitution].desc;
            constitutionPriorities = CONSTITUTION_MAP[hp.constitution].priority || [];
        }

        // 3. 年龄推荐
        var ageRecs = [];
        var ageGroup = null;
        Object.keys(AGE_ADJUSTMENT).forEach(function(group) {
            var a = AGE_ADJUSTMENT[group];
            if (age >= a.minAge && age <= a.maxAge) {
                ageGroup = group;
                Object.keys(a.adjustments).forEach(function(vitId) {
                    var v = getVitaminDetail(vitId);
                    if (v) {
                        ageRecs.push({
                            id: v.id,
                            nameCN: v.nameCN,
                            icon: v.icon,
                            reason: '年龄相关（' + a.adjustments[vitId] + '）',
                            priority: a.adjustments[vitId] === '增加' ? 3 : 2
                        });
                    }
                });
            }
        });

        // 4. 饮食调整
        var dietRecs = [];
        if (hp.diet === '素食' || hp.diet === '偏素食') {
            var vB12 = getVitaminDetail('vitamin-b12');
            if (vB12) dietRecs.push({ id: vB12.id, nameCN: vB12.nameCN, icon: vB12.icon, reason: '素食者易缺乏', priority: 3 });
            var vIron = getVitaminDetail('iron');
            if (vIron) dietRecs.push({ id: vIron.id, nameCN: vIron.nameCN, icon: vIron.icon, reason: '植物性铁吸收率低', priority: 3 });
            var vCalcium = getVitaminDetail('calcium');
            if (vCalcium) dietRecs.push({ id: vCalcium.id, nameCN: vCalcium.nameCN, icon: vCalcium.icon, reason: '素食者需关注钙摄入', priority: 2 });
        }

        // 5. 睡眠/运动调整
        if (hp.sleep === '失眠' || hp.sleep === '较差') {
            var vMag = getVitaminDetail('magnesium');
            if (vMag) dietRecs.push({ id: vMag.id, nameCN: vMag.nameCN, icon: vMag.icon, reason: '改善睡眠质量', priority: 3 });
            var vB6 = getVitaminDetail('vitamin-b6');
            if (vB6) dietRecs.push({ id: vB6.id, nameCN: vB6.nameCN, icon: vB6.icon, reason: '调节神经递质，助眠', priority: 2 });
        }

        // 6. 健康目标匹配
        var goalRecs = [];
        if (hp.healthGoals && hp.healthGoals.length > 0) {
            hp.healthGoals.forEach(function(goal) {
                if (goal.indexOf('免疫力') >= 0) {
                    ['vitamin-c', 'vitamin-d', 'zinc', 'selenium'].forEach(function(id) {
                        var v = getVitaminDetail(id);
                        if (v) goalRecs.push({ id: v.id, nameCN: v.nameCN, icon: v.icon, reason: '增强免疫力', priority: 3 });
                    });
                }
                if (goal.indexOf('睡眠') >= 0) {
                    ['magnesium', 'vitamin-b6'].forEach(function(id) {
                        var v = getVitaminDetail(id);
                        if (v) goalRecs.push({ id: v.id, nameCN: v.nameCN, icon: v.icon, reason: '改善睡眠', priority: 3 });
                    });
                }
                if (goal.indexOf('减重') >= 0 || goal.indexOf('减肥') >= 0) {
                    ['vitamin-b1', 'vitamin-b6', 'magnesium', 'coq10'].forEach(function(id) {
                        var v = getVitaminDetail(id);
                        if (v) goalRecs.push({ id: v.id, nameCN: v.nameCN, icon: v.icon, reason: '促进代谢', priority: 2 });
                    });
                }
                if (goal.indexOf('皮肤') >= 0) {
                    ['vitamin-c', 'vitamin-e', 'vitamin-a'].forEach(function(id) {
                        var v = getVitaminDetail(id);
                        if (v) goalRecs.push({ id: v.id, nameCN: v.nameCN, icon: v.icon, reason: '改善皮肤', priority: 2 });
                    });
                }
                if (goal.indexOf('骨骼') >= 0 || goal.indexOf('骨') >= 0) {
                    ['calcium', 'vitamin-d', 'magnesium', 'vitamin-k'].forEach(function(id) {
                        var v = getVitaminDetail(id);
                        if (v) goalRecs.push({ id: v.id, nameCN: v.nameCN, icon: v.icon, reason: '骨骼健康', priority: 3 });
                    });
                }
            });
        }

        // 7. 合并评分
        var scoreMap = {};
        function addScore(arr, score) {
            arr.forEach(function(item) {
                var key = item.id;
                if (!scoreMap[key]) scoreMap[key] = { id: item.id, nameCN: item.nameCN, icon: item.icon, reasons: [], score: 0 };
                scoreMap[key].score += score;
                if (scoreMap[key].reasons.indexOf(item.reason) < 0) {
                    scoreMap[key].reasons.push(item.reason);
                }
            });
        }
        // 症状匹配分数：score * 5
        symptomRecs.forEach(function(r) { addScore([r], r.score * 5); });
        // 体质优先级：3
        constitutionPriorities.forEach(function(id) {
            if (!scoreMap[id]) {
                var v = getVitaminDetail(id);
                if (v) scoreMap[id] = { id: id, nameCN: v.nameCN, icon: v.icon, reasons: [], score: 0 };
            }
            if (scoreMap[id]) scoreMap[id].score += 3;
        });
        // 年龄推荐：priority * 2
        addScore(ageRecs, 2);
        // 饮食调整：priority * 3
        addScore(dietRecs, 3);
        // 目标匹配：priority * 4
        addScore(goalRecs, 4);

        // 排序
        var sortedKeys = Object.keys(scoreMap).sort(function(a, b) {
            return scoreMap[b].score - scoreMap[a].score;
        });

        var recommendations = sortedKeys.map(function(key) {
            var item = scoreMap[key];
            var v = getVitaminDetail(key);
            return {
                id: key,
                nameCN: item.nameCN,
                icon: item.icon,
                score: item.score,
                reasons: item.reasons,
                function: v ? v.function : '',
                foods: v ? v.foods : '',
                dailyIntake: v ? v.dailyIntake : ''
            };
        });

        // 8. 相互作用检测
        var supplements = hp.supplements || [];
        var medications = hp.medications || [];
        var interactionWarnings = checkAllSupplementInteractions(supplements, medications);

        // 9. 摘要
        var summary = '';
        if (recommendations.length > 0) {
            summary = '根据您的健康画像，建议重点关注 ' + recommendations.slice(0, 3).map(function(r) { return r.nameCN; }).join('、') + '。';
            if (hp.constitution) summary += ' 体质分析：' + constitutionAdvice;
            if (interactionWarnings.length > 0) summary += ' 检测到 ' + interactionWarnings.length + ' 项相互作用提示。';
        } else {
            summary = '您当前的健康画像信息较少，建议完善档案以获得更精准的个性化推荐。';
        }

        return {
            recommendations: recommendations,
            constitutionAdvice: constitutionAdvice,
            interactionWarnings: interactionWarnings,
            summary: summary,
            ageGroup: ageGroup
        };
    }

    // ========== 每日服用时间表（按时间分组）==========

    /**
     * 时间槽定义
     */
    var TIME_SLOTS = [
        { id: 'morning', label: '🌅 早晨', timeRange: '起床后 · 早餐前后', order: 1, desc: '适合空腹或随早餐服用的营养素' },
        { id: 'lunch', label: '☀️ 午间', timeRange: '午餐前后', order: 2, desc: '适合随午餐服用的营养素' },
        { id: 'afternoon', label: '🌤 下午', timeRange: '下午茶时间', order: 3, desc: '适合下午服用的营养素' },
        { id: 'dinner', label: '🌆 晚间', timeRange: '晚餐前后', order: 4, desc: '适合随晚餐服用的营养素' },
        { id: 'bedtime', label: '🌙 睡前', timeRange: '睡前30-60分钟', order: 5, desc: '适合睡前服用的营养素' }
    ];

    /**
     * 营养素-时间槽映射
     * 基于生物利用度、吸收特性和生理节律
     */
    var NUTRIENT_TIME_MAP = {
        'morning': {
            id: 'morning',
            nutrients: [
                { id: 'vitamin-c', reason: '清晨空腹吸收好，提神醒脑、抗氧化' },
                { id: 'vitamin-b1', reason: '随早餐服用，促进碳水化合物转化能量' },
                { id: 'vitamin-b2', reason: '随早餐服用，促进全天能量代谢' },
                { id: 'vitamin-b3', reason: '随早餐服用，避免空腹刺激胃部' },
                { id: 'vitamin-b7', reason: '随早餐服用，促进能量代谢' },
                { id: 'iron', reason: '空腹吸收好，搭配维生素C效果更佳' },
                { id: 'chromium', reason: '随早餐服用，稳定全天血糖' },
                { id: 'coq10', reason: '早晨服用提升全天精力' },
                { id: 'iodine', reason: '随早餐服用，促进甲状腺功能' }
            ],
            avoid: '钙、锌（早晨空腹服可能刺激胃部，建议随餐）'
        },
        'lunch': {
            id: 'lunch',
            nutrients: [
                { id: 'vitamin-d', reason: '随午餐（含脂肪）服用，吸收最充分' },
                { id: 'vitamin-a', reason: '随午餐（含脂肪）服用，吸收更好' },
                { id: 'vitamin-e', reason: '随午餐（含脂肪）服用，吸收率最高' },
                { id: 'vitamin-k', reason: '随午餐（含脂肪）服用，吸收最佳' },
                { id: 'omega-3', reason: '随午餐服用，减少鱼油反胃感' },
                { id: 'calcium', reason: '午餐后服用，胃酸充足促进吸收' },
                { id: 'zinc', reason: '随餐服用减少刺激，与蛋白质搭配效果更好' }
            ],
            avoid: '高剂量铁（与钙同服降低吸收，建议错开）'
        },
        'afternoon': {
            id: 'afternoon',
            nutrients: [
                { id: 'vitamin-b6', reason: '下午服用助缓解疲劳，促进神经递质合成' },
                { id: 'vitamin-b9', reason: '下午服用，搭配B12效果佳' },
                { id: 'vitamin-b12', reason: '下午服用提升精力，避免睡前兴奋' },
                { id: 'selenium', reason: '下午随餐服用，抗氧化效果持续' }
            ],
            avoid: '含咖啡因的营养补充剂（影响下午休息）'
        },
        'dinner': {
            id: 'dinner',
            nutrients: [
                { id: 'vitamin-b5', reason: '随晚餐服用，促进晚间能量代谢' },
                { id: 'calcium', reason: '晚餐后补钙，夜间骨骼修复利用' },
                { id: 'magnesium', reason: '晚餐后服用，放松神经助睡眠' },
                { id: 'potassium', reason: '随晚餐服用，维持夜间电解质平衡' }
            ],
            avoid: '高剂量维生素B族（部分人可能影响睡眠）'
        },
        'bedtime': {
            id: 'bedtime',
            nutrients: [
                { id: 'magnesium', reason: '睡前服用甘氨酸镁，助眠效果最佳' },
                { id: 'calcium', reason: '睡前补钙，促进夜间骨骼修复' },
                { id: 'vitamin-b6', reason: '小剂量睡前服用，促进褪黑素合成' }
            ],
            avoid: '维生素B12、辅酶Q10（可能干扰睡眠）'
        }
    };

    /**
     * 获取所有时间槽
     */
    function getAllTimeSlots() {
        return TIME_SLOTS.map(function(s) { return Object.assign({}, s); });
    }

    /**
     * 根据用户保健品列表生成个性化时间表
     * @param {array} supplements - 用户正在服用的保健品 [{name, brand, dosage, frequency}]
     * @returns {array} 按时间槽分组的时间表
     */
    function generateTimeSchedule(supplements) {
        supplements = supplements || [];
        var schedule = [];

        TIME_SLOTS.forEach(function(slot) {
            var slotInfo = NUTRIENT_TIME_MAP[slot.id];
            if (!slotInfo) return;

            var matched = [];
            var supplementNames = supplements.map(function(s) { return (s.name || '').toLowerCase(); });

            slotInfo.nutrients.forEach(function(n) {
                var v = getVitaminDetail(n.id);
                if (!v) return;

                // 检查用户是否正在服用
                var isTaking = supplementNames.some(function(sn) {
                    return sn.indexOf(v.nameCN.toLowerCase()) >= 0 ||
                           sn.indexOf(v.nameEN.toLowerCase()) >= 0 ||
                           sn.indexOf(v.id) >= 0;
                });

                matched.push({
                    id: n.id,
                    nameCN: v.nameCN,
                    icon: v.icon,
                    reason: n.reason,
                    isTaking: isTaking,
                    category: v.category
                });
            });

            schedule.push({
                slotId: slot.id,
                slotLabel: slot.label,
                timeRange: slot.timeRange,
                desc: slot.desc,
                order: slot.order,
                nutrients: matched,
                avoid: slotInfo.avoid || ''
            });
        });

        return schedule.sort(function(a, b) { return a.order - b.order; });
    }

    // ========== 保健品效果跟踪 ==========

    /**
     * 保存效果评价
     * @param {string} supplementName - 保健品名称
     * @param {number} rating - 效果评分 1-5
     * @param {string} effect - 效果描述
     * @param {string} note - 备注
     */
    function saveEffectivenessRating(supplementName, rating, effect, note) {
        var key = 'qhh_supplement_effects';
        var raw = localStorage.getItem(key);
        var data = raw ? JSON.parse(raw) : [];
        data.push({
            id: genId(),
            supplementName: supplementName,
            rating: rating,
            effect: effect || '',
            note: note || '',
            date: todayStr(),
            timestamp: now()
        });
        // 最多保留200条
        if (data.length > 200) data = data.slice(data.length - 200);
        localStorage.setItem(key, JSON.stringify(data));
        return data[data.length - 1];
    }

    /**
     * 获取保健品效果历史
     * @param {string} supplementName - 可选，按名称筛选
     * @param {number} days - 最近天数
     */
    function getEffectivenessHistory(supplementName, days) {
        days = days || 90;
        var key = 'qhh_supplement_effects';
        var raw = localStorage.getItem(key);
        if (!raw) return [];
        var data;
        try { data = JSON.parse(raw); } catch(e) { return []; }

        var cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        return data.filter(function(r) {
            if (supplementName && r.supplementName !== supplementName) return false;
            var recDate = new Date(r.date);
            return recDate >= cutoff;
        }).sort(function(a, b) {
            return b.timestamp.localeCompare(a.timestamp);
        });
    }

    /**
     * 获取保健品效果统计
     * @param {string} supplementName - 可选，按名称统计
     */
    function getEffectivenessStats(supplementName) {
        var records = getEffectivenessHistory(supplementName, 365);
        if (records.length === 0) return null;

        var totalRating = 0;
        var effectCount = {};
        records.forEach(function(r) {
            totalRating += r.rating;
            if (r.effect) {
                effectCount[r.effect] = (effectCount[r.effect] || 0) + 1;
            }
        });

        var avgRating = (totalRating / records.length).toFixed(1);
        var topEffect = null;
        var maxCount = 0;
        Object.keys(effectCount).forEach(function(e) {
            if (effectCount[e] > maxCount) {
                maxCount = effectCount[e];
                topEffect = e;
            }
        });

        return {
            totalRecords: records.length,
            avgRating: parseFloat(avgRating),
            topEffect: topEffect,
            effectCount: effectCount,
            ratingDistribution: {
                5: records.filter(function(r) { return r.rating >= 5; }).length,
                4: records.filter(function(r) { return r.rating >= 4 && r.rating < 5; }).length,
                3: records.filter(function(r) { return r.rating >= 3 && r.rating < 4; }).length,
                2: records.filter(function(r) { return r.rating >= 2 && r.rating < 3; }).length,
                1: records.filter(function(r) { return r.rating < 2; }).length
            }
        };
    }

    // ========== 保健品功效标签（用于快速选择）==========

    var EFFECT_LABELS = [
        '改善睡眠', '缓解疲劳', '增强免疫力', '改善消化', '改善皮肤',
        '缓解焦虑', '提升精力', '改善关节', '改善视力', '改善记忆力',
        '调节情绪', '减重辅助', '改善脱发', '改善指甲', '无明显效果'
    ];

    function getAllEffectLabels() {
        return EFFECT_LABELS.slice();
    }

    // ========== 暴露到全局 ==========

    global.VitaminEngine = {
        // 数据
        VITAMIN_LIST: VITAMIN_LIST,
        SYMPTOM_MAP: SYMPTOM_MAP,
        NUTRIENT_FORMS: NUTRIENT_FORMS,
        BODY_SYSTEM_MAP: BODY_SYSTEM_MAP,
        DEFICIENCY_RISK_LEVELS: DEFICIENCY_RISK_LEVELS,

        // 维生素查询
        getAllVitamins: getAllVitamins,
        getVitaminDetail: getVitaminDetail,
        getRecommendationsBySymptoms: getRecommendationsBySymptoms,
        searchVitamins: searchVitamins,
        getAllSymptoms: getAllSymptoms,
        getSymptomsForVitamin: getSymptomsForVitamin,

        // 补充记录
        saveSupplementRecord: saveSupplementRecord,
        getSupplementHistory: getSupplementHistory,
        getSupplementStats: getSupplementStats,
        deleteSupplementRecord: deleteSupplementRecord,

        // 剂量分级
        getAllDoseLevels: getAllDoseLevels,
        getRecommendedDose: getRecommendedDose,

        // 相互作用检测
        INTERACTION_DB: INTERACTION_DB,
        checkInteractions: checkInteractions,
        checkAllSupplementInteractions: checkAllSupplementInteractions,

        // 个性化推荐
        AGE_ADJUSTMENT: AGE_ADJUSTMENT,
        CONSTITUTION_MAP: CONSTITUTION_MAP,
        getPersonalizedRecommendations: getPersonalizedRecommendations,

        // 营养素细分形态与生物利用度
        getNutrientForms: getNutrientForms,
        getBodySystems: getBodySystems,
        getBodySystemsBySymptoms: getBodySystemsBySymptoms,

        // 缺乏风险评估
        assessDeficiencyRisk: assessDeficiencyRisk,
        assessAllDeficiencyRisks: assessAllDeficiencyRisks,

        // 智能补充计划
        generateSupplementPlan: generateSupplementPlan,

        // 服用时间表
        TIME_SLOTS: TIME_SLOTS,
        NUTRIENT_TIME_MAP: NUTRIENT_TIME_MAP,
        getAllTimeSlots: getAllTimeSlots,
        generateTimeSchedule: generateTimeSchedule,

        // 效果跟踪
        EFFECT_LABELS: EFFECT_LABELS,
        saveEffectivenessRating: saveEffectivenessRating,
        getEffectivenessHistory: getEffectivenessHistory,
        getEffectivenessStats: getEffectivenessStats,
        getAllEffectLabels: getAllEffectLabels
    };

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);