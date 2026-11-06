#!/usr/bin/env python3
"""从《养老奉亲书》下籍抽「调护条目」——不吃药的调理方法。

为什么需要这一层：用户点明目标人群是「工作忙、没条件看医生、想调理让自己
舒服一点的人」。对这类人，只给「吃什么」是不够的——
起居、进食节奏、四时调养，才是他们日常真能改的东西。

卷下（保生调护）正好是这部分：饮食调治、宴处起居、戒忌保护、四时摄养。
其中一句就是这产品的立论依据：
「若有疾患，且先详食医之法，审其疾状，以食疗之。食疗未愈，然后命药，
贵不伤其脏腑也。」

只抽**不含药名**的条目：带人参、半夏、散丸的属于用药，不是调护。
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://zh.wikisource.org/wiki/"
TITLE = "養老奉親書"
CACHE = Path(__file__).resolve().parents[2] / "_gm_cache"
OUT = Path(__file__).resolve().parents[2] / "static" / "data" / "care.json"
PROXY = "http://127.0.0.1:10808"

# 只收这几章：饮食、起居、戒忌、四时摄养。形证脉候/医药扶持偏诊断用药，不收。
WANTED = {
    "饮食调治": "饮食",
    "宴处起居": "起居",
    "戒忌保护": "戒忌",
    "性气好嗜": "情志",
    "春时摄养": "春",
    "夏时摄养": "夏",
    "秋时摄养": "秋",
    "冬时摄养": "冬",
}

# 含这些词说明在讲用药，不是调护
# 剂型词要带上下文：单字「散」会命中「消散」，「汤」会命中「汤水」，
# 「煎」会命中「煎汤」。实测「食后，引行一二百步，令运动消散」就是这样被误杀的——
# 那是全书最好的一条调护（饭后散步），不能因为一个「散」字丢掉。
MED_RE = re.compile(r"人参|半夏|茯苓|黄芪|当归|丸药|散剂|汤药|煎服|煎汤|服之|一服|药一|入药")
# 要有可操作的动作
ACT_RE = re.compile(r"宜|忌|不可|当|须|莫|勿|食|饮|行|步|卧|起|睡|浴|洗|晒|衣|暖|寒|温|热|饱|饥")

# 指令词：调护条目得是「该怎么做」，不是「这事很重要」
ORDER_RE = re.compile(r"宜|忌|不可|不宜|当|须|勿|莫|可|使|令")

# 议论句：讲道理不是给方法（「食者，生民之天，活人之本也」）
DISC_RE = re.compile(r"^(故|是以|所谓|夫|盖|若夫|凡百)|者，.{0,6}也。$|莫不|皆由")

# 宗教、祸福、兵灾、鬼神：不是养生内容，也不能上架
DROP_RE = re.compile(r"佛|僧|杀|精兰|神识|善道|祸福|兵寇|鬼神|祭祀|卜筮|贫富")
# 单独再排三类：酒（不能给忙人推荐喝酒）、寺院、孝道说教（不是方法）
DROP2_RE = re.compile(r"醇酒|饮酒|酒不可|寺院|人子|为人子|孝")


def fetch() -> str:
    CACHE.mkdir(exist_ok=True)
    cache = CACHE / f"c_{TITLE}.html"
    if cache.exists() and cache.stat().st_size > 50000:
        return cache.read_text(encoding="utf-8")
    url = BASE + urllib.parse.quote(TITLE)
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": PROXY, "https": PROXY})
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = opener.open(req, timeout=40).read().decode("utf-8")
    cache.write_text(html, encoding="utf-8")
    return html


def clean(t: str) -> str:
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"\[\d+\]", "", t)
    t = re.sub(r"\s+", "", t)
    return t.strip()


def split_sents(text: str):
    """按句切开，只留 12-60 字、有动作、不含药名的句子。"""
    out = []
    for s in re.split(r"[。；！？]", text):
        s = s.strip("，、： 「」『』（）()")
        if not (12 <= len(s) <= 60):
            continue
        if not ACT_RE.search(s):
            continue
        if not ORDER_RE.search(s):
            continue
        if DISC_RE.search(s):
            continue
        if MED_RE.search(s):
            continue
        if DROP_RE.search(s):
            continue
        if DROP2_RE.search(s):
            continue
        out.append(s + "。")
    return out


def parse(html: str):
    i = html.find('<h2 id="下籍"')
    j = html.find('<h2 id="附篇"')
    body = html[i:j if j > i else len(html)]
    hs = [(m.start(), clean(m.group(1))) for m in
          re.finditer(r"<h3[^>]*>([\s\S]{1,120}?)</h3>", body)]
    items = []
    for idx, (pos, title) in enumerate(hs):
        tag = None
        for k, v in WANTED.items():
            if title.startswith(k):
                tag = v
                break
        if not tag:
            continue
        end = hs[idx + 1][0] if idx + 1 < len(hs) else len(body)
        paras = [clean(p) for p in re.findall(r"<p[^>]*>([\s\S]*?)</p>", body[pos:end])]
        seen = set()
        for p in paras:
            for s in split_sents(p):
                if s in seen:
                    continue
                seen.add(s)
                items.append({"tag": tag, "chapter": title, "text": s})
    return items


def main():
    html = fetch()
    items = parse(html)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"source": "維基文庫《養老奉親書》下籍（宋·陳直）", "items": items},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"完成：{len(items)} 条 → {OUT}")
    tags = {}
    for x in items:
        tags[x["tag"]] = tags.get(x["tag"], 0) + 1
    print("分布：", "、".join(f"{k}{v}" for k, v in tags.items()))


if __name__ == "__main__":
    main()
