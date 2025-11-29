# AI AlphaTrader (A-Share) 🟢

面向 A 股模拟/策略验证的 AI 交易助手，前端基于 Vite + React + TypeScript，后端使用 Express + sqlite3，另提供 Tauri 包装以分发桌面版本。

## 核心特性
- 多智能体交易面板：监控行情、执行策略、查看交易日志与资金曲线。
- 数据与服务分层：前端在 `services/` 统一封装行情、Gemini/OPENAI 兼容/Ollama 推理、通知、持久化调用。
- 行情链路：优先后端 `/api/market` 缓存，失败回退东财/英为；非交易时同一关键字仅首开拉取一次；行情异常会提示并自动暂停交易，恢复后自动继续。
- 模型与券商探活：启动前自动检查智能体（Gemini/OpenAI 兼容/Ollama）可用性并在 UI 标记，可手动刷新；真实券商模式需用户自行配置 endpoint 并通过 `/health` 探活，否则禁止启动。
- 交易风控：内置滑点、限价偏离、单次/单标的仓位上限；行情异常时拒绝下单；默认提供 Sandbox（本地模拟）与 Real（用户自配券商）两种模式。
- 行情采集脚本：`server/eastmoney.py` 提供东财 push2/push2his 全量主表、实时行情、日线 K 线抓取，落地 SQLite（`a_stock_master` / `a_stock_kline_daily`），支持仅刷新价格。
- 桌面发行：`src-tauri/` 集成 Tauri，可打包为桌面应用，sidecar 启动后端并共用数据库。

## 项目结构
```
App.tsx                 # 主应用入口
components/             # UI 组件（SideBar、Charts、Settings 等）
contexts/               # 状态/语言/鉴权上下文
services/               # 行情、AI、通知、数据接口封装
server/                 # Express + sqlite3 后端（index.js、schema.sql）
src-tauri/              # Tauri 配置与 Rust 入口
types.ts                # 共享类型定义
```

## 快速开始
1) 安装依赖：`npm install`  
2) 启动顺序：先启动 Akshare 微服务（`python3 server/akshare_service.py --port 5001`，或打包后的 sidecar），再启动后端 `node server/index.js`（或 Tauri sidecar），最后启动前端 `npm run dev`（前端行情强制依赖后端）。  
3) 配置智能体：在「设置-智能体」中为每个 Agent 选择 Provider（Gemini/OpenAI 兼容/Ollama），填写接口地址/Key，点击“检查智能体可用性”确认通过后再启动。  
4) 切换交易模式：默认 Sandbox（本地模拟）；如需真实券商，请在「资金管理」或设置中提供券商 endpoint，确保 `/health` 可访问后切到 Real。  
5) 行情抓取（可选）：安装 Python 依赖后运行 `python3 server/eastmoney.py`，初始化主表/日线数据。  

## 配置说明
- 必备环境：Node.js 18+，Rust（Tauri），Python 3.10+（东财脚本，需 `pandas`、`requests`），sqlite3 随 npm 自动安装。
- 后端基址：在 `.env.local` 设置 `VITE_API_BASE=http://127.0.0.1:3001/api`（可选，Tauri 打包默认 sidecar 3001），`VITE_FORCE_BACKEND=true` 时强制走后端行情。
- 模型配置：通过前端设置界面填写，不写入代码库。支持 Gemini（需 API Key）、OpenAI 兼容（如 Azure、APIProxy）、本地 Ollama。UI 会为不可用模型显示 “不可用” 标签。
- 券商配置：真实交易需用户自备接口并在 UI 填写 endpoint，要求提供 `/health`，通过后方可切换 Real 模式；默认 Sandbox 为本地模拟，不会产生真实交易。
- 行情行为：非交易时同一搜索关键字仅首开拉一次；行情拉取失败会提示并暂停交易，恢复成功后自动继续。

## 构建与打包
- Web 构建：`npm run build`（先 TypeScript 检查，再产出 `dist/`）
- 后端打包（Tauri sidecar）：`yarn build:server`，基于 `pkg` 将 `server/index.js` 打成 `src-tauri/bin/server.exe`，并内置 `schema.sql`，数据库文件落在 Tauri 的 app 数据目录（`DATA_DIR`）。
- 桌面打包：`yarn build:desktop`（等价于 `yarn build:server && yarn tauri build`，需 Rust）；如遇图标/平台依赖错误，请确保 `assets/desktop_icon_rgba.png` 与 `assets/tray_icon_rgba.png` 存在且为 RGBA，并安装匹配平台的 Tauri CLI/openssl。
- 部署建议：将 `dist/` 交由任意静态资源服务器（如 Nginx）；后端服务独立部署，确保前端调用的 API 基址已通过配置或环境变量提供。

## 已知限制
- 当前环境 `yarn build` 依赖可选包 `@rollup/rollup-linux-x64-gnu`，缺失会导致打包失败；请在目标平台重装依赖或显式安装匹配的 rollup 可选二进制。
- Tauri/sidecar 构建需 Rust 工具链与平台 openssl/CLI，未满足会编译失败。
- `server/test_eastmoney.py` 需 `pandas`/`requests`，未安装会无法运行单测。

## 测试
- 前端：暂无自动化测试，建议引入 Vitest + React Testing Library；用例命名 `*.test.ts(x)`。
- 后端行情脚本：`server/test_eastmoney.py` 使用 mock 覆盖东财解析与 SQLite 入库；运行前需安装 pandas/requests。

## 贡献指引
- 提交信息建议遵循 Conventional Commits，例如 `feat: 增加止损保护`、`fix: 去重重复通知`。
- 提交或 PR 前请附带运行过的关键命令与必要的截图/GIF，并说明对配置或数据库的影响。

## 许可
未明确许可协议，请在发布前补充合适的开源协议（如 MIT）。
