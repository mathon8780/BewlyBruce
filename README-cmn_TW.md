# BewlyBewly

[English](README.md) | [官话 - 简体中文](README-cmn_CN.md) | 官話 - 繁體中文 | [廣東話](README-jyut.md)

<p align="center" style="margin-bottom: 0px !important;">
<img width="300" alt="BewlyBewly icon" src="https://cdn.jsdelivr.net/gh/BewlyBewly/Imgs/logos/bewlybewly-vtuber-logo.png"><br/>
</p>

<p align="center">只需對您的 Bilibili 主頁進行一些小改動就好。</p>

<!-- ![min1](https://github.com/hakadao/BewlyBewly/assets/33394391/951f9e2a-d0e1-452c-83a9-dc6d85c4d441)
![min2](https://github.com/hakadao/BewlyBewly/assets/33394391/3e75dd20-f60b-4645-b434-23a24c72959c) -->

## 👋 介紹

> [!IMPORTANT]
> BewlyBewly 主要著重於頁面調整和改良，而不是完善功能和提升效率。
>
> 由於考慮到效率和維護困難度，深色模式只會適應常用的頁面，而較少使用的頁面則不會支護。

> [!NOTE]
> 維護範圍包含 Chromium（Chrome、Edge 等）和 Firefox。安裝時請允許擴充功能存取 Bilibili 和 hdslb.com。Firefox 也會使用 Cookie 和請求標頭權限維持網站及容器的登入狀態。

BewlyBewly 是一個針對 BiliBili 的瀏覽器擴充功能，旨在透過重新設計 BiliBili 的介面來提升用戶體驗。設計靈感來自於 YouTube、Vision OS 和 iOS，使介面更具視覺吸引力和用戶友好性。

該專案使用 [vitesse-webext](https://github.com/antfu/vitesse-webext) 範例進行開發。如果沒有此範例，可能無法開發出此專案。

## ⬇️ 安裝

### Chromium（Chrome、Edge）

1. 解壓縮 `extension.zip`。
2. 在 Chrome 開啟 `chrome://extensions/`，在 Edge 開啟 `edge://extensions/`，啟用開發人員模式。
3. 選擇「載入未封裝項目」，選取包含 `manifest.json` 的資料夾，再重新整理 Bilibili 頁面。

[Chrome 官方指南](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Edge 官方指南](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

### Firefox

- 開啟 `about:debugging#/runtime/this-firefox`，選擇「此 Firefox」及「暫時載入附加元件」，選取 `extension-firefox.zip` 或解壓縮資料夾中的 `manifest.json`。重新啟動後須再次載入。
- 長期安裝請使用 Mozilla 簽署的 XPI，在 `about:addons` 選擇「從檔案安裝附加元件」。本機產生的 `extension.xpi` 是未簽署的測試套件。

[Firefox 暫時安裝](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) · [Firefox 簽署要求](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

建置與封裝方式請參閱[本機開發與建置](docs/LOCAL_DEVELOPMENT-cmn_CN.md#多平台打包)。

## 🤝 貢獻與建置專案

詳情 [CONTRIBUTING.md](docs/CONTRIBUTING-cmn_TW.md)

### 貢獻者

[![Contributors](https://contrib.rocks/image?repo=hakadao/BewlyBewly)](https://github.com/BewlyBewly/BewlyBewly/graphs/contributors)

## ❤️ 鳴謝

- [vitesse-webext](https://github.com/antfu/vitesse-webext) - 此專案所用的範例
- [UserScripts/bilibiliHome](https://github.com/indefined/UserScripts/tree/master/bilibiliHome), [bilibili-app-recommend](https://github.com/magicdawn/bilibili-app-recommend) - 參考取得 access key 之方法
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) - 部分功能的實現
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
