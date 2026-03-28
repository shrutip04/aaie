// background.js - AAIE Service Worker
// Context Engine + Notification Manager + Decision Engine

import {
  classifyNotification,
  makeDecision,
  computeInterruptibilityScore,
  scoreToUserState,
  getInteractionLevel,
  DECISIONS,
  USER_STATES,
} from './decisionEngine.js';

// ─── State ───────────────────────────────────────────────────────────────────



let state = {
  userState: USER_STATES.CASUAL,
  interruptibilityScore: 80,
  interactionLevel: { canView: true, canAct: true, label: 'Full actions' },
  notifications: [],   // allowed (shown)
  queue: [],           // delayed
  blocked: [],         // blocked (for insights)
  insights: {
    distractionsAvoided: 0,
    totalBlocked: 0,
    totalDelayed: 0,
    focusStartTime: null,
  },
};

let contextSignals = {
  idleState: 'active',
  tabUrl: '',
  tabSwitchRate: 0,
  timeSinceLastSwitch: 0,
  lastTabSwitchTime: Date.now(),
  switchCount: 0,
};

let safeWindowTimer = null;
let lastTypingSpeed = 0;

// ─── Context Engine ───────────────────────────────────────────────────────────

chrome.idle.setDetectionInterval(30);

chrome.idle.onStateChanged.addListener((idleState) => {
  contextSignals.idleState = idleState;
  updateContext();

  if (idleState === 'idle' || idleState === 'locked') {
    flushQueue();
  }
});

chrome.tabs.onActivated.addListener(async (info) => {
  const now = Date.now();
  contextSignals.timeSinceLastSwitch = now - contextSignals.lastTabSwitchTime;
  contextSignals.lastTabSwitchTime = now;
  contextSignals.switchCount++;

  contextSignals.tabSwitchRate = contextSignals.switchCount;
  setTimeout(() => { contextSignals.switchCount = Math.max(0, contextSignals.switchCount - 1); }, 60000);

  try {
    const tab = await chrome.tabs.get(info.tabId);
    contextSignals.tabUrl = tab.url || '';
  } catch (e) {}

  updateContext();
  scheduleDemoNotification(contextSignals.tabUrl); // ← fires demo popup
});

// ─── Demo Notification Engine ─────────────────────────────────────────────────

let demoTimer = null;
let lastDemoUrl = '';

function scheduleDemoNotification(url) {
  if (!url || url === lastDemoUrl) return;
  lastDemoUrl = url;
  if (demoTimer) clearTimeout(demoTimer);
  demoTimer = setTimeout(() => {
    const notif = buildDemoNotification(url);
    if (notif) handleIncomingNotification(notif);
  }, 2000);
}

function buildDemoNotification(url) {
  const id = `demo-${Date.now()}`;
  if (url.includes('github.com') || url.includes('gitlab.com')) {
    return {
      id, source: 'discord', sender: 'DevTeam #backend',
      subject: 'URGENT: PR #247 blocks prod deploy — needs review NOW',
      body: 'URGENT: PR #247 blocks prod deploy — needs review NOW',
      timestamp: Date.now(), webhookUrl: '',
    };
  }
  if (url.includes('youtube.com') || url.includes('netflix.com') || url.includes('reddit.com')) {
    return {
      id, source: 'gmail', sender: 'Newsletter <deals@shop.com>',
      subject: 'Flash sale: 50% off everything today only!',
      body: 'Flash sale: 50% off everything today only!',
      timestamp: Date.now(), messageId: id,
    };
  }
  if (url.includes('docs.google.com') || url.includes('notion.so')) {
    return {
      id, source: 'gmail', sender: 'Sarah Chen <sarah@acme.com>',
      subject: 'Action required: Q4 report sign-off by 5pm today',
      body: 'Action required: Q4 report sign-off by 5pm today',
      timestamp: Date.now(), messageId: id,
    };
  }
  if (url.includes('figma.com')) {
    return {
      id, source: 'discord', sender: 'Design #review',
      subject: 'Client feedback on landing page — changes needed',
      body: 'Client feedback on landing page — changes needed before tomorrow',
      timestamp: Date.now(), webhookUrl: '',
    };
  }
  if (url.includes('web.whatsapp.com') || url.includes('mail.google.com') || url.includes('slack.com')) return null;
  return {
    id, source: 'gmail', sender: 'Alex Kumar <alex@work.com>',
    subject: "Can we move tomorrow's meeting to 3pm?",
    body: "Can we move tomorrow's meeting to 3pm? Let me know.",
    timestamp: Date.now(), messageId: id,
  };
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id === tabId) {
      contextSignals.tabUrl = tab.url || '';
      updateContext();
    }
  }
});



