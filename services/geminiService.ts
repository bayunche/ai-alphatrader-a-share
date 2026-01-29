
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIConfig, MarketData, PortfolioState, AIResponse, TradeAction } from "../types";

// --- Shared Logic ---

import { KLineData } from "../types";
import { dataApi } from "./api";

const SYSTEM_PROMPT = (marketData: MarketData, portfolio: PortfolioState, lang: 'en' | 'zh', history: KLineData[] = []) => {
  const currentPosition = portfolio.positions.find(p => p.symbol === marketData.symbol);
  const cost = currentPosition?.averageCost || 0;
  const pnlPct = currentPosition?.pnlPercentage || 0;
  const holdingQty = currentPosition?.quantity || 0;
  const holdingValue = currentPosition?.marketValue || 0;
  const exposurePct = portfolio.totalEquity > 0 ? (holdingValue / portfolio.totalEquity * 100) : 0;

  // 计算历史数据统计
  const last5d = history.slice(-5);
  const avgVolume5d = last5d.length > 0 ? last5d.reduce((a, h) => a + h.volume, 0) / last5d.length : 0;
  const avgChange5d = last5d.length > 0 ? last5d.reduce((a, h) => a + h.change_pct, 0) / last5d.length : 0;
  const volatility5d = last5d.length > 1
    ? Math.sqrt(last5d.reduce((a, h) => a + Math.pow(h.change_pct - avgChange5d, 2), 0) / (last5d.length - 1))
    : 0;

  // 格式化历史（最近 5 日）
  const historyStr = history.slice(-5).map(h =>
    `${h.date}: O=${h.open} C=${h.close} H=${h.high} L=${h.low} Vol=${(h.volume / 10000).toFixed(0)}w Chg=${h.change_pct}%`
  ).join('\n');

  // 当日涨跌状态
  const dayTrend = marketData.change > 0 ? '上涨' : marketData.change < 0 ? '下跌' : '持平';
  const volumeRatio = avgVolume5d > 0 ? (marketData.volume / avgVolume5d).toFixed(2) : 'N/A';

  // 趋势分析（20 tick）
  const trendData = marketData.trend || [];
  const trendStart = trendData[0] || marketData.price;
  const trendEnd = trendData[trendData.length - 1] || marketData.price;
  const trendPctChange = trendStart > 0 ? ((trendEnd - trendStart) / trendStart * 100).toFixed(2) : '0';
  const trendDirection = trendEnd > trendStart ? '向上' : trendEnd < trendStart ? '向下' : '震荡';

  return `
ROLE: 你是一个专业的 A 股量化交易智能体，负责自主决策交易。
OBJECTIVE: 在控制风险的前提下，寻找高置信度的交易机会以获取 Alpha 收益。
RESPONSE FORMAT: 仅输出 JSON，不要任何 markdown 或额外文字。
LANGUAGE: reasoning 和 strategyName 字段请使用${lang === 'zh' ? '中文' : 'English'}。

═══════════════════════════════════════
📈 标的信息 (${marketData.name} - ${marketData.symbol})
═══════════════════════════════════════
• 当前价格：¥${marketData.price.toFixed(2)}
• 今日涨跌：${marketData.change.toFixed(2)}% (${dayTrend})
• 今日成交：${(marketData.volume / 100).toFixed(0)} 手
• 量比（vs 5日均量）：${volumeRatio}x
• 短期趋势（20tick）：${trendDirection}，变化 ${trendPctChange}%

═══════════════════════════════════════
📊 近 5 日 K 线数据
═══════════════════════════════════════
${historyStr || '暂无历史数据'}

• 5日平均涨跌：${avgChange5d.toFixed(2)}%
• 5日波动率：${volatility5d.toFixed(2)}%

═══════════════════════════════════════
💼 组合与持仓状态
═══════════════════════════════════════
• 可用现金：¥${portfolio.cash.toFixed(0)}
• 组合总值：¥${portfolio.totalEquity.toFixed(0)}
• 现金比例：${(portfolio.cash / portfolio.totalEquity * 100).toFixed(1)}%
• 当前持仓（${marketData.symbol}）：${holdingQty} 股
• 持仓成本：¥${cost.toFixed(2)}
• 浮动盈亏：${pnlPct.toFixed(2)}%
• 该标仓位占比：${exposurePct.toFixed(1)}%

═══════════════════════════════════════
⚠️ 风控规则（系统强制执行）
═══════════════════════════════════════
• 置信度 < 85% 的信号会被系统过滤，不会执行
• 同标的最近 5 分钟内交易过则进入冷却期
• 单标的最大仓位不超过总资产的 60%
• 你的决策应谨慎，只有高置信度机会才值得交易

═══════════════════════════════════════
🎯 决策任务
═══════════════════════════════════════
1. 综合分析：价格趋势、量价关系、历史波动、持仓状态
2. 评估风险：当前仓位、盈亏状况、市场情绪
3. 做出决策：BUY / SELL / HOLD
4. 给出置信度：0.0-1.0（低于 0.85 会被忽略）
5. 建议仓位比例：0-100（占可用资金或持仓的百分比）
6. 命名策略：如"量价突破"、"超跌反弹"、"止盈减仓"等
7. 详细说明：解释你的交易逻辑

JSON 输出格式：
{
  "action": "BUY" | "SELL" | "HOLD",
  "symbol": "${marketData.symbol}",
  "confidence": 0.0-1.0,
  "suggestedQuantity": 0-100,
  "strategyName": "策略名称",
  "reasoning": "详细决策逻辑（可多行）"
}
`;
};

