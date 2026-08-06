/**
 * 岐黄阁 · 本草查询组件
 * 快捷药材按钮 + 详细信息 + 推荐药膳
 */
(function(global) {
    'use strict';

    var PRESET_HERBS = ['人参', '黄芪', '当归', '白术', '茯苓', '甘草', '川芎', '熟地黄', '柴胡', '黄芩', '半夏', '附子'];

    var HERB_RECIPES = {
        '人参': [
            { name: '人参黄芪粥', recipe: '人参5g、黄芪15g、粳米100g。人参黄芪煎水取汁，与粳米同煮粥。补气固表。', suitability: '气虚乏力、自汗易感' },
            { name: '人参鸡汤', recipe: '人参10g、母鸡半只、生姜3片。炖煮2小时，加盐调味。大补元气。', suitability: '气血亏虚、病后体弱' }
        ],
        '黄芪': [
            { name: '黄芪炖鸡', recipe: '黄芪30g、母鸡1只、生姜3片。炖煮2小时，加盐调味。益气补虚。', suitability: '气虚乏力、气短懒言' },
            { name: '黄芪枸杞茶', recipe: '黄芪10g、枸杞10g。沸水冲泡，代茶饮。补气养血。', suitability: '气血两虚、面色萎黄' }
        ],
        '当归': [
            { name: '当归生姜羊肉汤', recipe: '当归15g、生姜30g、羊肉500g。羊肉切块焯水，与当归生姜同炖至烂。温阳补血。', suitability: '血虚畏寒、月经不调' },
            { name: '当归补血茶', recipe: '当归5g、红枣3枚。沸水冲泡，代茶饮。补血调经。', suitability: '血虚萎黄、经期腹痛' }
        ],
        '白术': [
            { name: '白术茯苓粥', recipe: '白术10g、茯苓15g、粳米100g。白术茯苓煎水取汁，与粳米煮粥。健脾祛湿。', suitability: '脾虚湿盛、食少便溏' },
            { name: '白术炖猪肚', recipe: '白术15g、猪肚1个、生姜3片。炖煮至烂，加盐调味。健脾养胃。', suitability: '脾胃虚弱、消化不良' }
        ],
        '茯苓': [
            { name: '茯苓山药粥', recipe: '茯苓15g、山药30g、粳米100g。一起煮粥，加糖调味。健脾宁心。', suitability: '脾虚失眠、心悸健忘' },
            { name: '茯苓饼', recipe: '茯苓粉50g、米粉100g、蜂蜜适量。拌匀蒸熟切块。健脾安神。', suitability: '脾虚食少、心神不宁' }
        ],
        '甘草': [
            { name: '甘草枣仁茶', recipe: '甘草3g、酸枣仁10g。沸水冲泡，代茶饮。调和诸药，安神助眠。', suitability: '心悸失眠、烦躁不安' },
            { name: '甘草绿豆汤', recipe: '甘草3g、绿豆50g。绿豆煮烂加甘草，加糖调味。清热解毒。', suitability: '热毒疮疡、咽喉肿痛' }
        ],
        '川芎': [
            { name: '川芎茶调散', recipe: '川芎10g、薄荷5g、荆芥5g。研末，沸水冲服。祛风止痛。', suitability: '风寒头痛、偏头痛' },
            { name: '川芎炖鸡蛋', recipe: '川芎10g、鸡蛋2个。同煮，蛋熟去壳再煮5分钟。活血止痛。', suitability: '血瘀头痛、痛经' }
        ],
        '熟地黄': [
            { name: '熟地山药粥', recipe: '熟地黄15g、山药30g、粳米100g。熟地煎水取汁，与山药粳米煮粥。滋阴补血。', suitability: '肝肾阴虚、腰膝酸软' },
            { name: '熟地煲汤', recipe: '熟地黄20g、乌鸡半只、枸杞10g。炖煮2小时。补血滋阴。', suitability: '血虚萎黄、月经不调' }
        ],
        '柴胡': [
            { name: '柴胡疏肝茶', recipe: '柴胡6g、陈皮3g、玫瑰花3g。沸水冲泡，代茶饮。疏肝理气。', suitability: '肝郁气滞、胸胁胀痛' },
            { name: '柴胡薄荷饮', recipe: '柴胡10g、薄荷3g、甘草3g。煎水代茶饮。疏解少阳。', suitability: '少阳证、寒热往来' }
        ],
        '黄芩': [
            { name: '黄芩栀子茶', recipe: '黄芩6g、栀子6g。沸水冲泡，代茶饮。清热燥湿。', suitability: '湿热黄疸、肺热咳嗽' },
            { name: '黄芩绿豆汤', recipe: '黄芩10g、绿豆50g。绿豆煮烂加黄芩，加糖调味。清热解毒。', suitability: '热毒疮疡、咽喉肿痛' }
        ],
        '半夏': [
            { name: '半夏陈皮粥', recipe: '制半夏6g、陈皮5g、粳米100g。半夏陈皮煎水取汁，与粳米煮粥。燥湿化痰。', suitability: '痰湿咳嗽、恶心呕吐' },
            { name: '半夏半夏汤', recipe: '制半夏9g、生姜3片。煎水代茶饮。降逆止呕。', suitability: '胃气上逆、眩晕呕吐' }
        ],
        '附子': [
            { name: '附子理中粥', recipe: '制附子3g（先煎1小时）、干姜5g、粳米100g。附子干姜煎水取汁，与粳米煮粥。温阳散寒。', suitability: '阳虚畏寒、四肢不温' },
            { name: '附子羊肉汤', recipe: '制附子3g（先煎）、羊肉200g、生姜5片。炖煮2小时。回阳救逆。', suitability: '阳虚寒盛、腰膝冷痛' }
        ]
    };

    function render() {
        var pills = PRESET_HERBS.map(function(h) {
            return '<button class="herb-pill" onclick="quickQueryBencao(\'' + h + '\')">' + h + '</button>';
        }).join('');

        return `
            <div class="bencao-page">
                <h2>本草查询</h2>
                <p class="desc">查询药物性味归经、功效主治、推荐药膳</p>
                <div class="search-area">
                    <div class="input-with-btn">
                        <input type="text" id="bencao-input" placeholder="输入药物名，如：人参" onkeydown="if(event.key==='Enter')runBencao()">
                        <button onclick="runBencao()" class="search-btn">查询</button>
                    </div>
                    <div class="hint-text">可尝试：人参、黄芪、当归、白术、茯苓、甘草、川芎、熟地黄、柴胡、黄芩、半夏、附子</div>
                </div>
                <div class="quick-section">
                    <div class="quick-title">常用药材</div>
                    <div class="herb-pills">${pills}</div>
                </div>
                <div id="bencao-result" class="result-area" style="display:none;"></div>
            </div>
        `;
    }

    window.quickQueryBencao = function(name) {
        document.getElementById('bencao-input').value = name;
        runBencao();
    };

    window.runBencao = function() {
        var name = document.getElementById('bencao-input').value.trim();
        if (!name) { alert('请输入药物名称'); return; }

        var result = BencaoEngine.query(name);
        if (!result) {
            alert('未找到该药物，请尝试：人参、黄芪、当归、白术、茯苓、甘草、川芎、熟地黄、柴胡、黄芩、半夏、附子');
            return;
        }

        var recipes = HERB_RECIPES[name] || [];
        var recipeHtml = recipes.length > 0 ?
            '<div class="recipe-section"><h5>推荐药膳</h5>' +
            recipes.map(function(r) {
                return '<div class="recipe-item"><div class="recipe-name">' + r.name + '</div><div class="recipe-suit">' + r.suitability + '</div><div class="recipe-how">' + r.recipe + '</div></div>';
            }).join('') +
            '</div>' : '';

        var html = '<div class="bencao-detail-card">';
        html += '<div class="bencao-header">';
        html += '<div class="herb-name">' + name + '</div>';
        html += '<span class="tox-badge">' + result.jindu + '</span>';
        html += '</div>';

        html += '<div class="bencao-meta">';
        html += '<div class="meta-item"><span class="meta-label">性味</span><span class="meta-value">' + result.xingwei + '</span></div>';
        html += '<div class="meta-item"><span class="meta-label">归经</span><span class="meta-value">' + result.guijing + '</span></div>';
        html += '</div>';

        html += '<div class="bencao-section"><h5>功效</h5><p>' + result['功效'] + '</p></div>';
        html += '<div class="bencao-section"><h5>主治</h5><p>' + result.zhuji + '</p></div>';
        html += '<div class="bencao-section"><h5>用法用量</h5><p>' + result.jifu + '</p></div>';
        html += '<div class="bencao-section"><h5>配伍</h5><p>' + result.peiwu + '</p></div>';

        if (result.tabi && result.tabi.length > 0) {
            html += '<div class="bencao-section warning-section"><h5>禁忌</h5><ul>' +
                result.tabi.map(function(t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>';
        }

        if (result.gujiyuanwen && result.gujiyuanwen.length > 0) {
            html += '<div class="bencao-section gujiyuanwen-section"><h5>📜 古籍原文</h5><div class="gujiyuanwen-list">' +
                result.gujiyuanwen.map(function(g) {
                    return '<div class="gujiyuanwen-item"><span class="gujiyuanwen-source">' + g.source + '</span><span class="gujiyuanwen-text">' + g.text + '</span></div>';
                }).join('') +
                '</div></div>';
        }

        html += recipeHtml;
        html += '</div>';

        var resultEl = document.getElementById('bencao-result');
        if (resultEl) {
            resultEl.innerHTML = html;
            resultEl.style.display = 'block';
            resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    global.BencaoComponent = { render: render };
})(typeof window !== 'undefined' ? window : this);
