#!/usr/bin/env python3
"""
浏览器爬虫 — 从油猴脚本重构的 Python 版
==========================================
原脚本：Tampermonkey 版网页爬虫（作者 setycyas）
重构：CLI + Python 模块，支持本地文件/浏览器双模式

功能：
  - 多 URL 批量爬取
  - 自动提取 wiki 正文（去除导航/侧栏/脚本）
  - 结果保存为 txt/md/json
  - 支持 Playwright 模式绕过 Cloudflare

用法：
  python3 crawler.py scrape url1 url2 ...          # 爬取指定URL
  python3 crawler.py scrape -f urls.txt            # 从文件读取URL列表
  python3 crawler.py scrape --playwright url1      # 浏览器模式（绕Cloudflare）
  python3 crawler.py extract page.html             # 从本地HTML提取正文
"""

import sys
import re
import json
import asyncio
import argparse
from pathlib import Path
from html.parser import HTMLParser
from typing import Optional


# ═══════════════════════════════════════════════
# HTML 正文提取器 — 通用的 wiki 页面清洗
# ═══════════════════════════════════════════════

class WikiContentExtractor(HTMLParser):
    """从 wiki 页面提取正文，跳过导航/脚本/样式"""

    SKIP_TAGS = {"script", "style", "nav", "header", "footer", "noscript", "iframe"}
    BLOCK_TAGS = {"div", "p", "h1", "h2", "h3", "h4", "h5", "h6",
                  "li", "tr", "table", "section", "article", "pre", "blockquote",
                  "ul", "ol", "dl", "dt", "dd", "hr", "br"}

    def __init__(self):
        super().__init__()
        self.text_parts: list[str] = []
        self.skip_depth = 0
        self._last_tag = ""

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
        if tag in self.BLOCK_TAGS and self.skip_depth == 0:
            self.text_parts.append("\n")
        if tag == "br" and self.skip_depth == 0:
            self.text_parts.append("\n")
        self._last_tag = tag

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self.skip_depth > 0:
            self.skip_depth -= 1
        if tag in self.BLOCK_TAGS and self.skip_depth == 0:
            self.text_parts.append("\n")

    def handle_data(self, data):
        if self.skip_depth > 0:
            return
        text = data.strip()
        if text:
            self.text_parts.append(text)
            self.text_parts.append(" ")

    def get_text(self) -> str:
        raw = "".join(self.text_parts)
        # 压缩多个连续换行
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        # 压缩多个空格
        raw = re.sub(r" {2,}", " ", raw)
        return raw.strip()


def extract_text_from_html(html: str) -> str:
    """从 HTML 提取可读文本"""
    extractor = WikiContentExtractor()
    extractor.feed(html)
    return extractor.get_text()


def extract_title_from_html(html: str) -> str:
    """提取页面标题"""
    m = re.search(r"<title>([^<]+)</title>", html, re.I)
    if m:
        title = m.group(1).strip()
        # 去除常见后缀
        for suffix in [" - WIKIWIKI", " - wikiwiki.jp"]:
            title = title.replace(suffix, "")
        return title
    # 尝试 h1
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
    return m.group(1).strip() if m else "(无标题)"


# ═══════════════════════════════════════════════
# 网络请求层 — 支持直接 HTTP 和 Playwright 双模式
# ═══════════════════════════════════════════════

async def fetch_http(url: str) -> tuple[int, str]:
    """直接 HTTP 请求（可能被 Cloudflare 拦截）"""
    import httpx
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,zh-CN;q=0.9,en;q=0.8",
        "Referer": "https://wikiwiki.jp/",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0, headers=headers) as client:
        resp = await client.get(url)
        return resp.status_code, resp.text


async def fetch_playwright(url: str) -> tuple[int, str]:
    """Playwright 浏览器模式 — 绕过 Cloudflare 反爬"""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            html = await page.content()
            status = 200
        except Exception as e:
            html = f"<!-- Error: {e} -->"
            status = 500
        finally:
            await browser.close()
    return status, html


# ═══════════════════════════════════════════════
# 核心爬虫逻辑
# ═══════════════════════════════════════════════

async def scrape_urls(urls: list[str], use_browser: bool = False) -> list[dict]:
    """爬取多个 URL，返回结果列表"""
    results = []
    total = len(urls)
    fetch_func = fetch_playwright if use_browser else fetch_http

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{total}] 请求: {url[:70]}...")

        if url.startswith("file://") or Path(url).exists():
            # 本地文件
            path = url.replace("file://", "")
            html = Path(path).read_text(encoding="utf-8")
            status = 200
        else:
            try:
                status, html = await fetch_func(url)
            except Exception as e:
                print(f"  ✗ 失败: {e}")
                results.append({"url": url, "error": str(e), "title": "", "text": ""})
                continue

        if status != 200 or "Sorry, you have been blocked" in html:
            print(f"  ✗ HTTP {status} / Cloudflare 拦截")
            results.append({"url": url, "error": f"HTTP {status} / blocked", "title": "", "text": ""})
            continue

        title = extract_title_from_html(html)
        text = extract_text_from_html(html)
        print(f"  ✓ {title[:50]} ({len(text)} 字符)")

        results.append({"url": url, "title": title, "text": text, "html_length": len(html)})

    return results


