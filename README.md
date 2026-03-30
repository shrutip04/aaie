# 🧠 AAIE — Attention + Action Intelligence Engine

> *"We don't just manage notifications. We understand attention."*

A Chrome extension powered by a 9-engine AI pipeline that decides **when to interrupt you**, **what deserves your attention**, and **lets you act across Gmail, WhatsApp, Discord, and Telegram** — all from a single intelligent UI with voice control. No tab switching. No context loss.

---

## 🎯 The Problem

Every knowledge worker is interrupted every **2 minutes** on average. After each interruption, it takes **23 minutes** to fully regain focus. Existing tools (Superhuman, Slack DND, Apple Focus Mode) use **static rules** — they don't know what you're doing, don't understand notification content, and can't predict the right moment to reach you.

**AAIE solves this with real-time behavioral intelligence.**

---

## ✨ What Makes AAIE Different

| Feature | Superhuman | Slack DND | Apple Focus | **AAIE** |
|---|---|---|---|---|
| Knows what you're doing | ✗ | ✗ | ✗ | ✅ |
| Understands notification content | Partial | ✗ | ✗ | ✅ |
| Predicts safe interruption windows | ✗ | ✗ | ✗ | ✅ |
| Cross-app reply without switching tabs | ✗ | ✗ | ✗ | ✅ |
| Voice-to-text replies | ✗ | ✗ | ✗ | ✅ |
| Learns your preferences over time | Partial | ✗ | ✗ | ✅ |
| Notification summaries | ✗ | ✗ | ✗ | ✅ |

---

## 🔌 Connected Apps (Live, Real Accounts)

| App | What Works |
|-----|------------|
| **Gmail** | Real emails via OAuth2 — mark read, archive, reply without opening Gmail |
| **WhatsApp** | Real personal messages via WhatsApp Web DOM observer — reply sends to your actual phone |
| **Discord** | Real server messages via Discord bot — reply via webhook to actual channel |
| **Telegram** | Real messages via Telegram Bot API — reply goes to actual Telegram chat |

> All replies are **real** — they appear in your actual apps on your phone and desktop instantly. No simulation.

---
<img width="1919" height="959" alt="Screenshot 2026-03-29 113819" src="https://github.com/user-attachments/assets/8af4d78e-1a04-437a-bf27-021b2472a3c4" />
<img width="1918" height="971" alt="Screenshot 2026-03-30 223400" src="https://github.com/user-attachments/assets/273a984e-35f4-45a6-9463-5cb2b8aa4e1f" />
<img width="1080" height="1350" alt="demoo" src="https://github.com/user-attachments/assets/ad02fa24-dcdd-431c-81b4-7f379803fe53" />
<img width="1919" height="979" alt="Screenshot 2026-03-31 001853" src="https://github.com/user-attachments/assets/2ffaf163-3265-4bb6-ae9b-c15f091e3ce1" />
<img width="1919" height="974" alt="Screenshot 2026-03-31 001909" src="https://github.com/user-attachments/assets/f04fc56a-e91f-4caf-afb2-af1e21b46a35" />
<img width="1919" height="974" alt="Screenshot 2026-03-31 001954" src="https://github.com/user-attachments/assets/9e479ee9-3d4b-4a91-a699-7cba755ab47e" />


---
## 🧠 Core System (Multi-Layer Decision Pipeline)

### Engine 1 — Context Understanding
Monitors 5 real-time behavioral signals every 3 seconds:
- **Active tab URL** → classifies site (coding/meeting/casual/comms)
- **Typing speed** → keystrokes per 10 seconds via content script
- **Mouse movement velocity** → activity bursts per interval
- **Tab switching rate** → frequency of context changes
- **Chrome idle API** → active / idle / locked detection

### Engine 2 — Interruptibility Scoring
Combines all signals into a **live 0–100 score** with hysteresis smoothing to prevent flapping:

| Score | State | Example |
|-------|-------|---------|
| 0–35 | 🎯 Deep Focus | GitHub, Programiz, Figma, Notion |
| 36–62 | ⚡ Light Focus | Mixed browsing with work |
| 63–85 | 🌿 Casual | YouTube, Reddit, Instagram |
| 86–100 | 😴 Idle | Away from keyboard |

### Engine 3 — Task-Relevance Matching
Detects your current task context from the active URL, then matches notification content against task-specific keywords. On GitHub, a "server is down" Discord message scores **HIGH relevance**. A newsletter scores **LOW**.

