
import { NotificationConfig, TradeExecution } from "../types";

// 转义 MarkdownV2 需要逃逸的全部字符（参考 Telegram 文档）
const escapeMarkdownV2 = (text: string) =>
  text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');

const withTimeout = async (promise: Promise<Response>, ms = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await promise;
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

export const sendNotification = async (config: NotificationConfig, trade: TradeExecution) => {
  if (!config.enabled) return;

  const cleanReason = trade.reason ? trade.reason.substring(0, 120) : '';
  const plainMessage = [
    '🤖 AlphaTrader 交易提醒',
    `操作：${trade.action} ${trade.symbol}`,
    `价格：¥${trade.price.toFixed(2)}`,
    `数量：${trade.quantity}`,
    `智能体：${trade.agentName}`,
    `策略：${trade.strategyId}`,
    `原因：${cleanReason || '（无）'}`
  ].join('\n');

  const tasks: Promise<any>[] = [];

  if (config.telegramBotToken && config.telegramChatId) {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const body = {
      chat_id: config.telegramChatId,
      text: plainMessage
    };
    tasks.push(
      withTimeout(fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })).then(res => {
        if (!res.ok) throw new Error(`Telegram ${res.status}`);
      }).catch(e => console.error("Telegram Send Error", e.message || e))
    );
  }

  if (config.webhookUrl) {
    tasks.push(
      withTimeout(fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TRADE_ALERT',
          data: trade,
          message: plainMessage
        })
      })).then(res => {
        if (!res.ok) throw new Error(`Webhook ${res.status}`);
      }).catch(e => console.error("Webhook Send Error", e.message || e))
    );
  }

  await Promise.all(tasks);
};

export const testNotification = async (config: NotificationConfig) => {
  const mockTrade: TradeExecution = {
    id: 'test',
    agentId: 'test',
    agentName: 'Test Agent',
    timestamp: new Date().toISOString(),
    symbol: '000001',
    action: 'BUY' as any,
    price: 10.50,
    quantity: 100,
    totalAmount: 1050,
    status: 'FILLED',
    strategyId: 'Test Strategy',
    reason: 'This is a test notification.',
    confidence: 0.95
  };
  await sendNotification(config, mockTrade);
};
