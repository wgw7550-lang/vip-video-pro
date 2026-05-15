"""
站点配置模块 — 从 TU-破解视频VIP 用户脚本提取的 17 个视频平台映射。
每个站点定义：名称、域名匹配规则、URL 提取策略、支持的解析器类型。
"""

from dataclasses import dataclass, field
from typing import Optional

@dataclass
class SiteConfig:
    """单个视频站点的配置"""
    key: str                           # 配置键名
    name: str                          # 中文名称
    host_pattern: str                  # 域名匹配（用于识别站点）
    url_patterns: list[str] = field(default_factory=list)  # URL 正则匹配
    source: Optional[str] = None       # 特殊来源处理（如 "qq" 表示嵌套腾讯视频）


# 17 个视频平台完整配置
SITES: dict[str, SiteConfig] = {
    "iqiyi": SiteConfig(
        key="iqiyi",
        name="爱奇艺",
        host_pattern="iqiyi.com",
        url_patterns=[r"/v_\w+\.html", r"/w_\w+\.html"],
    ),
    "youku": SiteConfig(
        key="youku",
        name="优酷视频",
        host_pattern="youku.com",
        url_patterns=[r"/v_show/id_\w+==\.html"],
    ),
    "le": SiteConfig(
        key="le",
        name="乐视TV",
        host_pattern="le.com",
        url_patterns=[r"/ptv/vplay/\d+\.html"],
    ),
    "v_qq": SiteConfig(
        key="v_qq",
        name="腾讯视频",
        host_pattern="v.qq.com",
        url_patterns=[r"/x/page/\w+\.html", r"/x/cover/\w+\.html"],
    ),
    "tudou": SiteConfig(
        key="tudou",
        name="土豆视频",
        host_pattern="video.tudou.com",
        url_patterns=[r"/v/\w+==\.html"],
    ),
    "mgtv": SiteConfig(
        key="mgtv",
        name="芒果TV",
        host_pattern="mgtv.com",
        url_patterns=[r"/b/\d+/\d+\.html"],
    ),
    "sohu": SiteConfig(
        key="sohu",
        name="搜狐视频",
        host_pattern=("tv.sohu.com", "film.sohu.com"),
        url_patterns=[r"/v/\w+==\.shtml", r"/album/\d+\.html"],
    ),
    "bilibili": SiteConfig(
        key="bilibili",
        name="哔哩哔哩",
        host_pattern="bilibili.com",
        url_patterns=[r"/bangumi/play/ep\d+", r"/video/BV\w+"],
    ),
    "pptv": SiteConfig(
        key="pptv",
        name="PPTV",
        host_pattern="pptv.com",
        url_patterns=[r"/show/\w+\.html"],
    ),
    "yinyuetai": SiteConfig(
        key="yinyuetai",
        name="音悦台",
        host_pattern="yinyuetai.com",
        url_patterns=[r"/video/\d+"],
    ),
    "wasu": SiteConfig(
        key="wasu",
        name="华数TV",
        host_pattern="wasu.cn",
        url_patterns=[r"/Play/show/id/\d+"],
    ),
    "1905": SiteConfig(
        key="1905",
        name="1905电影网",
        host_pattern="1905.com",
        url_patterns=[r"/play/\w+\.html"],
    ),
    "feixiong": SiteConfig(
        key="feixiong",
        name="飞熊视频",
        host_pattern="51lol.feixiong.tv",
        url_patterns=[r"/Video/play/id/\d+"],
        source="qq",
    ),
    "lolfun": SiteConfig(
        key="lolfun",
        name="暴龙电竞",
        host_pattern="lolfun.cn",
        url_patterns=[r"/video/video\.html\?id=\d+"],
        source="qq",
    ),
    "lolshipin": SiteConfig(
        key="lolshipin",
        name="木木不哭",
        host_pattern="lolshipin.com",
        url_patterns=[r"/\d+/\d+\.html"],
        source="qq",
    ),
    "lol_qq": SiteConfig(
        key="lol_qq",
        name="腾讯LOL视频",
        host_pattern="lol.qq.com",
        url_patterns=[r"/v/detail\.shtml\?id=\d+"],
        source="qq",
    ),
}


# 精选第三方解析接口（持续更新中）
PARSER_APIS = [
    {"name": "虾米解析",      "url": "https://jx.xmflv.com/?url="},
    {"name": "冰豆解析",      "url": "https://bd.jx.cn/?url="},
    {"name": "M3U8",          "url": "https://jx.m3u8.tv/jiexi/?url="},
    {"name": "Wandhi",        "url": "https://jx.wandhi.com?u="},
    {"name": "七七云解析",    "url": "https://jx.77flv.cc/?url="},
    {"name": "playm3u8",      "url": "https://www.playm3u8.cn/jiexi.php?url="},
    {"name": "虾米CC",        "url": "https://jx.xmflv.cc/?url="},
    {"name": "XYMP4",         "url": "https://jx.xymp4.cc/?url="},
    {"name": "8090G",         "url": "https://www.8090g.cn/jiexi/?url="},
    {"name": "盘古解析",      "url": "https://www.pangujiexi.com/jiexi/?url="},
    {"name": "Yparse2",       "url": "https://yparse.ik9.cc/index.php?url="},
    {"name": "JSON解析",      "url": "https://json.fongmi.cc/web?url="},
]


def detect_site(url: str) -> Optional[SiteConfig]:
    """根据 URL 自动识别视频平台"""
    from urllib.parse import urlparse
    host = urlparse(url).netloc.lower()

    for site in SITES.values():
        patterns = site.host_pattern
        if isinstance(patterns, str):
            patterns = (patterns,)
        for p in patterns:
            if p in host:
                return site
    return None


def get_parser_url(video_url: str, parser_index: int = 0) -> str:
    """生成解析链接：解析器地址 + 编码后的视频 URL"""
    from urllib.parse import quote
    if 0 <= parser_index < len(PARSER_APIS):
        return PARSER_APIS[parser_index]["url"] + quote(video_url, safe="")
    return PARSER_APIS[0]["url"] + quote(video_url, safe="")
