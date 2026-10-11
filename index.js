#!/usr/bin/env node
/**
 * deepseek-telegram-bot — DeepSeek（及任意 OpenAI 兼容网关）的 Telegram bot
 *
 * 零运行时依赖：只用 Node 内置 fetch，无需 npm install
 *
 * 环境变量（见 .env.example）：
 *   TELEGRAM_BOT_TOKEN  @BotFather 创建 bot 后获得（必填）
 *   OPENAI_BASE_URL     网关地址（默认 https://api.deepseek.com/v1）
 *   OPENAI_API_KEY      网关密钥（必填）
 *   MODEL               默认模型（默认 deepseek-chat）
 *   SYSTEM_PROMPT       系统提示词（可选）
 *   HISTORY_LIMIT       每会话保留历史条数（默认 12）
 */
import fs from 'node:fs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
const API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.MODEL || 'deepseek-chat';
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || '';
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT || 12);
const TG_API = `https://api.telegram.org/bot${TOKEN}`;

for (const k of ['TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY']) {
  if (!process.env[k]) { console.error(`缺少环境变量 ${k}（参考 .env.example）`); process.exit(1); }
}

/* ---------- 会话历史（内存，按 chat id 隔离） ---------- */
const history = new Map(); // chatId -> [{role, content}]
const getHistory = id => (history.get(id) || []);
const pushHistory = (id, msg) => {
  const arr = history.get(id) || [];
  arr.push(msg);
  while (arr.length > HISTORY_LIMIT * 2) arr.shift();
  history.set(id, arr);
};

/* ---------- LLM 调用（OpenAI 兼容） ---------- */
async function chatComplete(messages, { model, temperature } = {}) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: model || MODEL,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/* ---------- Telegram API ---------- */
async function tg(method, body) {
  const res = await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`TG ${method}: ${JSON.stringify(data).slice(0, 200)}`);
  return data.result;
}
const sendChatAction = (id, action = 'typing') =>
  tg('sendChatAction', { chat_id: id, action }).catch(() => {});
const sendMessage = (id, text) =>
  tg('sendMessage', { chat_id: id, text, parse_mode: 'Markdown' })
    .catch(() => tg('sendMessage', { chat_id: id, text })); // Markdown 失败降级纯文本

/* ---------- 命令 ---------- */
const HELP = [
  '🤖 **DeepSeek Bot**',
  '',
  '直接发消息即可对话（支持上下文）',
  '',
  '命令：',
  '/help — 帮助',
  '/model <名称> — 切换模型（如 /model deepseek-reasoner）',
  '/models — 列出网关可用模型',
  '/clear — 清空当前会话历史',
].join('\n');

async function listModels() {
  const res = await fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return (data.data || []).map(m => m.id).join('\n') || '（网关未返回模型列表）';
}

/* ---------- 消息处理 ---------- */
async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  if (!chatId || !text) return;

  // 群聊：只响应 @提及 或 /命令
  const mentioned = msg.chat?.type !== 'private' &&
    !(text.startsWith('/') || msg.reply_to_message?.from?.is_bot || text.includes(`@${process.env.BOT_USERNAME || ''}`));
  if (mentioned && !text.startsWith('@')) return;

  try {
    if (text === '/start' || text === '/help') return void (await sendMessage(chatId, HELP));
    if (text === '/clear') { history.delete(chatId); return void (await sendMessage(chatId, '🧹 会话历史已清空')); }
    if (text === '/models') return void (await sendMessage(chatId, '可用模型：\n' + await listModels()));
    if (text.startsWith('/model ')) {
      const m = text.slice(7).trim();
      history.delete(chatId);
      process.env.MODEL = m;
      return void (await sendMessage(chatId, `✅ 已切换模型：\`${m}\``));
    }
    if (text.startsWith('/')) return; // 未知命令忽略

    await sendChatAction(chatId);
    const msgs = [];
    if (SYSTEM_PROMPT) msgs.push({ role: 'system', content: SYSTEM_PROMPT });
    msgs.push(...getHistory(chatId));
    msgs.push({ role: 'user', content: text });

    const reply = await chatComplete(msgs);
    pushHistory(chatId, { role: 'user', content: text });
    pushHistory(chatId, { role: 'assistant', content: reply });
    await sendMessage(chatId, reply || '（空回复）');
  } catch (e) {
    console.error(`[msg] ${chatId}: ${e.message}`);
    await sendMessage(chatId, `⚠️ ${e.message.slice(0, 300)}`).catch(() => {});
  }
}

/* ---------- 长轮询主循环 ---------- */
async function main() {
  // 写 .env（如不存在，方便参考）
  if (!fs.existsSync('.env')) {
    fs.writeFileSync('.env', '# TELEGRAM_BOT_TOKEN=\n# OPENAI_BASE_URL=https://api.deepseek.com/v1\n# OPENAI_API_KEY=\n# MODEL=deepseek-chat\n');
  }
  const me = await tg('getMe');
  console.log(`🤖 bot 已启动: @${me.username} → 网关 ${BASE_URL}（模型 ${MODEL}）`);
  if (!process.env.BOT_USERNAME) process.env.BOT_USERNAME = me.username;

  let offset = 0;
  for (;;) {
    try {
      const res = await fetch(`${TG_API}/getUpdates?timeout=30&offset=${offset}`, {
        signal: AbortSignal.timeout(40000),
      });
      const data = await res.json().catch(() => ({}));
      for (const u of data.result || []) {
        offset = u.update_id + 1;
        await handleMessage(u.message || u.edited_message);
      }
    } catch (e) {
      console.error(`[poll] ${e.message}，5s 后重试`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

main().catch(e => { console.error('启动失败:', e.message); process.exit(1); });
