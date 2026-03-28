// backend/server.js
// AAIE Backend — Gmail OAuth relay + Discord webhook handler

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gmailRoutes from './routes/gmail.js';
import discordRoutes from './routes/discord.js';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/gmail', gmailRoutes);
app.use('/discord', discordRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AAIE Backend', ts: Date.now() });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`AAIE backend running on http://localhost:${PORT}`);
});

export default app;
