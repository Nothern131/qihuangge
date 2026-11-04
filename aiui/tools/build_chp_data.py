# -*- coding: utf-8 -*-
"""从《中国药典》2025 年版一部的官方 PDF，生成 adapter/food-canon.js 和 adapter/pair-canon.js。

为什么要有这个脚本，而不是把数据当黑盒：
  这两个文件里有一千多行汉字，看上去像手打的。它们不是——
  每一个字都是从药典 PDF 里抽的，脚本在这儿，谁都可以重跑、可以核对。
  一份查不到来源的医理数据，和编的没有区别。

用法：

    # 1. 拿 PDF
    #    书籍接口：https://2025.chp.org.cn/front-api/book/1
    #    返回体里的 data.pdfUrl 就是整本一部，拼上 https://2025.chp.org.cn/front-api 前缀下载
    #    约 37 MB，2057 页
    pip install pypdf
    python tools/build_chp_data.py chp2025.pdf --work /tmp/chp

    # 2. 脚本会在 --work 下生成 chp_pages.json / chp_items3.json，
    #    然后直接把 adapter/food-canon.js 和 adapter/pair-canon.js 写回去。
    #    写完跑一遍 node tests/food.js && node tests/pair.js 确认没坏。

三个坑写在下面对应位置，重跑之前先看一眼，省得从头查一遍。
"""
import argparse
import io
import json
import os
import re
import sys

# ── 归一化 ────────────────────────────────────────────────────────────

# 坑一：pypdf 把不少字形（小数点之类）映射到了 Unicode 私有区，
# 而实际出现的码点到了 \U001001b0。只写到 \U000FFFFD 会漏一大片，
# 表现为正文里夹着看不懂的方块。范围要开到底。
PRIVATE = re.compile(r'[\ue000-\uf8ff\U000F0000-\U0010FFFF]')
FULL2HALF = str.maketrans('０１２３４５６７８９％．', '0123456789%.')

# 跨页时页眉页脚会被带进正文：「511\n白果\n中国药典2025年版\n」
NOISE = re.compile(r'\n\d{1,4}\n[\u4e00-\u9fa5]{2,8}\n中国药典2025年版\n?|中国药典2025年版\n?|\n\d{1,4}\n')

NOT_NAME = {'凡例', '目录', '正文', '索引', '药材和饮片', '植物油脂和提取物',
            '成方制剂和单味制剂', '中文索引', '汉语拼音索引', '拉丁名索引',
            '饮片', '药材'}
NAME_LINE = re.compile(r'[\u4e00-\u9fa5]{2,10}')
TOC_LINE = re.compile(r'^([\u4e00-\u9fa5]{2,10})(\d{1,4})$')
ANCHOR = '【性味与归经】'


def norm(s):
    s = PRIVATE.sub('', s)
    s = s.translate(FULL2HALF)
    return re.sub(r'[ \t\u3000\xa0]+', '', s).replace('\r', '')


def clean(s):
    """把抽出来的原文整理成能上屏的样子。不改字，只动标点和换行。"""
    if not s:
        return ''
    s = NOISE.sub('', s).replace('\n', '')
    s = s.replace(',', '，').replace(';', '；').replace('.', '。')
    s = re.sub(r'。+', '。', s)
    s = s.replace('【', '').replace('】', '')
    # 页眉的另一半：删掉书名之后，前面往往还留着半截药名（「…外敷。丁香」）
    s = re.sub(r'。([\u4e00-\u9fa5]{2,6})$', '。', s)
    return re.sub(r'\s{2,}', ' ', s).strip()


# ── 第一步：PDF → 每页文本 ───────────────────────────────────────────

def extract_pages(pdf_path, work):
    from pypdf import PdfReader
    out_path = os.path.join(work, 'chp_pages.json')
    if os.path.exists(out_path):
        print('[1/3] 已有 %s，跳过提取' % out_path)
        return json.load(io.open(out_path, encoding='utf-8'))

    r = PdfReader(pdf_path)
    print('[1/3] %d 页，开始提取……' % len(r.pages))
    pages = []
    for i in range(len(r.pages)):
        try:
            pages.append(r.pages[i].extract_text() or '')
        except Exception as err:  # 个别页抽不出来不该让整本失败
            print('  第 %d 页失败：%s' % (i + 1, err))
            pages.append('')
        if i % 200 == 0:
            print('  ...', i, flush=True)
    json.dump(pages, io.open(out_path, 'w', encoding='utf-8'), ensure_ascii=False)
    return pages