def save_results(results: list[dict], fmt: str = "txt", output: str = "crawl_output") -> str:
    """保存爬取结果到文件"""
    if fmt == "json":
        path = f"{output}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        return path

    elif fmt == "md":
        path = f"{output}.md"
        with open(path, "w", encoding="utf-8") as f:
            for r in results:
                f.write(f"# {r['title']}\n\n")
                f.write(f"> 来源: {r['url']}\n\n")
                if r.get("error"):
                    f.write(f"**错误**: {r['error']}\n\n")
                else:
                    f.write(r["text"])
                f.write("\n\n---\n\n")
        return path

    else:  # txt
        path = f"{output}.txt"
        with open(path, "w", encoding="utf-8") as f:
            for r in results:
                f.write(f"{'═'*60}\n")
                f.write(f"  {r['title']}\n")
                f.write(f"  来源: {r['url']}\n")
                f.write(f"{'═'*60}\n\n")
                if r.get("error"):
                    f.write(f"错误: {r['error']}\n")
                else:
                    f.write(r["text"])
                f.write("\n\n")
        return path


# ═══════════════════════════════════════════════
# CLI 入口
# ═══════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="浏览器爬虫 — Python 版（原油猴脚本重构）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 crawler.py scrape https://example.com/page1 https://example.com/page2
  python3 crawler.py scrape -f urls.txt -o my_output
  python3 crawler.py scrape --playwright https://wikiwiki.jp/vbl/基础知识
  python3 crawler.py extract page.html
  python3 crawler.py extract page.html --format json
        """,
    )

    sub = parser.add_subparsers(dest="command", help="子命令")

    # scrape 命令
    scrape_parser = sub.add_parser("scrape", help="爬取 URL 列表")
    scrape_parser.add_argument("urls", nargs="*", help="要爬取的 URL 列表")
    scrape_parser.add_argument("-f", "--file", help="从文件读取 URL（每行一个）")
    scrape_parser.add_argument("-o", "--output", default="crawl_output", help="输出文件名前缀 (默认: crawl_output)")
    scrape_parser.add_argument("--format", choices=["txt", "md", "json"], default="txt", help="输出格式 (默认: txt)")
    scrape_parser.add_argument("--playwright", action="store_true", help="使用浏览器模式（绕过 Cloudflare）")

    # extract 命令
    extract_parser = sub.add_parser("extract", help="从本地 HTML 文件提取正文")
    extract_parser.add_argument("file", help="HTML 文件路径")
    extract_parser.add_argument("--format", choices=["txt", "md", "json"], default="txt",
                                help="输出格式 (默认: txt)")
    extract_parser.add_argument("-o", "--output", default="extracted", help="输出文件名前缀")

    args = parser.parse_args()

    if args.command == "scrape":
        urls = list(args.urls) if args.urls else []

        if args.file:
            with open(args.file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        urls.append(line)

        if not urls:
            print("错误: 请提供 URL 或用 -f 指定 URL 文件")
            return 1

        print(f"\n  爬取 {len(urls)} 个页面")
        print(f"  模式: {'Playwright 浏览器' if args.playwright else '直接 HTTP'}")
        print(f"  输出: {args.output}.{args.format}\n")

        results = asyncio.run(scrape_urls(urls, use_browser=args.playwright))

        ok = sum(1 for r in results if not r.get("error"))
        path = save_results(results, fmt=args.format, output=args.output)
        print(f"\n  完成: {ok}/{len(urls)} 成功 → {path}")

    elif args.command == "extract":
        html_path = args.file
        if not Path(html_path).exists():
            print(f"错误: 文件不存在: {html_path}")
            return 1

        html = Path(html_path).read_text(encoding="utf-8")
        title = extract_title_from_html(html)
        text = extract_text_from_html(html)

        print(f"\n  文件: {html_path}")
        print(f"  标题: {title}")
        print(f"  正文: {len(text)} 字符\n")

        result = [{"url": f"file://{html_path}", "title": title, "text": text}]
        path = save_results(result, fmt=args.format, output=args.output)
        print(f"  已保存: {path}")

    else:
        parser.print_help()

    return 0


if __name__ == "__main__":
    sys.exit(main())
