# 岐黄阁 · 古籍知识库导入脚本模板
# 使用方法：将古籍条文整理为如下格式，导入到 static/data/ 目录下
# 每条知识单元包含：古籍来源、原文、关键词、分类标签、辨证结论、关联方剂

import json
import re
from pathlib import Path
from datetime import datetime

# ========== 配置 ==========
OUTPUT_DIR = Path(__file__).parent.parent / "static" / "data"
OUTPUT_FILE = OUTPUT_DIR / "ancient_texts.json"

# ========== 知识单元结构模板 ==========
KNOWLEDGE_UNIT = {
    "id": "huangdi_neijing_001",          # 唯一标识
    "source": "黄帝内经",                  # 古籍来源
    "chapter": "素问·阴阳应象大论",        # 篇目
    "original_text": "阴阳者，天地之道也，万物之纲纪，变化之父母，生杀之本始，神明之府也。",  # 原文
    "keywords": ["阴阳", "天地", "纲纪"],  # 关键词（用于检索）
    "category": "医经",                    # 分类：医经/伤寒/本草/方剂/诊断/温病
    "subject_area": "阴阳理论",            # 主题领域
    "bianzheng_type": None,               # 辨证类型（可选）
    "syndrome_keywords": [],              # 证型关键词
    "formula_keywords": [],               # 关联方剂关键词
    "herb_keywords": [],                  # 关联药物关键词
    "commentary": "阴阳是天地运行的根本规律，万物变化的总纲。",  # 注释
    "confidence": 1.0                     # 可信度（专家标注）
}