// --- Gemini Provider ---

const createGeminiClient = (baseUrl?: string, apiKey?: string) => {
  const key = apiKey || process.env.API_KEY;
  const options: any = { apiKey: key };
  if (baseUrl && baseUrl.trim() !== '') {
    options.baseUrl = baseUrl;
  }
  return new GoogleGenAI(options);
};

const geminiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: [TradeAction.BUY, TradeAction.SELL, TradeAction.HOLD] },
    symbol: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    suggestedQuantity: { type: Type.NUMBER },
    strategyName: { type: Type.STRING },
    reasoning: { type: Type.STRING },
  },
  required: ["action", "symbol", "confidence", "reasoning", "suggestedQuantity", "strategyName"],
};

// --- OpenAI / Ollama Provider ---

const fetchOpenAICompatible = async (config: AIConfig, prompt: string): Promise<AIResponse> => {
  const baseUrl = config.apiEndpoint.replace(/\/+$/, ""); // trim trailing slash
  const url = `${baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const payload = {
    model: config.modelName,
    messages: [
      { role: "system", content: "You are a JSON-speaking trading bot." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    // Ollama often supports format: "json"
    response_format: { type: "json_object" }
  };

  try {
    let data;
    if (config.provider === 'OLLAMA') {
      // Use Backend Proxy to avoid CORS
      data = await dataApi.proxyRequest(url, {
        method: "POST",
        headers,
        body: payload
      });
    } else {
      // Direct Fetch for others (OpenAI remote, etc.)
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
      }
      data = await response.json();
    }

    const content = data.choices?.[0]?.message?.content || "{}";

    // Robust JSON parsing for models that might wrap in markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    return JSON.parse(jsonStr);

  } catch (e) {
    console.error("OpenAI/Ollama API call failed", e);
    throw e;
  }
};

// --- Main Entry Point ---

export const analyzeMarket = async (
  marketData: MarketData,
  portfolio: PortfolioState,
  config: AIConfig,
  lang: 'en' | 'zh' = 'zh',
  history: KLineData[] = []
): Promise<AIResponse> => {

  const prompt = SYSTEM_PROMPT(marketData, portfolio, lang, history);

  try {
    if (config.provider === 'GEMINI') {
      // Use Backend Proxy for Gemini to bypass CORS/GFW
      const baseUrl = (config.apiEndpoint && config.apiEndpoint.trim() !== '')
        ? config.apiEndpoint.replace(/\/+$/, '')
        : 'https://generativelanguage.googleapis.com';

      let modelId = config.modelName || 'gemini-2.5-flash';
      const url = `${baseUrl}/v1beta/models/${modelId}:generateContent?key=${config.apiKey}`;

      const payload = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: geminiResponseSchema,
          temperature: 0.7
        }
      };

      const data = await dataApi.proxyRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      });

      // Handle Gemini Response Structure
      // { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error("Empty Gemini response");
      return JSON.parse(text);

    } else {
      // OPENAI or OLLAMA
      return await fetchOpenAICompatible(config, prompt);
    }

  } catch (error) {
    console.error(`AI Analysis Error (${config.provider}):`, error);
    return {
      action: TradeAction.HOLD,
      symbol: marketData.symbol,
      confidence: 0,
      reasoning: `System Error: ${error instanceof Error ? error.message : "Unknown"}`,
      strategyName: "Error Fallback",
      suggestedQuantity: 0
    };
  }
};
