# BewlyBewly

English | [官话 - 简体中文](README-cmn_CN.md) | [官話 - 繁體中文](README-cmn_TW.md) | [廣東話](README-jyut.md)

<p align="center" style="margin-bottom: 0px !important;">
<img width="300" alt="BewlyBewly icon" src="https://cdn.jsdelivr.net/gh/BewlyBewly/Imgs/logos/bewlybewly-vtuber-logo.png"><br/>
</p>

<p align="center">Just make a few small changes to your Bilibili homepage.</p>

<!-- ![min1](https://github.com/hakadao/BewlyBewly/assets/33394391/951f9e2a-d0e1-452c-83a9-dc6d85c4d441)
![min2](https://github.com/hakadao/BewlyBewly/assets/33394391/3e75dd20-f60b-4645-b434-23a24c72959c) -->

## 👋 Introduction

> [!IMPORTANT]
> BewlyBewly mainly focuses on page adjustments and optimization rather than improving functionally and efficiency.
>
> The dark mode will only be adapted to commonly used pages due to its efficiency and maintenance difficulty, while less
> frequently used pages will not to be adapted.

> [!NOTE]
> This project maintains Chromium builds for browsers such as Chrome and Edge, and Firefox builds. Installation grants access to Bilibili and hdslb.com. Firefox also uses cookie and request-header permissions to keep Bilibili sessions working in their respective containers.

BewlyBewly is a browser extension for BiliBili that aims to enhance the user experience by redesigning the BiliBili UI.
The design is inspired by YouTube, Vision OS, and iOS, resulting in a more visually appealing and user-friendly interface.
This project uses the [vitesse-webext](https://github.com/antfu/vitesse-webext) template for development.
Without this template, it may not be possible to develop this project.

## ⬇️ Installation

### Chromium (Chrome and Edge)

1. Extract `extension.zip`.
2. Open `chrome://extensions/` in Chrome or `edge://extensions/` in Edge and enable Developer mode.
3. Select **Load unpacked**, choose the folder containing `manifest.json`, and refresh the Bilibili page.

[Chrome guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Edge guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

### Firefox

- For a temporary install, open **This Firefox** at `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `extension-firefox.zip` or its extracted `manifest.json`. Load it again after restarting Firefox.
- For a permanent install, use a Mozilla-signed XPI and select **Install Add-on From File** at `about:addons`. The locally built `extension.xpi` is an unsigned test package.

[Firefox temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) · [Firefox signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

See the [local development guide](docs/LOCAL_DEVELOPMENT-cmn_CN.md#多平台打包) for build and packaging commands.

## 🤝 Contribution & Build

See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

### Contributors

[![Contributors](https://contrib.rocks/image?repo=hakadao/BewlyBewly)](https://github.com/BewlyBewly/BewlyBewly/graphs/contributors)

## ❤️ Credits

- [vitesse-webext](https://github.com/antfu/vitesse-webext) - The template used for this project
- [UserScripts/bilibiliHome](https://github.com/indefined/UserScripts/tree/master/bilibiliHome),
[bilibili-app-recommend](https://github.com/magicdawn/bilibili-app-recommend) - Reference source for obtaining the access key
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) - Partial implementation of functionalities
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
