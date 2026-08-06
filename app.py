"""
岐黄阁 · 中医药古籍知识推理系统 — FastAPI 入口
纯前端架构，零 API 调用，所有推理算法本地运行
"""
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="岐黄阁 · 中医药古籍知识推理系统",
    description="古籍分析 · 辨证推理 · 方剂解析 · 本草查询 · 大师蒸馏 · 逆向工程",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")

@app.get("/")
async def root():
    return FileResponse(str(Path(__file__).parent / "index.html"))

@app.get("/architecture.html")
async def architecture():
    return FileResponse(str(Path(__file__).parent / "architecture.html"))

if __name__ == "__main__":
    import uvicorn
    logger.info("启动岐黄阁服务: http://127.0.0.1:8890")
    uvicorn.run("app:app", host="127.0.0.1", port=8892, reload=False)
