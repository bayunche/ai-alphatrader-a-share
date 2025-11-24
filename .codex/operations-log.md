# Operations Log

- Used `sequential-thinking` to outline task scope and key questions for AGENTS.md creation.
- Ran `ls`, `cat package.json`, and directory inspections (`components/`, `contexts/`, `services/`, `server/`, `src-tauri/`) to map structure and scripts.
- Authored `.codex/context-scan.json` and `.codex/context-sufficiency.json` to capture project overview and readiness.
- Created `AGENTS.md` contributor guidelines (320 words) and noted absence of automated tests in `.codex/testing.md` and `verification.md`.
- Rewrote `AGENTS.md` to中文并优化排版；重写 `README.md` 为开源风格，包含配置示例与构建/打包流程；强化 `.gitignore` 覆盖 env、Tauri 产物等。
- Added Tauri scaffolding to fix `yarn tauri build` failure: populated `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, and `src-tauri/build.rs`; validated with `cargo metadata`.
- 更新 `.codex/context-scan.json`、`.codex/context-sufficiency.json` 并新增 `.codex/context-question-2.json`，记录 tauri.bundle.icon 缺失图标导致构建失败的现状；通过 `ls`/`rg` 确认仓库无 icons 目录或图标文件。
- 生成 `src-tauri/app-icon.png` 与 `src-tauri/icons`（32/128/256 PNG、ICO、ICNS），记录 `yarn tauri icon` 因缺少 `@tauri-apps/cli-linux-x64-gnu` 失败，以及 `cargo build` 因缺少 pkg-config/openssl 开发库失败（图标检查已通过）；同步更新 testing.md 与 verification.md。
- 输出 `.codex/review-report.md`，总结评分与剩余风险。
- 为样式打包落地本地 Tailwind 流程：新增 `tailwind.config.js`、`postcss.config.js`、`index.css`，在 `index.tsx` 引入并移除 index.html 的 CDN tailwind 引用；排除 tsc 扫描 `src-tauri/target`。本地 `yarn build` 仍因缺少 `@rollup/rollup-linux-x64-gnu` 失败，需要在目标平台重新安装依赖。
- 行情页完善：将东方财富抓取 pz 提升至 200，作为临时证券主表；为市场搜索框绑定状态与过滤，补充无匹配提示；更新 `.codex/context-scan.json`（market_page）、`.codex/context-question-3.json`、`.codex/context-sufficiency.json` 说明现状。
- 后端 sidecar 集成：server/index.js 支持 DATA_DIR/PORT、pkg 打包；package.json 增加 build:server/build:desktop 与 pkg 依赖；tauri.conf.json 先跑 build:server 并注册 externalBin=bin/server（去掉重复 target）；main.rs 启动/退出管理 sidecar；API_BASE 改为 VITE_API_BASE 默认 127.0.0.1；README 补充使用说明，.gitignore 忽略 src-tauri/bin/。
- 补充：build:server 脚本改用 `npx pkg`，避免未全局安装 pkg 时命令找不到。
- 补充：sidecar 直接生成 `src-tauri/bin/server-x86_64-pc-windows-msvc.exe`，externalBin 配合基名 `bin/server`，避免双重追加 target；Rust 侧启用 `process-command-api` 并用 RunEvent 清理 sidecar。
- 补充：server `/api/market` 增加多页拉取+缓存（MARKET_MAX_PAGES/MARKET_PAGE_SIZE，可配置），分页返回 total；前端使用后端 total 计算页数，不再本地切片。
- 补充：前端 fallback 时也会多页抓取东方财富（最多5页）后分页，避免后端不可用时只剩一页数据。
- 补充：英为财经兜底（VITE_YW_API/YINGWEI_API），导出改用 Tauri fs/dialog，新增依赖 `@tauri-apps/api` 以通过 Rollup 解析。
