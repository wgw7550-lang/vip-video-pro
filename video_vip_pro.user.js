// ==UserScript==
// @name              VIP视频破解 Pro
// @namespace         video_vip_pro
// @version           4.0.0
// @description       全网VIP视频免费破解 - Pro增强版：智能解析器排名、自动故障转移、移动端优化、内置广告拦截
// @icon              https://cdn.jsdmirror.com/gh/88lin/picx-images-hosting@master/favicon.67xwxgc03y.svg
// @author            茉灵智库 Pro Enhanced
// @include           *://v.qq.com/x/page/*
// @include           *://v.qq.com/x/cover/*
// @include           *://v.qq.com/tv/*
// @include           *://*.iqiyi.com/v_*
// @include           *://*.iqiyi.com/a_*
// @include           *://*.iqiyi.com/w_*
// @include           *://*.iq.com/play/*
// @include           *://*.youku.com/v_*
// @include           *://*.youku.com/video*
// @include           *://*.youku.com/*?vid=*
// @include           *://*.mgtv.com/b/*
// @include           *://*.tudou.com/v_*
// @include           *://tv.sohu.com/v/*
// @include           *://*.bilibili.com/video/*
// @include           *://*.bilibili.com/bangumi/play/*
// @include           *://v.pptv.com/show/*
// @include           *://vip.pptv.com/show/*
// @include           *://www.wasu.cn/Play/show/*
// @include           *://*.le.com/ptv/vplay/*
// @include           *://*.acfun.cn/v/*
// @include           *://*.acfun.cn/bangumi/*
// @include           *://*.1905.com/play/*
// @include           *://m.v.qq.com/x/m/*
// @include           *://m.v.qq.com/*
// @include           *://m.iqiyi.com/*
// @include           *://m.iqiyi.com/v_*
// @include           *://m.youku.com/video/*
// @include           *://m.youku.com/alipay_*
// @include           *://m.mgtv.com/b/*
// @include           *://m.tv.sohu.com/v/*
// @include           *://m.tv.sohu.com/album/*
// @include           *://m.pptv.com/show/*
// @include           *://m.bilibili.com/anime/*
// @include           *://m.bilibili.com/video/*
// @include           *://m.bilibili.com/bangumi/play/*
// @connect           cdn.jsdmirror.com
// @connect           raw.githubusercontent.com
// @grant             unsafeWindow
// @grant             GM_addStyle
// @grant             GM_openInTab
// @grant             GM_getValue
// @grant             GM_setValue
// @grant             GM_xmlhttpRequest
// @grant             GM_deleteValue
// @charset           UTF-8
// @license           GPL License
// @downloadURL       https://cdn.jsdmirror.com/gh/88lin/video_vip@main/video_vip.user.js
// @updateURL         https://cdn.jsdmirror.com/gh/88lin/video_vip@main/video_vip.user.js
// ==/UserScript==

/* ───────────────────────────────────────────
   VIP视频破解 Pro v4.0.0
   增强特性：
   1. 解析器健康评分 — 自动排序，优先生存解析器
   2. 智能故障转移 — 解析失败自动尝试下一个
   3. 移动端底部弹出面板 — 拇指操作优化
   4. 通用广告拦截 — CSS规则 + DOM监控
   5. 远程解析器列表更新 — 免升级获取新解析源
   6. 零外部依赖 — 纯原生JS，无jQuery，无innerHTML
   ─────────────────────────────────────────── */

