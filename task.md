# AI 全流程自主交易与决策记录增强

## 1. 方案设计 (Planning)
- [x] 分析现有 `types.ts` 与 `App.tsx` 交易循环逻辑 <!-- id: 0 -->
- [x] 制定决策记录的数据结构与存储方案 (`implementation_plan.md`) <!-- id: 1 -->

## 2. 核心逻辑实现 (Implementation)
- [x] **Schema 更新**: 修改 `types.ts`，新增 `DecisionRecord` 结构，扩展 `Workspace`。 <!-- id: 2 -->
- [x] **逻辑增强**: 修改 `App.tsx` 中的 `runAIAnalysis` 与 `executeTradeForAgent`。
    - [x] 捕获 `HOLD` 决策。
    - [x] 将所有决策（含置信度、理由、策略名）写入新的决策记录表/数组。
    - [x] 优化日志输出，避免 `HOLD` 刷屏，但确保数据库留痕。 <!-- id: 3 -->
- [x] **持久化适配**: 确保新字段通过 `saveWorkspace` 正确存入后端 SQLite。 <!-- id: 4 -->

## 3. 界面展示 (UI)
- [x] **决策日志视图**: 在 UI (如 Logs 面板或独立面板) 增加“AI 思考”专属过滤器或视图。 <!-- id: 5 -->
- [x] **持仓备注**: 在持仓列表中展示AI最近一次对该标的的看法 (Tip 或 详情列)。 <!-- id: 6 -->

## 4. 验证与交付 (Verification & Testing)
- [x] **功能验证**: 验证 `BUY`/`SELL`/`HOLD` 均有记录，且重启不丢失。 <!-- id: 7 -->
- [x] Fix Infinite Polling Loop
- [x] Add Positions Table to Dashboard
- [x] **Plan AI Context Upgrade**
    - [x] Create `docs/upgrade_plan.md` to document requirements (Cross-day, Volume, Portfolio Context).
    - [x] Implement Backend History API (Phase 1)
    - [x] Update AI Prompt with Cross-day/Volume/Portfolio Context (Phase 2)
    - [x] Implement Dedicated Portfolio Page (Phase 3)
- [x] **单元测试 (Unit Tests)**:
    - [x] 配置 Vitest 测试环境。 <!-- id: 10 -->
    - [x] 为 `geminiService.ts` 编写 Mock 测试。 <!-- id: 11 -->
    - [x] 为 `akshare_service.py` 编写 History API 测试。 <!-- id: 12 -->
    - [x] 为 `marketService.ts` 编写 Mock 测试。 <!-- id: 12 -->
- [x] **全流程验证**: 生成架构验证报告 `docs/architecture_validation.md`。 <!-- id: 13 -->
- [x] **发布准备**: 修复构建报错 (`App.tsx` JSX 错误, TS 类型错误)，确保 `yarn build` 通过。 <!-- id: 14 -->
- [x] **运行时修复**: 修复前端 API 端口不匹配 (3001 vs 38211) 及 AI 模型地址拼接错误。 <!-- id: 15 -->
- [x] **体验优化**: 拦截 `mock-broker.com` 虚拟地址的请求，避免控制台报错。 <!-- id: 16 -->
- [x] **性能修复**: 修复导致 `ERR_INSUFFICIENT_RESOURCES` 的行情轮询无限死循环问题。 <!-- id: 17 -->
- [x] 编写交付文档 `docs/release_guide.md`。 <!-- id: 9 -->
