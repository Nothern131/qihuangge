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
        '食欲不振': ['vitamin-b1', 'zinc']
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

    // ========== 暴露到全局 ==========

    global.VitaminEngine = {
        // 数据
        VITAMIN_LIST: VITAMIN_LIST,
        SYMPTOM_MAP: SYMPTOM_MAP,

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
        deleteSupplementRecord: deleteSupplementRecord
    };

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);