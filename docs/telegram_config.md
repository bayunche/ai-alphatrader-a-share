# Telegram 消息推送配置指南

AI AlphaTrader 支持通过 Telegram Bot 推送实时交易信号、决策理由和置信度分析。本指南将帮助您完成配置。

## 第一步：创建 Telegram Bot

1. 在 Telegram 中搜索 **[@BotFather](https://t.me/botfather)**。
2. 发送命令 `/newbot`。
3. 按照提示输入 Bot 的显示名称（例如 `MyAlphaTraderBot`）。
4. 输入 Bot 的用户名（必须以 `bot` 结尾，例如 `alpha_trader_v1_bot`）。
5. 创建成功后，BotFather 会发送一条消息，其中包含 **HTTP API Token**。
   - 格式如：`123456789:ABCdefGhIJKlmNoPQRstUVwxyZ`
   - **保存好这个 Token**，稍后需要填入配置。

## 第二步：获取 Chat ID

我们需要知道将消息发送给谁（您自己或群组）。

### 方法 A：发送给个人（最简单）
1. 在 Telegram 中搜索 **[@userinfobot](https://t.me/userinfobot)**。
2. 点击 Start 或发送任意消息。
3. 它会回复您的用户信息，找到 `Id` 字段（例如 `123456789`）。
   - 这就是您的 **Chat ID**。

### 方法 B：发送给群组
1. 将您的 Bot 拉入一个群组。
2. 将 Bot 设为管理员（通常不需要，但在某些隐私设置下可能需要）。
3. 在群里发送一条消息 `/start`。
4. 访问以下 URL（替换您的 Token）：
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. 在返回的 JSON 中找到 `chat` -> `id`。群组 ID 通常是以 `-` 开头的负数（例如 `-987654321`）。

## 第三步：在 AlphaTrader 中配置

1. 打开 AI AlphaTrader应用。
2. 进入 **设置 (Settings)** 页面。
3. 切换到 **通知 (Notifications)** 选项卡。
4. 勾选 **启用通知** 开关。
5. 填写配置：
   - **Bot Token**: 输入第一步获取的 API Token。
   - **Chat ID**: 输入第二步获取的 ID。
6. 点击 **发送测试消息 (Send Test)** 按钮。
   - 如果配置正确，您的 Telegram 应该会立即收到一条测试通知。

## 常见问题

**Q: 点击发送测试消息没有反应？**
A: 请检查网络连接。由于 Telegram API 在某些地区无法直接访问，您可能需要配置系统代理或确保您的网络环境可以访问 `api.telegram.org`。

**Q: 接收不到消息？**
A: 
1. 确保您已经跟 Bot 发起过对话（点击过 Start）。Bot 无法主动向从未交互过的用户发送消息。
2. 检查 Chat ID 是否包含负号（如果是群组）。

**Q: 消息格式乱码？**
A: 我们使用 MarkdownV2 格式发送消息。如果遇到特定字符转义问题，系统会自动降级为纯文本发送，请留意日志输出。
