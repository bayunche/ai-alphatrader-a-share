
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIConfig, MarketData, PortfolioState, AIResponse, TradeAction } from "../types";

// --- Shared Logic ---

const SYSTEM_PROMPT = (marketData: MarketData, portfolio: PortfolioState, lang: 'en' | 'zh') => `
ROLE: You are an Elite Autonomous A-Share Quantitative Trading Agent.
OBJECTIVE: Maximize alpha (returns) while preserving capital. 
RESPONSE FORMAT: JSON ONLY. No markdown, no commentary outside JSON.
LANGUAGE: Output the "reasoning" and "strategyName" fields in ${lang === 'zh' ? 'CHINESE (Simplified)' : 'ENGLISH'}.

CURRENT MARKET DATA (${marketData.name} - ${marketData.symbol}):
- Price: ¥${marketData.price.toFixed(2)}
- Change: ${marketData.change.toFixed(2)}%
- Trend (Last 20 ticks): ${JSON.stringify(marketData.trend.map(t => Number(t.toFixed(2))))}

PORTFOLIO STATUS:
- Available Cash: ¥${portfolio.cash.toFixed(2)}
- Current Position (${marketData.symbol}): ${portfolio.positions.find(p => p.symbol === marketData.symbol)?.quantity || 0} shares

TASK:
1. Analyze volatility, trend, and volume.
2. Formulate a SPECIFIC technical strategy name (e.g., "Bollinger Squeeze" or "布林带突破").
3. Decide BUY, SELL, or HOLD.
4. Suggested Quantity 0-100%.

Output JSON Schema:
{
  "action": "BUY" | "SELL" | "HOLD",
  "symbol": "string",
  "confidence": number (0.0-1.0),
  "suggestedQuantity": number (0-100),
  "strategyName": "string",
  "reasoning": "string"
}
`;

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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: "system", content: "You are a JSON-speaking trading bot." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        // Ollama often supports format: "json"
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
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
  lang: 'en' | 'zh' = 'zh'
): Promise<AIResponse> => {
  
  const prompt = SYSTEM_PROMPT(marketData, portfolio, lang);

  try {
    if (config.provider === 'GEMINI') {
      const genAI = createGeminiClient(config.apiEndpoint, config.apiKey);
      
      let modelId = config.modelName || 'gemini-2.5-flash';
      
      const response = await genAI.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: geminiResponseSchema,
          temperature: 0.7,
        }
      });
      
      const text = response.text;
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
