import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gmailRoutes from './routes/gmail.js';
import discordRoutes from './routes/discord.js';
import telegramRoutes from './routes/telegram.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/gmail', gmailRoutes);
app.use('/discord', discordRoutes);
app.use('/telegram', telegramRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AAIE Backend', ts: Date.now() });
});

app.listen(PORT, () => {
  console.log(`AAIE backend running on http://localhost:${PORT}`);
});

export default app;