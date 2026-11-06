# -*- coding: utf-8 -*-
"""
《本草纲目》谷/菜/果部数据生成器（1.0.5 附方层）。

抓维基文库《本草纲目》穀四+菜三+果六+木四+草十 共 27 卷，
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
    # 1.0.7：补木部与草部。上一版只抓了谷菜果——药膳真正的主力
    #（酸枣仁、柏子仁、茯苓、枸杞、当归、黄芪、人参、甘草）全在木部草部，
    # 导致「我失眠吃什么好」答出酸枣仁却拿不到它的附方。
    ("木之一", "木部"), ("木之二", "木部"), ("木之三", "木部"), ("木之四", "木部"),
    ("草之一", "草部"), ("草之二", "草部"), ("草之三", "草部"), ("草之四", "草部"),
    ("草之五", "草部"), ("草之六", "草部"), ("草之七", "草部"), ("草之八", "草部"),
    ("草之九", "草部"), ("草之十", "草部"),
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
    """按条目切分，条目内按【】段标记抽 气味/主治/附方。

    切分依据要看卷：谷菜果木部的条目是 h3（h2 只有目录之类 2 个），
    草部反过来——药名是 h2，h3 是部位（釋名/集解/根/稍/頭/附方）。
    上一版一律取 h2+h3，导致草部每味药的正文被「根」「稍」「頭」切碎，
    甘草只剩三个字，整味被丢弃——人参黄芪当归全缺，就是这么来的。
    """
    text = strip_tags(html)
    h2 = [(m.start(), re.sub(r"<[^>]+>", "", m.group(1)))
          for m in re.finditer(r"<h2[^>]*>([\s\S]{1,160}?)</h2>", html)]
    h3 = [(m.start(), re.sub(r"<[^>]+>", "", m.group(1)))
          for m in re.finditer(r"<h3[^>]*>([\s\S]{1,160}?)</h3>", html)]
    # 药名级标题：h2 够多就是 h2（草部），否则退到 h3（谷菜果木部）
    heads = h2 if len(h2) >= 5 else h3

    # 草部的段标记两种写法混着来：多数是【氣味】文本，甘草这类写成 <h3>氣味</h3>。
    # 不统一的话甘草取不到气味与附方，整条被判为空丢弃（实测附方 0 条）。
    # 只在药名用 h2 的卷做这个转换——谷菜果木部的 h3 本身就是药名，不能动。
    if heads is h2:
        html = re.sub(r"<h3[^>]*>([^<]{1,12})</h3>",
                      lambda m: f"【{m.group(1).strip()}】", html)
        h2 = [(m.start(), re.sub(r"<[^>]+>", "", m.group(1)))
              for m in re.finditer(r"<h2[^>]*>([\s\S]{1,160}?)</h2>", html)]
        heads = h2

    items = {}
    for idx, (pos, name) in enumerate(heads):
        if name in ("目錄", "目录") or "序" in name[:2]:
            continue
        end = heads[idx + 1][0] if idx + 1 < len(heads) else len(html)
        body = strip_tags(html[pos:end])
        # 繁体段标记 → 统一切分。
        # 记录**每一次**出现而不是第一次：一味药常分根/稍/头几个部位，
        # 每个部位各有【主治】，只取第一次会丢掉大半内容。
        marks = ["【氣味】", "【主治】", "【發明】", "【附方】", "【修治】", "【集解】", "【正誤】"]
        found = []
        for m in marks:
            start = 0
            while True:
                i = body.find(m, start)
                if i < 0:
                    break
                found.append((i, m))
                start = i + len(m)
        found.sort()

        def section_from(mark):
            """取该标记下的全部段（一味药可能分根/稍/头几个部位，各有主治）。"""
            out = []
            for i, m in found:
                if m != mark:
                    continue
                later = [p for p, _ in found if p > i]
                stop = min(later) if later else len(body)
                out.append(body[i + len(mark):stop])
            return "".join(out)

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
