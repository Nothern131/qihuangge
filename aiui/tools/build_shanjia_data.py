#!/usr/bin/env python3
"""从维基文库《山家清供》（宋·林洪）抽「一道菜怎么做」。

为什么补这本：用户要的不是「某味药有什么功效」，是「几样东西怎么配起来做」。
《食疗本草》给的是单味吃法（「熟煮和蜜，或为汤煎」），
《山家清供》给的是一整道菜——主料、配料、下锅顺序，照着能炒出来。

原文形态（碧澗羹）：「芹，楚菜也…二月三月作羹時採之，洗淨，入湯焯過取出，
以苦酒研芝蔴，入鹽少許，與茴香漬之」——先有原料名录，后有做法。

抽取只做三件事：按菜名切条、去编辑标记、把菜名重复的开头削掉。
一个字不改写。
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://zh.wikisource.org/wiki/"
TITLE = "山家清供"
CACHE = Path(__file__).resolve().parents[2] / "_gm_cache"
OUT = Path(__file__).resolve().parents[2] / "static" / "data" / "shanjia.json"
PROXY = "http://127.0.0.1:10808"

# 做法动词：命中才留。没有做法的条目多半是纯议论，对「怎么做」没用。
COOK_RE = re.compile(
    r"煮|煑|蒸|炒|煎|熬|漬|醃|拌|煠|烤|燒|爨|炊|煨|燉|瀹|焯|研|搗|磨|釀|羹|飯|粥|餅|麵|脯|膾"
)


def fetch() -> str:
    CACHE.mkdir(exist_ok=True)
    cache = CACHE / f"b_{TITLE}.html"
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
    heads = [
        (m.start(), strip_tags(m.group(2)).strip())
        for m in re.finditer(r"<h([23])[^>]*>([\s\S]{1,80}?)</h\1>", html)
    ]
    items = {}
    for idx, (pos, name) in enumerate(heads):
        name = name.replace("[编辑]", "").strip()
        if not name or name in ("目录", "目錄") or "卷之" in name:
            continue
        end = heads[idx + 1][0] if idx + 1 < len(heads) else len(html)
        body = strip_tags(html[pos:end]).replace("[编辑]", "")
        # 正文开头常把菜名重说一遍（「青精飯青精飯者」），削掉第一个
        if body.startswith(name):
            body = body[len(name):]
        body = body.strip("。，；： 「」『』\"'“”‘’…、·")
        if len(body) < 20:
            continue
        if not COOK_RE.search(body):
            continue
        items[name] = {"text": body}
    return items


def main():
    html = fetch()
    items = parse(html)
    # 繁体转简体：书里写「雞」「蘆菔」，用户说「鸡」「萝卜」。
    # 只转字面，不改异名——「蘆菔」转出来是「芦菔」，离「萝卜」还差一层，
    # 那层由 recipe.js 的同义词组处理。
    try:
        from opencc import OpenCC
        cc = OpenCC("t2s")
        items = {
            cc.convert(k): {"text": cc.convert(v["text"])}
            for k, v in items.items()
        }
    except ImportError:
        print("警告：没有 opencc，数据保持繁体")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"source": "維基文庫《山家清供》（宋·林洪）", "items": items},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"完成：{len(items)} 道 → {OUT}")


if __name__ == "__main__":
    main()
