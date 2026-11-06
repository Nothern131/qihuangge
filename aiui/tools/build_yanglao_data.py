#!/usr/bin/env python3
"""从维基文库《养老奉亲书》（宋·陈直）抽「按病分类的药膳方」。

为什么补这本：前面三本各管一段——
  本草纲目 → 某味药有什么附方（多是治病方剂）
  食疗本草 → 某味东西怎么吃（单味）
  山家清供 → 一道菜怎么做（山野素食）
没有一本回答「我脾胃弱，有什么方子」。

《养老奉亲书》上籍 16 章全部按病分类：食治老人脾胃气弱方、泻痢方、
喘嗽方、眼目方、耳聋耳鸣方…每章下面是完整方：
  【方名】法制猪肚方  【主治】食治老人补虚羸、乏气力
  【原料】猪肚二枚 人参半两 干姜二钱 椒二钱 葱白七茎 糯米二合
  【做法】上件捣为末，入米合和相得，入猪肚内，缝合，以水五升微火煮令烂熟

原文的 HTML 结构是：h3 章标题 + 若干 <p>，方名在 <p><b>里。
抽取只按结构切分，不改写一个字。
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://zh.wikisource.org/wiki/"
TITLE = "養老奉親書"
CACHE = Path(__file__).resolve().parents[2] / "_gm_cache"
OUT = Path(__file__).resolve().parents[2] / "static" / "data" / "yanglao.json"
PROXY = "http://127.0.0.1:10808"

# 方名后缀：古籍方名多以「方/散/羹/粥/酒/煎/饼/馄饨/索饼」结尾
NAME_TAIL = r"(?:方|散|羹|粥|酒|煎|饼|餠|馄饨|索饼|汤|丸|膏|饮|脯|面|麵)"


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
    t = re.sub(r"\[\d+\]", "", t)          # 编辑链接残留
    t = re.sub(r"\s+", "", t)
    return t.strip()


def parse(html: str):
    """按 h3 切章，章内按 <p><b>方名</b> 切方。"""
    # 只取正文：从第一个「上籍」正文锚点之后开始，避开目录和导航
    body_start = html.find('<h2 id="上籍"')
    if body_start < 0:
        body_start = 0
    body_end = html.find('<h2 id="下籍"')
    if body_end < 0:
        body_end = len(html)
    body = html[body_start:body_end]

    # 章：h3 标题
    chapters = [(m.start(), clean(m.group(1)))
                for m in re.finditer(r"<h3[^>]*>([\s\S]{1,200}?)</h3>", body)]
    # h3 里常包一层 <span>，clean 之后就是章名
    items = []
    for idx, (pos, title) in enumerate(chapters):
        if "食治" not in title:
            continue
        end = chapters[idx + 1][0] if idx + 1 < len(chapters) else len(body)
        chunk = body[pos:end]
        # 段落切分：每个 <p> 一段
        paras = [clean(p) for p in re.findall(r"<p[^>]*>([\s\S]*?)</p>", chunk)]
        paras = [p for p in paras if p]
        # 章名去掉编号后缀「第X」之外的「方第N」，留病类名
        cat = re.sub(r"[（(]?第[一二三四五六七八九十]+[)）]?$", "", title)
        cat = cat.replace("食治老人", "").replace("食治养老", "").replace("食治", "")
        cat = re.sub(r"诸?方$", "", cat).strip() or title

        cur = None
        for p in paras:
            if p.startswith("【"):
                continue
            # 方名段：短、以方字类词结尾、后面常跟主治
            m = re.match(rf"^([\u4e00-\u9fa5]{{2,12}}{NAME_TAIL})(.*)$", p)
            if m and len(m.group(1)) <= 12:
                if cur:
                    items.append(cur)
                cur = {
                    "category": cat,
                    "name": m.group(1),
                    "effect": m.group(2).strip("。，、； "),
                    "ingredients": "",
                    "method": "",
                }
                continue
            if not cur:
                continue
            if not cur["ingredients"] and re.search(r"[（(][^）)]*[）)]", p):
                cur["ingredients"] = p
                continue
            if not cur["method"]:
                cur["method"] = p
                continue
        if cur:
            items.append(cur)

    # 只留信息完整的：有原料、有做法
    items = [x for x in items if x["ingredients"] and x["method"] and len(x["method"]) >= 8]
    return items


def main():
    html = fetch()
    items = parse(html)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"source": "維基文庫《養老奉親書》（宋·陳直）", "items": items},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"完成：{len(items)} 方 → {OUT}")
    cats = {}
    for x in items:
        cats[x["category"]] = cats.get(x["category"], 0) + 1
    print("病类分布：", "、".join(f"{k}{v}" for k, v in cats.items()))


if __name__ == "__main__":
    main()
