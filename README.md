# dsh-whale-startup · 深海鲸鱼娘启动动画

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面加一段约 **4.6 秒**的
明日方舟风格全屏启动动画：PRTS 终端自检 → 声呐扫描 → 全息锁定 → 干员档案 → 深海回响定格，
深蓝工业 HUD、鲸鱼娘全息登录与干员档案，播放结束自动淡出进入界面。

> 每次打开或刷新 DSH Web 页面时自动播放；**点击任意位置 / 按 Esc 立即跳过**；
> 设置 →「启动动画」里可以关掉、改时长（3.6s / 4.6s / 5.0s）或立即重播。

![启动动画关键帧](preview/storyboard.png)

## 分镜 / Storyboard

| 时间 | 画面 |
| --- | --- |
| 0.0 – 2.0s | **PRTS 终端自检**：深蓝终端 HUD、逐字启动日志、「深海回响计划」标题、声呐扫描环 + 雷达扫描线 |
| 1.0 – 2.1s | **全息锁定**：目标环展开，Q 版鲸鱼娘以扫描线遮罩 + RGB 分离逐段显现，`TARGET ACQUIRED` |
| 2.0 – 3.6s | **干员档案**：切镜黑场 → 绝密标签、`鲸鱼娘 / WHALE-01`、六项属性条填满、`AUTHORIZED` 印章、全身立绘滑入 + 光扫 |
| 3.6 – 4.4s | **深海回响定格**：扫描光刃炸开、鲸鱼徽记描边点亮、`DEEPSEEK HARNESS` 字标与「深海回响 · 启动完成」 |
| 4.4 – 4.6s | 白光闪一下，遮罩淡出，露出下面的 DSH 界面 |

配色：深海军蓝底（`#01040c → #0a2a52`）+ DSH 蓝光效（`#4d6bfe`）+ 冰青高光（`#8be8ff`），
切角面板 / 等宽字 / 细线刻度 / 菱形装饰，尽量贴近明日方舟的界面语言。

完整动效录屏（70 帧）：[`preview/startup-animation.webp`](preview/startup-animation.webp)
可交互预览：[`preview/index.html`](preview/index.html)（`?t=2500` 可定格在 2.5s）

## 安装

```sh
# 从 GitHub 安装（在 DSH 命令行里）
dsh plugin --profile web add https://github.com/cshengyi023-collab/dsh-whale-startup

# 装好后刷新页面即可看到动画；桌面端同理（profile 名按需替换为 desktop）
```

插件包含预构建的 `lib/client.js`，安装后**不需要额外的构建步骤或构建脚本授权**。

## 使用

- **播放**：打开或刷新 DSH 页面时自动全屏播放一次；
- **跳过**：播放中点击任意位置，或按 `Esc`；
- **设置**：设置 →「启动动画」→ 启用开关 / 播放时长（3.6s / 4.6s / 5.0s）/ 重播动画；
- **偏好存储**：`localStorage["dsh-whale-startup:v1"]`。

## 卸载

```sh
dsh plugin --profile web remove dsh-whale-startup
```

## 实现

- 纯 **client 插件**（`dsh.client.platform = "web"`）：host 半边只有一个空的 `apply()`，
  让包在 profile 里有 Loader entry；浏览器半边由 DSH 的 client module system 以
  `/plugins/dsh-whale-startup/client.js` 提供给页面。
- `lib/client.js` 是**手写的 lazy-CJS bundle**（`window.__ModuleLoader__.load({ id, factory })`），
  素材以 data URI 内嵌，离线可用、无第三方依赖。
- 插件 `apply()` 时立刻把全屏遮罩挂到 `document.documentElement` 上（早于 shell 首帧），
  播放完或插件被禁用时移除全部 DOM、样式与事件监听；另有看门狗兜底，渲染出错也不会卡住界面。
- 动画是一条由 `requestAnimationFrame` 驱动的可寻址时间轴（`render(t)`，基准 4600ms）：
  DOM 变换、Canvas 粒子、遮罩、逐字文本都在同一帧函数里计算；时长选项只是对时间轴整体缩放。
- 设置页注册在 `settings.section` 插槽（id `whale-startup`）。

## 开发

```sh
# 重新生成 lib/client.js（把 assets/ 里的立绘内嵌进 bundle）
node scripts/build.mjs

# 本地预览（浏览器打开，自动播放；?t=2500 定格在 2.5s）
open preview/index.html

# 用无头 Chrome 逐帧截图，重建 preview/startup-animation.webp 与 storyboard.png
chrome --headless=new --window-size=960,540 \
  --screenshot=frame.png "file:///<repo>/preview/index.html?t=2500"
python scripts/make-preview-assets.py <frames-dir>
```

## 目录

```
lib/index.js              host 半边（空 apply）
lib/client.js             浏览器半边（构建产物，内嵌素材）
src/client.template.js    动画源码（模板，含 __ASSET_*__ 占位）
cordis.patch.yml          bundle patch：把插件插进 profile
assets/                   角色立绘、颗粒贴图、插件图标、市场截图
preview/                  动效预览、关键帧、可交互预览页
scripts/                  构建 / 预览素材脚本
```

## 许可

- **代码**：MIT（见 [`LICENSE`](LICENSE)）。
- **角色美术**：**不适用 MIT**，按 **CC BY-NC-SA 4.0** 随仓库非商业分发，署名链为
  上善（角色原案）→ ZipZipPipe（女仆装再设计）→ Small-tailqwq（本仓库所用素材版本）。
  详见 [`NOTICE-ARTWORK.md`](NOTICE-ARTWORK.md) 与 [`LICENSE-ARTWORK.md`](LICENSE-ARTWORK.md)。
  商业使用请替换为你有权使用的立绘。若你是权利人希望下架相关素材，请开 issue，我们会立刻替换或移除。

## English

An Arknights-flavoured startup animation for the DeepSeek Harness Web GUI: a PRTS terminal
boot, sonar scan, hologram lock-on and an operator file ending in a deep-sea lockup
(about 4.6 seconds). It plays full-screen on every page load, can be skipped with a click
or `Esc`, and can be switched off, re-timed (3.6s / 4.6s / 5.0s) or replayed from
**Settings → 启动动画** (Startup Animation). Implemented as a client-only DSH plugin with a
hand-written lazy-CJS bundle and embedded artwork — no build step and no runtime dependencies.
Code is MIT; the character artwork is CC BY-NC-SA 4.0 (see `NOTICE-ARTWORK.md`).
