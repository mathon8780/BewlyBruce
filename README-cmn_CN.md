# BewlyBewly

[English](README.md) | 官话 - 简体中文 | [官話 - 繁体中文](README-cmn_TW.md) | [廣東話](README-jyut.md)

<p align="center" style="margin-bottom: 0px !important;">
<img width="300" alt="BewlyBewly icon" src="https://cdn.jsdelivr.net/gh/BewlyBewly/Imgs/logos/bewlybewly-vtuber-logo.png"><br/>
</p>

<p align="center">只需对您的 Bilibili 主页进行一些小更改即可。</p>

<!-- ![min1](https://github.com/hakadao/BewlyBewly/assets/33394391/951f9e2a-d0e1-452c-83a9-dc6d85c4d441)
![min2](https://github.com/hakadao/BewlyBewly/assets/33394391/3e75dd20-f60b-4645-b434-23a24c72959c) -->

## 👋 介绍

> [!IMPORTANT]
> BewlyBewly 主要专注页面的调整和优化，而不是完善功能和提升效率。
>
> 由于效率和维护难度的原因，暗色模式只会适应常用页面，而不会适应不常用的页面。

> [!NOTE]
> 维护范围包括 Chromium（Chrome、Edge 等）和 Firefox。安装时授予扩展访问 Bilibili 和 hdslb.com 的权限。Firefox 还使用 Cookie 和请求头权限维持站点及容器登录状态。

BewlyBewly 是一个用于 BiliBili 的浏览器扩展，旨在通过重新设计 BiliBili 用户界面来提升用户体验。设计灵感来自于 YouTube、Vision OS 和 iOS，从而实现了更具视觉吸引力和用户友好性的界面。

该项目使用 [vitesse-webext](https://github.com/antfu/vitesse-webext) 模板进行开发。如果没有这个模板，可能无法开发出这个项目。

## 订阅与评论屏蔽

- 首页「订阅剧集」并行请求追番、追剧，每类每页 20 项；没有可用缓存或主动刷新时，首批返回即显示，后续分页自动补齐并合并更新，按上映时间从新到旧排序并去重，新返回的剧集可能调整已有卡片顺序；缺少上映时间时使用开播时间，两者均缺失时排在末尾。同一首页内切换标签会保留已加载结果，重复点击当前订阅标签不再刷新。
- 完整订阅结果会保存在扩展本地存储，刷新网页或重启浏览器后可先展示缓存。五分钟内直接复用，超过五分钟先展示再后台更新；有旧缓存时等新列表全部加载后整体替换。加载失败保留当前已显示的结果并提供重试，不缓存部分结果。缓存只保留最近账号、最多 2 MiB，超过三十天或账号不符时不使用；不保存封面图片。需立即获取订阅变动时使用刷新按钮。
- 「设置 → BewlyBewly 页面 → 订阅剧集」上方选择 A 封面叠加、B 海报详情或 C 下方信息，下方编辑该样式。每种样式独立保存信息显隐、封面裁切和标题行数，可单独恢复默认；A 还可选择悬停/聚焦展开或始终显示。预览与实际页面共用卡片组件，只显示一张示例卡片，A 直接呈现展开效果。默认采用 A，横向样式最多四列，海报样式自适应最多三列，封面宽度不超过 160px，详情紧跟标题，并优先使用竖版封面。未提供的数据显示「—」，总话数未知时显示已更新话数。设置子页保留编辑状态，切换时不再等待淡入动画。
- 「设置 → 常规 → 屏蔽」底部可开启「屏蔽含 @ 的一级评论」，默认关闭。只检查一级评论正文，命中后隐藏整条评论及其回复、查看回复入口、分隔线和间距；不单独检查回复中的 @。关闭开关后恢复显示。
- 「设置 → 常规 → 屏蔽」中的「屏蔽广告和推广」统一控制站内广告、搜索结果顶部推广和播放页推广。旧版三个开关中任一开启时，合并后的开关沿用开启状态。
- 「设置 → 常规 → 播放页面」中的「屏蔽相关推荐」独立控制普通视频、多分 P、合集、播放列表、稍后再看及番剧、影视播放页的推荐内容，保留分 P、合集和选集。

## 视频卡片与收藏

- 首页保留已设置的标签顺序和开关。已有配置中缺少的标签默认隐藏，隐藏当前标签后会切到第一个可见标签。
- 首页的个性推荐、正在关注、热门视频、排行和直播，以及番剧、观看历史、稍后再看和收藏页的卡片，标题固定预留两行高度。首页横向卡片的加载占位也显示两行标题。
- 在侧栏切换收藏夹，窄屏时在列表上方切换。左侧搜索仅匹配当前收藏夹。右侧「批量管理」支持逐项勾选或全选已加载条目，可将所选内容复制或移动到其他收藏夹，也可取消所选条目的收藏。「清理失效内容」确认后处理整个当前收藏夹。

## ⬇️ 安装

### Chromium（Chrome、Edge）

1. 解压 `extension.zip`。
2. 在 Chrome 打开 `chrome://extensions/`，在 Edge 打开 `edge://extensions/`，打开开发者模式。
3. 点击「加载已解压的扩展程序」，选择包含 `manifest.json` 的目录，再刷新 Bilibili 页面。

[Chrome 官方指南](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Edge 官方指南](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

### Firefox

- 在 `about:debugging#/runtime/this-firefox` 打开「此 Firefox」，点击「临时载入附加组件」，选择 `extension-firefox.zip` 或解压目录中的 `manifest.json`。重启后需要重新载入。
- 长期安装请使用经过 Mozilla 签名的 XPI，在 `about:addons` 中选择「从文件安装附加组件」。本地打包生成的 `extension.xpi` 是未签名的测试包。

[Firefox 临时安装](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) · [Firefox 签名要求](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

构建和打包命令见[本机开发与构建](docs/LOCAL_DEVELOPMENT-cmn_CN.md#多平台打包)。

## 🤝 贡献与构建项目

查看 [CONTRIBUTING.md](docs/CONTRIBUTING-cmn_CN.md)

### 贡献者

[![Contributors](https://contrib.rocks/image?repo=hakadao/BewlyBewly)](https://github.com/BewlyBewly/BewlyBewly/graphs/contributors)

## ❤️ 鸣谢

- [vitesse-webext](https://github.com/antfu/vitesse-webext) - 该项目使用的模板
- [UserScripts/bilibiliHome](https://github.com/indefined/UserScripts/tree/master/bilibiliHome),
[bilibili-app-recommend](https://github.com/magicdawn/bilibili-app-recommend) - 获取访问密钥的参考来源
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) - 部分功能实现
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
