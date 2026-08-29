// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
/** dsh-plugin client 模块：dock 布局/侧栏同步/CSS 注入。 */
import { MMA_HOST, MMA_STATE, syncHostState } from "./state.js";
import { syncThemeFromDsh } from "./theme.js";
import { clampCardStyle, css, hue, monoOf } from "./utils.js";
var EASE = "cubic-bezier(.22,.8,.24,1)";
var ANIM_MS = 320;

export function installFootCss() {
  if (document.getElementById("mma-foot-css")) return;
  var s = document.createElement("style");
  s.id = "mma-foot-css";
  s.textContent = [
    "html.mma-anim-dock{transition:padding-right " + ANIM_MS + "ms " + EASE + ";}",
    "html.mma-dock-side{padding-right:var(--mma-side-w,440px);box-sizing:border-box;}",
    "#mma-host{color:var(--dsw-alias-fg,#111);background:var(--dsw-alias-bg,#f7f7f8);overflow:hidden;transition:background-color .22s ease,color .22s ease,border-color .22s ease;}",
    "#mma-host.mma-anim-dock{transition:left " + ANIM_MS + "ms " + EASE + ",width " + ANIM_MS + "ms " + EASE + ",opacity " + ANIM_MS + "ms " + EASE + ",transform " + ANIM_MS + "ms " + EASE + ",box-shadow " + ANIM_MS + "ms ease,border-color " + ANIM_MS + "ms ease,background-color .22s ease,color .22s ease;}",
    "#mma-host button,#mma-host input,#mma-host select{color:inherit;font:inherit;}",
    "#mma-host .mma-chrome{display:flex;align-items:center;gap:8px;height:44px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);flex:0 0 auto;transition:background-color .22s ease,border-color .22s ease;}",
    "#mma-host .mma-tabs{display:flex;align-items:center;gap:2px;flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;scrollbar-width:thin;}",
    "#mma-host .mma-tab{display:inline-flex;align-items:center;flex:0 0 auto;max-width:140px;height:32px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-size:13px;font-weight:500;color:inherit;opacity:.7;white-space:nowrap;border-radius:8px 8px 0 0;}",
    "#mma-host .mma-tab[data-active='1']{font-weight:600;opacity:1;border-bottom-color:var(--dsw-alias-primary,#3b82f6);color:var(--dsw-alias-primary,#3b82f6);}",
    "#mma-host .mma-tab>span{display:inline-flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    "#mma-host .mma-tab-x{margin-left:6px;border:0;background:transparent;cursor:pointer;opacity:.55;color:inherit;padding:0 2px;line-height:1;font-size:14px;flex:0 0 auto;}",
    "#mma-host [hidden]{display:none !important;}",
    "#mma-host .mma-iconbtn{width:32px;height:32px;border:0;border-radius:8px;background:transparent;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;}",
    "#mma-host .mma-iconbtn:hover{background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-theme-wrap{position:relative;flex:0 0 auto;}",
    "#mma-host .mma-pop{display:none;position:absolute;right:0;top:38px;z-index:8;width:220px;padding:10px;border-radius:12px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);box-shadow:0 12px 32px var(--dsw-alias-shadow,rgba(0,0,0,.14));}",
    "#mma-host .mma-pop[data-open='1']{display:block;}",
    "#mma-host .mma-pop-seg{display:flex;gap:4px;margin:0 0 8px;padding:3px;border-radius:9px;background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-pop-seg button{flex:1;height:28px;border:0;border-radius:7px;background:transparent;cursor:pointer;font-size:12px;color:inherit;}",
    "#mma-host .mma-pop-seg button[data-on='1']{background:var(--dsw-alias-surface,#fff);font-weight:600;box-shadow:0 1px 2px var(--dsw-alias-shadow,rgba(0,0,0,.06));color:var(--dsw-alias-primary,#2563eb);}",
    "#mma-host .mma-scope-seg{margin-top:8px;border-top:1px solid var(--dsw-alias-border,#e5e7eb);padding-top:8px;}",
    "#mma-host .mma-scope-seg button:disabled{opacity:.45;cursor:not-allowed;}",
    "#mma-host .mma-swatch{display:flex;align-items:center;gap:10px;width:100%;height:36px;padding:0 8px;border:0;border-radius:8px;background:transparent;cursor:pointer;color:inherit;font-size:13px;text-align:left;}",
    "#mma-host .mma-swatch:hover{background:var(--dsw-alias-accent,var(--dsw-alias-muted,#f3f4f6));}",
    "#mma-host .mma-swatch[data-on='1']{background:var(--dsw-alias-accent,var(--dsw-alias-muted,#f3f4f6));font-weight:600;}",
    "#mma-host .mma-dot{width:14px;height:14px;border-radius:99px;border:1px solid var(--dsw-alias-border,#e5e7eb);flex:0 0 14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25);}",
    "#mma-host .mma-textbtn{height:28px;padding:0 8px;border:0;border-radius:6px;background:transparent;cursor:pointer;color:inherit;opacity:.7;font-size:12px;}",
    "#mma-host .mma-textbtn:hover{opacity:1;background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-textbtn.danger:hover{color:#dc2626;}",
    "#mma-host .mma-stage{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;position:relative;}",
    "#mma-host .mma-list,#mma-host .mma-frames{flex:1;min-height:0;overflow:auto;}",
    "#mma-host .mma-frames{display:none;position:relative;}",
    "#mma-host .mma-frame{position:absolute;inset:0;display:none;flex-direction:column;}",
    "#mma-host .mma-frame>iframe{flex:1;height:100%;min-height:0;width:100%;border:0;background:transparent;display:block;}",
    "#mma-host .mma-list-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:18px 18px 8px;}",
    "#mma-host .mma-list-head h2{margin:0;font-size:16px;font-weight:650;}",
    "#mma-host .mma-list-head span{font-size:12px;opacity:.5;}",
    "#mma-host .mma-search{margin:0 18px 12px;position:relative;}",
    "#mma-host .mma-search input{width:100%;height:34px;box-sizing:border-box;padding:0 12px 0 32px;border:1px solid var(--dsw-alias-border,#e5e7eb);border-radius:8px;background:var(--dsw-alias-surface,#fff);color:inherit;font-size:13px;outline:none;}",
    "#mma-host .mma-search input:focus{border-color:var(--dsw-alias-primary,#3b82f6);}",
    "#mma-host .mma-search svg{position:absolute;left:10px;top:9px;opacity:.45;pointer-events:none;}",
    "#mma-host .mma-grid{padding:8px 16px 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}",
    "#mma-host[data-dock='side'] .mma-grid{grid-template-columns:minmax(0,1fr);}",
    "#mma-host .mma-card,#mma-host .mma-row{text-align:left;border-radius:13px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);color:var(--dsw-alias-fg,#111);cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease,background-color .22s ease;}",
    "#mma-host .mma-card{display:flex;flex-direction:column;align-items:flex-start;gap:0;padding:16px 15px 13px;position:relative;overflow:hidden;}",
    "#mma-host .mma-row{display:flex;align-items:center;gap:12px;padding:10px 12px;position:relative;overflow:hidden;width:100%;}",
    "#mma-host .mma-card h3,#mma-host .mma-row .mma-t{font-size:14px;font-weight:650;margin:0;letter-spacing:.1px;position:relative;z-index:1;}",
    "#mma-host .mma-card p,#mma-host .mma-row small{font-size:12px;color:var(--muted-foreground,inherit);opacity:.85;line-height:1.45;}",
    "#mma-host .mma-card p{margin:0;position:relative;z-index:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}",
    "#mma-host .mma-row .mma-twrap{flex:1;min-width:0;position:relative;z-index:1;}",
    "#mma-host .mma-row small{display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    "#mma-host .mma-row .mma-right{margin-left:auto;display:flex;align-items:center;gap:7px;flex:0 0 auto;position:relative;z-index:1;}",
    "#mma-host .mma-chev{color:var(--muted-foreground,inherit);opacity:.5;width:14px;height:14px;}",
    "#mma-host .mma-meta{display:flex;align-items:center;gap:10px;margin-top:9px;position:relative;z-index:1;}",
    "#mma-host .mma-ver{font-size:10.5px;color:var(--muted-foreground,inherit);opacity:.8;letter-spacing:.2px;white-space:nowrap;}",
    "#mma-host .mma-open{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--dsw-alias-primary,#3b82f6);white-space:nowrap;}",
    "#mma-host .mma-open i{width:6px;height:6px;border-radius:99px;background:var(--dsw-alias-primary,#3b82f6);}",
    // ① Hero 海报：渐变文字 monogram + 右上光晕（grid 竖排卡 / side 微缩行同元素）
    "#mma-host[data-cardstyle='hero'] .mma-card::before,#mma-host[data-cardstyle='hero'] .mma-row::before{content:'';position:absolute;top:-28px;right:-20px;width:140px;height:120px;background:radial-gradient(62% 62% at 62% 40%,hsl(var(--h,215) 80% 60% / .20),transparent 72%);transition:opacity .16s ease;pointer-events:none;}",
    "#mma-host[data-cardstyle='hero'] .mma-card:hover::before,#mma-host[data-cardstyle='hero'] .mma-row:hover::before{opacity:1.3;}",
    "#mma-host[data-cardstyle='hero'] .mma-card:hover,#mma-host[data-cardstyle='hero'] .mma-row:hover{border-color:hsl(var(--h,215) 70% 60% / .45);box-shadow:0 8px 22px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host[data-cardstyle='hero'] .mma-mono{font-size:52px;font-weight:800;letter-spacing:2px;line-height:1.05;position:relative;z-index:1;margin-bottom:11px;color:hsl(var(--h,215) 60% 40%);}",
    "@supports (-webkit-background-clip:text){#mma-host[data-cardstyle='hero'] .mma-mono{background:linear-gradient(135deg,hsl(var(--h,215) 72% 42%),hsl(var(--h,215) 72% 62%));-webkit-background-clip:text;background-clip:text;color:transparent;}}",
    "@supports (-webkit-background-clip:text){#mma-host[data-theme='dark'][data-cardstyle='hero'] .mma-mono{background:linear-gradient(135deg,hsl(var(--h,215) 85% 70%),hsl(var(--h,215) 85% 84%));-webkit-background-clip:text;background-clip:text;color:transparent;}}",
    "#mma-host[data-cardstyle='hero'] .mma-row .mma-mono{font-size:27px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;margin:0;flex:0 0 34px;}",
    // ② 蚀刻空心：大号描边字，hover 填充实心
    "#mma-host[data-cardstyle='etch'] .mma-etch{font-size:46px;font-weight:800;letter-spacing:2px;line-height:1.02;color:transparent;-webkit-text-stroke:1.5px hsl(var(--h,215) 65% 45%);margin-bottom:10px;transition:color .2s ease;position:relative;z-index:1;}",
    "#mma-host[data-theme='dark'][data-cardstyle='etch'] .mma-etch{-webkit-text-stroke:1.5px hsl(var(--h,215) 85% 72%);}",
    "#mma-host[data-cardstyle='etch'] .mma-card:hover,#mma-host[data-cardstyle='etch'] .mma-row:hover{border-color:hsl(var(--h,215) 65% 50% / .5);box-shadow:0 8px 22px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host[data-cardstyle='etch'] .mma-card:hover .mma-etch,#mma-host[data-cardstyle='etch'] .mma-row:hover .mma-etch{color:hsl(var(--h,215) 65% 45%);}",
    "#mma-host[data-theme='dark'][data-cardstyle='etch'] .mma-card:hover .mma-etch,#mma-host[data-theme='dark'][data-cardstyle='etch'] .mma-row:hover .mma-etch{color:hsl(var(--h,215) 85% 72%);}",
    "#mma-host[data-cardstyle='etch'] .mma-row .mma-etch{flex:0 0 30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:25px;letter-spacing:1px;margin:0;-webkit-text-stroke-width:1.2px;}",
    // ③ 印章印刷：右上线框邮戳，hover 黑白反转
    "#mma-host[data-cardstyle='stamp'] .mma-stamp{position:absolute;top:13px;right:13px;width:44px;height:44px;border:1.5px solid var(--dsw-alias-fg,#111);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;letter-spacing:1px;color:var(--dsw-alias-fg,#111);background:transparent;transition:background-color .18s ease,color .18s ease,transform .18s ease;}",
    "#mma-host[data-cardstyle='stamp'] .mma-card:hover .mma-stamp,#mma-host[data-cardstyle='stamp'] .mma-row:hover .mma-stamp{background:var(--dsw-alias-fg,#111);color:var(--dsw-alias-surface,#fff);transform:scale(1.05);}",
    "#mma-host[data-cardstyle='stamp'] .mma-card:hover,#mma-host[data-cardstyle='stamp'] .mma-row:hover{border-color:var(--dsw-alias-fg,#111);box-shadow:0 8px 22px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host[data-cardstyle='stamp'] .mma-card h3,#mma-host[data-cardstyle='stamp'] .mma-card p{padding-right:52px;}",
    "#mma-host[data-cardstyle='stamp'] .mma-row .mma-stamp{position:static;width:36px;height:36px;font-size:12px;border-radius:8px;flex:0 0 36px;}",
    "#mma-host .mma-open-dot{width:7px;height:7px;border-radius:99px;background:var(--dsw-alias-primary,#3b82f6);display:inline-block;}",
    "#mma-host .mma-empty{padding:24px;opacity:.75;line-height:1.6;}",
    "#mma-host .mma-error{padding:24px;color:#b91c1c;}",
    ".mma-load{flex:1;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--dsw-alias-fg,#111);}",
    ".mma-load-art{position:relative;width:88px;height:72px;}",
    ".mma-load-art svg{display:block;width:88px;height:64px;}",
    ".mma-load-dots{display:flex;gap:5px;justify-content:center;margin-top:2px;}",
    ".mma-load-dots i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-primary,#3b82f6);opacity:.35;animation:mma-dot 1s ease-in-out infinite;}",
    ".mma-load-dots i:nth-child(2){animation-delay:.15s;}",
    ".mma-load-dots i:nth-child(3){animation-delay:.3s;}",
    "@keyframes mma-dot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-5px);opacity:1}}",
    ".mma-iframe-wrap{position:relative;flex:1 1 auto;min-height:0;height:100%;display:flex;flex-direction:column;}",
    ".mma-iframe-wrap .mma-load,#mma-host .mma-frame .mma-load{position:absolute;inset:0;background:var(--dsw-alias-bg,#f7f7f8);z-index:1;}",
    "#mma-host .mma-modal{position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:5;display:flex;align-items:center;justify-content:center;padding:24px;}",
    "#mma-host .mma-modal[hidden]{display:none;}",
    "#mma-host .mma-dialog{width:min(360px,100%);background:var(--dsw-alias-surface,#fff);color:var(--dsw-alias-fg,#111);border:1px solid var(--dsw-alias-border,#e5e7eb);border-radius:var(--radius,12px);padding:18px;box-shadow:0 12px 40px var(--dsw-alias-shadow,rgba(0,0,0,.18));}",
    "#mma-host .mma-dialog h3{margin:0 0 8px;font-size:15px;}",
    "#mma-host .mma-dialog p{margin:0 0 16px;font-size:13px;opacity:.75;line-height:1.5;}",
    "#mma-host .mma-dialog-actions{display:flex;justify-content:flex-end;gap:8px;}",
    "#mma-host .mma-dialog-actions button{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);cursor:pointer;}",
    "#mma-host .mma-dialog-actions .go{background:#dc2626;color:#fff;border-color:#dc2626;}",
    "#mma-host .mma-settings{position:absolute;inset:0;background:var(--dsw-alias-bg,#f7f7f8);z-index:4;overflow:auto;padding:20px 22px 32px;display:none;}",
    "#mma-host .mma-settings[data-open='1']{display:block;}",
    "#mma-host .mma-settings h3{margin:0 0 6px;font-size:16px;}",
    "#mma-host .mma-settings p.lead{margin:0 0 16px;font-size:12px;opacity:.6;line-height:1.45;}",
    "#mma-host .mma-field{display:flex;flex-direction:column;gap:6px;margin:0 0 14px;}",
    "#mma-host .mma-field label{font-size:12px;font-weight:600;}",
    "#mma-host .mma-field input,#mma-host .mma-field select{height:34px;padding:0 10px;border:1px solid var(--dsw-alias-border,#e5e7eb);border-radius:8px;background:var(--dsw-alias-surface,#fff);color:inherit;font:inherit;}",
    "#mma-host .mma-settings-actions{display:flex;gap:8px;align-items:center;margin-top:8px;}",
    "#mma-host .mma-settings-actions button{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-primary,#2563eb);background:var(--dsw-alias-primary,#2563eb);color:var(--dsw-alias-primary-fg,#fff);cursor:pointer;}",
    "#mma-host .mma-settings-actions button.ghost{background:transparent;color:inherit;border-color:var(--dsw-alias-border,#e5e7eb);}",
    "#mma-host .mma-settings-msg{font-size:12px;opacity:.7;}",
    "#mma-host .mma-settings-msg.err{color:#b91c1c;opacity:1;}",
    // —— 浏览面板（commits / storage 共用） ——
    "#mma-host .mma-browse{background:var(--dsw-alias-bg,#f7f7f8);}",
    "#mma-host .mma-browse-head{display:flex;align-items:center;gap:8px;margin:0 0 12px;}",
    "#mma-host .mma-browse-head h3{margin:0;font-size:15px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    "#mma-host .mma-browse-head .sub{font-size:11.5px;color:var(--muted-foreground,inherit);opacity:.7;white-space:nowrap;}",
    "#mma-host .mma-btns{display:flex;gap:6px;}",
    "#mma-host .mma-btns button{height:26px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);cursor:pointer;font-size:12px;color:inherit;}",
    "#mma-host .mma-btns button:hover{border-color:var(--dsw-alias-primary,#3b82f6);color:var(--dsw-alias-primary,#3b82f6);}",
    "#mma-host .mma-blist{display:flex;flex-direction:column;gap:6px;}",
    "#mma-host .mma-bitem{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);cursor:pointer;font:inherit;color:inherit;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease;}",
    "#mma-host .mma-bitem:hover{border-color:var(--dsw-alias-primary,#3b82f6);box-shadow:0 4px 12px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host .mma-bitem b{display:block;font-size:13px;font-weight:650;word-break:break-all;}",
    "#mma-host .mma-bitem .meta{display:flex;align-items:center;gap:8px;margin-top:4px;font-size:11px;color:var(--muted-foreground,inherit);opacity:.75;flex-wrap:wrap;}",
    "#mma-host .mma-bitem .meta code{font-size:10.5px;background:var(--dsw-alias-muted,#f3f4f6);padding:1px 5px;border-radius:5px;}",
    "#mma-host .mma-plus{color:#16a34a;font-weight:600;}",
    "#mma-host .mma-minus{color:#dc2626;font-weight:600;}",
    "#mma-host .mma-files{margin-top:8px;border-top:1px dashed var(--dsw-alias-border,#e5e7eb);padding-top:6px;}",
    "#mma-host .mma-fitem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 4px;border:0;background:none;cursor:pointer;font:inherit;color:inherit;font-size:12px;text-align:left;border-radius:6px;}",
    "#mma-host .mma-fitem:hover{background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-fitem .p{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,Menlo,Consolas,monospace;}",
    "#mma-host .mma-preview{margin:4px 0 2px;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-muted,#f3f4f6);font:11px/1.55 ui-monospace,Menlo,Consolas,monospace;overflow-x:auto;white-space:pre;max-height:220px;overflow-y:auto;}",
    "#mma-host .mma-bempty{padding:18px;text-align:center;opacity:.6;font-size:12px;}",
    "#mma-host .mma-berr{padding:14px;color:#b91c1c;font-size:12px;}",
    "#mma-host .mma-browse .mma-bitem[data-sec='0']{cursor:default;}",
    "#mma-host .mma-browse .mma-bitem[data-sec='0']:hover{transform:none;box-shadow:none;}",

    ".mma-foot-btn{display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;box-sizing:border-box;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;line-height:inherit;cursor:pointer;}",
    ".mma-foot-btn:hover,.mma-foot-btn[aria-pressed='true']{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));}",
    ".mma-foot-ico{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;flex:0 0 16px;}",
    ".mma-foot-ico svg{display:block;}",
    ".mma-foot-label{white-space:nowrap;overflow:hidden;}",
    "[class*='_collapsed'] .mma-foot-label{display:none !important;}",
    "[class*='_railIn'] .mma-foot-label{display:none !important;}",
    "[class*='_collapsed'] .mma-foot-btn{width:36px;height:36px;margin:18px 0 10px;padding:0;gap:0;justify-content:center;border-radius:50%;overflow:hidden;}",
  ].join("");
  document.head.appendChild(s);
}
export function hostLeftPx() {
  var best = 0;
  var nodes = document.body.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
  for (var i = 0; i < nodes.length; i++) {
    var r = nodes[i].getBoundingClientRect();
    if (r.top > 24) continue;
    if (r.left > 80) continue;
    if (r.height < window.innerHeight * 0.45) continue;
    if (r.width < 48 || r.width > 560) continue;
    if (r.right > best) best = r.right;
  }
  if (best < 48) {
    function walk(el) {
      if (!el || !el.getBoundingClientRect) return;
      var r = el.getBoundingClientRect();
      if (r.left <= 4 && r.top <= 4 && r.height >= window.innerHeight * 0.8 && r.width >= 48 && r.width <= 560) {
        if (r.right > best) best = r.right;
      }
      var ch = el.children || [];
      for (var k = 0; k < Math.min(ch.length, 12); k++) walk(ch[k]);
    }
    var kids = document.body.children;
    for (var j = 0; j < kids.length; j++) walk(kids[j]);
  }
  return Math.max(56, Math.round(best || 56));
}
export function sideWidthPx() {
  return Math.round(Math.min(440, window.innerWidth * 0.42));
}
export function layoutBox() {
  var vw = window.innerWidth;
  if (MMA_STATE.dock === "side") {
    var w = sideWidthPx();
    return { left: vw - w, width: w };
  }
  var rail = hostLeftPx();
  return { left: rail, width: Math.max(0, vw - rail) };
}
export function setDockPad(on) {
  var w = sideWidthPx();
  document.documentElement.style.setProperty("--mma-side-w", w + "px");
  document.documentElement.classList.toggle("mma-dock-side", !!on);
}
export function armDockAnim() {
  var host = document.getElementById("mma-host");
  if (host) host.classList.add("mma-anim-dock");
  document.documentElement.classList.add("mma-anim-dock");
  if (MMA_HOST._animTimer) clearTimeout(MMA_HOST._animTimer);
  MMA_HOST._animTimer = setTimeout(function () {
    var h = document.getElementById("mma-host");
    if (h) h.classList.remove("mma-anim-dock");
    document.documentElement.classList.remove("mma-anim-dock");
    MMA_HOST._animTimer = 0;
  }, ANIM_MS + 40);
}
export function lockLayout() {
  MMA_HOST._layoutLockUntil = Date.now() + ANIM_MS + 50;
}
export function layoutLocked() {
  return MMA_HOST._closing || Date.now() < MMA_HOST._layoutLockUntil;
}
export function clearVisTimer() {
  if (MMA_HOST._visTimer) {
    clearTimeout(MMA_HOST._visTimer);
    MMA_HOST._visTimer = 0;
  }
}
export function syncHostToSidebar(animate) {
  var host = document.getElementById("mma-host");
  if (!host) return;
  if (!animate && layoutLocked()) return;
  if (animate) armDockAnim();
  var box = layoutBox();
  host.style.top = "0";
  host.style.bottom = "0";
  host.style.right = "auto";
  host.style.zIndex = "40";
  host.style.left = box.left + "px";
  host.style.width = box.width + "px";
  host.setAttribute("data-dock", MMA_STATE.dock);
  if (MMA_STATE.dock === "side" && MMA_STATE.visible) {
    host.style.borderLeft = "1px solid var(--dsw-alias-border, #e5e7eb)";
    host.style.boxShadow = "-8px 0 24px rgba(0,0,0,.06)";
    setDockPad(true);
  } else {
    host.style.borderLeft = "none";
    host.style.boxShadow = "none";
    setDockPad(false);
  }
}
export function followSidebar(ms) {
  var until = Date.now() + (ms || 360);
  if (MMA_HOST._followRaf) cancelAnimationFrame(MMA_HOST._followRaf);
  function frame() {
    syncHostToSidebar(false);
    if (Date.now() < until) MMA_HOST._followRaf = requestAnimationFrame(frame);
    else MMA_HOST._followRaf = 0;
  }
  MMA_HOST._followRaf = requestAnimationFrame(frame);
}
export function startSidebarSync() {
  syncHostToSidebar(false);
  if (MMA_HOST._sideObs) return;
  MMA_HOST._sideObs = new ResizeObserver(function () {
    followSidebar(360);
  });
  function observeCols() {
    var nodes = document.body.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
    for (var i = 0; i < nodes.length; i++) {
      try {
        MMA_HOST._sideObs.observe(nodes[i]);
      } catch (_) {}
    }
  }
  observeCols();
  window.addEventListener("resize", function () {
    followSidebar(360);
  });
  document.addEventListener(
    "click",
    function () {
      followSidebar(360);
    },
    true
  );
  var mo = new MutationObserver(function () {
    observeCols();
    followSidebar(360);
    syncThemeFromDsh();
  });
  mo.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class", "style", "data-sidebar-collapsed", "data-collapsed", "data-theme", "data-color-mode"],
  });
}
export function startRailWatch() {
  installFootCss();
  function tick() {
    syncHostToSidebar(false);
    syncThemeFromDsh();
  }
  tick();
  if (!window.__mmaRailWatch) {
    window.__mmaRailWatch = true;
    window.addEventListener("resize", tick);
    document.addEventListener(
      "click",
      function () {
        tick();
        var n = 0;
        function frame() {
          tick();
          n++;
          if (n < 45) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      },
      true
    );
    setInterval(tick, 400);
    if (window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeFromDsh);
      } catch (_) {}
    }
  }
}
export function markFooter(open) {
  var nodes = document.querySelectorAll("[data-mma-open]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].setAttribute("aria-pressed", open ? "true" : "false");
  }
}
export function setCardStyle(v) {
  MMA_STATE.cardStyle = clampCardStyle(v);
  try {
    localStorage.setItem("mma-card-style", MMA_STATE.cardStyle);
  } catch (_) {}
  var host = document.getElementById("mma-host");
  if (host) host.setAttribute("data-cardstyle", MMA_STATE.cardStyle);
}

/* —— 浏览面板：提交历史 / storage —— */