// Predictive timing: detect when user is about to take a break
function checkSafeWindow() {
  const { typingSpeed = 0, mouseIdleMs = 0, tabSwitchRate = 0 } = contextSignals;

  const wasBusy = lastTypingSpeed > 5;
  const nowIdle = typingSpeed === 0 && mouseIdleMs > 15000;
  const tabSwitch = tabSwitchRate > 0 && contextSignals.timeSinceLastSwitch < 5000;

  // Typing just stopped after active session → safe window
  if (wasBusy && nowIdle) {
    console.log('AAIE: Safe window detected — flushing queue');
    if (state.queue.length > 0) {
      setTimeout(flushQueue, 2000); // 2s grace before releasing
    }
  }

  // Tab just switched → potential break
  if (tabSwitch && state.queue.length > 0) {
    state.insights.nextSafeWindow = 'Now (tab switch detected)';
  } else if (typingSpeed > 10) {
    const estMinutes = Math.round(typingSpeed / 3);
    state.insights.nextSafeWindow = `~${estMinutes} min`;
  } else {
    state.insights.nextSafeWindow = 'Soon';
  }

  lastTypingSpeed = typingSpeed;
  saveState();
}

function updateContext() {
  const score = computeInterruptibilityScore(contextSignals);
  const userState = scoreToUserState(score);
  const interactionLevel = getInteractionLevel(userState);

  const wasDeepFocus = state.userState === USER_STATES.DEEP_FOCUS;
  const nowDeepFocus = userState === USER_STATES.DEEP_FOCUS;

  if (!wasDeepFocus && nowDeepFocus) {
    state.insights.focusStartTime = Date.now();
  }

  state.userState = userState;
  state.interruptibilityScore = score;
  state.interactionLevel = interactionLevel;

  saveState();
}
// ─── Notification Pipeline ────────────────────────────────────────────────────

function handleIncomingNotification(raw) {
  // Deduplicate — skip if same id already exists
  const alreadyExists = state.notifications.some(n => n.id === raw.id) ||
                      state.queue.some(n => n.id === raw.id);
  if (alreadyExists) return;

  const classified = classifyNotification(raw, contextSignals.tabUrl);
  classified._typingSpeed = contextSignals.typingSpeed || 0;
  classified._sessionMinutes = Math.round((contextSignals.timeSinceLastSwitch || 0) / 60000);

  const decided = makeDecision(classified, {
    userState: state.userState,
    interruptibilityScore: state.interruptibilityScore,
    typingSpeed: contextSignals.typingSpeed || 0,
  });

  if (decided.decision === DECISIONS.ALLOW) {
    state.notifications.unshift(decided);
    if (state.notifications.length > 50) state.notifications.pop();
    showChromeNotification(decided);
  } else if (decided.decision === DECISIONS.DELAY) {
    state.queue.unshift(decided);
    state.insights.totalDelayed++;
    showQueuedNotification(decided);   // ← shows QUEUED popup
  } else {
    state.blocked.unshift(decided);
    state.insights.totalBlocked++;
    state.insights.distractionsAvoided++;
    showBlockedNotification(decided);  // ← shows BLOCKED popup
  }

  saveState();
}

