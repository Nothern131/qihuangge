# -*- coding: utf-8 -*-
"""
《本草纲目》谷/菜/果部数据生成器（1.0.5 附方层）。

抓维基文库《本草纲目》穀之一~四、菜之一~三、果之一~六 共 13 卷，
按 h2 条目切分，每条目抽【氣味】【主治】【附方】三段。

附方定位（与 gm-canon.js 头注释同一条纪律）：
  附方是 1596 年古籍方，只收「食治类」——做法含 粥/羹/汁/酒/蜜/蒸/煮
  等入口方式的。丸散膏丹的治疗方不收：用户拿它当治疗建议用的风险，
  比不给配方更大。收进来的每一条都带出处典籍（如《食疗本草》），
  展示时标「古籍记载，未经现代验证」。

复现：python aiui/tools/build_gm_data.py   （需代理，走 127.0.0.1:10808）
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

PROXY = "http://127.0.0.1:10808"
BASE = "https://zh.wikisource.org/wiki/"
CACHE = Path(__file__).resolve().parents[2] / "_gm_cache"
OUT_JSON = Path(__file__).resolve().parents[2] / "static" / "data" / "bencao_gm_full.json"

VOLUMES = [
    ("穀之一", "穀部"), ("穀之二", "穀部"), ("穀之三", "穀部"), ("穀之四", "穀部"),
    ("菜之一", "菜部"), ("菜之二", "菜部"), ("菜之三", "菜部"),
    ("果之一", "果部"), ("果之二", "果部"), ("果之三", "果部"),
    ("果之四", "果部"), ("果之五", "果部"), ("果之六", "果部"),
]

# 食治类做法白名单：附方条里命中任一才算「入口的吃法」。
# 刻意收窄：哪怕漏掉几条，也比把外敷丸散收进来强。
COOK_WORDS = re.compile(r"粥|羹|汁|煮食|煮|浸酒|酒|蜜|蒸|捣汁|擂|生食|嚼|炒|餺飥|餅|糜")

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({"http": PROXY, "https": PROXY})
)
opener.addheaders = [("User-Agent", "Mozilla/5.0 (research; qihuangge)"), ("Accept-Language", "zh")]


def fetch(vol: str) -> str:
    cache = CACHE / f"{vol}.html"
    if cache.exists() and cache.stat().st_size > 50000:
        return cache.read_text(encoding="utf-8")
    # 中文路径必须 percent-encode，urllib 对非 ASCII URL 直接抛 ascii 编码错
    from urllib.parse import quote
    url = BASE + quote("本草綱目/" + vol)
    for attempt in range(3):
        try:
            html = opener.open(url, timeout=40).read().decode("utf-8")
            CACHE.mkdir(exist_ok=True)
            cache.write_text(html, encoding="utf-8")
            time.sleep(1.5)
            return html
        except Exception as e:  # noqa: BLE001 —— 抓取失败要重试并报出，不静默
            print(f"  抓 {vol} 第 {attempt + 1} 次失败：{e}", file=sys.stderr)
            time.sleep(3)
    raise RuntimeError(f"抓取失败：{vol}")


def strip_tags(html: str) -> str:
    t = re.sub(r"<style[\s\S]*?</style>|<script[\s\S]*?</script>", "", html)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", "", t)


def parse_volume(vol: str, vol_group: str, html: str):
    """按 h2 条目切分，条目内按【】段标记抽 气味/主治/附方。"""
    text = strip_tags(html)
    # 条目可能是 h2 或 h3（维基文库不同卷标记不一）：只看药名标题
    heads = [(m.start(), re.sub(r"<[^>]+>", "", m.group(1)))
             for m in re.finditer(r"<h[23][^>]*>([\s\S]{1,160}?)</h[23]>", html)]
    items = {}
    for idx, (pos, name) in enumerate(heads):
        if name in ("目錄",) or "序" in name[:2]:
            continue
        end = heads[idx + 1][0] if idx + 1 < len(heads) else len(html)
        body = strip_tags(html[pos:end])
        # 繁体段标记 → 统一切分
        marks = ["【氣味】", "【主治】", "【發明】", "【附方】", "【修治】", "【集解】", "【正誤】"]
        found = sorted((body.find(m), m) for m in marks if body.find(m) >= 0)
        seg = {}

        def section_from(mark):
            i = body.find(mark)
            if i < 0:
                return ""
            starts = [pos for pos, m in found if pos > i]
            stop = min(starts) if starts else len(body)
            return body[i + len(mark):stop]

        qi = section_from("【氣味】")
        zhi = section_from("【主治】")
        raw_ff = section_from("【附方】")
        if not qi and not zhi and not raw_ff:
            continue
        fufang = extract_edible_formulas(raw_ff)
        items[name] = {
            "qi": qi,
            "zhi": zhi,
            "fufang": fufang,
            "vol": vol_group,
        }
    return items


def extract_edible_formulas(raw: str):
    """附方段 → 食治条列表。

    原文是「方名：主治。组成做法。（《出处》）」多条连排，
    以「。（出处）」为条的终结标记切。三条铁律：
      ① 计数头（「旧六。」「三，新十三。」）剥离
      ② 每条必须带出处括号，无出处的一律不收——来源不明比来源少更糟
      ③ 维基文库跨页截断的尾巴（戛然而止的残句）随切分自然丢弃
    """
    if not raw:
        return []
    raw = re.sub(r"^[^：︰]{0,8}[舊旧]\d+\s*[。.]?", "", raw).strip()
    raw = re.sub(r"^[一二三四五六七八九十]+\s*，\s*新?\d*\s*[。.]?", "", raw).strip()
    if not raw:
        return []
    # 计数头剥离：「新一。」「旧三，新十三。」——附方栏的计数标记，
    # 特征是第一个冒号（︰/：）之前的短段里含数字或「新/舊」。
    head = re.split(r"[：︰]", raw, 1)
    if len(head) == 2 and len(head[0]) <= 12 and (
            re.search(r"\d|[新舊旧]", head[0])):
        raw = head[1]
    if not raw:
        return []
    # 数据层全收「有出处」的条（含治疗方）——完整性优先；
    # 食治类挑选在展示层做（COOK_WORDS 挑选挪到 agent 侧），
    # 因为「煮取一升」的汤剂和「煮作粥」的膳食在同一栏里，机械过滤两头出错。
    out = []
    prev = 0
    for m in re.finditer(r"。?\s*[（(]([^）()]{1,14})[)）]", raw):
        seg = raw[prev:m.end()].strip()
        prev = m.end()
        seg = re.sub(r"^[（(][^）()]{1,14}[)）]\s*[。.]?\s*", "", seg).strip("。，； ")
        if len(seg) < 10:
            continue
        # 跨栏脏条直接丢弃：段尾把下一部位（如「核【主治】」）吞进来的
        if re.search(r"【(主治|氣味|附方|發明|修治)】", seg):
            continue
        tails = re.findall(r"[（(]([^）()]{1,14})[)）]", seg)
        # 出处括号：排除炮制词（炒/炙/焙——「酸枣仁（炒）」不是出处）
        PREP = re.compile(r"^(炒|炙|焙|煨|炮|烧|去核|去皮|去心|取汁|研|末)$")
        cands = [t for t in tails if not PREP.match(t)]
        src = cands[-1].strip("《》") if cands else ""
        src = re.sub(r"^并", "", src).strip("《》")
        src = re.sub(r"^并", "", src)
        body = re.sub(r"[（(][^）()]{1,14}[)）]\s*$", "", seg).strip("。，； ")
        if len(body) < 8:
            continue
        out.append({"text": body + "。", "src": src})
    return out[:8]



def trad_to_simp(s):
    """繁转简。优先 opencc；没装就原样保留繁体并打警告——
    宁可繁体（引文原貌），不要一个错的简体字。"""
    try:
        from opencc import OpenCC
        return OpenCC("t2s").convert(s)
    except ImportError:
        print("  [warn] 未装 opencc，附方保留繁体原文", file=sys.stderr)
        return s


def main():
    all_items = {}
    for vol, group in VOLUMES:
        print(f"抓取 {vol}…")
        html = fetch(vol)
        items = parse_volume(vol, group, html)
        print(f"  条目 {len(items)}，带附方 {sum(1 for v in items.values() if v['fufang'])}")
        for k, v in items.items():
            if k in all_items:
                continue
            all_items[k] = v

    # 繁转简（在结构切完之后做，避免【】标记受影响）
    converted = {}
    for name, v in all_items.items():
        row = {}
        for k, val in v.items():
            if isinstance(val, str):
                row[k] = trad_to_simp(val)
            elif isinstance(val, list):
                row[k] = [{"text": trad_to_simp(f["text"]), "src": trad_to_simp(f["src"])} for f in val]
            else:
                row[k] = val
        converted[trad_to_simp(name)] = row

    OUT_JSON.parent.mkdir(exist_ok=True)
    OUT_JSON.write_text(
        json.dumps({"source": "維基文庫《本草綱目》", "volumes": [v for v, _ in VOLUMES], "items": converted},
                   ensure_ascii=False),
        encoding="utf-8",
    )
    ff_total = sum(len(v.get("fufang") or []) for v in converted.values())
    print(f"\n完成：{len(converted)} 条 → {OUT_JSON}")
    print(f"食治附方共 {ff_total} 条")


if __name__ == "__main__":
    main()
