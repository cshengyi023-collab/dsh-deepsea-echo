/**
 * dsh-deepsea-echo — browser half.
 *
 * A full-screen PRTS-flavoured startup sequence for the DSH web GUI:
 *   terminal boot log → sonar search → hologram lock-on of the whale girl →
 *   operator file splash with the full-body illustration → deep-sea lockup →
 *   fade into the UI. A synthesized cue (terminal ticks, sonar pings, a riser
 *   and a final chime) follows the same timeline and has its own settings toggle.
 *
 * The bundle is plain JavaScript in the host's lazy-CJS module-loader form
 * (`window.__ModuleLoader__.load({ id, factory })`). Everything it needs is
 * embedded: artwork as data URIs, UI as DOM + one scoped stylesheet. It mounts
 * itself as soon as the client plugin is applied (before the shell's first
 * paint) and removes every node, style tag and listener when it finishes or the
 * plugin is disabled.
 *
 * Artwork credit: see NOTICE-ARTWORK.md. The animation code is MIT.
 */

window.__ModuleLoader__.load({
  id: "dsh-deepsea-echo",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    //#region assets + constants
    /** Two transparent illustrations reused from the installed whale-maid skin. */
    const ASSET_CHIBI = __ASSET_CHIBI__;
    const ASSET_SPLASH = __ASSET_SPLASH__;
    const ASSET_GRAIN = __ASSET_GRAIN__;
    /** Four synthesized startup scores (32 kHz mono WAV, inlined as data URIs). */
    const SFX_ASSETS = {
      deepsea: __ASSET_SFX_DEEPSEA__,
      orchestral: __ASSET_SFX_ORCHESTRAL__,
      neon: __ASSET_SFX_NEON__,
      calm: __ASSET_SFX_CALM__,
    };
    /** Selectable sound presets; `off` mutes the animation entirely. */
    const SOUND_CHOICES = [
      { key: "deepsea", label: "深海回响" },
      { key: "orchestral", label: "凛冬管弦" },
      { key: "neon", label: "霓虹脉冲" },
      { key: "calm", label: "静海氛围" },
      { key: "off", label: "关闭" },
    ];

    const NS = "dsh-deepsea-echo";
    const STORAGE_KEY = "dsh-deepsea-echo:v1";
    /** Settings written by the 0.1.x "dsh-whale-startup" build, migrated once. */
    const LEGACY_STORAGE_KEY = "dsh-whale-startup:v1";
    /** Base storyboard length in ms; the selected duration scales this timeline. */
    const BASE_MS = 4600;
    const DURATION_CHOICES = [
      { ms: 3600, label: "3.6s" },
      { ms: 4600, label: "4.6s" },
      { ms: 5000, label: "5.0s" },
    ];
    const DEFAULT_SETTINGS = { enabled: true, duration: 4600, sound: "deepsea" };

    /** Whale-side emblem: hexagon + whale silhouette + sonar line. */
    const WHALE_MARK =
      '<svg class="wla-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      '<path class="wla-mark-hex" d="M32 3.5 57 17.8v28.4L32 60.5 7 46.2V17.8Z"/>' +
      '<g class="wla-mark-body" transform="translate(32 33) scale(0.88) translate(-32 -33)">' + '<path class="wla-mark-whale" d="M52 33c0-6.6-7.5-12-16.8-12-8.4 0-14.9 3.7-17.7 8.4L6.8 18.9c-1 6.5 1.9 12.1 6.5 14.9l-5.6 5.6c7.5 1.9 13.1-0.9 15-4.7 4.7 5.6 12.1 8.4 19.6 6.5 5.6-1.9 9.3-4.7 9.3-8.4Z"/>' + '<circle class="wla-mark-eye" cx="43.4" cy="30.4" r="2.1"/>' + '</g>' +
      '<path class="wla-mark-line" d="M18.5 50.6h27"/>' +
      "</svg>";

    //#endregion

    //#region settings storage
    /** Validate a stored settings object (also used when migrating the legacy key). */
    function normalizeSettings(parsed) {
      return {
        enabled: parsed && typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SETTINGS.enabled,
        duration: DURATION_CHOICES.some((c) => c.ms === parsed?.duration) ? parsed.duration : DEFAULT_SETTINGS.duration,
        sound:
          parsed && typeof parsed.sound === "string" && SOUND_CHOICES.some((c) => c.key === parsed.sound)
            ? parsed.sound
            : parsed && parsed.sound === true
              ? "deepsea"
              : parsed && parsed.sound === false
                ? "off"
                : DEFAULT_SETTINGS.sound,
      };
    }

    /** Read persisted preferences, falling back to defaults on any corruption. */
    function readSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const migrated = normalizeSettings(JSON.parse(legacy));
            writeSettings(migrated);
            return migrated;
          }
          return { ...DEFAULT_SETTINGS };
        }
        return normalizeSettings(JSON.parse(raw));
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }

    /** Persist preferences; storage failures (private mode) never break the UI. */
    function writeSettings(next) {
      const value = normalizeSettings(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* ignore */
      }
      return value;
    }
    //#endregion

    //#region stylesheet
    const CSS = String.raw`
.wla-root, .wla-root *, .wla-root *::before, .wla-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.wla-root {
  --wla-ink: #e9f6ff;
  --wla-dim: #7f9dc2;
  --wla-faint: #3d5a7e;
  --wla-line: rgba(126, 190, 255, 0.34);
  --wla-line-soft: rgba(126, 190, 255, 0.14);
  --wla-cyan: #8be8ff;
  --wla-blue: #4d6bfe;
  --wla-blue-deep: #17357c;
  --wla-amber: #f3b54a;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  overflow: hidden;
  background: #01040c;
  color: var(--wla-ink);
  font-family: "Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", "Source Han Sans SC", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
  user-select: none;
  cursor: default;
  pointer-events: auto;
}
.wla-root ::selection { background: transparent; }

/* ---------- background ---------- */
.wla-bg { position: absolute; inset: 0; overflow: hidden; }
.wla-bg-base {
  position: absolute; inset: 0;
  background:
    radial-gradient(120% 80% at 50% 26%, rgba(14, 48, 94, 0.95) 0%, rgba(6, 24, 52, 0.9) 34%, #020814 68%, #01040c 100%),
    linear-gradient(180deg, #02060f 0%, #01040c 100%);
}
.wla-bg-beam { position: absolute; top: -20%; height: 140%; width: 60%; filter: blur(52px); opacity: 0.5; mix-blend-mode: screen; }
.wla-bg-beam i { position: absolute; inset: 0; }
.wla-bg-beam-l { left: -18%; background: linear-gradient(104deg, transparent 30%, rgba(46, 104, 210, 0.26) 47%, transparent 62%); }
.wla-bg-beam-r { right: -14%; background: linear-gradient(256deg, transparent 32%, rgba(38, 130, 214, 0.22) 49%, transparent 64%); }
.wla-bg-grid { position: absolute; inset: 0; opacity: 0; }
.wla-bg-grid svg { width: 100%; height: 100%; display: block; }
.wla-bg-grid path { fill: none; stroke: rgba(112, 188, 255, 0.085); stroke-width: 1; }
.wla-bg-horizon {
  position: absolute; left: -10%; right: -10%; bottom: -4%; height: 44%;
  background-image:
    repeating-linear-gradient(90deg, rgba(120,198,255,0.16) 0 1px, transparent 1px 92px),
    repeating-linear-gradient(0deg, rgba(120,198,255,0.12) 0 1px, transparent 1px 66px);
  transform: perspective(520px) rotateX(74deg);
  transform-origin: 50% 100%;
  mask-image: linear-gradient(to top, #000 0%, transparent 76%);
  -webkit-mask-image: linear-gradient(to top, #000 0%, transparent 76%);
  opacity: 0.5;
}
.wla-bg-whale { position: absolute; left: -14%; bottom: 4%; width: 74%; height: 46%; opacity: 0.12; filter: blur(4px); }
.wla-bg-whale path { fill: rgba(26, 74, 148, 0.6); }
.wla-vignette {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(120% 100% at 50% 44%, transparent 38%, rgba(0,3,10,0.55) 78%, rgba(0,2,8,0.92) 100%),
    linear-gradient(180deg, rgba(0,2,8,0.6) 0%, transparent 18%, transparent 82%, rgba(0,2,8,0.7) 100%);
}
.wla-scanlines { position: absolute; inset: 0; pointer-events: none; opacity: 0.45; background: repeating-linear-gradient(0deg, rgba(150,220,255,0.045) 0 1px, transparent 1px 3px); }
.wla-scanband { position: absolute; left: 0; right: 0; height: 20%; background: linear-gradient(180deg, transparent 0%, rgba(110,210,255,0.045) 45%, rgba(160,235,255,0.09) 52%, transparent 100%); mix-blend-mode: screen; opacity: 0.75; }
.wla-grain { position: absolute; inset: 0; opacity: 0.2; mix-blend-mode: overlay; background-image: url("__ASSET_GRAIN__"); background-size: 160px 160px; }
.wla-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.wla-tear { position: absolute; inset: 0; opacity: 0; background: repeating-linear-gradient(0deg, rgba(180,240,255,0.16) 0 2px, transparent 2px 11px); mix-blend-mode: screen; }

/* ---------- stage ---------- */
.wla-stage { position: absolute; left: 50%; top: 50%; width: 1600px; height: 900px; transform-origin: 50% 50%; will-change: transform; }
.wla-stage > * { position: absolute; }

/* ---------- top bar ---------- */
.wla-topbar { left: 64px; right: 64px; top: 34px; height: 52px; display: flex; align-items: center; justify-content: space-between; opacity: 0; }
.wla-brand { display: flex; align-items: center; gap: 14px; }
.wla-brand .wla-mark { width: 36px; height: 36px; }
.wla-mark-hex { stroke: rgba(160, 226, 255, 0.85); stroke-width: 1.5; }
.wla-mark-whale { fill: rgba(196, 240, 255, 0.95); }
.wla-mark-eye { fill: #04101f; }
.wla-mark-line { stroke: rgba(160, 226, 255, 0.55); stroke-width: 1.3; }
.wla-brandtext b { display: block; font-size: 15px; font-weight: 700; letter-spacing: 0.34em; color: rgba(233,246,255,0.96); }
.wla-brandtext span { display: block; margin-top: 4px; font-size: 10px; letter-spacing: 0.30em; color: rgba(140,185,225,0.75); }
.wla-meta { display: flex; align-items: flex-start; gap: 34px; }
.wla-meta-col { display: flex; flex-direction: column; gap: 5px; align-items: flex-end; }
.wla-meta-col .wla-k { font-size: 9px; letter-spacing: 0.34em; color: rgba(126,160,196,0.7); }
.wla-meta-col .wla-v { font-size: 12px; font-weight: 600; letter-spacing: 0.2em; color: rgba(220,240,255,0.92); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-meta-col .wla-v.wla-live { color: var(--wla-cyan); }

/* ---------- progress ---------- */
.wla-progress { left: 64px; right: 64px; top: 108px; height: 2px; background: rgba(110,170,230,0.14); opacity: 0; }
.wla-progress-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: linear-gradient(90deg, rgba(139,232,255,0.30) 0%, rgba(139,232,255,0.80) 62%, #eaf8ff 100%); box-shadow: 0 0 14px rgba(120,220,255,0.55); }
.wla-progress-dot { position: absolute; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; background: #eaf8ff; transform: rotate(45deg); box-shadow: 0 0 12px rgba(160,235,255,0.95); }
.wla-progress-num { position: absolute; right: 0; top: 12px; font-size: 10px; letter-spacing: 0.22em; color: rgba(170,215,255,0.8); font-family: "Cascadia Mono", Consolas, monospace; }

/* ---------- framing ---------- */
.wla-corner { width: 28px; height: 28px; border: 1px solid rgba(140,205,255,0.4); opacity: 0; }
.wla-corner.tl { left: 26px; top: 24px; border-right: 0; border-bottom: 0; }
.wla-corner.tr { right: 26px; top: 24px; border-left: 0; border-bottom: 0; }
.wla-corner.bl { left: 26px; bottom: 24px; border-right: 0; border-top: 0; }
.wla-corner.br { right: 26px; bottom: 24px; border-left: 0; border-top: 0; }
.wla-rail { top: 50%; display: flex; flex-direction: column; align-items: center; gap: 18px; opacity: 0; }
.wla-rail span { writing-mode: vertical-rl; text-orientation: mixed; font-size: 9px; letter-spacing: 0.34em; color: rgba(130,175,215,0.62); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-rail em { writing-mode: vertical-rl; font-style: normal; font-size: 9px; letter-spacing: 0.3em; color: rgba(139,232,255,0.55); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-rail i { width: 1px; height: 54px; background: repeating-linear-gradient(180deg, rgba(130,190,240,0.5) 0 5px, transparent 5px 11px); }
.wla-rail-l { left: 34px; transform: translateY(-50%); }
.wla-rail-r { right: 34px; transform: translateY(-50%); }

/* ---------- boot log ---------- */
.wla-log { left: 96px; bottom: 118px; width: 620px; opacity: 0; }
.wla-log-head { display: flex; align-items: center; gap: 10px; font-size: 9px; letter-spacing: 0.32em; color: rgba(126,170,210,0.66); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-log-head::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(126,190,255,0.28), transparent); }
.wla-log-lines { margin-top: 14px; display: flex; flex-direction: column; gap: 9px; }
.wla-log-line { font-size: 12px; letter-spacing: 0.04em; color: rgba(196,224,248,0.88); font-family: "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace; white-space: pre; }
.wla-log-cursor { display: inline-block; width: 7px; height: 12px; margin-left: 3px; background: rgba(160,235,255,0.9); vertical-align: -1px; }

/* ---------- terminal title + sonar ---------- */
.wla-title { left: 50%; top: 208px; transform: translateX(-50%); text-align: center; opacity: 0; white-space: nowrap; }
.wla-title b { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.62em; color: rgba(150, 210, 250, 0.72); text-indent: 0.62em; font-family: "Cascadia Mono", Consolas, monospace; }
.wla-title span { display: block; margin-top: 12px; font-size: 26px; font-weight: 700; letter-spacing: 0.5em; color: rgba(228, 246, 255, 0.9); text-indent: 0.5em; text-shadow: 0 0 30px rgba(77, 107, 254, 0.45); }
.wla-sonar { left: 50%; top: 50%; width: 720px; height: 720px; transform: translate(-50%, -50%); opacity: 0; }
.wla-sonar-pulse { position: absolute; left: 50%; top: 50%; width: 620px; height: 620px; margin: -310px 0 0 -310px; border-radius: 50%; border: 1.5px solid rgba(139, 232, 255, 0.8); }
.wla-sonar-cross i { position: absolute; background: rgba(130, 200, 255, 0.22); }
.wla-sonar-cross i:nth-child(1) { left: 50%; top: 0; width: 1px; height: 200px; }
.wla-sonar-cross i:nth-child(2) { left: 50%; bottom: 0; width: 1px; height: 200px; }
.wla-sonar-cross i:nth-child(3) { top: 50%; left: 0; height: 1px; width: 200px; }
.wla-sonar-cross i:nth-child(4) { top: 50%; right: 0; height: 1px; width: 200px; }
.wla-sonar-cross i:nth-child(5) { left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; transform: rotate(45deg); background: rgba(170, 236, 255, 0.85); box-shadow: 0 0 12px rgba(139, 232, 255, 0.8); }
.wla-sonar-sweep { position: absolute; left: calc(50% - 1px); top: calc(50% - 310px); width: 2px; height: 310px; transform-origin: 50% 100%; background: linear-gradient(0deg, transparent 0%, rgba(120, 220, 255, 0.12) 45%, rgba(160, 240, 255, 0.9) 100%); box-shadow: 0 0 16px rgba(120, 220, 255, 0.55); filter: blur(0.4px); }
.wla-sonar-sweep-2 { position: absolute; left: calc(50% - 1px); top: calc(50% - 240px); width: 1px; height: 240px; transform-origin: 50% 100%; background: linear-gradient(0deg, transparent 0%, rgba(120, 220, 255, 0.05) 50%, rgba(120, 220, 255, 0.45) 100%); filter: blur(1px); }
.wla-sonar-meta { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); text-align: center; white-space: nowrap; }
.wla-sonar-meta b { display: block; font-size: 10px; letter-spacing: 0.4em; color: rgba(150, 205, 245, 0.75); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-sonar-meta span { display: block; margin-top: 8px; font-size: 10px; letter-spacing: 0.28em; color: rgba(139, 232, 255, 0.85); font-family: "Cascadia Mono", Consolas, monospace; }

/* ---------- hologram ---------- */
.wla-holo { left: 50%; top: 50%; width: 900px; height: 800px; transform: translate(-50%, -50%); opacity: 0; }
.wla-holo-cross i { position: absolute; background: rgba(130, 200, 255, 0.16); }
.wla-holo-cross i:nth-child(1) { left: 0; top: 50%; width: 250px; height: 1px; }
.wla-holo-cross i:nth-child(2) { right: 0; top: 50%; width: 250px; height: 1px; }
.wla-holo-cross i:nth-child(3) { top: 0; left: 50%; height: 180px; width: 1px; }
.wla-holo-cross i:nth-child(4) { bottom: 0; left: 50%; height: 180px; width: 1px; }
.wla-holo-rings { position: absolute; inset: 0; display: grid; place-items: center; }
.wla-ring { position: absolute; border-radius: 50%; }
.wla-ring-1 { width: 588px; height: 588px; border: 1px solid rgba(130,210,255,0.26); }
.wla-ring-1::before, .wla-ring-1::after { content: ""; position: absolute; background: rgba(160,235,255,0.8); }
.wla-ring-1::before { left: 50%; top: -3px; width: 1px; height: 7px; }
.wla-ring-1::after { left: 50%; bottom: -3px; width: 1px; height: 7px; }
.wla-ring-2 { width: 512px; height: 512px; border: 1px dashed rgba(120,190,255,0.22); }
.wla-ring-3 { width: 664px; height: 664px; border: 1px solid rgba(90,150,220,0.12); }
.wla-ring-arc { width: 704px; height: 704px; background: conic-gradient(from 0deg, rgba(120,220,255,0.85) 0deg 24deg, transparent 28deg 88deg, rgba(77,107,254,0.9) 92deg 102deg, transparent 106deg 178deg, rgba(160,235,255,0.85) 182deg 194deg, transparent 198deg 266deg, rgba(120,220,255,0.6) 270deg 278deg, transparent 282deg 354deg, rgba(160,235,255,0.8) 357deg 360deg); mask: radial-gradient(circle, transparent 65.2%, #000 65.5%, #000 66.4%, transparent 66.7%); -webkit-mask: radial-gradient(circle, transparent 65.2%, #000 65.5%, #000 66.4%, transparent 66.7%); }
.wla-ring-arc-2 { width: 562px; height: 562px; background: conic-gradient(from 40deg, transparent 0deg 68deg, rgba(139,232,255,0.95) 74deg 80deg, transparent 86deg 248deg, rgba(160,235,255,0.6) 254deg 258deg, transparent 264deg 360deg); mask: radial-gradient(circle, transparent 72.6%, #000 72.9%, #000 73.5%, transparent 73.8%); -webkit-mask: radial-gradient(circle, transparent 72.6%, #000 72.9%, #000 73.5%, transparent 73.8%); }
.wla-ring-tick { width: 640px; height: 640px; }
.wla-ring-tick span { position: absolute; left: 50%; top: 0; width: 1px; height: 9px; background: rgba(160,225,255,0.55); transform-origin: 50% 320px; }
.wla-holo-core { position: absolute; left: 50%; top: 50%; width: 424px; height: 400px; transform: translate(-50%, -56%); display: grid; place-items: center; }
.wla-holo-imgwrap { position: relative; width: 100%; height: 100%; display: grid; place-items: center; filter: drop-shadow(0 0 26px rgba(94, 190, 255, 0.55)); }
.wla-holo-imgwrap img { position: absolute; height: 100%; width: auto; object-fit: contain; }
.wla-holo-imgwrap img.wla-img-main { filter: saturate(1.12) contrast(1.06) brightness(1.05); }
.wla-holo-imgwrap img.wla-img-r, .wla-holo-imgwrap img.wla-img-b { mix-blend-mode: screen; opacity: 0; }
.wla-holo-imgwrap img.wla-img-r { filter: sepia(1) saturate(9) hue-rotate(-50deg) brightness(0.95); }
.wla-holo-imgwrap img.wla-img-b { filter: sepia(1) saturate(9) hue-rotate(150deg) brightness(0.95); }
.wla-holo-scan { position: absolute; left: 2%; right: 2%; height: 3px; background: linear-gradient(90deg, transparent, rgba(200,245,255,0.95), transparent); box-shadow: 0 0 22px 6px rgba(110,220,255,0.5); mix-blend-mode: screen; opacity: 0.9; }
.wla-holo-caption { position: absolute; left: 50%; top: 79%; transform: translateX(-50%); text-align: center; white-space: nowrap; }
.wla-holo-caption b { display: block; font-size: 21px; font-weight: 700; letter-spacing: 0.5em; color: #eaf8ff; text-shadow: 0 0 22px rgba(120,220,255,0.75); text-indent: 0.5em; }
.wla-holo-caption span { display: block; margin-top: 9px; font-size: 10px; letter-spacing: 0.34em; color: rgba(155,205,245,0.8); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-holo-brackets i { position: absolute; width: 22px; height: 22px; border: 1px solid rgba(150,225,255,0.55); }
.wla-holo-brackets i:nth-child(1) { left: 196px; top: 250px; border-right: 0; border-bottom: 0; }
.wla-holo-brackets i:nth-child(2) { right: 196px; top: 250px; border-left: 0; border-bottom: 0; }
.wla-holo-brackets i:nth-child(3) { left: 196px; bottom: 250px; border-right: 0; border-top: 0; }
.wla-holo-brackets i:nth-child(4) { right: 196px; bottom: 250px; border-left: 0; border-top: 0; }
.wla-holo-side { position: absolute; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 8px; font-family: "Cascadia Mono", Consolas, monospace; }
.wla-holo-side span { font-size: 9px; letter-spacing: 0.22em; color: rgba(130,180,225,0.6); }
.wla-holo-side b { font-size: 11px; letter-spacing: 0.16em; color: rgba(139,232,255,0.85); font-weight: 600; }
.wla-holo-side-l { left: 26px; text-align: right; align-items: flex-end; }
.wla-holo-side-r { right: 26px; }

/* ---------- operator file ---------- */
.wla-file { inset: 0; opacity: 0; }
.wla-file-body { position: absolute; left: 116px; top: 168px; width: 640px; }
.wla-file-head { display: flex; align-items: center; gap: 14px; font-family: "Cascadia Mono", Consolas, monospace; font-size: 10px; letter-spacing: 0.3em; color: rgba(150,195,235,0.78); }
.wla-file-head i { flex: 0 0 76px; height: 1px; background: rgba(140,200,250,0.4); }
.wla-file-head .wla-file-head-spacer { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(140,200,250,0.34), transparent); }
.wla-secret { position: absolute; left: 800px; top: 166px; width: 220px; display: flex; flex-direction: column; align-items: flex-start; gap: 9px; font-family: "Cascadia Mono", Consolas, monospace; font-size: 9px; letter-spacing: 0.26em; color: rgba(243,181,74,0.72); }
.wla-secret b { padding: 4px 9px; border: 1px solid rgba(243,181,74,0.5); font-weight: 600; letter-spacing: 0.22em; color: rgba(250,196,110,0.9); }
.wla-file-vline { position: absolute; left: 792px; top: 214px; bottom: 120px; width: 1px; background: linear-gradient(180deg, rgba(130,190,245,0.42), rgba(130,190,245,0.12) 60%, transparent); }
.wla-file-vline i { position: absolute; left: -3px; width: 7px; height: 1px; background: rgba(150,210,255,0.5); }
.wla-name { margin-top: 34px; display: flex; align-items: flex-end; gap: 26px; }
.wla-name h1 { font-size: 92px; line-height: 0.96; font-weight: 800; letter-spacing: 0.06em; color: #f2f9ff; text-shadow: 0 0 42px rgba(77,107,254,0.55), 0 0 6px rgba(200,240,255,0.35); }
.wla-name h1 span { display: inline-block; opacity: 0; transform: translateY(18px); }
.wla-name-sub { padding-bottom: 12px; }
.wla-name-sub b { display: block; font-size: 26px; font-weight: 700; letter-spacing: 0.28em; color: var(--wla-cyan); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-name-sub span { display: block; margin-top: 6px; font-size: 10px; letter-spacing: 0.3em; color: rgba(160,200,240,0.7); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-divider { position: relative; height: 1px; margin: 26px 0 22px; background: linear-gradient(90deg, rgba(140,200,250,0.55), rgba(140,200,250,0.12) 70%, transparent); }
.wla-divider i { position: absolute; left: 0; top: -2px; width: 5px; height: 5px; background: var(--wla-cyan); transform: rotate(45deg); }
.wla-stats { display: flex; flex-direction: column; gap: 13px; }
.wla-stat { display: flex; align-items: center; gap: 16px; opacity: 0; }
.wla-stat-label { width: 210px; display: flex; align-items: baseline; gap: 10px; }
.wla-stat-label b { font-size: 15px; font-weight: 600; letter-spacing: 0.1em; color: rgba(230,244,255,0.94); }
.wla-stat-label span { font-size: 8px; letter-spacing: 0.2em; color: rgba(130,170,210,0.6); font-family: "Cascadia Mono", Consolas, monospace; }
.wla-stat-bars { flex: 1; display: flex; gap: 4px; height: 8px; align-items: center; }
.wla-stat-bars i { flex: 1; height: 6px; background: rgba(120,170,225,0.16); }
.wla-stat-bars i.on { background: linear-gradient(180deg, rgba(190,245,255,0.95), rgba(96,190,255,0.9)); box-shadow: 0 0 8px rgba(120,220,255,0.5); }
.wla-stat-rank { width: 64px; text-align: right; font-family: "Cascadia Mono", Consolas, monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.08em; color: var(--wla-cyan); }
.wla-stat-val { width: 44px; text-align: right; font-family: "Cascadia Mono", Consolas, monospace; font-size: 11px; color: rgba(150,195,235,0.65); }
.wla-file-foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid rgba(130,185,240,0.16); display: flex; align-items: center; gap: 26px; font-family: "Cascadia Mono", Consolas, monospace; font-size: 9px; letter-spacing: 0.22em; color: rgba(140,180,220,0.66); }
.wla-file-foot .wla-file-foot-spacer { flex: 1; }
.wla-barcode { width: 128px; height: 22px; background: repeating-linear-gradient(90deg, rgba(215,240,255,0.8) 0 1px, transparent 1px 3px, rgba(215,240,255,0.8) 3px 5px, transparent 5px 9px, rgba(215,240,255,0.8) 9px 10px, transparent 10px 14px); opacity: 0.7; }
.wla-stamp { position: absolute; left: 826px; bottom: 132px; padding: 10px 22px; border: 2px solid rgba(139,232,255,0.5); color: rgba(170,244,255,0.92); font-family: "Cascadia Mono", Consolas, monospace; font-size: 12px; letter-spacing: 0.3em; transform: rotate(-6deg); opacity: 0; text-shadow: 0 0 14px rgba(120,220,255,0.5); }
.wla-file-art { position: absolute; right: 168px; top: 92px; bottom: 36px; width: 560px; }
.wla-art-img { position: absolute; left: 50%; bottom: 0; height: 100%; width: auto; transform: translateX(-50%); filter: drop-shadow(0 26px 48px rgba(0, 10, 30, 0.75)) drop-shadow(0 0 60px rgba(70, 150, 255, 0.18)); }
.wla-art-frame { position: absolute; inset: 4% 0 6% 0; }
.wla-art-frame i { position: absolute; width: 30px; height: 30px; border: 1px solid rgba(150,215,255,0.5); }
.wla-art-frame i:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; }
.wla-art-frame i:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; }
.wla-art-frame i:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; }
.wla-art-frame i:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; }
.wla-art-cross { position: absolute; width: 14px; height: 14px; opacity: 0.55; }
.wla-art-cross::before, .wla-art-cross::after { content: ""; position: absolute; background: rgba(160,225,255,0.8); }
.wla-art-cross::before { left: 50%; top: 0; bottom: 0; width: 1px; }
.wla-art-cross::after { top: 50%; left: 0; right: 0; height: 1px; }
.wla-art-sweep { position: absolute; inset: 0; overflow: hidden; }
.wla-art-sweep i { position: absolute; top: -20%; bottom: -20%; width: 210px; background: linear-gradient(90deg, transparent, rgba(190,240,255,0.10) 38%, rgba(240,252,255,0.20) 50%, rgba(190,240,255,0.10) 62%, transparent); transform: rotate(14deg); filter: blur(16px); mix-blend-mode: screen; }
.wla-art-caption { position: absolute; right: -54px; top: 50%; transform: translateY(-50%); writing-mode: vertical-rl; font-size: 9px; letter-spacing: 0.5em; color: rgba(140,185,225,0.7); font-family: "Cascadia Mono", Consolas, monospace; }

/* ---------- lockup ---------- */
.wla-lockup { left: 50%; top: 50%; width: 1100px; height: 560px; transform: translate(-50%, -50%); opacity: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.wla-lockup::before { content: ""; position: absolute; left: 50%; top: 44%; width: 980px; height: 520px; transform: translate(-50%, -50%); border-radius: 50%; background: radial-gradient(ellipse at center, rgba(77, 107, 254, 0.26) 0%, rgba(60, 140, 240, 0.10) 42%, transparent 72%); filter: blur(18px); }
.wla-lockring { position: absolute; left: 50%; top: 50%; width: 440px; height: 440px; transform: translate(-50%, -55%); border-radius: 50%; border: 1px solid rgba(130,200,255,0.18); }
.wla-lockring::before { content: ""; position: absolute; inset: 24px; border-radius: 50%; border: 1px dashed rgba(130,200,255,0.14); }
.wla-lock-side { position: absolute; top: 50%; width: 1px; height: 300px; margin-top: -190px; background: linear-gradient(180deg, transparent, rgba(130,195,245,0.35) 30%, rgba(130,195,245,0.35) 70%, transparent); }
.wla-lock-side::before, .wla-lock-side::after { content: ""; position: absolute; left: -3px; width: 7px; height: 1px; background: rgba(150,215,255,0.55); }
.wla-lock-side::before { top: 26%; }
.wla-lock-side::after { bottom: 26%; }
.wla-lock-side-l { left: 128px; }
.wla-lock-side-r { right: 128px; }
.wla-lock-rail { position: absolute; left: 50%; top: 50%; width: 560px; height: 560px; transform: translate(-50%, -55%); }
.wla-lock-rail i { position: absolute; left: 50%; top: 0; width: 1px; height: 13px; background: rgba(160,230,255,0.55); transform-origin: 50% 280px; }
.wla-lockup .wla-mark { width: 164px; height: 164px; transform: translateY(-8px); filter: drop-shadow(0 0 26px rgba(100, 200, 255, 0.5)); }
.wla-lockword { margin-top: 30px; font-size: 38px; font-weight: 700; letter-spacing: 0.42em; color: #f2faff; text-indent: 0.42em; text-shadow: 0 0 40px rgba(77,107,254,0.6); white-space: nowrap; }
.wla-locktag { margin-top: 20px; font-size: 16px; letter-spacing: 0.62em; color: rgba(168,222,255,0.92); text-indent: 0.62em; white-space: nowrap; }
.wla-lockfoot { margin-top: 10px; font-size: 9px; letter-spacing: 0.42em; color: rgba(130,170,210,0.6); font-family: "Cascadia Mono", Consolas, monospace; white-space: nowrap; }
.wla-loadbar { margin-top: 40px; width: 460px; height: 3px; background: rgba(120,180,240,0.18); position: relative; }
.wla-loadbar i { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: linear-gradient(90deg, rgba(77,107,254,0.6), #aef0ff); box-shadow: 0 0 12px rgba(140,230,255,0.8); }
.wla-lock-meta { margin-top: 18px; display: flex; align-items: center; gap: 18px; font-size: 10px; letter-spacing: 0.3em; color: rgba(146,190,230,0.7); font-family: "Cascadia Mono", Consolas, monospace; white-space: nowrap; }
.wla-lock-meta i { width: 1px; height: 10px; background: rgba(126,180,235,0.3); }

/* ---------- phase blink ---------- */
.wla-dip { inset: 0; background: #01040c; opacity: 0; }

/* ---------- transition burst ---------- */
.wla-burst { left: 50%; top: 50%; height: 1px; width: 0; transform: translate(-50%, -50%); background: linear-gradient(90deg, transparent, rgba(160,235,255,0.9), transparent); box-shadow: 0 0 18px 2px rgba(120,215,255,0.55); opacity: 0; }
.wla-burst::after { content: ""; position: absolute; left: 50%; top: -2px; width: 6px; height: 5px; margin-left: -3px; background: #eaf9ff; transform: rotate(45deg); box-shadow: 0 0 14px rgba(160,235,255,0.9); }

/* ---------- skip + flash ---------- */
.wla-skip { right: 64px; bottom: 52px; font-size: 10px; letter-spacing: 0.28em; color: rgba(150,195,235,0.62); font-family: "Cascadia Mono", Consolas, monospace; opacity: 0; }
.wla-skip b { color: rgba(200,238,255,0.85); font-weight: 600; }
.wla-flash { position: absolute; inset: 0; background: radial-gradient(circle at 50% 46%, rgba(255,255,255,0.95) 0%, rgba(200,240,255,0.5) 16%, rgba(140,220,255,0.18) 34%, transparent 56%); opacity: 0; pointer-events: none; mix-blend-mode: screen; }

/* ---------- settings page ---------- */
.wla-settings { display: flex; flex-direction: column; gap: 22px; font-family: inherit; color: var(--dsw-alias-label-primary, inherit); }
.wla-settings-head h2 { font-size: 17px; font-weight: 600; margin: 0 0 8px; }
.wla-settings-head p { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--dsw-alias-label-secondary, inherit); }
.wla-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 18px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.2)); border-radius: 12px; background: var(--dsw-alias-bg-layer-2, transparent); }
.wla-settings-row-main b { display: block; font-size: 13.5px; font-weight: 600; }
.wla-settings-row-main small { display: block; margin-top: 5px; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary, inherit); }
.wla-settings-switch { flex: none; width: 46px; height: 26px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3)); background: var(--dsw-alias-bg-base, transparent); position: relative; cursor: pointer; transition: background 0.16s ease, border-color 0.16s ease; }
.wla-settings-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--dsw-alias-label-secondary, #888); transition: transform 0.16s ease, background 0.16s ease; }
.wla-settings-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary, #4d6bfe); border-color: var(--dsw-alias-brand-primary, #4d6bfe); }
.wla-settings-switch[aria-checked="true"]::after { transform: translateX(20px); background: #fff; }
.wla-settings-seg { display: flex; flex: none; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.2)); border-radius: 9px; overflow: hidden; }
.wla-settings-seg button { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, inherit); font: inherit; font-size: 12px; padding: 8px 15px; cursor: pointer; }
.wla-settings-seg button + button { border-left: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.2)); }
.wla-settings-seg button[aria-pressed="true"] { background: var(--dsw-alias-brand-primary, #4d6bfe); color: #fff; }
.wla-settings-row-top { align-items: flex-start; }
.wla-settings-choices { display: flex; flex-wrap: wrap; gap: 8px; flex: none; max-width: 400px; justify-content: flex-end; }
.wla-settings-choice { appearance: none; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.25)); border-radius: 999px; background: transparent; color: var(--dsw-alias-label-secondary, inherit); font: inherit; font-size: 12px; padding: 7px 13px; cursor: pointer; white-space: nowrap; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.wla-settings-choice:hover { background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.12)); }
.wla-settings-choice[aria-pressed="true"] { background: var(--dsw-alias-brand-primary, #4d6bfe); border-color: var(--dsw-alias-brand-primary, #4d6bfe); color: #fff; }
.wla-settings-action { appearance: none; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3)); border-radius: 9px; background: transparent; color: var(--dsw-alias-label-primary, inherit); font: inherit; font-size: 12.5px; padding: 8px 18px; cursor: pointer; transition: background 0.16s ease, border-color 0.16s ease; }
.wla-settings-action:hover { background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.12)); }
.wla-settings-note { margin: 0; font-size: 11.5px; letter-spacing: 0.02em; color: var(--dsw-alias-label-secondary, inherit); opacity: 0.85; }
`;

    //#endregion

    //#region markup
    const LOG_LINES = [
      { text: "> DSH KERNEL v0.2.0 ............ READY", at: 200, dur: 250 },
      { text: "> 深海链路同步 / DEEP-SEA LINK .. LINKED", at: 430, dur: 260 },
      { text: "> 声呐阵列校准 / SONAR ARRAY .... 100%", at: 690, dur: 240 },
      { text: "> 干员档案解密 / FILE DECRYPT ... GRANTED", at: 940, dur: 250 },
      { text: "> 鲸鱼娘 WHALE-01 登录 ......... ALLOWED", at: 1200, dur: 260 },
    ];

    const STATS = [
      { zh: "摸鱼强度", en: "LOAFING", rank: "A+", val: "92", n: 10 },
      { zh: "声呐感知", en: "SONAR", rank: "S", val: "96", n: 11 },
      { zh: "陪伴指数", en: "COMPANIONSHIP", rank: "SSS", val: "100", n: 12 },
      { zh: "深海适应", en: "ABYSSAL ADAPT", rank: "S", val: "94", n: 11 },
      { zh: "甜度", en: "SWEETNESS", rank: "A", val: "88", n: 9 },
      { zh: "神秘感", en: "MYSTIQUE", rank: "B+", val: "78", n: 8 },
    ];

    /** A dark whale silhouette that drifts across the backdrop like a shadow. */
    const BG_WHALE =
      '<svg viewBox="0 0 600 260" fill="none" aria-hidden="true">' +
      '<path d="M96 150c10-46 66-76 132-76 44 0 78 14 96 36l30-34c12 8 18 22 16 40l32 18c-18 14-40 16-58 8-12 30-46 50-92 50-66 0-118-24-156-42Z"/>' +
      '<path d="M186 104c-14-6-22-18-24-32 14 4 26 12 34 24Z"/>' +
      "</svg>";

    /** Pointy-top honeycomb path generated once for the backdrop grid. */
    function buildHexPath(width, height, radius) {
      const hexWidth = Math.sqrt(3) * radius;
      const stepY = 1.5 * radius;
      let d = "";
      let row = 0;
      for (let cy = -radius; cy < height + radius; cy += stepY, row++) {
        const offset = row % 2 === 0 ? 0 : hexWidth / 2;
        for (let cx = -hexWidth; cx < width + hexWidth; cx += hexWidth) {
          const x = cx + offset;
          d +=
            "M" + (x).toFixed(1) + " " + (cy - radius).toFixed(1) +
            "L" + (x + hexWidth / 2).toFixed(1) + " " + (cy - radius / 2).toFixed(1) +
            "L" + (x + hexWidth / 2).toFixed(1) + " " + (cy + radius / 2).toFixed(1) +
            "L" + x.toFixed(1) + " " + (cy + radius).toFixed(1) +
            "L" + (x - hexWidth / 2).toFixed(1) + " " + (cy + radius / 2).toFixed(1) +
            "L" + (x - hexWidth / 2).toFixed(1) + " " + (cy - radius / 2).toFixed(1) + "Z";
        }
      }
      return d;
    }

    function logLineHtml(index) {
      return '<div class="wla-log-line" data-log="' + index + '"><span class="wla-log-typed"></span><span class="wla-log-cursor" style="display:none"></span></div>';
    }

    function statHtml(stat, index) {
      let bars = "";
      for (let i = 0; i < 12; i++) bars += "<i></i>";
      return (
        '<div class="wla-stat" data-stat="' + index + '">' +
        '<div class="wla-stat-label"><b>' + stat.zh + "</b><span>" + stat.en + "</span></div>" +
        '<div class="wla-stat-bars">' + bars + "</div>" +
        '<div class="wla-stat-rank">' + stat.rank + "</div>" +
        '<div class="wla-stat-val">' + stat.val + "</div>" +
        "</div>"
      );
    }

    /** Compose the whole overlay markup. */
    function buildMarkup() {
      let logLines = "";
      for (let i = 0; i < LOG_LINES.length; i++) logLines += logLineHtml(i);
      let stats = "";
      for (let i = 0; i < STATS.length; i++) stats += statHtml(STATS[i], i);
      let tickMarks = "";
      for (let i = 0; i < 36; i++) tickMarks += '<span style="transform: rotate(' + i * 10 + 'deg)"></span>';
      let lockRail = "";
      for (let i = 0; i < 36; i++) lockRail += '<i style="transform: rotate(' + i * 10 + 'deg)"></i>';
      let vlineTicks = "";
      for (let i = 0; i < 9; i++) vlineTicks += '<i style="top: ' + (i * 11 + 4) + '%"></i>';
      let pulses = "";
      for (let i = 0; i < 3; i++) pulses += '<div class="wla-sonar-pulse" data-pulse="' + i + '"></div>';

      return (
        '<div class="wla-bg">' +
        '<div class="wla-bg-base"></div>' +
        '<div class="wla-bg-beam wla-bg-beam-l"><i></i></div>' +
        '<div class="wla-bg-beam wla-bg-beam-r"><i></i></div>' +
        '<div class="wla-bg-grid"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><path d="' + buildHexPath(1600, 900, 58) + '"/></svg></div>' +
        '<div class="wla-bg-horizon"></div>' +
        '<div class="wla-bg-whale">' + BG_WHALE + "</div>" +
        "</div>" +
        '<canvas class="wla-canvas"></canvas>' +
        '<div class="wla-scanlines"></div>' +
        '<div class="wla-scanband"></div>' +
        '<div class="wla-vignette"></div>' +
        '<div class="wla-grain"></div>' +
        '<div class="wla-tear"></div>' +
        '<div class="wla-stage">' +
        '<div class="wla-topbar">' +
        '<div class="wla-brand">' + WHALE_MARK + '<div class="wla-brandtext"><b>DEEPSEEK HARNESS</b><span>深蓝终端 · DEEP-SEA TERMINAL</span></div></div>' +
        '<div class="wla-meta">' +
        '<div class="wla-meta-col"><span class="wla-k">LINK</span><b class="wla-v" data-ref="link">STANDBY</b></div>' +
        '<div class="wla-meta-col"><span class="wla-k">NODE</span><b class="wla-v">DSH-07</b></div>' +
        '<div class="wla-meta-col"><span class="wla-k">SYS TIME</span><b class="wla-v" data-ref="clock">00:00:00</b></div>' +
        "</div></div>" +
        '<div class="wla-progress"><div class="wla-progress-fill" data-ref="progress-fill"></div><div class="wla-progress-dot" data-ref="progress-dot"></div><div class="wla-progress-num" data-ref="progress-num">00%</div></div>' +
        '<div class="wla-corner tl"></div><div class="wla-corner tr"></div><div class="wla-corner bl"></div><div class="wla-corner br"></div>' +
        '<div class="wla-rail wla-rail-l"><span>PRTS // DEEP-SEA LINK // 07</span><i></i><em>0000</em></div>' +
        '<div class="wla-rail wla-rail-r"><span>CLASSIFIED // INTERNAL USE ONLY</span><i></i><em>WHALE-01</em></div>' +
        // terminal title + sonar
        '<div class="wla-title"><b>DEEP-SEA ECHO PROJECT</b><span>深 海 回 响 计 划</span></div>' +
        '<div class="wla-sonar">' +
        '<div class="wla-sonar-cross"><i></i><i></i><i></i><i></i><i></i></div>' +
        pulses +
        '<div class="wla-sonar-sweep"></div>' +
        '<div class="wla-sonar-sweep-2"></div>' +
        '<div class="wla-sonar-meta"><b>SONAR SCAN // 声呐扫描</b><span data-ref="sonar-status">SEARCHING ...</span></div>' +
        "</div>" +
        // boot log
        '<div class="wla-log"><div class="wla-log-head">SYSTEM BOOT LOG</div><div class="wla-log-lines">' + logLines + "</div></div>" +
        // hologram
        '<div class="wla-holo">' +
        '<div class="wla-holo-cross"><i></i><i></i><i></i><i></i></div>' +
        '<div class="wla-holo-rings">' +
        '<div class="wla-ring wla-ring-3"></div>' +
        '<div class="wla-ring wla-ring-1"></div>' +
        '<div class="wla-ring wla-ring-2"></div>' +
        '<div class="wla-ring wla-ring-arc"></div>' +
        '<div class="wla-ring wla-ring-arc-2"></div>' +
        '<div class="wla-ring wla-ring-tick">' + tickMarks + "</div>" +
        "</div>" +
        '<div class="wla-holo-core">' +
        '<div class="wla-holo-imgwrap">' +
        '<img class="wla-img-b" src="' + ASSET_CHIBI + '" alt="" draggable="false"/>' +
        '<img class="wla-img-r" src="' + ASSET_CHIBI + '" alt="" draggable="false"/>' +
        '<img class="wla-img-main" data-ref="chibi" src="' + ASSET_CHIBI + '" alt="" draggable="false"/>' +
        "</div>" +
        '<div class="wla-holo-scan" data-ref="holo-scan"></div>' +
        "</div>" +
        '<div class="wla-holo-side wla-holo-side-l"><span>SIG</span><b>0x9F2A</b><span>DEPTH</span><b>-1200m</b><span>SYNC</span><b data-ref="sync">00%</b></div>' +
        '<div class="wla-holo-side wla-holo-side-r"><span>ECHO</span><b>TRUE</b><span>FORM</span><b>WHALE</b><span>STATE</span><b data-ref="holo-state">WAIT</b></div>' +
        '<div class="wla-holo-brackets"><i></i><i></i><i></i><i></i></div>' +
        '<div class="wla-holo-caption"><b>TARGET ACQUIRED</b><span>个体代号 / SUBJECT : 鲸鱼娘 · WHALE-01</span></div>' +
        "</div>" +
        // operator file
        '<div class="wla-file">' +
        '<div class="wla-secret"><b>绝密 · TOP SECRET</b><span>深海回响计划 / FILE No.0007</span><span>ACCESS : DSH-07 级授权</span></div>' +
        '<div class="wla-file-vline">' + vlineTicks + "</div>" +
        '<div class="wla-file-art">' +
        '<div class="wla-art-frame"><i></i><i></i><i></i><i></i></div>' +
        '<img class="wla-art-img" data-ref="splash" src="' + ASSET_SPLASH + '" alt="" draggable="false"/>' +
        '<div class="wla-art-sweep"><i data-ref="sweep"></i></div>' +
        '<div class="wla-art-cross" style="left:-26px;top:18%"></div>' +
        '<div class="wla-art-cross" style="right:-26px;top:62%"></div>' +
        '<div class="wla-art-caption">WHALE-01 — 深 海 鲸 鱼 娘</div>' +
        "</div>" +
        '<div class="wla-file-body">' +
        '<div class="wla-file-head"><span>OPERATOR FILE</span><i></i><span class="wla-file-head-spacer"></span><span>DSH // 深海回响计划</span></div>' +
        '<div class="wla-name"><h1 data-ref="name"><span>鲸</span><span>鱼</span><span>娘</span></h1>' +
        '<div class="wla-name-sub"><b>WHALE-01</b><span>DEEP-SEA COMPANION</span></div></div>' +
        '<div class="wla-divider"><i></i></div>' +
        '<div class="wla-stats">' + stats + "</div>" +
        '<div class="wla-file-foot"><span>项目 / PROJECT : 深海回响</span><span class="wla-file-foot-spacer"></span><span>AUTHORIZED BY DSH</span><span class="wla-barcode"></span></div>' +
        "</div>" +
        '<div class="wla-stamp">AUTHORIZED / 已授权</div>' +
        "</div>" +
        '<div class="wla-burst" data-ref="burst"></div>' +
        // lockup
        '<div class="wla-lockup">' +
        '<div class="wla-lockring"></div>' +
        '<div class="wla-lock-rail">' + lockRail + "</div>" +
        '<div class="wla-lock-side wla-lock-side-l"></div>' +
        '<div class="wla-lock-side wla-lock-side-r"></div>' +
        WHALE_MARK +
        '<div class="wla-lockword">DEEPSEEK HARNESS</div>' +
        '<div class="wla-locktag">深 海 回 响 · 启 动 完 成</div>' +
        '<div class="wla-lockfoot">DEEP-SEA ECHO // STARTUP COMPLETE</div>' +
        '<div class="wla-loadbar"><i data-ref="loadbar"></i></div>' +
        '<div class="wla-lock-meta"><span>CORE 0.2.0</span><i></i><span>SESSION READY</span><i></i><span>深海回响</span></div>' +
        "</div>" +
        '<div class="wla-dip" data-ref="dip"></div>' +
        '<div class="wla-skip">CLICK / <b>ESC</b> 跳过 · SKIP</div>' +
        '<div class="wla-flash" data-ref="flash"></div>' +
        "</div>"
      );
    }
    //#endregion

    //#region math
    const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const lerp = (a, b, x) => a + (b - a) * x;
    const ramp = (t, a, b) => clamp01((t - a) / (b - a));
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
    const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
    const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    function hashNoise(n) {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return s - Math.floor(s);
    }
    function track(t, keys) {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
          const [t0, v0] = keys[i - 1];
          const [t1, v1] = keys[i];
          return lerp(v0, v1, (t - t0) / (t1 - t0 || 1));
        }
      }
      return keys[keys.length - 1][1];
    }
    //#endregion

    //#region canvas fx
    /** Deterministic backdrop particles + final light bloom. */
    function createFx(canvas) {
      const ctx2d = canvas.getContext("2d");
      let width = 0;
      let height = 0;
      let dpr = 1;
      let motes = [];
      let streaks = [];

      (function seed() {
        let state = 0x2f6b21;
        const rnd = () => {
          state = (state * 1664525 + 1013904223) >>> 0;
          return state / 4294967296;
        };
        for (let i = 0; i < 170; i++) {
          motes.push({
            x: rnd(),
            y: rnd(),
            z: 0.25 + rnd() * 0.75,
            r: 0.55 + rnd() * 1.7,
            vx: -0.004 - rnd() * 0.016,
            vy: -0.010 - rnd() * 0.03,
            ph: rnd() * Math.PI * 2,
            warm: rnd() > 0.94,
          });
        }
        for (let i = 0; i < 18; i++) {
          streaks.push({ x: rnd(), y: rnd(), len: 0.02 + rnd() * 0.08, v: 0.02 + rnd() * 0.05, ph: rnd() * 6.28 });
        }
      })();

      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = canvas.clientWidth || window.innerWidth;
        height = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function draw(t) {
        if (!ctx2d || width === 0) return;
        ctx2d.clearRect(0, 0, width, height);
        const holo = ramp(t, 950, 1300) * (1 - ramp(t, 1900, 2200));
        const converge = easeInOutCubic(ramp(t, 3700, 4300));
        const bloom = Math.pow(ramp(t, 4150, 4370), 1.6) * (1 - ramp(t, 4400, 4580) * 0.6);

        ctx2d.save();
        for (const p of motes) {
          let x = (((p.x + p.vx * t) % 1) + 1) % 1;
          let y = (((p.y + p.vy * t) % 1) + 1) % 1;
          let size = p.r * p.z;
          let alpha = (0.18 + p.z * 0.55) * (0.55 + 0.45 * Math.sin(t * 0.004 + p.ph));
          if (converge > 0) {
            const ang = p.ph + converge * 3.6;
            const rad = 0.2 + p.z * 0.1 - converge * 0.06;
            x = lerp(x, 0.5 + Math.cos(ang) * rad, converge * 0.92);
            y = lerp(y, 0.48 + Math.sin(ang) * rad * 0.66, converge * 0.92);
            size *= 1 - converge * 0.2;
            alpha = lerp(alpha, 0.85, converge) * (1 - ramp(t, 4370, 4520));
          }
          alpha *= 0.8 + holo * 0.4;
          ctx2d.beginPath();
          ctx2d.fillStyle = p.warm ? "rgba(243,181,74," + alpha * 0.55 + ")" : "rgba(150,225,255," + alpha + ")";
          ctx2d.arc(x * width, y * height, size, 0, Math.PI * 2);
          ctx2d.fill();
        }
        ctx2d.restore();

        if (holo > 0.02) {
          ctx2d.save();
          ctx2d.globalCompositeOperation = "lighter";
          for (const s of streaks) {
            const x = (((s.x + t * 0.00002) % 1) + 1) % 1;
            const y = (((s.y - t * s.v * 0.001) % 1) + 1) % 1;
            const grad = ctx2d.createLinearGradient(x * width, y * height, x * width, y * height - height * s.len);
            grad.addColorStop(0, "rgba(150,235,255," + 0.28 * holo + ")");
            grad.addColorStop(1, "rgba(120,210,255,0)");
            ctx2d.strokeStyle = grad;
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(x * width, y * height);
            ctx2d.lineTo(x * width, y * height - height * s.len);
            ctx2d.stroke();
          }
          ctx2d.restore();
        }

        if (bloom > 0.001) {
          const cx = width * 0.5;
          const cy = height * 0.48;
          const rad = Math.max(width, height) * (0.16 + bloom * 0.5);
          const grad = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, rad);
          grad.addColorStop(0, "rgba(235,250,255," + 0.13 * bloom + ")");
          grad.addColorStop(0.35, "rgba(150,225,255," + 0.07 * bloom + ")");
          grad.addColorStop(1, "rgba(80,150,255,0)");
          ctx2d.fillStyle = grad;
          ctx2d.fillRect(0, 0, width, height);
        }
      }

      return { resize, draw, dispose() {} };
    }
    //#endregion

    //#region sound design
    /**
     * Play the synthesized startup cue in sync with the storyboard.
     * Autoplay may be refused before the first user gesture: in that case the
     * cue simply stays silent instead of raising, and a single gesture retries.
     */
    function createSoundDesign(rate, presetKey) {
      let ctx = null;
      let master = null;
      let bufferPromise = null;
      let source = null;
      let disposed = false;
      let gestureHooked = false;

      function ensureContext() {
        if (ctx) return ctx;
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        try {
          ctx = new AudioCtor();
        } catch {
          return null;
        }
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        return ctx;
      }

      function loadBuffer() {
        if (!bufferPromise) {
          bufferPromise = new Promise((resolve) => {
            try {
              // Decode the embedded WAV straight from base64: no fetch, no
              // network/CSP dependency, works on any page origin.
              const asset = SFX_ASSETS[presetKey] || "";
              const base64 = asset.slice(asset.indexOf(",") + 1);
              const binary = atob(base64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              ctx.decodeAudioData(bytes.buffer, (buffer) => resolve(buffer), () => resolve(null));
            } catch {
              resolve(null);
            }
          });
        }
        return bufferPromise;
      }

      function playBuffer(buffer) {
        if (disposed || !ctx || !buffer || source) return;
        try {
          source = ctx.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = rate;
          source.connect(master);
          source.start();
        } catch {
          source = null;
        }
      }

      function resumeWithGesture(buffer) {
        if (gestureHooked || disposed) return;
        gestureHooked = true;
        const kick = () => {
          window.removeEventListener("pointerdown", kick, true);
          window.removeEventListener("keydown", kick, true);
          if (disposed || !ctx) return;
          ctx.resume().then(() => playBuffer(buffer)).catch(() => {});
        };
        window.addEventListener("pointerdown", kick, true);
        window.addEventListener("keydown", kick, true);
      }

      function start() {
        const audio = ensureContext();
        if (!audio) return;
        loadBuffer().then((buffer) => {
          if (disposed || !buffer) return;
          if (audio.state === "running") {
            playBuffer(buffer);
            return;
          }
          audio
            .resume()
            .then(() => {
              if (audio.state === "running") playBuffer(buffer);
              else resumeWithGesture(buffer);
            })
            .catch(() => resumeWithGesture(buffer));
        });
      }

      function stop(fade) {
        if (!ctx || !master) return;
        try {
          const now = ctx.currentTime;
          const end = now + (fade === undefined ? 0.14 : fade);
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(0.0001, end);
          if (source) source.stop(end + 0.05);
        } catch {
          /* ignore */
        }
        source = null;
      }

      function dispose() {
        if (disposed) return;
        disposed = true;
        try {
          if (source) source.stop();
        } catch {
          /* ignore */
        }
        source = null;
        try {
          if (ctx) ctx.close();
        } catch {
          /* ignore */
        }
        ctx = null;
        master = null;
      }

      return { start, stop, dispose };
    }
    //#endregion

    //#region animation controller
    function createStartupAnimation(options) {
      const preview = options.preview === true;
      const chosenDuration = DURATION_CHOICES.some((c) => c.ms === options.duration) ? options.duration : DEFAULT_SETTINGS.duration;
      const speed = BASE_MS / chosenDuration;
      const preset =
        typeof options.sound === "string"
          ? options.sound
          : options.sound === true
            ? "deepsea"
            : "off";
      const sound = preset !== "off" && SFX_ASSETS[preset] ? createSoundDesign(speed, preset) : null;

      const root = document.createElement("div");
      root.className = "wla-root";
      root.innerHTML = buildMarkup();
      const stage = root.querySelector(".wla-stage");
      const canvas = root.querySelector(".wla-canvas");
      const fx = createFx(canvas);
      const refs = {};
      root.querySelectorAll("[data-ref]").forEach((el) => (refs[el.getAttribute("data-ref")] = el));
      const logEls = Array.from(root.querySelectorAll("[data-log]"));
      const statEls = Array.from(root.querySelectorAll("[data-stat]"));
      const nameChars = Array.from(root.querySelectorAll(".wla-name h1 span"));
      const ringTicks = Array.from(root.querySelectorAll(".wla-ring-tick span"));
      const lockRailTicks = Array.from(root.querySelectorAll(".wla-lock-rail i"));
      const pulseEls = Array.from(root.querySelectorAll("[data-pulse]"));

      const el = {
        topbar: root.querySelector(".wla-topbar"),
        progress: root.querySelector(".wla-progress"),
        corners: Array.from(root.querySelectorAll(".wla-corner")),
        rails: Array.from(root.querySelectorAll(".wla-rail")),
        title: root.querySelector(".wla-title"),
        sonar: root.querySelector(".wla-sonar"),
        sonarStatus: refs["sonar-status"],
        log: root.querySelector(".wla-log"),
        holo: root.querySelector(".wla-holo"),
        ring1: root.querySelector(".wla-ring-1"),
        ring2: root.querySelector(".wla-ring-2"),
        ring3: root.querySelector(".wla-ring-3"),
        ringArc: root.querySelector(".wla-ring-arc"),
        ringArc2: root.querySelector(".wla-ring-arc-2"),
        ringTick: root.querySelector(".wla-ring-tick"),
        imgMain: root.querySelector(".wla-img-main"),
        imgR: root.querySelector(".wla-img-r"),
        imgB: root.querySelector(".wla-img-b"),
        imgWrap: root.querySelector(".wla-holo-imgwrap"),
        caption: root.querySelector(".wla-holo-caption"),
        holoDecoration: Array.from(root.querySelectorAll(".wla-holo-side, .wla-holo-brackets, .wla-holo-cross")),
        file: root.querySelector(".wla-file"),
        fileBody: root.querySelector(".wla-file-body"),
        fileGiant: null,
        fileArt: root.querySelector(".wla-file-art"),
        artImg: root.querySelector(".wla-art-img"),
        artSweep: root.querySelector(".wla-art-sweep i"),
        artFrame: root.querySelector(".wla-art-frame"),
        artCaption: root.querySelector(".wla-art-caption"),
        divider: root.querySelector(".wla-divider"),
        secret: root.querySelector(".wla-secret"),
        vline: root.querySelector(".wla-file-vline"),
        stamp: root.querySelector(".wla-stamp"),
        lockup: root.querySelector(".wla-lockup"),
        lockring: root.querySelector(".wla-lockring"),
        lockRail: root.querySelector(".wla-lock-rail"),
        lockMark: root.querySelector(".wla-lockup .wla-mark"),
        lockWord: root.querySelector(".wla-lockword"),
        lockTag: root.querySelector(".wla-locktag"),
        lockFoot: root.querySelector(".wla-lockfoot"),
        lockMeta: root.querySelector(".wla-lock-meta"),
        lockSides: Array.from(root.querySelectorAll(".wla-lock-side")),
        loadbar: refs["loadbar"],
        skip: root.querySelector(".wla-skip"),
        flash: refs.flash,
        tear: root.querySelector(".wla-tear"),
        burst: refs.burst,
        dip: refs.dip,
        bgGrid: root.querySelector(".wla-bg-grid"),
        bgHorizon: root.querySelector(".wla-bg-horizon"),
        bgWhale: root.querySelector(".wla-bg-whale"),
        beams: root.querySelector(".wla-bg-beam"),
        scanband: root.querySelector(".wla-scanband"),
      };

      let disposed = false;
      let finished = false;
      let skipped = false;
      let startAt = 0;
      let raf = 0;
      let offset = 0;
      let paused = false;
      let pausedAt = 0;
      let watchdog = 0;
      let autoPlay = true;
      const listeners = [];
      const finishCallbacks = new Set();

      function layout() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const k = Math.min(w / 1600, h / 900);
        stage.style.transform = "translate(-50%, -50%) scale(" + k.toFixed(4) + ")";
        fx.resize();
      }

      /** Render the whole storyboard for base-timeline time `t` (ms). */
      function render(t) {
        const intro = 1 - ramp(t, 2020, 2160);
        const holoOut = ramp(t, 1850, 2010);
        const fileIn = ramp(t, 2030, 2230);
        const fileOut = ramp(t, 3520, 3660);
        const lockIn = ramp(t, 3660, 3830);
        const fade = 1 - ramp(t, 4400, 4590);

        root.style.opacity = String(fade);

        // backdrop
        el.bgGrid.style.opacity = String(ramp(t, 150, 900) * 0.95 * (0.6 + 0.4 * (1 - fade)));
        el.bgGrid.style.transform = "translate3d(0," + (-t * 0.004).toFixed(2) + "px,0)";
        el.bgHorizon.style.opacity = String(0.16 + ramp(t, 300, 1400) * 0.42);
        el.bgWhale.style.transform = "translate3d(" + (t * 0.012).toFixed(1) + "px," + (Math.sin(t * 0.0006) * 8).toFixed(1) + "px,0)";
        el.beams.style.transform = "translate3d(" + (Math.sin(t * 0.0003) * 22).toFixed(1) + "px,0,0)";
        el.scanband.style.transform = "translateY(" + (t * 0.14 - 200).toFixed(1) + "px)";

        // framing + HUD
        el.topbar.style.opacity = String(intro * ramp(t, 80, 420));
        el.topbar.style.transform = "translateY(" + (-12 * (1 - easeOutCubic(ramp(t, 80, 520)))).toFixed(2) + "px)";
        el.progress.style.opacity = String(intro * ramp(t, 60, 300));
        el.corners.forEach((node, i) => {
          const r = ramp(t, 120 + i * 60, 420 + i * 60);
          node.style.opacity = String(intro * r);
          node.style.transform = "scale(" + (0.6 + 0.4 * easeOutCubic(r)).toFixed(3) + ")";
        });
        el.rails.forEach((node, i) => {
          node.style.opacity = String(intro * ramp(t, 260 + i * 90, 700 + i * 90));
        });
        if (refs.link) {
          refs.link.textContent = t < 1300 ? "STANDBY" : t < 1720 ? "SYNCING" : "STABLE";
          refs.link.classList.toggle("wla-live", t >= 1720);
        }
        if (refs.clock) {
          const s = Math.floor(t / 1000);
          refs.clock.textContent = "00:00:" + String(s).padStart(2, "0");
        }
        const pct = track(t, [
          [0, 0],
          [1300, 34],
          [1950, 62],
          [3450, 88],
          [4300, 100],
        ]);
        if (refs["progress-fill"]) refs["progress-fill"].style.width = pct.toFixed(2) + "%";
        if (refs["progress-dot"]) refs["progress-dot"].style.left = pct.toFixed(2) + "%";
        if (refs["progress-num"]) refs["progress-num"].textContent = String(Math.round(pct)).padStart(2, "0") + "%";

        // boot log
        el.log.style.opacity = String(intro * ramp(t, 140, 420));
        for (let i = 0; i < LOG_LINES.length; i++) {
          const line = LOG_LINES[i];
          const node = logEls[i];
          if (!node) continue;
          const typed = node.querySelector(".wla-log-typed");
          const cursor = node.querySelector(".wla-log-cursor");
          const p = ramp(t, line.at, line.at + line.dur);
          const count = Math.floor(line.text.length * easeOutCubic(p));
          typed.textContent = line.text.slice(0, count);
          const showCursor = (p > 0 && p < 1) || (i === LOG_LINES.length - 1 && t < 2020);
          cursor.style.display = showCursor ? "inline-block" : "none";
          if (showCursor) cursor.style.opacity = String(Math.sin(t * 0.014) > 0 ? 1 : 0.1);
        }

        // terminal title + sonar
        const sonarIn = ramp(t, 320, 640) * (1 - ramp(t, 1000, 1160));
        el.sonar.style.opacity = String(sonarIn);
        el.sonar.style.transform = "translate(-50%, -50%) scale(" + (0.94 + 0.06 * easeOutCubic(ramp(t, 320, 760))).toFixed(4) + ")";
        const sweepEl = el.sonar.querySelector(".wla-sonar-sweep");
        if (sweepEl) sweepEl.style.transform = "rotate(" + ((t * 0.16) % 360).toFixed(2) + "deg)";
        const sweepEl2 = el.sonar.querySelector(".wla-sonar-sweep-2");
        if (sweepEl2) sweepEl2.style.transform = "rotate(" + (((t * 0.16) - 22) % 360).toFixed(2) + "deg)";
        pulseEls.forEach((node, i) => {
          const period = 780;
          const phase = (((t - 380 - i * 260) % period) + period) % period / period;
          const started = t - 380 - i * 260 >= 0;
          node.style.opacity = String(started ? (1 - phase) * 0.5 * sonarIn : 0);
          node.style.transform = "scale(" + (0.14 + phase * 0.82).toFixed(3) + ")";
        });
        if (el.sonarStatus) {
          const typing = Math.floor((t - 500) / 110);
          el.sonarStatus.textContent = t < 900 ? "SEARCHING" + ".".repeat(Math.max(0, Math.min(3, typing % 4))) : "SIGNAL 0x9F2A // LOCKED";
        }
        el.title.style.opacity = String(ramp(t, 380, 760) * (1 - ramp(t, 1010, 1160)));
        el.title.style.transform = "translateX(-50%) translateY(" + (10 * (1 - easeOutCubic(ramp(t, 380, 800)))).toFixed(1) + "px)";

        // hologram
        const holoAlpha = ramp(t, 1040, 1250) * (1 - holoOut);
        el.holo.style.opacity = String(holoAlpha);
        el.holo.style.transform = "translate(-50%, -50%) scale(" + (1 + 0.05 * easeOutCubic(ramp(t, 1100, 2100)) - 0.03 * holoOut).toFixed(4) + ")";
        const spin = t * 0.012;
        el.ringArc.style.transform = "rotate(" + spin.toFixed(2) + "deg)";
        el.ringArc2.style.transform = "rotate(" + (-spin * 1.6).toFixed(2) + "deg)";
        el.ring2.style.transform = "rotate(" + (spin * 0.35).toFixed(2) + "deg)";
        el.ring3.style.transform = "rotate(" + (-spin * 0.18).toFixed(2) + "deg)";
        el.ringTick.style.transform = "rotate(" + (-spin * 0.5).toFixed(2) + "deg)";
        ringTicks.forEach((node, i) => {
          node.style.opacity = String(0.2 + 0.8 * Math.max(0, Math.sin(t * 0.004 - i * 0.55)));
        });

        // glitch envelope: one lock-on burst + sparse later flickers
        const burst = ramp(t, 1030, 1130) * (1 - ramp(t, 1150, 1400));
        const flicker = hashNoise(Math.floor(t / 88)) > 0.87 ? (1 - ramp(t, 1500, 1850)) * 0.55 : 0;
        const glitch = Math.max(burst, flicker);
        const reveal = easeOutCubic(ramp(t, 1160, 1880)) * 116;
        const split = (1 - ramp(t, 1160, 1520)) * 2.5 + glitch * 7;

        const revealMask = reveal >= 110 ? "none"
          : "linear-gradient(to top, #000 0%, #000 " + reveal.toFixed(1) + "%, transparent " + (reveal + 9).toFixed(1) + "%, transparent 100%)";
        for (const img of [el.imgMain, el.imgR, el.imgB]) {
          img.style.webkitMaskImage = revealMask;
          img.style.maskImage = revealMask;
        }
        const flick = hashNoise(Math.floor(t / 60)) > 0.86 ? 0.62 : 1;
        el.imgMain.style.opacity = String(0.3 + 0.7 * ramp(t, 1100, 1320) * flick);
        el.imgMain.style.transform = "translateX(" + (glitch > 0.3 ? (hashNoise(Math.floor(t / 40)) - 0.5) * 7 : 0).toFixed(1) + "px)";
        const fringe = 0.07 + 0.3 * glitch;
        el.imgR.style.opacity = String(fringe);
        el.imgR.style.transform = "translateX(" + (-split).toFixed(1) + "px)";
        el.imgB.style.opacity = String(fringe);
        el.imgB.style.transform = "translateX(" + split.toFixed(1) + "px)";
        el.imgWrap.style.filter = "drop-shadow(0 0 " + (26 + 22 * glitch).toFixed(1) + "px rgba(94,190,255," + (0.45 + 0.35 * glitch).toFixed(2) + "))";
        if (refs["holo-scan"]) {
          refs["holo-scan"].style.top = Math.max(0, Math.min(100, 104 - reveal * 0.94)).toFixed(1) + "%";
          refs["holo-scan"].style.opacity = String(t > 1150 && t < 1960 ? 0.85 : 0);
        }
        if (refs.sync) refs.sync.textContent = String(Math.round(ramp(t, 1100, 1900) * 100)).padStart(2, "0") + "%";
        if (refs["holo-state"]) refs["holo-state"].textContent = t > 1500 ? "LOCK" : "WAIT";
        el.caption.style.opacity = String(ramp(t, 1500, 1740) * (1 - ramp(t, 1860, 2010)));
        el.caption.style.transform = "translateX(-50%) translateY(" + (10 * (1 - easeOutCubic(ramp(t, 1500, 1740)))).toFixed(1) + "px)";
        el.holoDecoration.forEach((node) => {
          node.style.opacity = node.classList.contains("wla-holo-cross") ? String(0.6 * ramp(t, 1100, 1400) * (1 - holoOut)) : String(0.9 * ramp(t, 1100, 1350) * (1 - holoOut));
        });

        // phase transition tear
        const tear = ramp(t, 1920, 1990) * (1 - ramp(t, 2040, 2160));
        el.tear.style.opacity = String(tear * 0.5);
        el.tear.style.transform = "translateY(" + (hashNoise(Math.floor(t / 50)) * 30 - 15).toFixed(1) + "px)";

        // operator file
        el.file.style.opacity = String(fileIn * (1 - fileOut));
        el.file.style.transform = "translateY(" + (-26 * fileOut).toFixed(1) + "px) scale(" + (1 + 0.015 * fileOut).toFixed(4) + ")";
        const bodyIn = easeOutCubic(ramp(t, 2050, 2270));
        el.fileBody.style.transform = "translateX(" + (-54 * (1 - bodyIn)).toFixed(1) + "px)";
        el.fileBody.style.opacity = String(ramp(t, 2050, 2240));
        el.divider.style.transform = "scaleX(" + easeOutQuint(ramp(t, 2200, 2460)).toFixed(4) + ")";
        el.divider.style.transformOrigin = "0 50%";
        nameChars.forEach((node, i) => {
          const p = easeOutCubic(ramp(t, 2100 + i * 100, 2340 + i * 100));
          node.style.opacity = String(p);
          node.style.transform = "translateY(" + (18 * (1 - p)).toFixed(1) + "px)";
        });
        statEls.forEach((node, i) => {
          const rowIn = easeOutCubic(ramp(t, 2280 + i * 90, 2460 + i * 90));
          node.style.opacity = String(rowIn);
          node.style.transform = "translateX(" + (-22 * (1 - rowIn)).toFixed(1) + "px)";
          const bars = node.querySelectorAll(".wla-stat-bars i");
          const fill = easeOutCubic(ramp(t, 2340 + i * 90, 2710 + i * 90));
          const onCount = Math.round(STATS[i].n * fill);
          bars.forEach((bar, bi) => bar.classList.toggle("on", bi < onCount));
        });
        const artIn = easeOutCubic(ramp(t, 2060, 2420));
        el.fileArt.style.opacity = String(artIn);
        el.fileArt.style.transform = "translateY(" + (56 * (1 - artIn)).toFixed(1) + "px)";
        el.artImg.style.opacity = String(0.2 + 0.8 * ramp(t, 2070, 2420));
        const sweep = ramp(t, 2860, 3260);
        el.artSweep.style.left = lerp(-16, 112, easeInOutCubic(sweep)).toFixed(2) + "%";
        el.artSweep.style.opacity = String(sweep > 0 && sweep < 1 ? 1 : 0);
        el.artFrame.style.opacity = String(ramp(t, 2150, 2420));
        el.artCaption.style.opacity = String(0.7 * ramp(t, 2440, 2700));
        el.secret.style.opacity = String(ramp(t, 2090, 2300));
        el.vline.style.opacity = String(ramp(t, 2150, 2420));
        const stamp = ramp(t, 3080, 3300) * (1 - ramp(t, 3480, 3620));
        el.stamp.style.opacity = String(stamp * 0.92);
        el.stamp.style.transform = "rotate(-6deg) scale(" + (0.8 + 0.2 * easeOutCubic(ramp(t, 3080, 3260))).toFixed(3) + ")";

        // phase blink: a two-frame dark dip hides the hologram → file cut
        const dip = Math.pow(ramp(t, 1980, 2030), 1.2) * (1 - ramp(t, 2050, 2170));
        el.dip.style.opacity = String(dip * 0.72);

        // transition burst between the file and the lockup
        const burstP = easeOutQuint(ramp(t, 3540, 3720));
        el.burst.style.width = (burstP * 1500).toFixed(1) + "px";
        el.burst.style.opacity = String(ramp(t, 3540, 3600) * (1 - ramp(t, 3720, 3860)));
        el.burst.style.transform = "translate(-50%, -50%) scaleY(" + (1 + 0.6 * (1 - burstP)).toFixed(3) + ")";

        // lockup
        el.lockup.style.opacity = String(lockIn);
        el.lockup.style.transform = "translate(-50%, -50%) scale(" + (0.96 + 0.04 * easeOutCubic(lockIn)).toFixed(4) + ")";
        el.lockring.style.transform = "translate(-50%, -55%) rotate(" + (t * 0.006).toFixed(2) + "deg)";
        el.lockring.style.opacity = String(0.9 * lockIn);
        el.lockRail.style.transform = "translate(-50%, -55%) rotate(" + (-t * 0.0035).toFixed(2) + "deg)";
        el.lockSides.forEach((node) => (node.style.opacity = String(0.8 * lockIn)));
        lockRailTicks.forEach((node, i) => {
          node.style.opacity = String(0.15 + 0.55 * Math.max(0, Math.sin(t * 0.003 - i * 0.35)));
        });
        const drawP = easeInOutCubic(ramp(t, 3660, 3920));
        const hex = el.lockMark.querySelector(".wla-mark-hex");
        const whale = el.lockMark.querySelector(".wla-mark-whale");
        const eye = el.lockMark.querySelector(".wla-mark-eye");
        const lineM = el.lockMark.querySelector(".wla-mark-line");
        if (hex) {
          const len = 190;
          hex.style.strokeDasharray = len;
          hex.style.strokeDashoffset = String(len * (1 - drawP));
        }
        if (whale) {
          const wp = ramp(t, 3800, 3990);
          whale.style.opacity = String(wp);
          whale.style.transform = "scale(" + (0.6 + 0.4 * easeOutCubic(wp)).toFixed(3) + ")";
          whale.style.transformOrigin = "32px 36px";
        }
        if (eye) eye.style.opacity = String(ramp(t, 3920, 4020));
        if (lineM) lineM.style.opacity = String(ramp(t, 3920, 4080));
        const wordIn = easeOutCubic(ramp(t, 3730, 4070));
        el.lockWord.style.opacity = String(wordIn);
        el.lockWord.style.letterSpacing = lerp(0.9, 0.42, wordIn).toFixed(3) + "em";
        el.lockTag.style.opacity = String(ramp(t, 3930, 4140));
        el.lockTag.style.letterSpacing = lerp(1.0, 0.62, easeOutCubic(ramp(t, 3930, 4200))).toFixed(3) + "em";
        el.lockFoot.style.opacity = String(0.8 * ramp(t, 4020, 4220));
        el.lockMeta.style.opacity = String(0.8 * ramp(t, 4090, 4280));
        if (el.loadbar) el.loadbar.style.width = (easeOutCubic(ramp(t, 3780, 4300)) * 100).toFixed(2) + "%";

        // skip + flash
        el.skip.style.opacity = String(ramp(t, 650, 900) * (1 - ramp(t, 4180, 4360)) * 0.9);
        const flash = Math.pow(ramp(t, 4250, 4310), 1.5) * (1 - ramp(t, 4320, 4420));
        el.flash.style.opacity = String(flash * 0.42);

        fx.draw(t);
      }

      function baseNow() {
        return (performance.now() - startAt) * speed;
      }
      function frame() {
        if (disposed) return;
        if (paused) {
          raf = 0;
          return;
        }
        try {
          const t = baseNow() + offset;
          render(Math.min(t, BASE_MS));
          if (t >= BASE_MS) {
            finish();
            return;
          }
          raf = requestAnimationFrame(frame);
        } catch (error) {
          // A failed frame must never leave the overlay covering the app.
          console.warn("[dsh-deepsea-echo] frame failed, dismissing the overlay:", error);
          finish();
        }
      }

      function skip() {
        if (skipped || disposed) return;
        if (baseNow() + offset < 300) return;
        skipped = true;
        if (sound) sound.stop(0.2);
        offset += BASE_MS - 320 - (baseNow() + offset);
        if (!raf && !paused) raf = requestAnimationFrame(frame);
      }
      function finish() {
        if (finished || disposed) return;
        finished = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        dispose();
      }
      function dispose() {
        if (disposed) return;
        disposed = true;
        if (watchdog) clearTimeout(watchdog);
        watchdog = 0;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        removeListeners();
        if (sound) sound.dispose();
        if (root.parentNode) root.parentNode.removeChild(root);
        finishCallbacks.forEach((cb) => {
          try {
            cb();
          } catch {
            /* ignore */
          }
        });
        finishCallbacks.clear();
      }

      function play(fromMs) {
        if (disposed) return;
        startAt = performance.now();
        offset = -(fromMs || 0) / speed;
        paused = false;
        if (!raf) raf = requestAnimationFrame(frame);
      }
      function pause() {
        if (paused || disposed) return;
        pausedAt = baseNow() + offset;
        paused = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        render(Math.min(pausedAt, BASE_MS));
      }
      function resume() {
        if (!paused || disposed) return;
        paused = false;
        startAt = performance.now();
        offset = pausedAt;
        raf = requestAnimationFrame(frame);
      }
      function seek(ms) {
        if (disposed) return;
        paused = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        pausedAt = Math.max(0, Math.min(ms, BASE_MS));
        render(pausedAt);
      }
      function onFinished(cb) {
        finishCallbacks.add(cb);
      }

      function addListener(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        listeners.push(() => target.removeEventListener(type, fn, opts));
      }
      function removeListeners() {
        while (listeners.length) {
          const off = listeners.pop();
          try {
            off();
          } catch {
            /* ignore */
          }
        }
      }

      addListener(window, "resize", layout);
      addListener(window, "pointerdown", skip, { capture: true });
      addListener(
        window,
        "keydown",
        (event) => {
          if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            skip();
          }
        },
        { capture: true },
      );

      const parent = document.documentElement || document.body;
      parent.appendChild(root);
      layout();
      // Backstop: however the storyboard ends, the cover comes off.
      watchdog = setTimeout(() => finish(), chosenDuration + 4000);
      const images = Array.from(root.querySelectorAll("img"));
      const ready = Promise.allSettled(images.map((img) => (img.decode ? img.decode() : Promise.resolve())));
      startAt = performance.now();
      offset = 0;
      if (preview) {
        autoPlay = options.autoplay !== false;
        render(0);
        if (autoPlay) raf = requestAnimationFrame(frame);
      } else {
        const kick = () => {
          if (disposed) return;
          startAt = performance.now();
          offset = 0;
          if (sound) sound.start();
          raf = requestAnimationFrame(frame);
        };
        ready.then(kick, kick);
      }

      return {
        root,
        seek,
        play: () => play(0),
        pause,
        resume,
        skip,
        dispose,
        onFinished,
        baseDuration: chosenDuration,
        isFinished: () => finished,
      };
    }
    //#endregion

    //#region settings page
    /** Settings → 启动动画 page. Kept dependency-free except React. */
    function installSettingsSection(ctx, react, hooks) {
      const h = react.createElement;
      const { useState } = react;

      function SettingsPage() {
        const [settings, setSettings] = useState(hooks.readSettings());
        const apply = (patch) => {
          const next = hooks.writeSettings({ ...settings, ...patch });
          setSettings(next);
        };
        return h(
          "div",
          { className: "wla-settings" },
          h(
            "div",
            { className: "wla-settings-head" },
            h("h2", null, "启动动画"),
            h(
              "p",
              null,
              "每次打开或刷新 DSH 界面时，播放一段约 " +
                (settings.duration / 1000).toFixed(1) +
                " 秒的深海鲸鱼娘启动动画：终端自检 → 声呐搜索 → 全息锁定 → 干员档案 → 深海回响。播放中点击任意位置或按 Esc 可跳过；音效可在下面单独开关。",
            ),
          ),
          h(
            "div",
            { className: "wla-settings-row" },
            h("div", { className: "wla-settings-row-main" }, h("b", null, "启用启动动画"), h("small", null, "关闭后启动时直接进入界面，不再播放。")),
            h("button", {
              type: "button",
              role: "switch",
              className: "wla-settings-switch",
              "aria-checked": settings.enabled ? "true" : "false",
              "aria-label": "启用启动动画",
              onClick: () => apply({ enabled: !settings.enabled }),
            }),
          ),
          h(
            "div",
            { className: "wla-settings-row" },
            h("div", { className: "wla-settings-row-main" }, h("b", null, "播放时长"), h("small", null, "整段动画的时长，短一些启动更快，长一些看得更完整。")),
            h(
              "div",
              { className: "wla-settings-seg" },
              DURATION_CHOICES.map((choice) =>
                h(
                  "button",
                  {
                    key: choice.ms,
                    type: "button",
                    "aria-pressed": settings.duration === choice.ms ? "true" : "false",
                    onClick: () => apply({ duration: choice.ms }),
                  },
                  choice.label,
                ),
              ),
            ),
          ),
          h(
            "div",
            { className: "wla-settings-row wla-settings-row-top" },
            h(
              "div",
              { className: "wla-settings-row-main" },
              h("b", null, "启动音效"),
              h("small", null, "四套原创配乐任选，也可以直接关闭；与上面的动画总开关互相独立。"),
            ),
            h(
              "div",
              { className: "wla-settings-choices" },
              SOUND_CHOICES.map((choice) =>
                h(
                  "button",
                  {
                    key: choice.key,
                    type: "button",
                    className: "wla-settings-choice",
                    "aria-pressed": settings.sound === choice.key ? "true" : "false",
                    onClick: () => apply({ sound: choice.key }),
                  },
                  choice.label,
                ),
              ),
            ),
          ),
          h(
            "div",
            { className: "wla-settings-row" },
            h("div", { className: "wla-settings-row-main" }, h("b", null, "立即预览"), h("small", null, "马上完整播放一遍（含音效设置），不影响下次启动。")),
            h("button", { type: "button", className: "wla-settings-action", onClick: () => hooks.replay({ duration: settings.duration, sound: settings.sound }) }, "重播动画"),
          ),
          h(
            "p",
            { className: "wla-settings-note" },
            "美术素材：鲸鱼娘 © 上善 / ZipZipPipe / Small-tailqwq（CC BY-NC-SA 4.0，非商业使用）。动画代码与合成音效 MIT。",
          ),
        );
      }

      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "deepsea-echo",
            order: 45,
            label: () => "启动动画",
          },
          SettingsPage,
        ),
      );
    }
    //#endregion

    //#region plugin entry
    let active = null;
    let mountedStyle = null;

    function mountAnimation(settings, preview) {
      if (typeof document === "undefined") return null;
      if (active) return active;
      const anim = createStartupAnimation({
        duration: settings ? settings.duration : DEFAULT_SETTINGS.duration,
        sound: preview ? "off" : settings ? settings.sound : DEFAULT_SETTINGS.sound,
        preview,
        autoplay: !(preview && window.__WLA_PREVIEW_STATIC__ === true),
      });
      active = anim;
      if (preview) {
        try {
          window.__WLA_ANIM__ = anim;
        } catch {
          /* ignore */
        }
      }
      anim.onFinished(() => {
        if (active === anim) active = null;
      });
      return anim;
    }

    function installStyles() {
      if (mountedStyle) return;
      const tag = document.createElement("style");
      tag.setAttribute("data-plugin", NS);
      tag.setAttribute("data-plugin-css", NS + "/startup");
      tag.textContent = CSS;
      (document.head || document.documentElement).appendChild(tag);
      mountedStyle = tag;
    }

    function removeStyles() {
      if (mountedStyle && mountedStyle.parentNode) mountedStyle.parentNode.removeChild(mountedStyle);
      mountedStyle = null;
    }

    function replay(options, preview) {
      installStyles();
      const stored = readSettings();
      const opts = typeof options === "number" ? { duration: options } : options || {};
      const next = () =>
        mountAnimation(
          {
            duration: opts.duration || stored.duration,
            sound: preview ? "off" : opts.sound === undefined ? stored.sound : opts.sound,
          },
          preview,
        );
      if (active) {
        active.onFinished(next);
        active.skip();
        return active;
      }
      return next();
    }

    /** Client plugin body. */
    function apply(ctx) {
      const preview = typeof window !== "undefined" && window.__WLA_PREVIEW__ === true;
      installStyles();
      try {
        window.__DEEPSEA_ECHO__ = (options) => replay(options, preview);
      } catch {
        /* ignore */
      }

      const settings = readSettings();
      if (preview || settings.enabled) mountAnimation(settings, preview);

      let react = null;
      try {
        react = require("react");
      } catch {
        react = null;
      }
      if (react && !preview) {
        try {
          installSettingsSection(ctx, react, {
            readSettings,
            writeSettings,
            replay: (options) => replay(options, false),
          });
        } catch (error) {
          console.warn("[dsh-deepsea-echo] settings section unavailable:", error);
        }
      }

      ctx.effect(
        () => {
          return () => {
            if (active) active.dispose();
            active = null;
            removeStyles();
            try {
              delete window.__DEEPSEA_ECHO__;
            } catch {
              /* ignore */
            }
          };
        },
        "dsh-deepsea-echo: startup overlay",
      );
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    exports.name = "deepsea-echo";
    exports.__internal = { createStartupAnimation, buildMarkup, readSettings, writeSettings, BASE_MS };
    return module.exports;
  },
});