function flushQueue() {
  const toRelease = [...state.queue];
  state.queue = [];

  toRelease.forEach(n => {
    const reDecided = makeDecision(n, {
      userState: USER_STATES.IDLE,
      interruptibilityScore: 100,
    });
    reDecided.decision = DECISIONS.ALLOW;
    reDecided.reason = 'Released from queue — user became idle';
    state.notifications.unshift(reDecided);
  });

  saveState();
}

function showChromeNotification(notification) {
  const emoji = { gmail: '📧', discord: '💬', whatsapp: '💚' };
  const sender = notification.sender?.match(/^([^<]+)/)?.[1]?.trim() || notification.sender || 'Unknown';
  chrome.notifications.create(`notif-${notification.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `${emoji[notification.source] || '🔔'} ${sender}`,
    message: notification.subject || notification.body || '',
    contextMessage: `AAIE ✓ ALLOWED · ${notification.priority} · ${state.userState}`,
    priority: notification.priority === 'HIGH' ? 2 : 1,
    requireInteraction: notification.priority === 'HIGH',
    buttons: notification.source === 'gmail'
      ? [{ title: '✓ Mark Read' }, { title: '📦 Archive' }]
      : [{ title: '↩ Reply OK' }, { title: '✕ Dismiss' }],
  });
}

function showQueuedNotification(notification) {
  const sender = notification.sender?.match(/^([^<]+)/)?.[1]?.trim() || notification.sender;
  chrome.notifications.create(`delay-${notification.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `⏸ QUEUED: ${sender}`,
    message: notification.subject || notification.body || '',
    contextMessage: `AAIE · ${notification.reason}`,
    priority: 0,
  });
}

function showBlockedNotification(notification) {
  const sender = notification.sender?.match(/^([^<]+)/)?.[1]?.trim() || notification.sender;
  chrome.notifications.create(`block-${notification.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `🛡️ BLOCKED: ${sender}`,
    message: notification.subject || notification.body || '',
    contextMessage: `AAIE · ${notification.reason}`,
    priority: -1,
  });
}

// ─── Gmail Polling ────────────────────────────────────────────────────────────

chrome.alarms.create('pollGmail', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollGmail') {
    await pollGmail();
  }
});

async function pollGmail() {
  try {
    const { gmailToken } = await chrome.storage.local.get('gmailToken');
    if (!gmailToken) return;

    const res = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=is:unread&labelIds=INBOX',
      { headers: { Authorization: `Bearer ${gmailToken}` } }
    );

    if (!res.ok) return;
    const data = await res.json();
    if (!data.messages) return;

    const { processedEmailIds = [] } = await chrome.storage.local.get('processedEmailIds');

    for (const msg of data.messages) {
      if (processedEmailIds.includes(msg.id)) continue;

      const detail = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${gmailToken}` } }
      );
      const emailData = await detail.json();

      const headers = emailData.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';

      handleIncomingNotification({
        id: msg.id,
        source: 'gmail',
        sender: from,
        subject,
        body: subject,
        messageId: msg.id,
        threadId: emailData.threadId,
        timestamp: Date.now(),
      });

      processedEmailIds.push(msg.id);
    }

    // Keep only last 200 processed IDs
    await chrome.storage.local.set({
      processedEmailIds: processedEmailIds.slice(-200)
    });

  } catch (e) {
    console.error('Gmail poll error:', e);
  }
}

// ─── Gmail OAuth ──────────────────────────────────────────────────────────────

async function authenticateGmail() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      chrome.storage.local.set({ gmailToken: token });
      resolve(token);
    });
  });
}

// ─── Gmail Actions ────────────────────────────────────────────────────────────

async function gmailMarkRead(messageId) {
  const { gmailToken } = await chrome.storage.local.get('gmailToken');
  if (!gmailToken) return { error: 'Not authenticated' };

  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    }
  );
  return res.ok ? { success: true } : { error: 'Failed' };
}