### Engine 4 — Interruption Cost Calculation
Estimates the cognitive cost of breaking your current flow based on:
- How long you've been on the same task
- Your current typing intensity
- Session depth score

### Engine 5 — Decision Engine
Routes every notification through a decision matrix:

| State | HIGH Priority | MEDIUM Priority | LOW Priority |
|-------|--------------|-----------------|--------------|
| Deep Focus | ALLOW | DELAY | BLOCK |
| Light Focus | ALLOW | ALLOW/DELAY | DELAY |
| Casual | ALLOW | ALLOW | DELAY |
| Idle | ALLOW | ALLOW | ALLOW |

### Engine 6 — Predictive Timing (Safe Window Detection)
Detects when you're about to take a break by monitoring:
- Typing speed dropping to zero after an active session
- Tab switches after a long focus period
- Mouse inactivity thresholds

Queued notifications are released automatically at these safe windows — nothing is lost, just optimally timed.

### Engine 7 — Cognitive Load Monitor
Detects mental overload by combining:
- Rapid tab switching (>6 switches/min)
- Erratic mouse movement (>200 events/interval)
- Sustained high typing speed (>30 keys/10s)

Shows a live cognitive load bar (LOW / MEDIUM / HIGH) with break suggestions.

### Engine 8 — Notification Summary
Instead of overwhelming you with individual notifications, AAIE compresses them into a **single intelligent summary** after a focus session:
- Grouped by source (Gmail, WhatsApp, Discord, Telegram)
- Urgency-ranked with callouts for HIGH priority items
- AI-generated plain-English briefing
- Expandable per-source breakdown

### Engine 9 — Learning Layer
Tracks every interaction (opened, dismissed, replied, archived) and adapts:
- **Priority senders** auto-boosted (people you always respond to)
- **Frequent dismissals** auto-reduced (newsletters you always ignore)
- Keyword weight adjustments per source
- Persisted across sessions via `chrome.storage.local`

---

## 🎤 Voice-to-Text Replies

Speak naturally — AAIE converts, refines with AI, and sends to the real app:

| You say | AI refines to | Sent via |
|---------|--------------|----------|
| "tell mom I'll call later" | "Hey Mom, I'll call you a bit later 🙂" | WhatsApp (real) |
| "reply I'm in a meeting" | "I'm currently in a meeting, will get back to you soon." | Gmail/Discord (real) |
| "mark email as read" | — | Gmail API |
| "flush the queue" | — | Releases all delayed |
| "archive this" | — | Gmail API |

**Reply Mode** shows exactly who you're replying to and previews the AI-refined message before sending. The reply **appears instantly in the real app** on your phone.

---

## 🗂 Notification Summary Tab

After focus sessions, instead of 15 individual cards:
```
WHILE YOU WERE DEEP FOCUS
37 notifications managed

✓ 8 shown  ⏸ 22 queued  🛡 7 blocked

🚨 NEEDS ATTENTION (3 urgent)
  📧 Sarah Chen — URGENT: Server down
  💬 DevTeam — PR #247 needs review
  ✈️ Alex — Can you join the call?

By Source
  📩 Gmail · 12 total (2 urgent)
  💬 Discord · 8 total (1 urgent)
  💚 WhatsApp · 11 total
  ✈️ Telegram · 6 total

🧠 AI Summary
You have 3 urgent messages that need attention.
22 notifications were held back to protect your focus.
7 low-priority items were automatically blocked.
```

---

## 🔔 Interaction Control

AAIE gates what you can do based on focus state — preventing the extension itself from becoming a distraction:

| State | Can See Notifications | Can Reply/Act |
|-------|----------------------|---------------|
| Deep Focus | ✗ Hidden | ✗ Locked |
| Light Focus | ✓ View only | ✗ Locked |
| Casual / Idle | ✓ Full feed | ✓ Full actions |

---

## ⚡ Single-Extension Actions (No Tab Switching)

From one popup, without opening any other app:

- **Gmail** → Mark as read, Archive, Reply
- **WhatsApp** → Quick replies (On it!, Give me 5 mins, etc.), custom reply → sends to phone
- **Discord** → Reply via webhook → appears in real channel
- **Telegram** → Reply → appears in real Telegram chat
- **All sources** → Dismiss, view priority/relevance badges

---