# ── 第二步：每味药的四个字段 ──────────────────────────────────────────

def extract_items(pages, work):
    out_path = os.path.join(work, 'chp_items.json')
    if os.path.exists(out_path):
        print('[2/3] 已有 %s，跳过抽取' % out_path)
        return json.load(io.open(out_path, encoding='utf-8'))

    full, offsets, pos = [], [], 0
    for p in pages:
        t = norm(p)
        offsets.append(pos)
        full.append(t)
        pos += len(t) + 1
    text = '\n'.join(full)

    def page_of(idx):
        lo, hi = 0, len(offsets) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if offsets[mid] <= idx:
                lo = mid
            else:
                hi = mid - 1
        return lo + 1

    # 坑三：药名不能靠「往前找第一个纯汉字短行」。
    # 会撞上「供试品色谱中…」被换行截出来的「试品色谱」，
    # 也会被「山药片」这样的饮片名顶掉正名，人参甚至被识别成「制成」。
    # 正解是用品名目次建白名单——目次行是「药名+页码」。
    m = re.search(r'南沙参\d+', text)
    toc_start = max(0, (m.start() - 4000) if m else 10000)
    names = set()
    for line in text[toc_start:toc_start + 30000].split('\n'):
        mm = TOC_LINE.match(line.strip())
        if mm:
            names.add(mm.group(1))

    order = sorted(names, key=len, reverse=True)  # 长名优先，「制草乌」不能被「草乌」吃掉
    alt = '|'.join(re.escape(n) for n in order)
    # 药名行后面必须紧跟拼音行，这是条目开头的固定形态（枸杞子\nGouqizi\nLYCIIFRUCTUS）。
    # 少了这一层，正文里提到别的药的地方也会被当成条目开头。
    name_near = re.compile(r'\n(' + alt + r')\n[A-Za-z\u0251-\u02ff]{2,30}\n')

    anchors = [mm.start() for mm in re.finditer(ANCHOR, text)]
    items = {}
    for k, a in enumerate(anchors):
        prev = anchors[k - 1] if k > 0 else 0
        nxt = anchors[k + 1] if k + 1 < len(anchors) else len(text)

        # 坑二：上界必须是「下一个锚点」。用固定窗口向后取，会把下一味药的
        # 【注意】抓进来——第一版就是这样，有注意项的条目从 218 虚涨到 459，
        # 而回到原文核对，多数是假的。
        hits = name_near.findall(text[max(prev, a - 9000):a])
        if not hits:
            continue
        name = hits[-1]
        if name in items:
            continue

        def take(marker, ends):
            i = text.find(marker, a, nxt)
            if i < 0:
                return ''
            i += len(marker)
            j = nxt
            for e in ends:
                k2 = text.find(e, i, nxt)
                if 0 <= k2 < j:
                    j = k2
            return text[i:j].strip()

        nature = take(ANCHOR, ['【功能与主治】'])
        if not nature or len(nature) > 60:
            continue
        items[name] = {
            'nature': nature,
            'functions': take('【功能与主治】', ['【用法与用量】', '【注意】']),
            'dosage': take('【用法与用量】', ['【注意】', '【贮藏】']),
            'tabi': take('【注意】', ['【贮藏】']),
            'page': page_of(a),
        }

    json.dump(items, io.open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('[2/3] 抽出 %d 味，其中 %d 味有【注意】' % (len(items), sum(1 for v in items.values() if v['tabi'])))
    return items


# ── 第三步：写两个数据文件 ────────────────────────────────────────────

FOOD = """丁香 八角茴香 刀豆 小茴香 小蓟 山药 山楂 马齿苋 乌梅 木瓜 火麻仁 玉竹 甘草 白芷
白果 白扁豆 龙眼肉 决明子 百合 肉豆蔻 肉桂 余甘子 佛手 沙棘 牡蛎 芡实 花椒 赤小豆
鸡内金 麦芽 昆布 大枣 罗汉果 郁李仁 金银花 青果 鱼腥草 生姜 干姜 枸杞子 栀子 砂仁
胖大海 茯苓 香橼 香薷 桃仁 桑叶 桑椹 桔梗 荷叶 莱菔子 莲子 高良姜 淡竹叶 淡豆豉
菊花 菊苣 黄精 紫苏子 葛根 黑芝麻 蒲公英 蜂蜜 榧子 酸枣仁 白茅根 芦根 薄荷
薏苡仁 薤白 覆盆子 玫瑰花 夏枯草 当归 山柰 西红花 草果 姜黄 荜茇 党参 肉苁蓉
铁皮石斛 西洋参 黄芪 灵芝 天麻 山茱萸 杜仲叶 地黄 麦冬 天冬 化橘红 陈皮
苦杏仁 益智 芥子 广藿香 紫苏叶 槐角 人参叶 人参""".split()

# 俗称 → 药典正名。只收确定等价的：
# 「姜」同时指生姜、干姜、姜黄，收进来一定答错，所以单字别名一律不收。
ALIASES = {
    '红枣': '大枣', '干枣': '大枣',
    '桂圆': '龙眼肉', '桂圆肉': '龙眼肉', '龙眼': '龙眼肉',
    '枸杞': '枸杞子',
    '薏米': '薏苡仁', '苡仁': '薏苡仁', '薏仁': '薏苡仁', '苡米': '薏苡仁',
    '淮山': '山药', '怀山药': '山药',
    '橘皮': '化橘红', '桔皮': '陈皮',
    '桑葚': '桑椹', '桑果': '桑椹',
    '杭菊': '菊花', '贡菊': '菊花', '滁菊': '菊花', '亳菊': '菊花',
    '忍冬花': '金银花', '双花': '金银花',
    '云苓': '茯苓', '白茯苓': '茯苓',
    '莲肉': '莲子',
    '黑脂麻': '黑芝麻', '胡麻': '黑芝麻',
    '草决明': '决明子',
    '杏仁': '苦杏仁',
    '益智仁': '益智',
    '黄芥子': '芥子', '白芥子': '芥子',
    '藿香': '广藿香',
    '紫苏': '紫苏叶', '苏叶': '紫苏叶',
    '粉葛': '葛根',
    '婆婆丁': '蒲公英',
    '折耳根': '鱼腥草',
    '香茹': '香薷',
}

# 炮制/变体 → 药典首载名。理由：制川乌是川乌的炮制品，瓜蒌子/皮是同一种果实的部位，
# 各家贝母在「反乌头」这件事上结论一致（药典也是逐个点名、同样措辞）。
NORM = {
    '制川乌': '川乌', '制草乌': '草乌',
    '瓜蒌子': '瓜蒌', '瓜蒌皮': '瓜蒌', '瓜蒌仁': '瓜蒌',
    '川贝母': '贝母', '浙贝母': '贝母', '平贝母': '贝母',
    '伊贝母': '贝母', '湖北贝母': '贝母',
    '玄明粉': '芒硝',
    '京大戟': '大戟', '红大戟': '大戟',
    '马钱子粉': '马钱子',
    '姜半夏': '半夏', '法半夏': '半夏', '清半夏': '半夏',
    '焦栀子': '栀子', '炒栀子': '栀子',
    '荆芥炭': '荆芥', '荆芥穗炭': '荆芥穗',
}


def nz(x, items):
    x = x.strip()
    if x in NORM:
        return NORM[x]
    if x.endswith('片') and len(x) > 2 and x[:-1] in items:
        return x[:-1]
    return x


def gen_food(items, path):
    out, miss = {}, []
    for n in dict.fromkeys(FOOD):
        d = items.get(n)
        if not d:
            miss.append(n)
            continue
        out[n] = {k: clean(v) for k, v in d.items() if k != 'page'}
        out[n]['page'] = d['page']

    L = []
    L.append('// 药食同源物品的性味、功效与禁忌。')
    L.append('//')
    L.append('// 全部来源：《中国药典》2025 年版一部，逐条从官方 PDF 抽取，未改写一个字。')
    L.append('// 生成脚本见 tools/build_chp_data.py，可以重跑、可以核对。')
    L.append('//')
    L.append('// 收录范围：卫健委「既是食品又是药品的物品名单」与药典一部收载品种的交集，共 %d 味。' % len(out))
    L.append('// 名单里但药典未收载的（绿豆、白萝卜、梨）不在本表——它们在药典里没有条文，')
    L.append('// 硬写性味就只能靠转述，而转述正是这套数据最不想引入的东西。')
    L.append('//')
    L.append('// 两条使用约束：')
    L.append('//   ① tabi 为空 = **药典没有列【注意】项**，不等于没有禁忌。')
    L.append('//      文案里只能说「药典未列注意事项」，绝不能说「没有禁忌」。')
    L.append('//   ② page 是官方 PDF 的页码，随时可以回查原句。')
    L.append('')
    L.append("export const FOOD_SOURCE = '《中国药典》2025年版一部';")
    L.append('')
    L.append('export const FOODS = {')
    for n, d in out.items():
        L.append('  %s: {' % n)
        for f in ('nature', 'functions', 'dosage', 'tabi'):
            L.append("    %s: '%s'," % (f, d[f].replace("'", "\\'")))
        L.append('    page: %d,' % d['page'])
        L.append('  },')
    L.append('};')
    L.append('')
    L.append('/** 俗称 → 药典正名。只收确定等价的；模棱两可的（如「姜」）一律不收。 */')
    L.append('export const ALIASES = {')
    for a, b in ALIASES.items():
        if b in out:
            L.append("  '%s': '%s'," % (a, b))
    L.append('};')
    L.append('')
    L.append('/** 查一味食材。认不出返回 null，调用方据此说「表里没有」，不猜。 */')
    L.append('export function foodOf(name) {')
    L.append("  const k = String(name || '').trim();")
    L.append('  if (!k) return null;')
    L.append("  const real = Object.prototype.hasOwnProperty.call(FOODS, k) ? k : ALIASES[k];")
    L.append("  if (!real || !Object.prototype.hasOwnProperty.call(FOODS, real)) return null;")
    L.append('  return { name: real, ...FOODS[real] };')
    L.append('}')
    L.append('')
    L.append('/** 表里所有可识别的写法（正名 + 俗称），给词表用。 */')
    L.append('export function foodWords() {')
    L.append('  return [...Object.keys(FOODS), ...Object.keys(ALIASES)];')
    L.append('}')
    L.append('')
    io.open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(L))
    return len(out), miss


