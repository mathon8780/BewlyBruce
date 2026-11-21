# 本机开发与构建

需要 Node.js 24 或更高版本、pnpm 9.5.0。项目使用 Bilibili 网站服务，不需要本地后端。依赖以 `pnpm-lock.yaml` 为准。

## 开发

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

默认 Vite 地址为 `http://localhost:3303`。Chrome 打开 `chrome://extensions/`，Edge 打开 `edge://extensions/`，启用开发者模式后加载仓库的 `extension/` 目录，再访问 Bilibili。

Firefox 使用 `pnpm dev-firefox` 和生成的 `extension-firefox/` 目录。开发服务持续运行时可刷新页面，修改清单后根据浏览器提示重新加载扩展。未启用的 popup/options 演示源码不进入生产构建。

使用 `Ctrl+C` 停止开发服务后再生产构建，避免开发和生产任务同时写同一输出目录。

## 验证与生产构建

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm build
pnpm build-firefox
```

`pnpm test` 执行一次必要回归测试。

## 多平台打包

先用同一份源码执行 `pnpm build` 和 `pnpm build-firefox`，再执行 `pnpm run pack` 生成两端安装包。版本取自 `package.json`，生成目录与压缩包均不纳入 Git。

| 平台 | 构建 | 打包 | 产物 |
| --- | --- | --- | --- |
| Chrome/Edge | `pnpm build` | `pnpm pack:zip` | `extension/`、`extension.zip` |
| Firefox | `pnpm build-firefox` | `pnpm pack:zip-firefox`、`pnpm pack:xpi` | `extension-firefox/`、`extension-firefox.zip`、`extension.xpi` |

Firefox XPI 是本地未签名测试包。浏览器的加载步骤和长期安装所需的签名见 [README 安装说明](../README-cmn_CN.md)。

Firefox 提审另需源码包。验证和打包使用同一份源码。干净工作区可用 `pnpm pack:zip-firefox-sources` 归档对应的 `HEAD`。本地反馈图片放在已忽略的 `feedback/`，不会进入提交或源码归档。

默认发布配置仅在本地创建版本提交和标签并打包。商店提交单独执行。

优化内容、体积数据和验证限制统一记录在[仓库优化记录](OPTIMIZATION-cmn_CN.md)。