## 🏗 Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                                      │
│                                                              │
│  background.js     → 9-Engine Pipeline + Decision Layer      │
│  decisionEngine.js → Pure scoring + classification logic     │
│  contentSignals.js → Typing speed + mouse signals (all tabs) │
│  content.js        → WhatsApp Web DOM observer + injector    │
│  whatsappInjector.js → Page-world Notification interceptor   │
│  popup/ (React)    → Feed, Summary, Voice, Insights UI       │
└──────────────────────┬──────────────────────────────────────┘
                       │ chrome.storage + runtime.sendMessage
┌──────────────────────▼──────────────────────────────────────┐
│  Backend (Node.js + Express)                                 │
│                                                              │
│  /gmail     → OAuth2 + Gmail API (read/archive/mark)         │
│  /discord   → Incoming webhook relay + outgoing replies      │
│  /telegram  → Bot API polling + send messages                │
└─────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  External Services                                           │
│                                                              │
│  Gmail API (googleapis)                                      │
│  Discord Bot (discord.js) + Webhooks                         │
│  Telegram Bot API                                            │
│  WhatsApp Web DOM (no API — pure browser interception)       │
│  Anthropic Claude API (voice reply refinement)               │
└─────────────────────────────────────────────────────────────┘
```


## 🔄 How It Works (Simple Flow)

1. Capture notifications (Gmail / Discord / WhatsApp)
2. Analyze user context (focus, tab, activity)
3. Classify notification (priority, intent, relevance)
4. Decide action (allow / delay / block)
5. Execute or queue action
```
```
## 📁 Project Structure
```
aaie/
├── extension/
│   ├── manifest.json          Permissions, OAuth, content scripts
│   ├── background.js          Service worker: all 9 engines
│   ├── decisionEngine.js      Scoring, classification, decisions
│   ├── contentSignals.js      Typing + mouse tracking (all pages)
│   ├── content.js             WhatsApp Web observer + reply injector
│   ├── whatsappInjector.js    Page-world Notification interceptor
│   └── popup/                 Built React app (output of npm run build)
│
├── popup-src/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Header.jsx         Live score ring + context mode badge
│       │   ├── NotificationFeed.jsx
│       │   ├── NotificationCard.jsx   Per-card actions + quick replies
│       │   ├── QueueSection.jsx   Expandable queue with release
│       │   ├── Summary.jsx        Notification summary + AI briefing
│       │   ├── VoiceUI.jsx        Voice-to-text + AI reply refinement
│       │   └── Insights.jsx       Cognitive load + learning layer
│       └── hooks/
│           ├── useExtensionState.js   Chrome storage bridge
│           └── useVoice.js            Web Speech API
│
├── backend/
│   ├── server.js
│   ├── bot.js                 Discord.js bot (real message forwarding)
│   ├── routes/
│   │   ├── gmail.js
│   │   ├── discord.js
│   │   └── telegram.js
│   └── services/
│       ├── gmailService.js
│       ├── discordService.js
│       └── telegramService.js
│
└── generate-icons.js
```

---

## 🚀 Quick Start
```bash
# 1. Install all dependencies
npm run setup

# 2. Build the React popup
npm run build

# 3. Start backend
cd backend && npm run dev

# 4. Start Discord bot (separate terminal)
cd backend && npm run bot

# 5. Load extension in Chrome
# chrome://extensions → Developer mode → Load unpacked → select extension/
```

---

## 🧪 Testing
```bash
# Fire a test Discord notification
Invoke-WebRequest -Uri "http://localhost:3001/discord/test" \
  -Method POST \
  -Headers @{"Content-Type"="application/json"} \
  -Body '{"sender": "Alex", "content": "URGENT: server is down!"}' \
  -UseBasicParsing

# Check backend health
curl http://localhost:3001/health
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Extension UI | React 18 + Vite |
| Extension Logic | Chrome MV3, Service Worker |
| Chrome APIs | tabs, idle, storage, notifications, identity, alarms |
| Context Signals | Content Scripts (keydown, mousemove, iframe support) |
| Backend | Node.js + Express |
| Gmail | Google APIs OAuth2 + REST |
| Discord | discord.js bot + Webhook API |
| Telegram | Telegram Bot API (polling) |
| WhatsApp | DOM MutationObserver + Notification interceptor |
| Voice | Web Speech API (browser-native, zero dependencies) |
| AI Reply Refinement | Anthropic Claude API (claude-sonnet-4) |
| Learning Layer | chrome.storage.local (persistent, private) |
| NLP Classification | Custom keyword engine (<1ms, no external ML) |

---

## 🏆 One-Line Summary

> **"AAIE understands attention, controls interruptions, and enables effortless cross-app communication — all from a single extension, in real time, with zero context switching."**
