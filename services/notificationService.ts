
import { NotificationConfig, TradeExecution } from "../types";

export const sendNotification = async (config: NotificationConfig, trade: TradeExecution) => {
    if (!config.enabled) return;

    const message = `
🤖 *AlphaTrader Alert*
Action: *${trade.action}* ${trade.symbol}
Price: ¥${trade.price.toFixed(2)}
Qty: ${trade.quantity}
Agent: ${trade.agentName}
Strategy: _${trade.strategyId}_
Reason: ${trade.reason.substring(0, 100)}...
    `.trim();

    const promises = [];

    // 1. Telegram Notification
    if (config.telegramBotToken && config.telegramChatId) {
        const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
        promises.push(
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config.telegramChatId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            }).catch(e => console.error("Telegram Send Error", e))
        );
    }

    // 2. Webhook Notification
    if (config.webhookUrl) {
        promises.push(
            fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'TRADE_ALERT',
                    data: trade,
                    message: message
                })
            }).catch(e => console.error("Webhook Send Error", e))
        );
    }

    await Promise.all(promises);
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
