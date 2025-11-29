import { AIConfig, BrokerConfig } from '../types';

const abortableFetch = async (input: RequestInfo, init: RequestInit = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

export type HealthStatus = { ok: boolean; reason?: string };

const checkOpenAICompatible = async (endpoint: string, apiKey?: string): Promise<HealthStatus> => {
  if (!endpoint) return { ok: false, reason: '缺少接口地址' };
  try {
    const url = `${endpoint.replace(/\/+$/, '')}/v1/models`;
    const res = await abortableFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'OpenAI 兼容接口不可用' };
  }
};

const checkOllama = async (endpoint: string): Promise<HealthStatus> => {
  if (!endpoint) return { ok: false, reason: '缺少 Ollama 地址' };
  try {
    const url = `${endpoint.replace(/\/+$/, '')}/api/tags`;
    const res = await abortableFetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Ollama 服务不可用' };
  }
};

const checkGemini = async (endpoint?: string, apiKey?: string): Promise<HealthStatus> => {
  if (!apiKey) return { ok: false, reason: '缺少 Gemini API Key' };
  try {
    const base = (endpoint && endpoint.trim() !== '') ? endpoint.replace(/\/+$/, '') : 'https://generativelanguage.googleapis.com';
    const url = `${base}/v1/models?key=${apiKey}`;
    const res = await abortableFetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Gemini 接口不可用' };
  }
};

export const checkModelAvailability = async (config: AIConfig): Promise<HealthStatus> => {
  if (!config) return { ok: false, reason: '未配置模型' };
  if (config.provider === 'GEMINI') {
    return checkGemini(config.apiEndpoint, config.apiKey);
  }
  if (config.provider === 'OLLAMA') {
    return checkOllama(config.apiEndpoint);
  }
  // OPENAI 或其他兼容
  return checkOpenAICompatible(config.apiEndpoint, config.apiKey);
};

export const checkBrokerAvailability = async (config: BrokerConfig): Promise<HealthStatus> => {
  if (!config?.endpoint) return { ok: false, reason: '缺少券商接口地址' };
  try {
    const url = `${config.endpoint.replace(/\/+$/, '')}/health`;
    const res = await abortableFetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || '券商接口未响应' };
  }
};
