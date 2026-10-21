# 美术素材署名 / Artwork attribution

本插件的**代码**按 MIT 许可（见 [`LICENSE`](LICENSE)）。

以下内容由仓库自身生成，按 MIT 许可，不涉及第三方权利：

- `assets/sfx/startup.wav`：启动音效，由 [`scripts/make-sfx.py`](scripts/make-sfx.py)
  用纯数学合成（无采样素材）；
- `assets/icon-source.svg` → `assets/plugin-icon.png` / `assets/icon-512.png`：
  插件图标，矢量绘制 + 无头浏览器渲染；
- `lib/client.js` 中的界面装饰、Canvas 粒子、HUD 图形等均由代码绘制。

`lib/client.js` 内嵌的两张角色立绘（Q 版鲸鱼娘 `assets/whale-chibi.webp`、招手女仆款全身鲸鱼娘
`assets/whale-splash.webp`）**不适用 MIT**，其权利属于下列作者，按
**CC BY-NC-SA 4.0** 使用（署名 / 非商业 / 相同方式共享）。

这两张图取自本机已安装的「深海女仆工坊 / Abyssal Maid Atelier」皮肤
（`@smalltailqwq/dsh-client-ui-skin-maid-atelier`）的 `assets/runtime/` 目录，
经裁切、缩放并转码后内嵌进本插件。本插件以 **MIT（代码）+ CC BY-NC-SA 4.0（美术）**
的组合公开发布于本仓库，供非商业使用；美术部分的许可条款见
[`LICENSE-ARTWORK.md`](LICENSE-ARTWORK.md)。

## 创作链 / Attribution chain

1. **一创（角色原案）**：上善 —— 鲸鱼娘（whale-girl）角色形象的原作者。
   Pixiv: https://www.pixiv.net/users/62155430
   The original whale-girl character design.

2. **二创**：ZipZipPipe —— 在上善的鲸鱼娘形象基础上加入 DeepSeek 元素的女仆鲸鱼娘二次设计
   （生成模型：GPT Image 2）。
   Pixiv: https://www.pixiv.net/users/18604994
   The maid whale-girl redesign adding DeepSeek elements, based on 上善's whale-girl.

3. **三创（本插件所用素材来源）**：Small-tailqwq（dsh-external/dsh-deep-whale）——
   「深海女仆工坊」皮肤中使用的该形象再设计素材。
   The DeepSeek-element design used by the maid-atelier skin.

素材许可条款：**CC BY-NC-SA 4.0** —— 必须保留以上完整创作链署名；仅限非商业使用；
衍生作品必须以相同方式共享。完整第三方声明见源皮肤的 `NOTICE` 与 `LICENSE-ARTWORK`。

## 本插件对素材的改动 / Modifications

- 裁掉透明留白（trim），等比缩放到 488×456（Q 版）与 829×1500（全身）；
- 转码为 WebP（质量 90–92）以便内嵌进浏览器端 bundle；
- 动画中的调色、遮罩、扫描线、RGB 分离等**均为运行时 CSS/SVG/Canvas 效果**，不修改像素源文件。

以下内容为品牌标识，不属于 MIT 授权范围：

- **DeepSeek 鲸鱼标志**（`assets/deepseek-mark.svg`，并用于启动动画中的品牌徽记与背景剪影）：
  商标与版权归 **DeepSeek（深度求索）** 所有，路径数据取自
  [Simple Icons](https://simpleicons.org/)（CC0 描述）。本项目仅将其用于标识 DeepSeek Harness
  生态与产品身份，不主张任何商标权。
