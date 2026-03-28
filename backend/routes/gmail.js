// backend/routes/gmail.js
import { Router } from 'express';
import {
  getAuthUrl,
  exchangeCode,
  getClientWithToken,
  fetchUnreadEmails,
  markAsRead,
  archiveEmail,
} from '../services/gmailService.js';

const router = Router();

// Step 1: Start OAuth flow
router.get('/auth', (_req, res) => {
  const url = getAuthUrl();
  res.json({ url });
});

// Step 2: OAuth callback — exchange code for tokens
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const tokens = await exchangeCode(code);
    // In production: store tokens securely per user
    // For hackathon: return tokens to client to store in chrome.storage
    res.json({ tokens });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch unread emails
// Expects: Authorization: Bearer <access_token>
// Optional header: x-refresh-token: <refresh_token>
router.get('/unread', async (req, res) => {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');
  const refreshToken = req.headers['x-refresh-token'];

  if (!accessToken) return res.status(401).json({ error: 'No token' });

  try {
    const authClient = getClientWithToken(accessToken, refreshToken);
    const emails = await fetchUnreadEmails(authClient, 10);
    res.json({ emails });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark as read
router.post('/mark-read/:messageId', async (req, res) => {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');
  if (!accessToken) return res.status(401).json({ error: 'No token' });

  try {
    const authClient = getClientWithToken(accessToken);
    const result = await markAsRead(authClient, req.params.messageId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Archive
router.post('/archive/:messageId', async (req, res) => {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');
  if (!accessToken) return res.status(401).json({ error: 'No token' });

  try {
    const authClient = getClientWithToken(accessToken);
    const result = await archiveEmail(authClient, req.params.messageId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
