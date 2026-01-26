# 智能体交易能力升级计划 (AI Trading Agent Upgrade Plan)

## 1. 背景
当前 AI 交易决策主要基于“实时快照”数据（价格、涨跌幅、简单分时趋势），缺乏对跨日趋势、成交量形态以及账户持仓状态的深度感知，限制了策略的复杂复度与准确性（如无法有效执行止盈止损或趋势跟踪）。

## 2. 升级目标
构建更完整的 **交易上下文 (Trading Context)**，这包括三个核心维度的增强：

### 2.1 跨日趋势上下文 (Cross-day Context)
**现状**：仅知晓当日涨跌，无法判断当前价格处于长期趋势的高位、低位或突破点。
**计划**：
- **后端**：在 `akshare_service` 中新增 `/history` 接口，提供指定标的近 N 天（如 20-60 天）的日线数据（Open/High/Low/Close/Volume）。
- **AI Prompt**：增加 `HISTORY_CONTEXT` 字段，以 ASCII 图表或简化数组形式传入最近 5-10 日的 K 线形态。
- **预期能力**：识别日线级别的趋势（上升/下降通道）、均线支撑/压力、突破形态。

### 2.3 持仓感知与 UI 增强 (Portfolio & UI)
**现状**：
- UI: 目前持仓通过 Dashboard 列表展示，缺乏独立分析视图。
- AI: Prompt 仅包含 `Available Cash` 和 `Current Position Quantity`。

**计划**：
- **UI 独立页面**：新增 **"持仓管理 (Portfolio Manager)"** 独立页面，提供：
    - 持仓列表（含成本、现价、盈亏比、持仓天数）。
    - 账户风险分析图表（持仓分布、现金占比）。
    - 手动干预入口（一键清仓、手动调仓）。
- **AI Prompt**：扩充 `PORTFOLIO STATUS` 区块，增加：
  - **Average Cost** (持仓成本)：AI 可据此判断当前是浮盈还是浮亏。
  - **Unrealized PnL** (未实现盈亏)：明确盈亏比例。
  - **Exposure** (风险敞口)：当前持仓占总资产的比例。
- **预期能力**：
  - **止盈/止损**：感知到浮亏 -5% 时触发更严格的卖出逻辑。
  - **加仓管理**：感知到已有底仓且浮盈时，在趋势确认后进行加仓（Pyramiding）。

### 2.4 趋势序列与量能 (Trend Sequence & Volume)
**现状**：Prompt 中包含 20 个 tick 的价格趋势，但**缺失成交量**。
**计划**：
- **AI Prompt**：
  - 增加 **近 20 笔趋势序列 (Recent 20 Ticks)**：包含价格与成交量的序列数据 `[(Price, Vol), (Price, Vol)...]`，捕捉即时资金流向。
  - 增加 **成交量分析**：显式计算量比（Volume Ratio）或资金流入流出状态。

## 3. 实施路线图

### 阶段一：数据层改造 (Backend)
- [ ] 修改 `server/akshare_service.py`，新增 `ak.stock_zh_a_hist` 封装接口。
- [ ] 修改 `server/index.js`，增加对应的 Proxy 路由。
- [ ] 修改 `types.ts`，扩展 `MarketData` 结构以承载历史数据字段。

###  阶段二(Frontend Service)
- [ ] 修改 `services/geminiService.ts`：
  - 升级 `SYSTEM_PROMPT` 模板，注入上述新字段。
  - 优化 Prompt 结构，确保 Token 消耗在合理范围。

### 阶段三：集成与测试 (Integration)
- [ ] 在 `App.tsx` 的 `runAIAnalysis` 循环中，改为“先拉取上下文，再调用 AI”。
- [ ] 验证包含上下文的新 Prompt 能否被 Gemini/OpenAI 正确理解并产出更合理的决策（如“因放量突破而买入”）。

## 4. 示例 Prompt 结构 (预览)

```text
CURRENT MARKET DATA (600519):
- Price: ¥1500.00
- Volume: 50000 lots (High) <-- [NEW]
- Trend (20 ticks): [...] 

HISTORY (Last 5 Days):       <-- [NEW]
- D-4: Close 1450, Vol 200
- D-3: Close 1460, Vol 210
- D-2: Close 1480, Vol 300
- D-1: Close 1490, Vol 250
- Today: 1500...

PORTFOLIO:
- Cash: ¥50,000
- Position: 100 shares
- Avg Cost: ¥1400            <-- [NEW]
- PnL: +7.1% (Profit)        <-- [NEW]
```