;(function () {
    'use strict';

    // ── 常量 ─────────────────────────────────
    var NS = 'vvp_';
    var BOX_ID = 'vvp_box_' + Math.ceil(Math.random() * 1e8);
    var IFRAME_CLASS = 'vvp_iframe_wrapper';
    var REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/88lin/video_vip/main/parsers.json';
    var PRELOAD_COUNT = 3;
    var IS_MOBILE = /(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini)/i.test(navigator.userAgent);

    // ── 解析器列表 ───────────────────────────
    var BUILTIN_PARSERS = [
        { name: '默认A',      url: 'https://json.fongmi.cc/web?url=' },
        { name: '默认B',      url: 'https://super.playr.top/?url=' },
        { name: 'CK解析',     url: 'https://www.ckplayer.vip/jiexi/?url=' },
        { name: 'Player-JY',  url: 'https://jx.playerjy.com/?url=' },
        { name: '虾米解析',   url: 'https://jx.xmflv.com/?url=' },
        { name: '789解析',    url: 'https://jiexi.789jiexi.icu:4433/?url=' },
        { name: 'HLS解析',    url: 'https://jx.hls.one/?url=' },
        { name: '极速解析',   url: 'https://jx.2s0.cn/player/?url=' },
        { name: '冰豆解析',   url: 'https://bd.jx.cn/?url=' },
        { name: '剖元解析',   url: 'https://www.pouyun.com/?url=' },
        { name: '973解析',    url: 'https://jx.973973.xyz/?url=' },
        { name: '七哥解析',   url: 'https://jx.nnxv.cn/tv.php?url=' },
        { name: 'playm3u8',   url: 'https://www.playm3u8.cn/jiexi.php?url=' },
        { name: '937解析',    url: 'https://bfq.937auth.vip?url=' },
        { name: '七七云解析', url: 'https://jx.77flv.cc/?url=' },
        { name: '芒果TV1',    url: 'https://video.isyour.love/player/getplayer?url=' },
        { name: 'M1907',      url: 'https://im1907.top/?jx=' },
        { name: 'Yparse',     url: 'https://jx.yparse.com/index.php?url=' },
    ];

    // ── 站点播放器容器配置 ────────────────────
    var PLAYER_CONTAINERS = [
        {
            host: 'v.qq.com',
            container: '#mod_player,#player-container,.container-player',
            displayNodes: ['#mask_layer', '.mod_vip_popup', '.panel-tip-pay'],
        },
        {
            host: 'm.v.qq.com',
            container: '.mod_player,#player',
            displayNodes: [
                '.mod_vip_popup', '[class^=app_]', '[class^=app-]', '[class*=_app_]',
                '[class*=-app-]', '[class$=_app]', '[class$=-app]',
                'div[dt-eid=open_app_bottom]', 'div.video_function.video_function_new',
                'a[open-app]', 'section.mod_source',
                'section.mod_box.mod_sideslip_h', 'section.mod_sideslip_privileges',
                'section.mod_game_rec',
            ],
        },
        { host: 'w.mgtv.com', container: '#mgtv-player-wrap', displayNodes: [] },
        { host: 'www.mgtv.com', container: '#mgtv-player-wrap', displayNodes: [] },
        {
            host: 'm.mgtv.com',
            container: '.video-area',
            displayNodes: [
                'div.adFixedContain', 'div.ad-banner', 'div.m-list-graphicxcy.fstp-mark',
                'div[class^=mg-app]', 'div#comment-id.video-comment div.ft',
                'div.bd.clearfix', 'div.v-follower-info',
                'div.ht.mgui-btn.mgui-btn-nowelt', 'div.personal', 'div[data-v-41c9a64e]',
            ],
        },
        {
            host: 'www.bilibili.com',
            container: '#player_module,#bilibiliPlayer,#bilibili-player',
            displayNodes: [],
        },
        {
            host: 'm.bilibili.com',
            container: '.player-wrapper,.player-container,.mplayer',
            displayNodes: [],
        },
        {
            host: 'www.iqiyi.com',
            container: '#areaLeftContainer,#outlayer,.iqp-player-videolayer',
            displayNodes: [
                '#playerPopup', '#vipCoversBox', 'div.iqp-player-vipmask',
                'div.iqp-player-paymask', 'div.iqp-player-loginmask',
                'div[class^=qy-header-login-pop]', '.covers_cloudCover__ILy8R',
                '#videoContent > div.loading_loading__vzq4j', '.iqp-player-guide',
            ],
        },
        {
            host: 'm.iqiyi.com',
            container: '.m-video-player-wrap,.iqp-player-videolayer',
            displayNodes: [
                'div.m-iqyGuide-layer', 'a[down-app-android-url]',
                'div.iqp-player-vipmask', '.loading_loading__vzq4j',
                '[name=m-extendBar]', '[class*=ChannelHomeBanner]', 'section.m-hotWords-bottom',
            ],
        },
        { host: 'www.iq.com', container: '.intl-video-wrap', displayNodes: [] },
        {
            host: 'v.youku.com',
            container: '.player-container,#ykPlayer,#playerMouseWheel',
            displayNodes: [
                '#iframaWrapper', '#video_side_cashier',
                '.secondary-container.video_side_cashier_wrapper', '#youku-dashboard',
            ],
        },
        { host: 'm.youku.com', container: '#playerMouseWheel,.h5-detail-player', displayNodes: [] },
        { host: 'tv.sohu.com', container: '#player', displayNodes: [] },
        { host: 'film.sohu.com', container: '#playerWrap', displayNodes: [] },
        { host: 'www.le.com', container: '#le_playbox', displayNodes: [] },
        { host: 'video.tudou.com', container: '.td-playbox', displayNodes: [] },
        { host: 'v.pptv.com', container: '#pptv_playpage_box', displayNodes: [] },
        { host: 'vip.pptv.com', container: '.w-video', displayNodes: [] },
        { host: 'www.wasu.cn', container: '#flashContent', displayNodes: [] },
        { host: 'www.acfun.cn', container: '#player', displayNodes: [] },
        { host: 'vip.1905.com', container: '#player,#vodPlayer', displayNodes: [] },
        { host: 'www.1905.com', container: '#player,#vodPlayer', displayNodes: [] },
    ];

    // ── 通用广告选择器 ───────────────────────
    var AD_SELECTORS = [
        '[id*="ad-"]', '[id*="-ad"]', '[id*="_ad"]', '[id*="ad_"]',
        '[class*="ad-"]', '[class*="-ad"]', '[class*="_ad"]', '[class*="ad_"]',
        '[id*="Ad"]', '[class*="Ad"]',
        '.advertisement', '.advert', '.banner-ad',
        '[class*="vip-popup"]', '[class*="vip-mask"]', '[class*="pay-mask"]',
        '[class*="login-mask"]', '[class*="login-pop"]',
        '.mod_vip_popup', '.panel-tip-pay',
        'a[open-app]', 'div[dt-eid=open_app_bottom]',
    ];

    // ── 状态管理 ─────────────────────────────
    var state = {
        currentPlayerNode: null,
        parsers: [],
        activeParserIdx: -1,
        preloadedIframes: {},
        cleanupTimer: null,
        healthScores: {},
        iframeVisible: false,
    };

    // ╔══════════════════════════════════════════╗
    // ║  DOM 工具函数 (零 innerHTML)             ║
    // ╚══════════════════════════════════════════╝

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

    /** 创建元素: el('div', {class:'x', id:'y'}, 'text', childEl) */
    function el(tag, attrs) {
        var elem = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (k === 'class') { elem.className = attrs[k]; }
                else if (k === 'style') { setStyles(elem, attrs[k]); }
                else { elem.setAttribute(k, attrs[k]); }
            });
        }
        // 剩余参数: 文本或子元素
        for (var i = 2; i < arguments.length; i++) {
            var arg = arguments[i];
            if (!arg && arg !== 0) continue;
            if (typeof arg === 'string' || typeof arg === 'number') {
                elem.appendChild(document.createTextNode(String(arg)));
            } else if (arg.nodeType) {
                elem.appendChild(arg);
            }
        }
        return elem;
    }

    function setStyles(elem, styles) {
        Object.keys(styles).forEach(function (k) { elem.style[k] = styles[k]; });
    }

    function on(el, evt, fn) { el.addEventListener(evt, fn); }

    function waitForElement(selector, timeout) {
        timeout = timeout || 60000;
        return new Promise(function (resolve, reject) {
            var found = $(selector);
            if (found) return resolve(found);
            var tries = 0;
            var maxTries = Math.ceil(timeout / 300);
            var timer = setInterval(function () {
                found = $(selector);
                if (found) { clearInterval(timer); resolve(found); }
                if (++tries >= maxTries) { clearInterval(timer); reject(new Error('Element not found: ' + selector)); }
            }, 300);
        });
    }

    // ╔══════════════════════════════════════════╗
    // ║  解析器健康评分系统                      ║
    // ╚══════════════════════════════════════════╝

    var HealthManager = {
        SCORE_KEY: NS + 'health_scores',

        init: function () {
            try {
                state.healthScores = JSON.parse(GM_getValue(this.SCORE_KEY, '{}'));
            } catch (e) {
                state.healthScores = {};
            }
            BUILTIN_PARSERS.forEach(function (p) {
                if (!(p.url in state.healthScores)) {
                    state.healthScores[p.url] = { score: 100, success: 0, fail: 0 };
                }
            });
        },

        save: function () {
            GM_setValue(this.SCORE_KEY, JSON.stringify(state.healthScores));
        },

        recordSuccess: function (url) {
            var entry = state.healthScores[url];
            if (!entry) return;
            entry.success += 1;
            entry.score = Math.min(1000, entry.score + 15);
            this.save();
        },

        recordFail: function (url) {
            var entry = state.healthScores[url];
            if (!entry) return;
            entry.fail += 1;
            entry.score = Math.max(0, entry.score - 25);
            this.save();
        },

        getBestParserIndex: function (parsers) {
            var best = 0;
            var bestScore = -Infinity;
            for (var i = 0; i < parsers.length; i++) {
                var entry = state.healthScores[parsers[i].url];
                var score = entry ? entry.score : 100;
                if (score > bestScore) { bestScore = score; best = i; }
            }
            return best;
        },

        sortParsers: function (parsers) {
            var sorted = parsers.slice();
            sorted.sort(function (a, b) {
                var sa = state.healthScores[a.url] ? state.healthScores[a.url].score : 100;
                var sb = state.healthScores[b.url] ? state.healthScores[b.url].score : 100;
                return sb - sa;
            });
            return sorted;
        },
    };

    // ╔══════════════════════════════════════════╗
    // ║  远程配置加载                            ║
    // ╚══════════════════════════════════════════╝

    function fetchRemoteParsers(callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: REMOTE_CONFIG_URL,
            timeout: 5000,
            onload: function (res) {
                try {
                    var data = JSON.parse(res.responseText);
                    if (Array.isArray(data.parsers) && data.parsers.length > 0) {
                        state.parsers = data.parsers;
                        state.parsers.forEach(function (p) {
                            if (!(p.url in state.healthScores)) {
                                state.healthScores[p.url] = { score: 100, success: 0, fail: 0 };
                            }
                        });
                        HealthManager.save();
                    }
                } catch (e) { /* ignore parse errors */ }
                if (callback) callback();
            },
            onerror: function () { if (callback) callback(); },
            ontimeout: function () { if (callback) callback(); },
        });
    }

    // ╔══════════════════════════════════════════╗
    // ║  广告隐藏引擎                            ║
    // ╚══════════════════════════════════════════╝

    var AdBlocker = {
        observer: null,

        injectCSS: function () {
            var rules = AD_SELECTORS.map(function (sel) {
                return sel + '{display:none !important;opacity:0 !important;pointer-events:none !important;height:0 !important;overflow:hidden !important;}';
            }).join('\n');
            GM_addStyle(rules);
        },

        clean: function () {
            AD_SELECTORS.forEach(function (sel) {
                try {
                    var nodes = document.querySelectorAll(sel);
                    for (var i = 0; i < nodes.length; i++) {
                        nodes[i].style.setProperty('display', 'none', 'important');
                        nodes[i].style.setProperty('opacity', '0', 'important');
                        nodes[i].style.setProperty('pointer-events', 'none', 'important');
                    }
                } catch (e) { /* skip invalid selectors */ }
            });
        },

        init: function () {
            this.injectCSS();
            this.clean();
            var root = document.documentElement || document.body;
            if (!root || !window.MutationObserver) return;
            var self = this;
            this.observer = new MutationObserver(function () { self.clean(); });
            this.observer.observe(root, { childList: true, subtree: true });
        },

        destroy: function () {
            if (this.observer) { this.observer.disconnect(); this.observer = null; }
        },
    };

    // ╔══════════════════════════════════════════╗
    // ║  原生媒体拦截                            ║
    // ╚══════════════════════════════════════════╝

    var mediaPlayBlocked = false;

    function stopMedia(el) {
        if (!el) return;
        try { el.pause(); } catch (e) {}
        try {
            el.removeAttribute('src');
            el.removeAttribute('autoplay');
            el.preload = 'none';
            el.autoplay = false;
            el.muted = true;
            el.volume = 0;
            el.loop = false;
            el.currentTime = 0;
            if (el.currentSrc || el.srcObject || el.getAttribute('src')) {
                el.removeAttribute('src');
            }
        } catch (e) {}
    }

    function blockNativeMediaPlayback() {
        if (mediaPlayBlocked || !window.HTMLMediaElement) return;
        mediaPlayBlocked = true;
        var origPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
            stopMedia(this);
            return Promise.resolve();
        };
        document.addEventListener('play', function (e) {
            if (e.target instanceof HTMLMediaElement) stopMedia(e.target);
        }, true);
        document.addEventListener('loadedmetadata', function (e) {
            if (e.target instanceof HTMLMediaElement) stopMedia(e.target);
        }, true);
    }

    // ╔══════════════════════════════════════════╗
    // ║  UI 构建 (纯 DOM 操作，无 innerHTML)      ║
    // ╚══════════════════════════════════════════╝

    function injectStyles() {
        var padBottom = 'env(safe-area-inset-bottom, 12px)';
        GM_addStyle([
            '#' + BOX_ID + ' { position:fixed; top:120px; left:0; z-index:2147483647; font-family:-apple-system,BlinkMacSystemFont,"Microsoft YaHei","Segoe UI",sans-serif; }',
            '#' + BOX_ID + ' .vvp_btn { width:36px; height:36px; line-height:36px; text-align:center; color:#fff; border-radius:10px; margin:3px 0; cursor:pointer; user-select:none; -webkit-tap-highlight-color:transparent; font-size:14px; font-weight:700; border:1px solid rgba(255,255,255,.15); box-shadow:0 4px 12px rgba(0,0,0,.35); display:block; }',
            '#' + BOX_ID + ' .vvp_main_btn { background:#6d28d9; border-color:#a78bfa; }',
            '#' + BOX_ID + ' .vvp_auto_btn { background:#4338ca; border-color:#a5b4fc; font-size:12px; }',
            '#' + BOX_ID + ' .vvp_auto_btn.active { background:#16a34a; border-color:#86efac; }',
            '#' + BOX_ID + ' .vvp_refresh_btn { background:#be123c; border-color:#fda4af; font-size:14px; }',
            '#' + BOX_ID + ' .vvp_overlay { display:none; position:fixed; inset:0; z-index:2147483646; background:rgba(0,0,0,.55); }',
            '#' + BOX_ID + ' .vvp_overlay.open { display:block; }',
            '#' + BOX_ID + ' .vvp_sheet { position:fixed; left:0; right:0; bottom:0; z-index:2147483647; background:#0f172a; border-radius:18px 18px 0 0; max-height:70vh; overflow-y:auto; transform:translateY(100%); transition:transform .3s cubic-bezier(.4,0,.2,1); padding:12px 16px calc(12px + ' + padBottom + '); }',
            '#' + BOX_ID + ' .vvp_sheet.open { transform:translateY(0); }',
            '#' + BOX_ID + ' .vvp_sheet_handle { width:36px; height:4px; background:#475569; border-radius:2px; margin:0 auto 16px; }',
            '#' + BOX_ID + ' .vvp_sheet_title { font-size:13px; color:#94a3b8; font-weight:700; margin:8px 0 6px; text-transform:uppercase; letter-spacing:.5px; }',
            '#' + BOX_ID + ' .vvp_parser_grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }',
            '#' + BOX_ID + ' .vvp_parser_btn { padding:10px 6px; text-align:center; font-size:13px; color:#e0f7ff; background:#0b2942; border:1px solid #155e75; border-radius:10px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:all .15s; user-select:none; -webkit-tap-highlight-color:transparent; }',
            '#' + BOX_ID + ' .vvp_parser_btn:active { background:#0e7490; border-color:#38bdf8; }',
            '#' + BOX_ID + ' .vvp_parser_btn.selected { background:#075985; border-color:#7dd3fc; color:#fff; }',
            '#' + BOX_ID + ' .vvp_score { display:block; font-size:10px; color:#86efac; margin-top:2px; }',
            '#' + BOX_ID + ' .vvp_score.low { color:#fca5a5; }',
            '#' + BOX_ID + ' .vvp_ext_btn { width:100%; padding:12px; text-align:center; font-size:14px; color:#fde68a; background:#1e293b; border:1px dashed #475569; border-radius:10px; cursor:pointer; margin-top:10px; }',
            '#' + BOX_ID + ' .vvp_info { font-size:11px; color:#64748b; margin-top:10px; line-height:1.7; }',
            '#' + BOX_ID + ' .vvp_panel { display:none; position:absolute; left:40px; top:-30px; background:#071827; border:1px solid #0ea5e9; border-radius:10px; padding:10px 0; width:380px; max-height:420px; overflow-y:auto; box-shadow:0 12px 30px rgba(2,12,27,.5); }',
            '#' + BOX_ID + ' .vvp_panel .vvp_parser_grid { grid-template-columns:repeat(4, 1fr); padding:0 10px; }',
            '#' + BOX_ID + ' .vvp_panel .vvp_parser_btn { font-size:12px; padding:6px 4px; margin:3px 2px; border-radius:5px; }',
            '.vvp_iframe_wrapper { background:#000; overflow:hidden; }',
            '.vvp_iframe_wrapper iframe { width:100%; height:100%; border:none; display:block; background:#000; }',
            '@media (max-width:520px) {',
            '  #' + BOX_ID + ' .vvp_panel { left:38px; top:-30px; width:calc(100vw - 50px); max-width:360px; max-height:70vh; }',
            '  #' + BOX_ID + ' .vvp_panel .vvp_parser_grid { grid-template-columns:repeat(2, 1fr); }',
            '  #' + BOX_ID + ' .vvp_sheet .vvp_parser_grid { grid-template-columns:repeat(3, 1fr); }',
            '}',
        ].join('\n'));
    }

    function buildUI() {
        var autoOn = !!GM_getValue(NS + 'auto_play', false);

        // 主按钮 VIP
        var mainBtn = el('div', { class: 'vvp_btn vvp_main_btn', title: '选择解析源' }, 'VIP');

        // 自动开关按钮
        var autoBtn = el('div', {
            class: 'vvp_btn vvp_auto_btn' + (autoOn ? ' active' : ''),
            id: 'vvp_auto',
            title: '自动解析开关',
        }, autoOn ? 'ON' : 'OFF');

        // 刷新按钮
        var refreshBtn = el('div', {
            class: 'vvp_btn vvp_refresh_btn',
            id: 'vvp_refresh',
            title: '刷新当前解析',
        }, '⟳');

        // PC 侧边面板
        var panelGrid = el('div', { class: 'vvp_parser_grid', id: 'vvp_panel_grid' });
        var panel = el('div', { class: 'vvp_panel', id: 'vvp_panel' }, panelGrid);

        // 移动端覆盖层
        var overlay = el('div', { class: 'vvp_overlay', id: 'vvp_overlay' });

        // 移动端底部面板
        var sheetHandle = el('div', { class: 'vvp_sheet_handle' });
        var sheetTitle = el('div', { class: 'vvp_sheet_title' }, '选择解析源');
        var sheetGrid = el('div', { class: 'vvp_parser_grid', id: 'vvp_sheet_grid' });
        var extBtn = el('div', { class: 'vvp_ext_btn', id: 'vvp_ext_btn' }, '🔗 弹窗播放 (新窗口)');
        var infoDiv = el('div', { class: 'vvp_info' }, '评分越高越稳定 | 点击切换解析器 | ON=自动解析');
        var sheet = el('div', { class: 'vvp_sheet', id: 'vvp_sheet' },
            sheetHandle, sheetTitle, sheetGrid, extBtn, infoDiv);

        // 组合
        var box = el('div', { id: BOX_ID }, mainBtn, autoBtn, refreshBtn, panel, overlay, sheet);
        document.body.appendChild(box);
        return box;
    }

    /**
     * 渲染解析器按钮到指定容器 (安全的 DOM 构建)
     */
    function renderParserButtons(containerId, selectedIdx, clickHandler) {
        var container = document.getElementById(containerId);
        if (!container) return;

        // 清空容器
        while (container.firstChild) { container.removeChild(container.firstChild); }

        state.parsers.forEach(function (parser, i) {
            var score = state.healthScores[parser.url] ? state.healthScores[parser.url].score : 100;
            var isLow = score < 50;

            var scoreSpan = el('span', { class: 'vvp_score' + (isLow ? ' low' : '') }, String(score));

            var btn = el('div', {
                class: 'vvp_parser_btn' + (i === selectedIdx ? ' selected' : ''),
                title: parser.name,
            }, parser.name, scoreSpan);

            btn.addEventListener('click', function () {
                clickHandler(i);
                container.querySelectorAll('.vvp_parser_btn').forEach(function (b) {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
            });

            container.appendChild(btn);
        });
    }

    // ╔══════════════════════════════════════════╗
    // ║  解析器预加载                            ║
    // ╚══════════════════════════════════════════╝

    function preloadParsers(count) {
        count = Math.min(count, state.parsers.length);
        var targetUrl = window.location.href;
        for (var i = 0; i < count; i++) {
            var parser = state.parsers[i];
            var key = parser.url;
            if (state.preloadedIframes[key]) continue;
            var iframe = document.createElement('iframe');
            iframe.src = parser.url + targetUrl;
            iframe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            document.body.appendChild(iframe);
            state.preloadedIframes[key] = iframe;
        }
    }

    function getPreloadedIframe(parserUrl) {
        var iframe = state.preloadedIframes[parserUrl];
        if (iframe && iframe.parentNode) {
            iframe.style.cssText = '';
            iframe.removeAttribute('sandbox');
            delete state.preloadedIframes[parserUrl];
            return iframe;
        }
        return null;
    }

    function clearPreloads() {
        Object.keys(state.preloadedIframes).forEach(function (key) {
            var iframe = state.preloadedIframes[key];
            if (iframe && iframe.parentNode) iframe.remove();
        });
        state.preloadedIframes = {};
    }

    // ╔══════════════════════════════════════════╗
    // ║  核心播放器逻辑                          ║
    // ╚══════════════════════════════════════════╝

    function hideAds() {
        if (!state.currentPlayerNode) return;
        var selectors = state.currentPlayerNode.displayNodes || [];
        selectors.forEach(function (sel) {
            $$(sel).forEach(function (node) {
                node.style.setProperty('display', 'none', 'important');
                node.style.setProperty('opacity', '0', 'important');
                node.style.setProperty('pointer-events', 'none', 'important');
            });
        });
    }

    function startPeriodicAdCleanup() {
        if (state.cleanupTimer) clearInterval(state.cleanupTimer);
        state.cleanupTimer = setInterval(hideAds, 500);
    }

    function buildIframeLayout(container) {
        var rect = container.getBoundingClientRect();
        var contStyle = window.getComputedStyle(container);
        var containerStyles, wrapperStyles, iframeStyles;

        if (IS_MOBILE) {
            var w = rect.width || 0;
            var h = rect.height || 0;
            var padTop = parseFloat(contStyle.paddingTop) || 0;
            var ratioH = w > 0 ? Math.round((w * 9) / 16) : 0;
            var vh = window.innerHeight || document.documentElement.clientHeight || 0;
            var fallback = vh > 0 ? Math.round(vh * 0.32) : 180;
            var rawH = h || padTop || ratioH || fallback;
            var maxH = vh > 0 ? Math.max(220, Math.round(vh * 0.7)) : rawH;
            var resolved = Math.max(180, Math.min(rawH, maxH));

            containerStyles = { overflow: 'hidden', height: 'auto', minHeight: resolved + 'px' };
            wrapperStyles = { position: 'relative', display: 'block', width: '100%', minHeight: resolved + 'px', aspectRatio: '16 / 9', background: '#000', overflow: 'hidden', zIndex: '2147483646' };
            iframeStyles = { position: 'absolute', inset: '0', width: '100%', height: '100%', border: 'none', display: 'block', background: '#000' };
        } else {
            containerStyles = { overflow: 'hidden' };
            wrapperStyles = { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', background: '#000', overflow: 'hidden', zIndex: '2147483646' };
            iframeStyles = { width: '100%', height: '100%', border: 'none', display: 'block', background: '#000' };
        }

        return { containerStyles: containerStyles, wrapperStyles: wrapperStyles, iframeStyles: iframeStyles };
    }

    function showPlayer(parserIdx) {
        var parser = state.parsers[parserIdx];
        if (!parser) return;

        state.activeParserIdx = parserIdx;
        var containerSelector = state.currentPlayerNode.container;

        waitForElement(containerSelector)
            .then(function (container) {
                hideAds();
                startPeriodicAdCleanup();

                var layout = buildIframeLayout(container);
                setStyles(container, layout.containerStyles);
                if (getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
                // 安全清空容器
                while (container.firstChild) { container.removeChild(container.firstChild); }

                var wrapper = el('div', { class: IFRAME_CLASS });
                setStyles(wrapper, layout.wrapperStyles);

                var iframe = getPreloadedIframe(parser.url);
                if (!iframe) {
                    iframe = el('iframe', { src: parser.url + window.location.href });
                }
                iframe.allow = 'autoplay; encrypted-media; fullscreen';
                iframe.allowFullscreen = true;
                iframe.referrerPolicy = 'no-referrer';
                setStyles(iframe, layout.iframeStyles);

                // 加载超时 → 自动故障转移
                var loadTimeout = setTimeout(function () {
                    HealthManager.recordFail(parser.url);
                    autoFallback();
                }, 10000);

                iframe.addEventListener('load', function () {
                    clearTimeout(loadTimeout);
                    HealthManager.recordSuccess(parser.url);
                });
                iframe.addEventListener('error', function () {
                    clearTimeout(loadTimeout);
                    HealthManager.recordFail(parser.url);
                    autoFallback();
                });

                wrapper.appendChild(iframe);
                container.appendChild(wrapper);
                state.iframeVisible = true;
                clearPreloads();
            })
            .catch(function (err) {
                console.error('[VIP Pro] Container error:', err);
            });
    }

    function autoFallback() {
        var nextIdx = state.activeParserIdx + 1;
        if (nextIdx < state.parsers.length) {
            showPlayer(nextIdx);
        }
    }

    function openExternalPlayer(parserIdx) {
        var parser = state.parsers[parserIdx];
        if (!parser) return;
        GM_openInTab(parser.url + window.location.href, { active: true, insert: true, setParent: true });
    }

    function refreshCurrentPlayer() {
        if (state.activeParserIdx >= 0) {
            showPlayer(state.activeParserIdx);
        }
    }

    // ╔══════════════════════════════════════════╗
    // ║  事件绑定                                ║
    // ╚══════════════════════════════════════════╝

    function bindEvents(box) {
        var mainBtn = box.querySelector('.vvp_main_btn');
        var autoBtn = box.querySelector('#vvp_auto');
        var refreshBtn = box.querySelector('#vvp_refresh');
        var panel = box.querySelector('#vvp_panel');
        var sheet = box.querySelector('#vvp_sheet');
        var overlay = box.querySelector('#vvp_overlay');
        var extBtn = box.querySelector('#vvp_ext_btn');

        function closeSheet() {
            sheet.classList.remove('open');
            overlay.classList.remove('open');
        }
        function openSheet() {
            sheet.classList.add('open');
            overlay.classList.add('open');
        }

        // 初始渲染解析器
        renderParserButtons('vvp_panel_grid', -1, function (i) { showPlayer(i); panel.style.display = 'none'; });
        renderParserButtons('vvp_sheet_grid', -1, function (i) { showPlayer(i); closeSheet(); });

        if (IS_MOBILE) {
            on(mainBtn, 'click', openSheet);
            on(overlay, 'click', closeSheet);
            on(sheet, 'touchstart', function (e) {
                var touchY = e.touches[0].clientY;
                var sheetTop = sheet.getBoundingClientRect().top;
                if (touchY - sheetTop < 60) {
                    function onMove(ev) {
                        if (ev.touches[0].clientY - touchY > 40) { closeSheet(); sheet.removeEventListener('touchmove', onMove); }
                    }
                    sheet.addEventListener('touchmove', onMove, { passive: true });
                }
            });
        } else {
            on(mainBtn, 'mouseover', function () { panel.style.display = 'block'; });
            on(mainBtn, 'mouseout', function () {
                setTimeout(function () {
                    if (!panel.matches(':hover') && !mainBtn.matches(':hover')) {
                        panel.style.display = 'none';
                    }
                }, 100);
            });
            on(panel, 'mouseover', function () { panel.style.display = 'block'; });
            on(panel, 'mouseout', function () { panel.style.display = 'none'; });

            // 右键拖动
            on(box, 'mousedown', function (e) {
                if (e.button !== 2) return;
                e.preventDefault();
                box.style.cursor = 'move';
                var offsetX = e.clientX - box.getBoundingClientRect().left;
                var offsetY = e.clientY - box.getBoundingClientRect().top;
                function onMove(ev) {
                    var x = ev.clientX - offsetX;
                    var y = ev.clientY - offsetY;
                    var maxX = window.innerWidth - box.offsetWidth - 100;
                    var maxY = window.innerHeight - box.offsetHeight;
                    box.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
                    box.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    box.style.cursor = '';
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            on(box, 'contextmenu', function (e) { e.preventDefault(); });
        }

        // 自动解析开关
        on(autoBtn, 'click', function () {
            var current = !!GM_getValue(NS + 'auto_play', false);
            var next = !current;
            GM_setValue(NS + 'auto_play', next);
            autoBtn.textContent = next ? 'ON' : 'OFF';
            autoBtn.classList.toggle('active', next);
            if (next) {
                var bestIdx = HealthManager.getBestParserIndex(state.parsers);
                showPlayer(bestIdx);
            }
            setTimeout(function () { window.location.reload(); }, 300);
        });

        // 刷新
        on(refreshBtn, 'click', refreshCurrentPlayer);

        // 弹窗播放
        on(extBtn, 'click', function () {
            var idx = state.activeParserIdx >= 0 ? state.activeParserIdx : HealthManager.getBestParserIndex(state.parsers);
            openExternalPlayer(idx);
        });

        // 键盘快捷键 Ctrl+数字
        on(document, 'keydown', function (e) {
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                var idx = parseInt(e.key) - 1;
                if (idx < state.parsers.length) {
                    e.preventDefault();
                    showPlayer(idx);
                }
            }
        });
    }

    // ╔══════════════════════════════════════════╗
    // ║  URL 变化检测                            ║
    // ╚══════════════════════════════════════════╝

    function watchUrlChange() {
        var autoPlay = !!GM_getValue(NS + 'auto_play', false);
        var oldHref = window.location.href;
        setInterval(function () {
            var newHref = window.location.href;
            if (oldHref !== newHref) {
                oldHref = newHref;
                if (autoPlay) { window.location.reload(); }
            }
        }, 1000);
    }

    // ╔══════════════════════════════════════════╗
    // ║  主入口                                  ║
    // ╚══════════════════════════════════════════╝

    function main() {
        var host = window.location.host;
        var playerNode = null;
        for (var i = 0; i < PLAYER_CONTAINERS.length; i++) {
            if (PLAYER_CONTAINERS[i].host === host) {
                playerNode = PLAYER_CONTAINERS[i];
                break;
            }
        }
        if (!playerNode) {
            console.warn('[VIP Pro] Site not supported:', host);
            return;
        }
        state.currentPlayerNode = playerNode;

        HealthManager.init();
        state.parsers = HealthManager.sortParsers(BUILTIN_PARSERS);

        injectStyles();
        var box = buildUI();
        bindEvents(box);

        AdBlocker.init();
        blockNativeMediaPlayback();
        watchUrlChange();
        preloadParsers(PRELOAD_COUNT);

        if (GM_getValue(NS + 'auto_play', false)) {
            var bestIdx = HealthManager.getBestParserIndex(state.parsers);
            setTimeout(function () { showPlayer(bestIdx); }, 1500);
        }

        fetchRemoteParsers(function () {
            if (state.parsers.length > 0) {
                renderParserButtons('vvp_panel_grid', -1, function (i) { showPlayer(i); });
                renderParserButtons('vvp_sheet_grid', -1, function (i) { showPlayer(i); closeSheet(); });
            }
        });
    }

    // ── 启动 ─────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
