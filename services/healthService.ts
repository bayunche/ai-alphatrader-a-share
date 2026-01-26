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

const checkOpenAICompatible = async (endpoint: string, apiKey?: string, modelName?: string): Promise<HealthStatus> => {
  if (!endpoint) return { ok: false, reason: '缺少接口地址' };
  if (!apiKey) return { ok: false, reason: '缺少 API Key' };
  const base = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
  try {
    // 基础探活：/v1/models 是否可访问
    const listUrl = `${base}/v1/models`;
    const listRes = await abortableFetch(listUrl, { method: 'GET', headers });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    // 具体模型校验：确保所选模型存在且可访问
    if (modelName && modelName.trim() !== '') {
      const modelUrl = `${base}/v1/models/${modelName}`;
      const modelRes = await abortableFetch(modelUrl, { method: 'GET', headers });
      if (!modelRes.ok) throw new Error(`模型不可用 (${modelName})`);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'OpenAI 兼容接口不可用' };
  }
};

const checkOllama = async (endpoint: string, modelName?: string): Promise<HealthStatus> => {
  if (!endpoint) return { ok: false, reason: '缺少 Ollama 地址' };
  try {
    const url = `${endpoint.replace(/\/+$/, '')}/api/tags`;
    const res = await abortableFetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (modelName && modelName.trim() !== '') {
      const json = await res.json();
      const tags = Array.isArray(json?.models) ? json.models : [];
      const exists = tags.some((m: any) => m.name === modelName || m.model === modelName);
      if (!exists) throw new Error(`未找到模型 ${modelName}`);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Ollama 服务不可用' };
  }
};

const checkGemini = async (endpoint?: string, apiKey?: string, modelName?: string): Promise<HealthStatus> => {
  if (!apiKey) return { ok: false, reason: '缺少 Gemini API Key' };
  const base = (endpoint && endpoint.trim() !== '') ? endpoint.replace(/\/+$/, '') : 'https://generativelanguage.googleapis.com';
  try {
    const listUrl = `${base}/v1/models?key=${apiKey}`;
    const listRes = await abortableFetch(listUrl, { method: 'GET' });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    if (modelName && modelName.trim() !== '') {
      const modelUrl = `${base}/v1/models/${modelName}?key=${apiKey}`;
      const modelRes = await abortableFetch(modelUrl, { method: 'GET' });
      if (!modelRes.ok) throw new Error(`模型不可用 (${modelName})`);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Gemini 接口不可用' };
  }
};

export const checkModelAvailability = async (config: AIConfig): Promise<HealthStatus> => {
  if (!config) return { ok: false, reason: '未配置模型' };
  const modelName = config.modelName?.trim();
  if (!modelName) return { ok: false, reason: '缺少模型名称' };
  if (config.provider === 'GEMINI') {
    return checkGemini(config.apiEndpoint, config.apiKey, modelName);
  }
  if (config.provider === 'OLLAMA') {
    return checkOllama(config.apiEndpoint, modelName);
  }
  // OPENAI 或其他兼容
  return checkOpenAICompatible(config.apiEndpoint, config.apiKey, modelName);
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
