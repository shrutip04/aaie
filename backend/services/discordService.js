// backend/services/discordService.js

// In-memory store for latest Discord messages (replace with DB for production)
const messageStore = [];
const MAX_STORED = 100;

export function storeMessage(message) {
  messageStore.unshift({ ...message, receivedAt: Date.now() });
  if (messageStore.length > MAX_STORED) messageStore.pop();
}

export function getMessages(limit = 20) {
  return messageStore.slice(0, limit);
}

export async function sendWebhookMessage(webhookUrl, content, username = 'AAIE Reply') {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, username }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }

  return { success: true };
}

export function parseWebhookPayload(body) {
  // Discord sends different payload shapes depending on event type
  // This handles the standard message create event
  return {
    id: body.id || `discord-${Date.now()}`,
    source: 'discord',
    sender: body.author?.username || body.member?.nick || 'Discord',
    body: body.content || '',
    subject: body.content || '',
    channel: body.channel_id,
    guildId: body.guild_id,
    webhookUrl: body.webhookUrl || '', // client should set this
    timestamp: body.timestamp ? new Date(body.timestamp).getTime() : Date.now(),
  };
}
