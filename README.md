# 🧠 AAIE — Attention + Action Intelligence Engine

A Chrome extension that decides **when to interrupt you**, **how much to let you interact**, and **how to act across Gmail, Discord, and WhatsApp** — all from a single intelligent UI with voice control.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension                                        │
│                                                          │
│  background.js    → Context Engine + Decision Engine     │
│  content.js       → WhatsApp Web MutationObserver        │
│  popup/ (React)   → UI: Feed, Voice, Insights            │
└────────────────┬────────────────────────────────────────┘
                 │ chrome.storage + runtime.sendMessage
┌────────────────▼────────────────────────────────────────┐
│  Backend (Node + Express)                                │
│                                                          │
│  /gmail  → OAuth2 + fetch/mark-read/archive              │
│  /discord → incoming webhook + outgoing replies          │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
aaie/
├── extension/              Chrome extension files
│   ├── manifest.json
│   ├── background.js       Service worker (context + decisions)
│   ├── content.js          WhatsApp Web observer
│   ├── decisionEngine.js   Pure decision logic
│   └── popup/              Built React app (output of npm run build)
│
├── popup-src/              React source (Vite)
│   └── src/
│       ├── App.jsx
│       ├── components/     Header, Feed, Card, Queue, Voice, Insights
│       └── hooks/          useExtensionState, useVoice
│
├── backend/                Node.js + Express
│   ├── server.js
│   ├── routes/             gmail.js, discord.js
│   └── services/           gmailService.js, discordService.js
│
└── generate-icons.js       Icon generator
```

---

## Quick Start

### 1. Clone and install

```bash
cd aaie
npm run setup        # installs popup + backend deps
```

### 2. Build the React popup

```bash
npm run build
# Outputs to extension/popup/
```

### 3. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Gmail API**
3. Create OAuth 2.0 credentials (Chrome Extension type)
4. Copy the **Client ID** into:
   - `extension/manifest.json` → `oauth2.client_id`
   - `backend/.env` → `GOOGLE_CLIENT_ID`

### 4. Set up the backend

```bash
cd backend
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run dev
```

### 5. Load the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Pin the AAIE extension

### 6. Connect Gmail

Click the extension icon → tap **Connect Gmail** → complete OAuth

---

## How It Works

### Context Engine (`background.js`)

Monitors:
- `chrome.idle` — detects idle/active/locked
- `chrome.tabs.onActivated` — tracks tab switching rate
- Active tab URL — classifies the site

Outputs a **0–100 interruptibility score** and **user state**:

| Score | State | What it means |
|-------|-------|---------------|
| 0–25 | Deep Focus | Heavy work (GitHub, Notion, Figma) |
| 26–55 | Light Focus | Mixed work |
| 56–85 | Casual | Browsing |
| 86–100 | Idle | Away from keyboard |

### Decision Engine (`decisionEngine.js`)

For each notification, computes:
- **Priority**: HIGH / MEDIUM / LOW (keyword heuristics)
- **Intent**: MESSAGE / TASK / CALL / INFO
- **Relevance**: HIGH / MEDIUM / LOW

Decision matrix:

| State | HIGH | MEDIUM | LOW |
|-------|------|--------|-----|
| Deep Focus | ALLOW | DELAY | BLOCK |
| Light Focus | ALLOW | ALLOW | DELAY |
| Casual | ALLOW | ALLOW | DELAY |
| Idle | ALLOW | ALLOW | ALLOW |

### Interaction Control

| State | Can View | Can Act |
|-------|----------|---------|
| Deep Focus | ✗ | ✗ |
| Light Focus | ✓ | ✗ |
| Casual / Idle | ✓ | ✓ |

### WhatsApp Integration (`content.js`)

- Uses `MutationObserver` on the WhatsApp Web DOM
- Extracts: sender name, message text, timestamp
- Can inject reply text and simulate Send click
- No official API needed — pure DOM manipulation

### Voice Commands (`useVoice.js`)

Uses the Web Speech API (built into Chrome). Supported commands:

| Say | Action |
|-----|--------|
| "Mark email as read" | Marks top Gmail email |
| "Archive" | Archives top email |
| "Reply okay" | Sends "Okay!" |
| "Reply I'll do it later" | Sends canned reply |
| "What did I miss?" | Shows queue count |
| "Flush the queue" | Releases all delayed |
| "Ignore this" | Dismisses top notification |
| "Reply [anything]" | Sends custom text |

### Discord Integration

**Incoming**: POST `/discord/incoming` — receives messages from a Discord bot/webhook, stores them, extension polls `GET /discord/messages`.

**Outgoing**: POST `/discord/send` with `webhookUrl` + `content` — sends reply via Discord webhook.

---

## Setting Up Discord

1. In your Discord server: **Settings → Integrations → Webhooks → New Webhook**
2. Copy the webhook URL
3. In the extension notification card, the webhook URL is stored with each Discord message
4. Replies go out via that webhook automatically

For **incoming** Discord messages:
- Create a Discord bot
- Add a message listener that POSTs to `http://localhost:3001/discord/incoming`
- Or use a Discord bot framework like discord.js

---

## Development

```bash
# Watch mode (rebuilds popup on file change)
npm run watch

# Run backend
npm run backend

# Test Discord incoming webhook
curl -X POST http://localhost:3001/discord/test \
  -H "Content-Type: application/json" \
  -d '{"sender": "Alex", "content": "URGENT: server is down!"}'
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Extension UI | React 18, Vite, Tailwind CSS |
| Extension Logic | Chrome Extension MV3, background.js, content.js |
| Chrome APIs | tabs, idle, storage, notifications, identity |
| Backend | Node.js, Express |
| Gmail | Google APIs (googleapis) + OAuth2 |
| Discord | Webhook-based (no bot required for basic use) |
| WhatsApp | DOM content script + MutationObserver |
| Voice | Web Speech API (browser-native) |

---

## File Reference

| File | Purpose |
|------|---------|
| `extension/manifest.json` | Extension config, permissions, OAuth |
| `extension/background.js` | Service worker: context + decisions + Gmail polling |
| `extension/content.js` | WhatsApp Web DOM observer + message injection |
| `extension/decisionEngine.js` | Pure logic: classify, decide, score |
| `popup-src/src/App.jsx` | Main app: tabs, action dispatch, voice routing |
| `popup-src/src/hooks/useExtensionState.js` | Chrome storage bridge |
| `popup-src/src/hooks/useVoice.js` | Web Speech API + intent parser |
| `popup-src/src/components/Header.jsx` | State card + interruptibility bar |
| `popup-src/src/components/NotificationCard.jsx` | Individual notification |
| `popup-src/src/components/VoiceUI.jsx` | Mic button + quick commands |
| `popup-src/src/components/Insights.jsx` | Focus stats |
| `backend/server.js` | Express app |
| `backend/routes/gmail.js` | Gmail OAuth + email actions |
| `backend/routes/discord.js` | Discord webhook relay |
| `backend/services/gmailService.js` | Gmail API wrapper |
| `backend/services/discordService.js` | Discord logic |
