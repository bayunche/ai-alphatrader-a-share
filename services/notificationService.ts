
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

  // 格式化原因：保留完整内容，仅做轻量清理
  const formatReason = (reason: string | undefined): string => {
    if (!reason) return '—';
    // 清理多余空白，但保留换行结构
    return reason.trim().replace(/\n{3,}/g, '\n\n');
  };

  // 操作标签
  const actionEmoji = trade.action === 'BUY' ? '🟢' : trade.action === 'SELL' ? '🔴' : '⚪';
  const actionText = trade.action === 'BUY' ? '买入' : trade.action === 'SELL' ? '卖出' : '持有';

  // 置信度百分比
  const confidencePercent = trade.confidence ? `${(trade.confidence * 100).toFixed(0)}%` : '—';

  // 纯文本格式消息（用于 Webhook 和简单场景）
  const plainMessage = [
    `🤖 AlphaTrader 交易提醒`,
    `━━━━━━━━━━━━━━━`,
    `${actionEmoji} 操作：${actionText} ${trade.symbol}`,
    `💰 价格：¥${trade.price.toFixed(2)}`,
    `📊 数量：${trade.quantity}`,
    `🤖 智能体：${trade.agentName}`,
    `📈 策略：${trade.strategyId}`,
    `🎯 置信度：${confidencePercent}`,
    `━━━━━━━━━━━━━━━`,
    `📝 决策逻辑：`,
    formatReason(trade.reason)
  ].join('\n');

  // Telegram Markdown 格式（更美观）
  const telegramMessage = [
    `*🤖 AlphaTrader 交易提醒*`,
    ``,
    `${actionEmoji} *${actionText}* \`${trade.symbol}\``,
    `💰 价格：\`¥${trade.price.toFixed(2)}\``,
    `📊 数量：\`${trade.quantity}\``,
    `🤖 智能体：${escapeMarkdownV2(trade.agentName)}`,
    `📈 策略：${escapeMarkdownV2(trade.strategyId)}`,
    `🎯 置信度：\`${confidencePercent}\``,
    ``,
    `📝 *决策逻辑*`,
    escapeMarkdownV2(formatReason(trade.reason))
  ].join('\n');

  const tasks: Promise<any>[] = [];

  if (config.telegramBotToken && config.telegramChatId) {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const body = {
      chat_id: config.telegramChatId,
      text: telegramMessage,
      parse_mode: 'MarkdownV2'
    };
    tasks.push(
      withTimeout(fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })).then(async res => {
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          // 如果 Markdown 解析失败，回退到纯文本
          if (errBody.includes('parse') || errBody.includes('entities')) {
            console.warn('Telegram Markdown parse failed, retry with plain text');
            return fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: config.telegramChatId,
                text: plainMessage
              })
            });
          }
          throw new Error(`Telegram ${res.status}: ${errBody}`);
        }
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
