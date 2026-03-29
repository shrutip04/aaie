import fetch from 'node-fetch';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE = `https://api.telegram.org/bot${TOKEN}`;

let lastUpdateId = 0;
const messageStore = [];

export async function pollTelegram() {
  try {
    const res = await fetch(`${BASE}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`);
    const data = await res.json();

    if (!data.ok || !data.result?.length) return [];

    const newMessages = [];

    for (const update of data.result) {
      lastUpdateId = update.update_id;

      const msg = update.message;
      if (!msg || !msg.text) continue;

      const parsed = {
        id: `tg-${update.update_id}`,
        source: 'telegram',
        sender: msg.from?.first_name || msg.from?.username || 'Unknown',
        subject: msg.text,
        body: msg.text,
        chatId: msg.chat?.id,
        timestamp: Date.now(),
        receivedAt: Date.now(),
        webhookUrl: '',
      };

      messageStore.unshift(parsed);
      if (messageStore.length > 100) messageStore.pop();
      newMessages.push(parsed);
    }

    return newMessages;
  } catch (e) {
    console.error('[Telegram] Poll error:', e.message);
    return [];
  }
}

export async function sendTelegramMessage(chatId, text) {
  try {
    const res = await fetch(`${BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json();
    return data.ok ? { success: true } : { error: data.description };
  } catch (e) {
    return { error: e.message };
  }
}

export function getTelegramMessages(limit = 20) {
  return messageStore.slice(0, limit);
}