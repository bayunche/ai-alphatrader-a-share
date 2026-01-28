<div align="center">
  <img src="assets/desktop_icon.png" alt="AI AlphaTrader" width="128" height="128">
  <h1>AI AlphaTrader</h1>
  <p><strong>A 股自主 AI 交易智能体</strong></p>
  
  <p>
    <a href="#功能特性">功能特性</a> •
    <a href="#安装">安装</a> •
    <a href="#使用方法">使用方法</a> •
    <a href="#配置">配置</a> •
    <a href="#贡献">贡献</a>
  </p>
  
  <p>
    <a href="./README.md">🇺🇸 English</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform">
    <img src="https://img.shields.io/badge/node-%3E%3D18-green.svg" alt="Node">
    <img src="https://img.shields.io/badge/react-18-blue.svg" alt="React">
  </p>
</div>

---

## 概述

AI AlphaTrader 是一个面向 A 股市场的**自主 AI 交易助手**，支持策略模拟与验证。采用多智能体架构，集成实时行情数据和智能风险管理。

> ⚠️ **免责声明**：本项目仅用于教育和研究目的，不构成任何投资建议。使用风险自负。

## 功能特性

- 🤖 **多智能体交易** — 同时运行多个采用不同策略的 AI 智能体
- 📊 **实时行情数据** — 集成东方财富等数据源
- 🧠 **AI 决策引擎** — 支持 Gemini、OpenAI 兼容 API 和 Ollama
- 📈 **持仓管理** — 实时跟踪持仓、盈亏和资金曲线
- 🔔 **通知系统** — Telegram 和 Webhook 交易信号推送
- 🖥️ **桌面应用** — 基于 Tauri 的跨平台桌面应用
- 🌐 **多语言** — 支持中英文界面

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、TypeScript、Vite |
| 后端 | Node.js、Express、SQLite |
| 桌面 | Tauri (Rust) |
| AI | Gemini API、OpenAI 兼容、Ollama |
| 数据 | 东方财富 API、AKShare |

## 安装

### 环境要求

- Node.js 18+
- Python 3.10+（行情数据脚本）
- Rust 工具链（Tauri 桌面构建）

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/bayunche/ai-alphatrader-a-share.git
cd ai-alphatrader-a-share

# 安装依赖
npm install

# 启动后端服务
node server/index.js

# 启动前端（另开终端）
npm run dev
```

### 桌面构建

```bash
# 构建桌面应用
yarn build:desktop
```

## 使用方法

1. **配置 AI 智能体**：进入设置 → 智能体，选择提供商（Gemini/OpenAI/Ollama），输入 API 凭证
2. **添加股票池**：创建要监控的自选股列表
3. **启动交易**：点击播放按钮开始 AI 分析和自主交易
4. **监控**：查看实时决策、交易历史和持仓表现

## 配置

### 环境变量

创建 `.env.local` 文件：

```env
VITE_API_BASE=http://127.0.0.1:3001/api
VITE_FORCE_BACKEND=true
```

### AI 提供商设置

| 提供商 | 配置 |
|--------|------|
| Gemini | Google AI Studio 的 API Key |
| OpenAI 兼容 | Endpoint URL + API Key |
| Ollama | 本地端点（如 http://localhost:11434）|

### 风险管理

系统内置风控机制：
- **置信度阈值**：仅执行置信度 ≥85% 的交易
- **冷却期**：同一标的 5 分钟内不重复交易
- **仓位限制**：单标的最大持仓不超过总资产 60%
- **滑点保护**：超出容忍度的交易自动放弃

## 项目结构

```
├── App.tsx                 # 主应用入口
├── components/             # React UI 组件
├── contexts/               # 状态管理（Auth、Language）
├── services/               # API 集成（行情、AI、通知）
├── server/                 # Express 后端 + SQLite
├── src-tauri/              # Tauri 桌面配置
└── types.ts                # TypeScript 类型定义
```

## 贡献

欢迎贡献！请遵循以下指南：

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feat/amazing-feature`）
3. 按 [Conventional Commits](https://www.conventionalcommits.org/) 规范提交
4. 推送分支（`git push origin feat/amazing-feature`）
5. 发起 Pull Request

## 许可

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 致谢

- [Tauri](https://tauri.app/) 桌面框架
- [东方财富](https://www.eastmoney.com/) 行情数据
- [Google Gemini](https://ai.google.dev/) AI 能力

---

<div align="center">
  <sub>由 AI AlphaTrader 社区用 ❤️ 构建</sub>
</div>
