import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const BACKEND_URL = 'http://localhost:3001/discord/incoming';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1487486793224949790/i_CLc2IvCsPSJXcKge8NhhdztH6lH6WrUCGWHNyMkLbbT0u_zb2_8meMmiD50T_aJmcw';

client.on('ready', () => {
  console.log(`[AAIE Bot] Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  console.log(`[AAIE Bot] ${message.author.username}: ${message.content}`);

  try {
    await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: message.id,
        author: { username: message.author.username },
        content: message.content,
        channel_id: message.channelId,
        timestamp: message.createdAt.toISOString(),
        webhookUrl: WEBHOOK_URL,
      }),
    });
  } catch (e) {
    console.error('[AAIE Bot] Error:', e.message);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);