#!/usr/bin/env python3
"""从维基文库《食疗本草》（唐·孟诜）抽「这个东西怎么吃」。

为什么要单独一本：用户问「酸枣仁怎么吃」，本草纲目的附方给的是治病方剂
（「为末，每服二钱」），那是抓药不是做饭。《食疗本草》是专门的食疗专著，
每条就是「某物，怎么弄着吃，吃了有什么用」——薯蓣「熟煮和蜜，或为汤煎，
或为粉，并佳」，这才是用户要的答案。

数据只有 5 万字，200 多条，每条正文按（一）（二）分段，每段一个吃法/功效。
抽取时不改写一个字，只做三件事：拆条、去编辑标记、把性味标注提出来。
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://zh.wikisource.org/wiki/"
TITLE = "食療本草"
CACHE = Path(__file__).resolve().parents[2] / "_gm_cache"
OUT = Path(__file__).resolve().parents[2] / "static" / "data" / "shiliao.json"
PROXY = "http://127.0.0.1:10808"

# 〈寒〉〈温〉这类性味标注：原文写在药名后面
NATURE_RE = re.compile(r"[〈〔（]([^〈〉〔〕（）]{1,6})[〉〕）]")


def fetch() -> str:
    CACHE.mkdir(exist_ok=True)
    cache = CACHE / f"{TITLE}.html"
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


def strip_tags(html: str) -> str:
    t = re.sub(r"<style[\s\S]*?</style>|<script[\s\S]*?</script>", "", html)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", "", t)


def parse(html: str):
    """按条目标题切，取正文分段。标题形如「薯蓣（山药）」「甘菊〈平〉」。"""
    heads = [
        (m.start(), strip_tags(m.group(2)).strip())
        for m in re.finditer(r"<h([23])[^>]*>([\s\S]{1,80}?)</h\1>", html)
    ]
    items = {}
    for idx, (pos, raw_name) in enumerate(heads):
        name = re.sub(r"\[编辑\]", "", raw_name).strip()
        if not name or name in ("目录", "卷上", "卷中", "卷下", "序"):
            continue
        end = heads[idx + 1][0] if idx + 1 < len(heads) else len(html)
        body = strip_tags(html[pos:end])
        body = body.replace("[编辑]", "").replace(name, "", 1)
        # 去掉每条末尾的来源标记（〔证〕〔卷〕〔嘉〕——辑佚出处，不是内容）
        body = re.sub(r"〔[^〕]{0,4}〕", "", body).strip()
        if len(body) < 10:
            continue
        # 药名里的括号是别名（薯蓣（山药）），尖括号是性味（甘菊〈平〉）
        alias = ""
        m = re.search(r"[（(]([^）)]{1,10})[)）]", name)
        if m:
            alias = m.group(1)
        nature = ""
        m = re.search(r"[〈〔]([^〉〕]{1,4})[〉〕]", name)
        if m:
            nature = m.group(1)
        main = re.sub(r"[（(][^）)]{1,10}[)）]", "", name)
        main = re.sub(r"[〈〔][^〉〕]{1,4}[〉〕]", "", main).strip()
        if not main:
            continue
        # 正文按（一）（二）拆段：一段是一个独立的吃法/功效
        paras = re.split(r"[（(][一二三四五六七八九十]+[)）]", body)
        paras = [p.strip("。，；： ") for p in paras if len(p.strip()) >= 8]
        items[main] = {
            "nature": nature,
            "alias": alias,
            "paras": paras,
        }
    return items


def main():
    html = fetch()
    items = parse(html)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"source": "維基文庫《食療本草》（唐·孟詵）", "items": items},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"完成：{len(items)} 条 → {OUT}")
    print(f"总分段：{sum(len(v['paras']) for v in items.values())}")


if __name__ == "__main__":
    main()
