# AI AlphaTrader (A-Share) 🟢

面向 A 股模拟/策略验证的 AI 交易助手，前端基于 Vite + React + TypeScript，后端使用 Express + sqlite3，另提供 Tauri 包装以分发桌面版本。

## 核心特性
- 多智能体交易面板：监控行情、执行策略、查看交易日志与资金曲线。
- 数据与服务分层：前端在 `services/` 统一封装行情、Gemini 推理、通知、持久化调用。
- 可选后端：`server/` 提供 Express + sqlite3 API 与 schema；无后端时前端也可独立运行。
- 桌面发行：`src-tauri/` 集成 Tauri，可打包为桌面应用。

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

## 环境与配置
- Node.js 18+（建议），Rust toolchain（用于 Tauri），sqlite3 由 npm 自动安装。
- 在根目录创建 `.env.local`，示例：
```bash
GEMINI_API_KEY=your_key_here
```

## 开发与运行
1. 安装依赖：`npm install`
2. 前端开发：`npm run dev`（Vite，默认监听 5173）
3. 后端启动（可选）：`cd server && npm install && npm start`（默认 3001）
4. 预览打包产物：`npm run preview`

## 构建与打包
- Web 构建：`npm run build`（先运行 TypeScript 检查，再产出 `dist/`）
- 桌面打包：`npm run tauri`（需要 Rust；产物位于 `src-tauri/target`）
- 部署建议：将 `dist/` 交由任意静态资源服务器（如 Nginx）；后端服务独立部署，确保前端调用的 API 基址已在服务封装中配置或由环境变量提供。

## 测试
当前仓库暂无自动化测试，新增功能时建议引入 Vitest + React Testing Library；用例命名 `*.test.ts(x)`。

## 贡献指引
- 提交信息建议遵循 Conventional Commits，例如 `feat: 增加止损保护`、`fix: 去重重复通知`。
- 提交或 PR 前请附带运行过的关键命令与必要的截图/GIF，并说明对配置或数据库的影响。

## 许可
未明确许可协议，请在发布前补充合适的开源协议（如 MIT）。
