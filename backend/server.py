"""
自建视频解析后端 — Playwright 拦截真实视频地址
启动: python server.py
接口: GET /extract?url=<视频链接>
"""

import asyncio
import re
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from playwright.async_api import async_playwright

PARSERS = [
    {"name": "默认A", "url": "https://json.fongmi.cc/web?url="},
    {"name": "虾米解析", "url": "https://jx.xmflv.com/?url="},
    {"name": "冰豆解析", "url": "https://bd.jx.cn/?url="},
    {"name": "playm3u8", "url": "https://www.playm3u8.cn/jiexi.php?url="},
    {"name": "七七云解析", "url": "https://jx.77flv.cc/?url="},
    {"name": "M3U8", "url": "https://jx.m3u8.tv/jiexi/?url="},
    {"name": "Wandhi", "url": "https://jx.wandhi.com?u="},
    {"name": "虾米CC", "url": "https://jx.xmflv.cc/?url="},
    {"name": "XYMP4", "url": "https://jx.xymp4.cc/?url="},
    {"name": "8090G", "url": "https://www.8090g.cn/jiexi/?url="},
    {"name": "盘古解析", "url": "https://www.pangujiexi.com/jiexi/?url="},
    {"name": "Yparse2", "url": "https://yparse.ik9.cc/index.php?url="},
]

browser = None
browser_sem = asyncio.Semaphore(3)  # max concurrent pages

VIDEO_RE = re.compile(r"\.(?:mp4|m3u8|flv|mkv|avi|mov|webm|ts)(?:\?|$)", re.I)


def is_video_url(url: str) -> bool:
    return bool(VIDEO_RE.search(url))


def pick_best(urls: list[str]) -> str | None:
    """优先 mp4，其次 m3u8，最后 ts"""
    if not urls:
        return None
    mp4 = [u for u in urls if ".mp4" in u.lower()]
    if mp4:
        return mp4[0]
    m3u8 = [u for u in urls if ".m3u8" in u.lower()]
    if m3u8:
        return m3u8[0]
    return urls[0]


async def extract_one(browser_instance, parser: dict, video_url: str) -> str | None:
    """用单个解析器尝试提取视频地址"""
    captured: list[str] = []
    page = await browser_instance.new_page()

    async def on_request(request):
        url = request.url
        if is_video_url(url):
            captured.append(url)

    async def on_response(response):
        url = response.url
        if is_video_url(url):
            captured.append(url)

    page.on("request", on_request)
    page.on("response", on_response)

    try:
        target = parser["url"] + video_url
        await page.goto(target, wait_until="domcontentloaded", timeout=15000)
        # 等待播放器加载和重定向完成
        await asyncio.sleep(10)
        # 也检查页面 HTML 中的媒体链接
        content = await page.content()
        for pattern in [r'https?://[^"\'\s]*\.m3u8[^"\'\s]*', r'https?://[^"\'\s]*\.mp4[^"\'\s]*']:
            for m in re.findall(pattern, content):
                if m not in captured:
                    captured.append(m)
    except Exception:
        pass
    finally:
        await page.close()

    return pick_best(captured)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global browser
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--autoplay-policy=no-user-gesture-required",
        ],
    )
    print("[OK] Browser launched")
    yield
    await browser.close()
    await pw.stop()
    print("[OK] Browser closed")


app = FastAPI(title="VIP Video Parser", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/extract")
async def extract(url: str = Query(..., description="视频页面链接")):
    """提取视频真实播放地址"""
    t0 = time.time()
    found: list[str] = []

    async def run_batch(parsers):
        tasks = [extract_one(browser, p, url) for p in parsers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, str) and r:
                found.append(r)

    # 分批并行：每批 3 个解析器，避免资源争抢
    for i in range(0, len(PARSERS), 3):
        if found:
            break  # 已找到就不用继续了
        batch = PARSERS[i : i + 3]
        await run_batch(batch)

    elapsed = round(time.time() - t0, 2)
    if found:
        return JSONResponse({
            "ok": True,
            "url": found[0],
            "all": found,
            "elapsed": elapsed,
        })
    return JSONResponse({
        "ok": False,
        "error": "所有解析器均未提取到视频地址",
        "elapsed": elapsed,
    })


@app.get("/health")
async def health():
    return {"status": "ok", "browser": browser is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8700, reload=False)