async function gmailArchive(messageId) {
  const { gmailToken } = await chrome.storage.local.get('gmailToken');
  if (!gmailToken) return { error: 'Not authenticated' };

  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
    }
  );
  return res.ok ? { success: true } : { error: 'Failed' };
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'NEW_NOTIFICATION':
        handleIncomingNotification(msg.payload);
        sendResponse({ ok: true });
        break;

      case 'GET_STATE':
        sendResponse(state);
        break;

      case 'GMAIL_AUTH':
        try {
          const token = await authenticateGmail();
          sendResponse({ token });
        } catch (e) {
          sendResponse({ error: e.message });
        }
        break;

      case 'GMAIL_MARK_READ':
        sendResponse(await gmailMarkRead(msg.messageId));
        break;

      case 'GMAIL_ARCHIVE':
        sendResponse(await gmailArchive(msg.messageId));
        break;

      case 'DISCORD_SEND':
        sendResponse(await sendDiscordReply(msg.webhookUrl, msg.content));
        break;

      case 'WHATSAPP_REPLY':
        // Forward to content script on WhatsApp tab
        const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'INJECT_MESSAGE',
            text: msg.text,
          });
          sendResponse({ ok: true });
        } else {
          sendResponse({ error: 'WhatsApp Web not open' });
        }
        break;

      case 'DISMISS_NOTIFICATION':
        state.notifications = state.notifications.filter(n => n.id !== msg.id);
        saveState();
        sendResponse({ ok: true });
        break;

      case 'FLUSH_QUEUE':
        flushQueue();
        sendResponse({ ok: true });
        break;
      
      case 'CONTENT_SIGNALS':
        contextSignals.typingSpeed = msg.payload.typingSpeed;
        contextSignals.mouseActivity = msg.payload.mouseActivity;
        contextSignals.mouseIdleMs = msg.payload.mouseIdleMs;
        updateContext();
        sendResponse({ ok: true });
        break;

      case 'INJECT_DEMO':
        handleIncomingNotification(msg.notification);
        sendResponse({ ok: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // keep channel open for async
});

// ─── Discord ──────────────────────────────────────────────────────────────────

async function sendDiscordReply(webhookUrl, content) {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return res.ok ? { success: true } : { error: 'Webhook failed' };
  } catch (e) {
    return { error: e.message };
  }
}

// ─── Backend webhook receiver (Discord incoming) ──────────────────────────────
// Backend posts to extension via chrome.runtime.sendMessage from a relay
// The extension also exposes a native messaging host if needed.
// For hackathon: backend calls this endpoint via a relay content script.

// ─── Storage ──────────────────────────────────────────────────────────────────

function saveState() {
  chrome.storage.local.set({ aaieState: state });
}

// Init
chrome.storage.local.get('aaieState', (result) => {
  if (result.aaieState) {
    state = { ...state, ...result.aaieState };
  }
  updateContext();
});

// ─── Discord Polling (CONNECT BACKEND → EXTENSION) ───────────────────────────

const DISCORD_API = "http://localhost:3001/discord/messages";

let lastFetchTime = 0;

async function pollDiscord() {
  try {
    const res = await fetch(`${DISCORD_API}?since=${lastFetchTime}`);
    const data = await res.json();

    if (!data.messages || data.messages.length === 0) return;

    console.log("Discord messages received:", data.messages);

    data.messages.forEach(msg => {
      handleIncomingNotification({
        id: msg.id,
        source: "discord",
        sender: msg.sender,
        subject: msg.body,
        body: msg.body,
        timestamp: msg.receivedAt,
        webhookUrl: msg.webhookUrl
      });

      // update last fetch time
      if (msg.receivedAt > lastFetchTime) {
        lastFetchTime = msg.receivedAt;
      }
    });

  } catch (err) {
    console.error("Discord polling error:", err);
  }
}

// Poll every 3 seconds
setInterval(pollDiscord, 3000);

// Initial call
pollDiscord();

console.log('AAIE background service worker started');
