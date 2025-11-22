# Repository Guidelines

## 项目结构与模块分工
- 前端：Vite + React/TypeScript，入口 `index.tsx`/`index.html`，主逻辑 `App.tsx`，UI 组件放在 `components/`，状态与上下文在 `contexts/`，数据与 AI 辅助方法在 `services/`，共享类型集中于 `types.ts`。
- 后端：独立于 `server/`，使用 Express + sqlite3（参见 `index.js`、`schema.sql`）。
- 桌面端：Tauri 包装位于 `src-tauri/`（`main.rs`、`tauri.conf.json`）；发布桌面版本时同步更新。

## 构建、测试与开发命令
- 安装依赖：`npm install`（存在 `yarn.lock`，若改用 yarn 请保持一致）。
- 前端：`npm run dev` 本地开发，`npm run build`（先 `tsc` 后 `vite build`），`npm run preview` 预览产物。
- 桌面：`npm run tauri` 打包/运行 Tauri（需 Rust 工具链）。
- 后端：`cd server && npm install && npm start` 启动 API，数据表定义见 `server/schema.sql`。
- 配置：在 `.env.local` 设置 `GEMINI_API_KEY` 以启用 Gemini 能力。

## 代码风格与命名规则
- TypeScript 优先，函数式 React 组件，使用 Hooks 管理状态与副作用。
- 缩进 2 空格，单引号，行末分号，与现有文件保持一致；JSX 保持简洁。
- 组件使用 PascalCase，变量/函数使用 camelCase；UI 就近存放于 `components/`，服务逻辑在 `services/`，共享类型集中维护。

## 测试指南
- 目前无自动化测试；扩展功能时请引入 Vitest + React Testing Library。
- 用例命名 `*.test.ts`/`*.test.tsx`，可与源码同目录或放入 `__tests__/`。
- 优先覆盖交易决策链路（行情→策略→下单）、`services/api.ts` 的数据持久化、通知流程。

## 提交与合并请求规范
- 无现有提交记录时默认采用 Conventional Commits（如 `feat: 增加止损保护`、`fix: 去重重复通知`），保持动词现在时与简洁性。
- PR 需包含变更摘要、执行过的命令（见上）、UI 变更截图/GIF，以及对环境/配置影响的说明（如新增 GEMINI 变量或数据库变更）。
