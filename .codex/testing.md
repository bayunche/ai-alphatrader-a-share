# 构建与测试记录（本地 AI 执行）

- 命令：`yarn build`
- 结果：失败
- 输出摘要：rollup 调用时报错 `Cannot find module @rollup/rollup-linux-x64-gnu`（node_modules/rollup/dist/native.js），提示 npm 可选依赖安装缺失。
- 结论：需要在当前环境重新安装依赖（建议删除 node_modules 后在目标平台运行 `yarn install` 或显式安装对应 @rollup/rollup-<platform> 包）后再重试构建。
- 命令：`yarn tauri icon src-tauri/app-icon.png`
- 结果：失败
- 输出摘要：Node 无法加载 `@tauri-apps/cli-linux-x64-gnu`，node_modules 仅存在 `cli-win32-x64-msvc`，需安装对应平台二进制或在 Windows 环境执行。
- 命令：`cargo build`（在 src-tauri/，已启用网络下载依赖）
- 结果：失败
- 输出摘要：tauri 依赖下载成功并进入编译阶段，最终在 `openssl-sys v0.9.111` 构建时缺少 pkg-config/openssl 开发库，提示安装 `pkg-config` 与 `libssl-dev` 等。
- 结论：当前图标缺失问题已消除（构建不再因 icon 报错），但完整构建仍需准备平台工具链（pkg-config、OpenSSL dev、匹配平台的 @tauri-apps/cli 二进制）。
- 命令：`yarn build`（添加本地 Tailwind 流程后）
- 结果：失败
- 输出摘要：缺少 `@rollup/rollup-linux-x64-gnu` 可选依赖导致 rollup native 加载失败；需在目标平台重装依赖或显式安装对应 rollup 二进制包。