# ========== 导入函数 ==========
def load_existing():
    """加载已有知识库"""
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_knowledge(base: list):
    """保存知识库"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(base, f, ensure_ascii=False, indent=2)
    print(f"共保存 {len(base)} 条知识单元到 {OUTPUT_FILE}")

def deduplicate(base: list) -> list:
    """去重（基于 original_text）"""
    seen = set()
    result = []
    for unit in base:
        text = unit.get('original_text', '').strip()
        if text and text not in seen:
            seen.add(text)
            result.append(unit)
    return result

# ========== 示例：黄帝内经条文（首批5条） ==========
HuangdiNeijing_samples = [
    {
        "id": "hn_001",
        "source": "黄帝内经",
        "chapter": "素问·阴阳应象大论",
        "original_text": "阴阳者，天地之道也，万物之纲纪，变化之父母，生杀之本始，神明之府也。",
        "keywords": ["阴阳", "天地", "纲纪"],
        "category": "医经",
        "subject_area": "阴阳理论",
        "bianzheng_type": None,
        "syndrome_keywords": [],
        "formula_keywords": [],
        "herb_keywords": [],
        "commentary": "阴阳是天地运行的根本规律，万物变化的总纲。",
        "confidence": 1.0
    },
    {
        "id": "hn_002",
        "source": "黄帝内经",
        "chapter": "素问·阴阳应象大论",
        "original_text": "阳化气，阴成形。",
        "keywords": ["阳", "阴", "化气", "成形"],
        "category": "医经",
        "subject_area": "阴阳理论",
        "bianzheng_type": None,
        "syndrome_keywords": [],
        "formula_keywords": [],
        "herb_keywords": [],
        "commentary": "阳主气化功能，阴主物质形质。",
        "confidence": 1.0
    },
    {
        "id": "hn_003",
        "source": "黄帝内经",
        "chapter": "素问·热论",
        "original_text": "巨阳者，五脏六腑之主也。伤寒一日，巨阳受之，故头项痛，腰脊强。",
        "keywords": ["太阳", "伤寒", "头项痛", "腰脊强"],
        "category": "伤寒",
        "subject_area": "六经辨证",
        "bianzheng_type": "太阳病",
        "syndrome_keywords": ["太阳经证", "表证"],
        "formula_keywords": ["麻黄汤", "桂枝汤"],
        "herb_keywords": [],
        "commentary": "太阳主一身之表，为诸阳主气。伤寒初起，邪犯太阳，故头项腰脊强痛。",
        "confidence": 1.0
    },
    {
        "id": "hn_004",
        "source": "黄帝内经",
        "chapter": "素问·至真要大论",
        "original_text": "寒者热之，热者寒之，温者清之，清者温之，散者收之，抑者散之，燥者润之，急者缓之，坚者软之，脆者坚之，衰者补之，强者泻之。",
        "keywords": ["寒热", "虚实", "治则"],
        "category": "医经",
        "subject_area": "治疗原则",
        "bianzheng_type": None,
        "syndrome_keywords": [],
        "formula_keywords": [],
        "herb_keywords": [],
        "commentary": "此为大法，治病当审其寒热虚实，随证施治。",
        "confidence": 1.0
    },
    {
        "id": "hn_005",
        "source": "黄帝内经",
        "chapter": "素问·灵兰秘典论",
        "original_text": "心者，君主之官也，神明出焉。肺者，相傅之官，治节出焉。肝者，将军之官，谋虑出焉。胆者，中正之官，决断出焉。",
        "keywords": ["心", "肺", "肝", "胆", "脏腑"],
        "category": "医经",
        "subject_area": "脏腑理论",
        "bianzheng_type": None,
        "syndrome_keywords": [],
        "formula_keywords": [],
        "herb_keywords": [],
        "commentary": "十二官各有其职，心为君主，统摄诸脏。",
        "confidence": 1.0
    }
]

# ========== 示例：伤寒论条文（首批5条） ==========
Shanghan_samples = [
    {
        "id": "sh_001",
        "source": "伤寒论",
        "chapter": "辨太阳病脉证并治上",
        "original_text": "太阳之为病，脉浮，头项强痛而恶寒。",
        "keywords": ["太阳", "脉浮", "头项强痛", "恶寒"],
        "category": "伤寒",
        "subject_area": "六经辨证",
        "bianzheng_type": "太阳病",
        "syndrome_keywords": ["太阳经证", "表证"],
        "formula_keywords": ["麻黄汤", "桂枝汤"],
        "herb_keywords": [],
        "commentary": "太阳病提纲证。太阳主表，外邪侵袭，卫阳抗邪，故脉浮、头项强痛、恶寒并见。",
        "confidence": 1.0
    },
    {
        "id": "sh_002",
        "source": "伤寒论",
        "chapter": "辨太阳病脉证并治上",
        "original_text": "太阳病，发热，汗出，恶风，脉缓者，名为中风。",
        "keywords": ["太阳", "发热", "汗出", "恶风", "中风"],
        "category": "伤寒",
        "subject_area": "六经辨证",
        "bianzheng_type": "太阳中风",
        "syndrome_keywords": ["太阳表虚证"],
        "formula_keywords": ["桂枝汤"],
        "herb_keywords": [],
        "commentary": "太阳中风证，营卫不和，卫强营弱。",
        "confidence": 1.0
    },
    {
        "id": "sh_003",
        "source": "伤寒论",
        "chapter": "辨太阳病脉证并治中",
        "original_text": "太阳病，头痛，发热，汗出，恶风，桂枝汤主之。",
        "keywords": ["太阳", "头痛", "发热", "桂枝汤"],
        "category": "伤寒",
        "subject_area": "方证对应",
        "bianzheng_type": "太阳中风",
        "syndrome_keywords": ["太阳表虚证"],
        "formula_keywords": ["桂枝汤"],
        "herb_keywords": ["桂枝", "白芍", "生姜", "大枣", "甘草"],
        "commentary": "桂枝汤为群方之祖，主治太阳中风表虚证。",
        "confidence": 1.0
    },
    {
        "id": "sh_004",
        "source": "伤寒论",
        "chapter": "辨太阳病脉证并治中",
        "original_text": "太阳病，项背强几几，无汗恶风，葛根汤主之。",
        "keywords": ["太阳", "项背强", "无汗", "葛根汤"],
        "category": "伤寒",
        "subject_area": "方证对应",
        "bianzheng_type": "太阳伤寒兼经输不利",
        "syndrome_keywords": ["太阳伤寒证"],
        "formula_keywords": ["葛根汤"],
        "herb_keywords": ["葛根", "麻黄", "桂枝", "白芍", "生姜", "大枣", "甘草"],
        "commentary": "太阳伤寒，经气不利，项背强几几，葛根汤主之。",
        "confidence": 1.0
    },
    {
        "id": "sh_005",
        "source": "伤寒论",
        "chapter": "辨少阳病脉证并治",
        "original_text": "少阳之为病，口苦，咽干，目眩也。",
        "keywords": ["少阳", "口苦", "咽干", "目眩"],
        "category": "伤寒",
        "subject_area": "六经辨证",
        "bianzheng_type": "少阳病",
        "syndrome_keywords": ["少阳证"],
        "formula_keywords": ["小柴胡汤"],
        "herb_keywords": [],
        "commentary": "少阳病提纲证。少阳胆火上炎，故口苦咽干目眩。",
        "confidence": 1.0
    }
]

# ========== 主程序 ==========
def main():
    base = load_existing()
    print(f"已有 {len(base)} 条知识单元")

    # 添加样本数据（实际使用时替换为完整数据）
    base.extend(HuangdiNeijing_samples)
    base.extend(Shanghan_samples)

    # 去重
    base = deduplicate(base)

    # 保存
    save_knowledge(base)

    # 统计
    cats = {}
    for unit in base:
        cat = unit.get('category', '未知')
        cats[cat] = cats.get(cat, 0) + 1
    print("\n分类统计：")
    for cat, count in sorted(cats.items()):
        print(f"  {cat}: {count}条")

if __name__ == '__main__':
    main()
