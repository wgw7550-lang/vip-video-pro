#!/usr/bin/env python3
"""
TU-破解视频VIP — 从用户脚本分析重构的 CLI 工具
=================================================
功能：
  info <url>    — 分析链接：识别站点、提取标题、查找嵌入式视频
  parse <url>   — 打开浏览器播放（自动选最优解析器）
  list          — 列出支持的 17 个视频平台和 12 个解析接口
  check         — 检测所有解析接口的可用性

原用户脚本：TU-破解视频VIP集合-去广告-音乐直接解析播放
作者：AC | 重构：CLI 版

使用示例：
  python3 cli.py info "https://v.qq.com/x/cover/au757x4acdk6jea.html"
  python3 cli.py parse "https://www.iqiyi.com/v_19rrfq5ajk.html"
  python3 cli.py list
  python3 cli.py check
"""

import sys
import json
import webbrowser
from typing import Optional

from site_config import SITES, PARSER_APIS, detect_site, get_parser_url
from extractor import analyze_url_sync, fetch_page, extract_embedded_videos, extract_title


def cmd_info(url: str) -> int:
    """分析视频 URL"""
    print(f"\n{'═'*50}")
    print(f"  分析: {url}")
    print(f"{'═'*50}\n")

    result = analyze_url_sync(url)

    print(f"  站点识别: {result['site']} ({result.get('site_key', 'N/A')})")
    print(f"  视频标题: {result.get('title', '(未提取到)')}")

    if result.get("error"):
        print(f"  ⚠ 错误: {result['error']}")

    if result.get("embedded_videos"):
        print(f"\n  嵌入视频地址 ({len(result['embedded_videos'])} 个):")
        for v in result["embedded_videos"][:5]:
            print(f"    • {v}")

    print(f"\n  可用解析器 ({len(result.get('parser_urls', []))} 个):")
    for i, p in enumerate(result.get("parser_urls", [])):
        print(f"    [{i}] {p['name']}")

    print()
    return 0


def cmd_parse(url: str, parser_idx: int = 0, open_browser: bool = True) -> int:
    """解析并播放视频"""
    site = detect_site(url)
    site_name = site.name if site else "未知站点"
    parser_name = PARSER_APIS[parser_idx]["name"] if 0 <= parser_idx < len(PARSER_APIS) else "默认"

    print(f"\n  站点: {site_name}")
    print(f"  解析器: {parser_name}")

    # 尝试获取标题
    try:
        import asyncio
        html, _ = asyncio.run(fetch_page(url))
        title = extract_title(html)
        if title:
            print(f"  标题: {title}")
    except Exception:
        pass

    parser_url = get_parser_url(url, parser_idx)
    print(f"  解析地址: {parser_url}")

    if open_browser:
        print(f"\n  正在打开浏览器…")
        webbrowser.open(parser_url)

    return 0


def cmd_list() -> int:
    """列出所有支持的平台和解析器"""
    print(f"\n{'═'*50}")
    print(f"  支持的视频平台 ({len(SITES)} 个)")
    print(f"{'═'*50}\n")

    for key, site in SITES.items():
        source_tag = f" [源: {site.source}]" if site.source else ""
        urls = ", ".join(site.url_patterns[:2])
        print(f"  {site.name:<10}  {key:<12}  {urls}{source_tag}")

    print(f"\n{'═'*50}")
    print(f"  解析接口 ({len(PARSER_APIS)} 个)")
    print(f"{'═'*50}\n")

    for i, parser in enumerate(PARSER_APIS):
        print(f"  [{i}] {parser['name']:<12}  {parser['url']}")

    print()
    return 0


def cmd_check() -> int:
    """检测解析接口可用性"""
    import asyncio
    import httpx

    print(f"\n{'═'*50}")
    print(f"  检测解析接口可用性…")
    print(f"{'═'*50}\n")

    TEST_URL = "https://v.qq.com/x/page/q0390tz0d2o.html"

    async def check_one(client, parser):
        try:
            test_url = parser["url"] + TEST_URL
            resp = await client.get(test_url, timeout=10.0)
            return parser["name"], resp.status_code, None
        except Exception as e:
            return parser["name"], None, str(e)

    async def check_all():
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            tasks = [check_one(client, p) for p in PARSER_APIS]
            return await asyncio.gather(*tasks)

    results = asyncio.run(check_all())
    ok_count = 0

    for name, status, error in results:
        if status and 200 <= status < 400:
            print(f"  ✓ {name:<12}  HTTP {status}")
            ok_count += 1
        elif status:
            print(f"  ✗ {name:<12}  HTTP {status}")
        else:
            print(f"  ✗ {name:<12}  {error[:40]}")

    print(f"\n  结果: {ok_count}/{len(PARSER_APIS)} 可用\n")
    return 0 if ok_count > 0 else 1


def print_help():
    print(__doc__)


# ── CLI 入口 ──────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print_help()
        return 1

    cmd = sys.argv[1].lower()
    args = sys.argv[2:]

    commands = {
        "info": lambda: cmd_info(args[0]) if args else print_help(),
        "parse": lambda: cmd_parse(args[0], int(args[1]) if len(args) > 1 else 0),
        "list": lambda: cmd_list(),
        "check": lambda: cmd_check(),
        "help": lambda: print_help(),
        "-h": lambda: print_help(),
        "--help": lambda: print_help(),
    }

    handler = commands.get(cmd)
    if handler:
        return handler() or 0
    else:
        # 如果直接给了一个 URL，默认执行 info
        if cmd.startswith("http"):
            return cmd_info(cmd)
        print(f"  未知命令: {cmd}")
        print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
