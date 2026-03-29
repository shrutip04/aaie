import { Router } from 'express';
import { pollTelegram, sendTelegramMessage } from '../services/telegramService.js';

const router = Router();

router.get('/messages', async (req, res) => {
  const messages = await pollTelegram();
  res.json({ messages });
});

router.post('/send', async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });
  const result = await sendTelegramMessage(chatId, text);
  res.json(result);
});

export default router;