def gen_pairs(items, path):
    groups = {}
    for name, v in items.items():
        text = clean(v['tabi'])
        if not text:
            continue
        m = re.search(r'不宜与([^；。]+?)同用', text)
        if not m:
            continue
        for other in re.split(r'[、，]', m.group(1)):
            other = other.strip()
            if not other:
                continue
            a, b = nz(name, items), nz(other, items)
            if a == b:
                continue
            key = '|'.join(sorted([a, b]))
            g = groups.setdefault(key, {'herbs': sorted([a, b]), 'text': text,
                                        'from': a, 'page': v['page'], 'raw': []})
            g['raw'].append([name, other])

    L = []
    L.append('// 药典口径的配伍禁忌：哪两味不宜同用。')
    L.append('//')
    L.append('// 来源：《中国药典》2025 年版一部，逐条从各味药【注意】项里抽出来，')
    L.append('// 每一对都能翻回 PDF 的 page 页对照原句。共 %d 组。' % len(groups))
    L.append('// 生成脚本见 tools/build_chp_data.py。')
    L.append('//')
    L.append('// 为什么要有这一份：十八反、十九畏加在一起是 26 对，而药典写着 %d 组。' % len(groups))
    L.append('// 歌诀是明清人编的口诀，药典是现行国家标准。两者重叠的部分口径一致，')
    L.append('// 药典多出来的那些（党参反藜芦、西洋参反藜芦、三棱畏芒硝）歌诀里根本没有——')
    L.append('// 而党参是日常煲汤最常用的一味参。')
    L.append('//')
    L.append('// 归一化说明：药典把炮制品逐个单列（川乌、制川乌、草乌、制草乌），')
    L.append('// 各家贝母也是逐个点名。这里按「同一味药的不同工序/不同品种」并成一组，')
    L.append('// 但 raw 字段保留药典原文的写法，随时能核对是哪几条并出来的。')
    L.append('')
    L.append("export const PAIR_SOURCE = '《中国药典》2025年版一部';")
    L.append('')
    L.append('export const CANON_PAIRS = {')
    for key in sorted(groups):
        g = groups[key]
        raw = '；'.join('%s×%s' % (x, y) for x, y in g['raw'][:6])
        if len(g['raw']) > 6:
            raw += ' 等 %d 条' % len(g['raw'])
        clause = next((x for x in re.split(r'[；。]', g['text']) if '不宜与' in x), g['text'])
        L.append("  '%s': {" % key)
        L.append("    herbs: ['%s', '%s']," % (g['herbs'][0], g['herbs'][1]))
        L.append("    text: '%s'," % g['text'].replace("'", "\\'"))
        L.append("    clause: '%s'," % clause.strip().replace("'", "\\'"))
        L.append("    from: '%s'," % g['from'])
        L.append('    page: %d,' % g['page'])
        L.append("    raw: '%s'," % raw.replace("'", "\\'"))
        L.append('  },')
    L.append('};')
    L.append('')
    L.append('/**')
    L.append(' * 别名的展开方向：用户/歌诀的说法 → 药典的写法。')
    L.append(' *')
    L.append(' * 不展开就会漏。「乌头反半夏」是最常见的问法之一，而药典里没有「乌头」这一条——')
    L.append(' * 它把川乌、草乌分开写，各自的【注意】里都列着半夏。')
    L.append(' * 同理：歌诀的「朴硝」「牙硝」是药典的芒硝，「牵牛」是牵牛子，')
    L.append(' * 「芍药」分赤芍白芍，「沙参」分南沙参北沙参。')
    L.append(' *')
    L.append(' * 只收确定等价的。像「参」这种能指十几种药材的，一律不收——')
    L.append(' * 展开错了会在两味无关的药上给出禁忌结论，比不答更糟。')
    L.append(' */')
    L.append('const HERB_ALIAS = {')
    for k, vs in [('乌头', ['川乌', '草乌']), ('朴硝', ['芒硝']), ('牙硝', ['芒硝']),
                  ('沙参', ['南沙参', '北沙参']), ('芍药', ['白芍', '赤芍']),
                  ('牵牛', ['牵牛子']), ('二丑', ['牵牛子'])]:
        L.append("  '%s': [%s]," % (k, ', '.join("'%s'" % v for v in vs)))
    L.append('};')
    L.append('')
    L.append('function variants(h) {')
    L.append("  return Object.prototype.hasOwnProperty.call(HERB_ALIAS, h) ? HERB_ALIAS[h] : [h];")
    L.append('}')
    L.append('')
    L.append('/**')
    L.append(' * 查一对药是不是药典列了「不宜同用」。')
    L.append(' *')
    L.append(' * 认不出也不猜：返回 null 表示药典没这两味的记录，')
    L.append(' * 调用方据此说「没查到」，而不是说「可以一起用」——这两句差得很远。')
    L.append(' */')
    L.append('export function canonPair(a, b) {')
    L.append("  const x = String(a || '').trim();")
    L.append("  const y = String(b || '').trim();")
    L.append('  if (!x || !y || x === y) return null;')
    L.append('  // 先按药典写法直接查（最常见的情况），没命中再展开别名。')
    L.append("  const direct = CANON_PAIRS[[x, y].sort().join('|')];")
    L.append('  if (direct) return { ...direct };')
    L.append('  for (const ax of variants(x)) {')
    L.append('    for (const ay of variants(y)) {')
    L.append('      if (ax === ay) continue;')
    L.append("      const hit = CANON_PAIRS[[ax, ay].sort().join('|')];")
    L.append('      if (hit) return { ...hit };')
    L.append('    }')
    L.append('  }')
    L.append('  return null;')
    L.append('}')
    L.append('')
    L.append('/** 药典收载的全部配伍禁忌对，给穷举测试用。 */')
    L.append('export function allCanonPairs() {')
    L.append('  return Object.values(CANON_PAIRS).map((v) => v.herbs.slice());')
    L.append('}')
    L.append('')
    io.open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(L))
    return len(groups)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf', help='《中国药典》2025 年版一部的 PDF 路径')
    ap.add_argument('--work', default='.', help='中间文件放在哪')
    ap.add_argument('--out', default=None, help='adapter 目录，默认脚本上一级的 adapter/')
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = args.out or os.path.join(os.path.dirname(here), 'adapter')
    os.makedirs(args.work, exist_ok=True)

    pages = extract_pages(args.pdf, args.work)
    items = extract_items(pages, args.work)

    n_food, miss = gen_food(items, os.path.join(out_dir, 'food-canon.js'))
    n_pair = gen_pairs(items, os.path.join(out_dir, 'pair-canon.js'))
    print('[3/3] food-canon.js %d 味；pair-canon.js %d 组' % (n_food, n_pair))
    if miss:
        print('  药典未收载（未写入）：', '、'.join(miss))
    print('\n写完请跑：node tests/food.js && node tests/pair.js')


if __name__ == '__main__':
    main()
