import { Router } from 'express';
import {
  storeMessage,
  getMessages,
  sendWebhookMessage,
  parseWebhookPayload,
} from '../services/discordService.js';

const router = Router();

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1487486793224949790/i_CLc2IvCsPSJXcKge8NhhdztH6lH6WrUCGWHNyMkLbbT0u_zb2_8meMmiD50T_aJmcw';

// ─── Incoming webhook (Discord → AAIE) ───────────────────────────────────────
router.post('/incoming', (req, res) => {
  const body = req.body;

  if (body.type === 1) {
    return res.json({ type: 1 });
  }

  const message = parseWebhookPayload(body);
  message.webhookUrl = req.body.webhookUrl || WEBHOOK_URL;
  storeMessage(message);

  console.log(`[Discord] New message from ${message.sender}: ${message.body.slice(0, 60)}`);

  res.json({ ok: true, id: message.id });
});

// ─── Poll for new messages (extension pulls these) ────────────────────────────
router.get('/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const since = parseInt(req.query.since);

  let messages = getMessages(limit);

  if (!isNaN(since)) {
    messages = messages.filter(m => m.receivedAt > since);
  }

  res.json({ messages });
});

// ─── Send reply via outgoing webhook ─────────────────────────────────────────
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
  message.webhookUrl = WEBHOOK_URL;
  storeMessage(message);
  res.json({ ok: true, message });
});

export default router;