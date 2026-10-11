# 🤖 deepseek-telegram-bot

**English** | [中文](#中文)

Telegram bot for **DeepSeek** (and any OpenAI-compatible gateway) — **zero runtime dependencies**, context-aware chat, model switching, group support.

> Works with DeepSeek · Zhipu (GLM) · Qwen · Moonshot · one-api / vLLM gateways · any OpenAI-compatible endpoint.
>
> ⭐ If this is useful, a star helps others find it.

---

## 中文

**DeepSeek**（及任意 OpenAI 兼容网关）的 Telegram bot——**零运行时依赖**（Node 内置 fetch，无需 `npm install`），带上下文对话、模型切换、群聊支持。

## ✨ 特性

- **零依赖**：只用 Node 内置 `fetch`，克隆即跑，无需 `npm install`
- **上下文对话**：自动保留每会话最近 12 轮历史（可配）
- **模型随时切换**：`/model deepseek-reasoner` 一条命令
- **网关模型发现**：`/models` 列出网关当前可用模型
- **群聊支持**：群里 @bot 或回复触发，私聊直接对话
- **Markdown 回复**：解析失败自动降级纯文本


## 🌐 在线体验

bot 已在运行：[@DeepSeek_Companion_bot](https://t.me/DeepSeek_Companion_bot) —— 打开 Telegram 发消息直接对话。

## 🚀 快速开始

```bash
git clone https://github.com/zjukop3/deepseek-telegram-bot.git
cd deepseek-telegram-bot
cp .env.example .env   # 填入 TELEGRAM_BOT_TOKEN 和 OPENAI_API_KEY
node index.js          # 无需 npm install
```

拿 token：Telegram 里找 [@BotFather](https://t.me/BotFather) → `/newbot` → 复制 token。

拿 DeepSeek key：[platform.deepseek.com](https://platform.deepseek.com) 创建 API key。

## 🐳 Docker

```bash
docker build -t deepseek-telegram-bot .
docker run -d --env-file .env deepseek-telegram-bot
```

## 💬 命令

| 命令 | 说明 |
|------|------|
| 直接发消息 | 对话（带上下文） |
| `/help` | 帮助 |
| `/model <名称>` | 切换模型，如 `/model deepseek-reasoner` |
| `/models` | 列出网关可用模型 |
| `/clear` | 清空当前会话历史 |

## ⚙️ 环境变量

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | @BotFather 创建 bot 后获得 |
| `OPENAI_API_KEY` | ✅ | — | 网关密钥 |
| `OPENAI_BASE_URL` | — | `https://api.deepseek.com/v1` | 任意 OpenAI 兼容网关 |
| `MODEL` | — | `deepseek-chat` | 默认模型 |
| `SYSTEM_PROMPT` | — | — | 系统提示词 |
| `HISTORY_LIMIT` | — | `12` | 每会话保留历史轮数 |

## 💡 典型用法

- **Telegram 里用 DeepSeek**：官方 API 直连，`deepseek-reasoner` 推理模型随时切
- **用国产模型**：`OPENAI_BASE_URL` 指向智谱/通义，一个 bot 多模型
- **自建网关**：one-api / vLLM 局域网网关直接接入

## 📄 License

MIT © zjukop3
