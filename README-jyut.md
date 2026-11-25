# BewlyBruce

[English](README.md) | [官话 - 简体中文](README-cmn_CN.md) | [官話 - 繁體中文](README-cmn_TW.md) | 廣東話

<p align="center" style="margin-bottom: 0px !important;">
<img width="112" alt="BewlyBruce icon" src="./assets/icon-512.png"><br/>
</p>

<p align="center">係咁以執吓你嘅 Bilibili 主頁。</p>

<!-- ![min1](https://github.com/hakadao/BewlyBewly/assets/33394391/951f9e2a-d0e1-452c-83a9-dc6d85c4d441)
![min2](https://github.com/hakadao/BewlyBewly/assets/33394391/3e75dd20-f60b-4645-b434-23a24c72959c) -->

## 👋 介紹

> [!IMPORTANT]
> BewlyBruce 主要着重頁面調整同埋改善, 而唔係完善功能同提升效率
>
> 事關考慮到維護嘅效率同埋難度, 深色模式淨係會適應常用頁面, 一啲冇咁常用嘅頁面唔會適應調整

> [!NOTE]
> 維護範圍包括 Chromium（Chrome、Edge 等）同 Firefox。安裝嗰陣請允許延伸功能存取 Bilibili 同 hdslb.com。Firefox 亦會用 Cookie 同請求標頭權限維持網站同容器嘅登入狀態。

BewlyBruce 係一個用於 BiliBili 嘅瀏覽器延伸功能，目的係透過重新設計 BiliBili 嘅 UI 令到用戶體驗提升。設計靈感源於 YouTube、Vision OS 同 iOS，從而實現更具視覺吸引力同用戶友好嘅介面。

呢個專案係用咗 [vitesse-webext](https://github.com/antfu/vitesse-webext) 範例進行開發。若果冇咗呢個範例，BewlyBruce 得個吉。

## ⬇️ 單撈

### Chromium（Chrome、Edge）

1. 解壓 `extension.zip`。
2. Chrome 開 `chrome://extensions/`，Edge 開 `edge://extensions/`，打開開發人員模式。
3. 撳「載入未封裝項目」，揀有 `manifest.json` 嘅資料夾，再重新整理 Bilibili 頁面。

[Chrome 官方指引](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Edge 官方指引](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

### Firefox

- 開 `about:debugging#/runtime/this-firefox` 嘅「此 Firefox」，撳「暫時載入附加元件」，揀 `extension-firefox.zip` 或者解壓後嘅 `manifest.json`。重開 Firefox 之後要再載入。
- 長期安裝請用 Mozilla 簽署嘅 XPI，喺 `about:addons` 揀「從檔案安裝附加元件」。本機打包嘅 `extension.xpi` 係未簽署嘅測試包。

[Firefox 暫時安裝](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) · [Firefox 簽署要求](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

要自己建置同打包，可以睇[本機開發與建置](docs/LOCAL_DEVELOPMENT-cmn_CN.md#多平台打包)。

## 🤝 貢獻同建置專案

睇吓 [CONTRIBUTING.md](docs/CONTRIBUTING-jyut.md)

### 貢獻者

[![Contributors](https://contrib.rocks/image?repo=hakadao/BewlyBewly)](https://github.com/BewlyBewly/BewlyBewly/graphs/contributors)

## ❤️ 鳴謝

- [vitesse-webext](https://github.com/antfu/vitesse-webext) - 專案所用嘅範例
- [UserScripts/bilibiliHome](https://github.com/indefined/UserScripts/tree/master/bilibiliHome), [bilibili-app-recommend](https://github.com/magicdawn/bilibili-app-recommend) - 參考取得 access key 之方法
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) - 部分功能嘅實現
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
