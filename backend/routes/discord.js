// backend/routes/discord.js
import { Router } from 'express';
import {
  storeMessage,
  getMessages,
  sendWebhookMessage,
  parseWebhookPayload,
} from '../services/discordService.js';

const router = Router();

// ─── Incoming webhook (Discord → AAIE) ───────────────────────────────────────
// Set this URL as your Discord bot's interactions endpoint, or call it from
// a Discord bot that forwards message_create events here.
//
// POST /discord/incoming
// Body: Discord message_create event payload
router.post('/incoming', (req, res) => {
  const body = req.body;

  // Discord sends a PING handshake on first setup
  if (body.type === 1) {
    return res.json({ type: 1 });
  }

  // Parse and store the message
  const message = parseWebhookPayload(body);
  storeMessage(message);

  console.log(`[Discord] New message from ${message.sender}: ${message.body.slice(0, 60)}`);

  // In production: push to connected extension via SSE or WebSocket
  // For hackathon: extension polls GET /discord/messages
  res.json({ ok: true, id: message.id });
});

// ─── Poll for new messages (extension pulls these) ────────────────────────────
router.get('/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const since = parseInt(req.query.since);

  let messages = getMessages(limit);

  // Only filter if 'since' is actually provided
  if (!isNaN(since)) {
    messages = messages.filter(m => m.receivedAt > since);
  }

  res.json({ messages });
});

// ─── Send reply via outgoing webhook ─────────────────────────────────────────
// POST /discord/send
// Body: { webhookUrl, content, username? }
router.post('/send', async (req, res) => {
  const { webhookUrl, content, username } = req.body;

  if (!webhookUrl || !content) {
    return res.status(400).json({ error: 'webhookUrl and content required' });
  }

  try {
    const result = await sendWebhookMessage(webhookUrl, content, username);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Test endpoint — send a mock notification ─────────────────────────────────
router.post('/test', (req, res) => {
  const mock = {
    id: `test-${Date.now()}`,
    author: { username: req.body.sender || 'TestUser' },
    content: req.body.content || 'Hello from Discord test!',
    channel_id: 'test-channel',
    timestamp: new Date().toISOString(),
  };

  const message = parseWebhookPayload(mock);
  storeMessage(message);
  res.json({ ok: true, message });
});

export default router;
