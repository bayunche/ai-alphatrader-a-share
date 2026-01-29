<div align="center">
  <img src="assets/desktop_icon.png" alt="AI AlphaTrader" width="128" height="128">
  <h1>AI AlphaTrader</h1>
  <p><strong>Autonomous AI Trading Agent for A-Share Market</strong></p>
  
  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a> •
    <a href="#configuration">Configuration</a> •
    <a href="#contributing">Contributing</a>
  </p>
  
  <p>
    <a href="./README_zh.md">🇨🇳 中文文档</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform">
    <img src="https://img.shields.io/badge/node-%3E%3D18-green.svg" alt="Node">
    <img src="https://img.shields.io/badge/react-18-blue.svg" alt="React">
  </p>
</div>

---

## Overview

AI AlphaTrader is an **autonomous AI-powered trading assistant** designed for A-share market simulation and strategy validation. It features multi-agent architecture, real-time market data integration, and intelligent risk management.

> ⚠️ **Disclaimer**: This project is for educational and research purposes only. It does not provide financial advice. Use at your own risk.

## Features

- 🤖 **Multi-Agent Trading** — Run multiple AI agents with different strategies simultaneously
- 📊 **Real-time Market Data** — Integration with EastMoney and other data sources
- 🧠 **AI Decision Engine** — Support for Gemini, OpenAI-compatible APIs, and Ollama
- 📈 **Portfolio Management** — Track positions, P&L, and equity curves
- 🔔 **Notification System** — Telegram and webhook alerts for trade signals
- 🖥️ **Desktop App** — Cross-platform Tauri-based desktop application
- 🌐 **Multi-language** — English and Chinese UI support

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express, SQLite |
| Desktop | Tauri (Rust) |
| AI | Gemini API, OpenAI-compatible, Ollama |
| Data | EastMoney API, AKShare |

## Installation

### Prerequisites

- Node.js 18+
- Python 3.10+ (for market data scripts)
- Rust toolchain (for Tauri desktop build)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/bayunche/ai-alphatrader-a-share.git
cd ai-alphatrader-a-share

# Install dependencies
npm install

# Start the backend server
node server/index.js

# Start the frontend (in another terminal)
npm run dev
```

### Desktop Build

```bash
# Build desktop application
yarn build:desktop
```

## Usage

1. **Configure AI Agent**: Go to Settings → Agents, select a provider (Gemini/OpenAI/Ollama), and enter your API credentials
2. **Add Stock Pool**: Create a watchlist of stocks you want to monitor
3. **Start Trading**: Click the play button to start AI analysis and autonomous trading
4. **Monitor**: View real-time decisions, trade history, and portfolio performance

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
VITE_API_BASE=http://127.0.0.1:3001/api
VITE_FORCE_BACKEND=true
```

### AI Provider Settings

| Provider | Configuration |
|----------|---------------|
| Gemini | API Key from Google AI Studio |
| OpenAI-compatible | Endpoint URL + API Key |
| Ollama | Local endpoint (e.g., http://localhost:11434) |

### Risk Management

The system includes built-in risk controls:
- **Confidence Threshold**: Only execute trades with ≥85% confidence
- **Cooldown Period**: 5-minute cooldown between trades on the same stock
- **Position Limits**: Max 60% of portfolio in a single stock
- **Slippage Protection**: Abort trades exceeding tolerance

### Notification

Supported channels: Telegram, Webhook.
👉 [Telegram Configuration Guide](docs/telegram_config.md)

## Project Structure

```
├── App.tsx                 # Main application entry
├── components/             # React UI components
├── contexts/               # State management (Auth, Language)
├── services/               # API integrations (Market, AI, Notification)
├── server/                 # Express backend + SQLite
├── src-tauri/              # Tauri desktop configuration
└── types.ts                # TypeScript type definitions
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Tauri](https://tauri.app/) for the desktop framework
- [EastMoney](https://www.eastmoney.com/) for market data
- [Google Gemini](https://ai.google.dev/) for AI capabilities

---

<div align="center">
  <sub>Built with ❤️ by the AI AlphaTrader community</sub>
</div>
