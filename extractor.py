"""
URL 提取引擎 — 从各视频平台的 HTML 页面中提取真实视频地址和标题。
解决原用户脚本依赖浏览器 DOM 的问题，改用 HTTP 请求 + 正则/JSON 提取。
"""

import re
import json
import asyncio
from urllib.parse import urlencode, quote, urlparse, parse_qs
from typing import Optional

import httpx

from site_config import detect_site, SiteConfig, SITES

# 常见 User-Agent，模拟移动端可减少反爬
UA_MOBILE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
)
UA_DESKTOP = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# 视频标题的正则模式（各站略有不同）
TITLE_PATTERNS = [
    r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"',
    r'<meta[^>]+name="twitter:title"[^>]+content="([^"]+)"',
    r'<title>([^<]+)</title>',
    r'"video_title"\s*:\s*"([^"]+)"',
    r'"title"\s*:\s*"([^"]+)"',
]

# 腾讯视频 vid 提取
RE_VQQ_VID = re.compile(r'vid["\s:=]+["\']?(\w+)["\']?', re.I)
RE_VQQ_COVER_VID = re.compile(r'/(\w+)\.html', re.I)

# 页面中嵌入的真实视频 URL
RE_VIDEO_URL = re.compile(
    r'(https?://[^"\'\s]*\.(?:mp4|m3u8|flv|mkv|avi|mov|webm|ts)[^"\'\s)]*)', re.I
)
RE_M3U8 = re.compile(r'(https?://[^"\'\s]*\.m3u8[^"\'\s)]*)', re.I)
RE_MP4 = re.compile(r'(https?://[^"\'\s]*\.mp4[^"\'\s)]*)', re.I)


def extract_title(html: str) -> str:
    """从 HTML 中提取视频标题"""
    for pattern in TITLE_PATTERNS:
        m = re.search(pattern, html)
        if m:
            title = m.group(1).strip()
            # 去除常见后缀
            for suffix in [" - 腾讯视频", " - 爱奇艺", " - 优酷", "_高清在线观看"]:
                title = title.replace(suffix, "")
            return title
    return ""


def extract_embedded_videos(html: str) -> list[str]:
    """从页面 HTML 中提取嵌入的视频地址"""
    videos = []
    for pattern in [RE_MP4, RE_M3U8, RE_VIDEO_URL]:
        for m in pattern.findall(html):
            url = m.strip()
            if url not in videos:
                videos.append(url)
    return videos


def normalize_iqiyi_url(url: str) -> str:
    """爱奇艺 URL 规范化：去除多余参数"""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def extract_vqq_vid(html: str, url: str) -> Optional[str]:
    """从腾讯视频页面提取 vid"""
    # 方法1：页面中 vid 变量
    m = RE_VQQ_VID.search(html)
    if m:
        return m.group(1)
    # 方法2：从 URL 路径提取
    m = RE_VQQ_COVER_VID.search(urlparse(url).path)
    if m:
        return m.group(1)
    return None


async def fetch_page(url: str, mobile: bool = True) -> tuple[str, str]:
    """获取页面 HTML，返回 (html, final_url)"""
    headers = {"User-Agent": UA_MOBILE if mobile else UA_DESKTOP}
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0, headers=headers) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text, str(resp.url)


def build_parser_urls(video_url: str) -> list[dict]:
    """生成所有可用的解析器链接"""
    from site_config import PARSER_APIS
    encoded = quote(video_url, safe="")
    results = []
    for parser in PARSER_APIS:
        results.append({
            "name": parser["name"],
            "url": parser["url"] + encoded,
        })
    return results


async def analyze_url(video_url: str) -> dict:
    """
    综合分析一个视频 URL：
    1. 识别站点
    2. 获取页面标题
    3. 提取嵌入视频地址
    4. 生成所有解析器链接
    """
    site = detect_site(video_url)
    result = {
        "input_url": video_url,
        "site": site.name if site else "未知",
        "site_key": site.key if site else None,
        "title": "",
        "embedded_videos": [],
        "parser_urls": [],
        "normalized_url": video_url,
    }

    # 获取页面
    try:
        html, final_url = await fetch_page(video_url)
        result["final_url"] = final_url

        # 提取标题
        result["title"] = extract_title(html)

        # 提取嵌入视频
        result["embedded_videos"] = extract_embedded_videos(html)

        # 特殊处理腾讯视频
        if site and site.source == "qq":
            vid = extract_vqq_vid(html, video_url)
            if vid:
                result["normalized_url"] = f"https://v.qq.com/x/page/{vid}.html"
                result["site"] = "腾讯视频 (嵌套)"
                result["site_key"] = "v_qq"

    except Exception as e:
        result["error"] = str(e)

    # 生成解析链接
    target = result.get("normalized_url", video_url)
    result["parser_urls"] = build_parser_urls(target)

    return result


# ── 命令行友好的同步封装 ──────────────────────

def analyze_url_sync(video_url: str) -> dict:
    """同步版本的 URL 分析"""
    return asyncio.run(analyze_url(video_url))
