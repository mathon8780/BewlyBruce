# BewlyBruce Firefox build instructions

The Firefox add-on ID is `mathon@bewlybewly.com`. The extension version comes
from `package.json`. The submitted build uses Windows x64 (build 26200),
Node.js 24.16.0, and pnpm 9.5.0.

Install [Node.js 24.16.0](https://nodejs.org/dist/v24.16.0/), extract the source
ZIP, and run these commands from the directory containing `package.json`.

```sh
npm install --global pnpm@9.5.0
pnpm install --frozen-lockfile
pnpm run build-firefox
```

The installation downloads the dependencies pinned by `pnpm-lock.yaml` from
the package registry. No Bilibili account, API key, or signing credentials
are needed to build. The Git hook installer may report a missing Git
directory in a source archive.

The generated files are in `extension-firefox/`. Extract the uploaded
extension ZIP into a second directory to compare its file names and bytes
with this build. To package the reproduced files, run the following command.

```sh
pnpm exec web-ext build --source-dir extension-firefox --artifacts-dir . --filename extension-firefox.zip --overwrite-dest
```

The Firefox manifest is generated from `src/manifest.ts`. Vite compiles the
Vue UI and the content scripts, tsup bundles the background scripts, and
`scripts/prepare.ts` copies the bundled assets. The configuration, scripts,
lockfile, and license are included in the source archive.
