# AI AlphaTrader 发布指南

本文档指导如何将代码打包为可分发的 Windows 安装包 (`.msi` 或 `.exe`)。

## 1. 环境准备 (Prerequisites)

在开始打包之前，请确保开发环境已安装以下工具：

1.  **Node.js**: 建议 v18+ (当前环境已就绪)
2.  **Rust**: Tauri 依赖 Rust 编译器。请运行 `rustc --version` 检查。
3.  **Visual Studio Build Tools**: 包含 C++ 构建工具 (Windows 必需)。

## 2. 快速打包 (Quick Start)

项目已配置一键打包脚本，会自动处理后端 (Node.js) 打包与前端 (Tauri) 构建。

在项目根目录运行：

```powershell
yarn build:desktop
```

### 该命令执行的动作：
1.  **构建后端**: 使用 `pkg` 将 `server/index.js` 打包为 `src-tauri/bin/server-x86_64-pc-windows-msvc.exe` (Sidecar)。
2.  **构建前端**: 运行 `vite build` 生成 `dist/` 静态资源。
3.  **打包桌面端**: 运行 `tauri build` 生成最终安装包。

## 3. 输出产物 (Artifacts)

打包成功后，安装包将生成在以下目录：

```text
src-tauri/
└── target/
    └── release/
        └── bundle/
            ├── msi/         # Windows Installer (.msi)
            └── nsis/        # Setup Executable (.exe)
```

**交付给用户时，只需发送 `nsis` 目录下的 `.exe` 安装包即可。**

## 4. 常见问题 (FAQ)

### Q: 报错 "resource directory not found"
**A**: 确保 `yarn build:server` 成功执行，并检查 `src-tauri/bin/` 下是否存在 `.exe` 文件。Tauri 需要 Sidecar 二进制文件存在才能打包。

### Q: 运行时提示 "API Key missing"
**A**: 打包后的应用处于生产模式。用户安装后，需要在 "设置" 页面手动填入 OpenAI/Gemini Key。生产环境**不会**内置开发者的测试 Key。

### Q: 如何构建 Python 依赖 (AkShare)?
**A**: 如果需要打包 Python 部分，请先运行 `yarn build:akshare` (需要 PyInstaller)，然后再运行 `yarn build:desktop`。
*注：当前版本主要依赖 Node.js 后端，Python 服务为可选组件。*

## 5. CI/CD 自动化 (Optional)

若需配置 GitHub Actions 自动发版，请参考 `.github/workflows/release.yml` (需新建)，核心步骤即调用 `yarn build:desktop` 并上传产物。
