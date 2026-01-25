# AI 全流程决策记录实现计划

## Goal Description
实现 AI 对每一次选股与交易决策的完整记录（包括 `HOLD`），并在界面上提供可视化查看方式，以便用户理解模型“为什么买/卖”以及“为什么不操作”。

## User Review Required
> [!IMPORTANT]
> 记录所有 `HOLD` 决策可能会导致数据量迅速增长（如果扫描频率高）。我们将限制每个智能体对每只股票仅保留**最近一次**的详细思考，历史思考归档或仅保留最近 1000 条全局思考记录，以防止 SQLite 数据库体积膨胀过快。

## Proposed Changes

### 1. 数据结构更新 (`types.ts`)
#### [MODIFY] [types.ts](file:///d:/code/ai-alphatrader-a-share/types.ts)
*   新增接口 `AIDecisionRecord`:
    ```typescript
    export interface AIDecisionRecord {
      id: string;
      agentId: string;
      symbol: string;
      timestamp: string;
      action: TradeAction; // BUY, SELL, HOLD
      reasoning: string;   // 核心思考内容
      confidence: number;
      strategyName: string;
      priceAtTime: number;
    }
    ```
*   更新 `Workspace` 接口，增加 `decisionHistory: AIDecisionRecord[]`。

### 2. 核心逻辑增强 (`App.tsx`)
#### [MODIFY] [App.tsx](file:///d:/code/ai-alphatrader-a-share/App.tsx)
*   **状态管理**: 新增 `decisionHistory` 状态 (`useState`)。
*   **决策捕获**:
    *   在 `runAIAnalysis` 的回调中，无论 `decision.action` 是什么，构造 `AIDecisionRecord` 对象。
    *   调用 `addDecision(...)` 函数将其存入状态。
*   **日志优化**:
    *   `BUY`/`SELL` 继续通过 `addLog` 写入主日志（高优先级）。
    *   `HOLD` 不写入主日志 (`logs`)，仅写入 `decisionHistory`，避免刷屏。

### 3. 数据持久化 (`services/api.ts`, `server/index.js`)
*   **前端适配**: 确保 `saveWorkspace` 包含 `decisionHistory`。
*   **后端检查**: `server/index.js` 的 `workspaces` 表存储的是 JSON 字符串，理论上无需修改 Schema，甚至不需要重启后端，只要 JSON 结构兼容即可。

### 4. 界面展示 (`components/LogsView.tsx` 或新组件)
*   **新增视图/Tab**: 在日志区域增加“AI 思考 (Thoughts)” 选项卡。
*   **展示内容**: 表格或流式列表，展示 Time, Agent, Symbol, Action, Reasoning。
*   **交互**: 点击某条记录可查看完整 `reasoning` 长文本。

## Verification Plan

### Manual Verification
1.  **启动系统**: `npm run dev` + `node server/index.js`。
2.  **触发分析**: 选中一个智能体和股票池，点击“启动”。
3.  **观察记录**:
    *   在“AI 思考”面板中，应能看到滚动的 `HOLD` 记录。
    *   当发生交易时，应同时在“系统日志”和“AI 思考”中看到记录。
4.  **持久化验证**: 刷新页面，确认之前的思考记录依然存在。
