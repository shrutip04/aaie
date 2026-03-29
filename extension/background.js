// background.js - AAIE Service Worker

import {
  classifyNotification,
  makeDecision,
  computeInterruptibilityScore,
  scoreToUserState,
  applyHysteresis,
  resetSmoothing,
  getInteractionLevel,
  DECISIONS,
  USER_STATES,
} from './decisionEngine.js';

import { getMotivationMessage } from './motivationEngine.js';

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  userState: USER_STATES.CASUAL,
  interruptibilityScore: 50,
  interactionLevel: { canView: true, canAct: true, label: 'Full actions' },
  notifications: [],
  queue: [],
  blocked: [],
  motivationNudge: null,
  insights: {
    distractionsAvoided: 0,
    totalBlocked: 0,
    totalDelayed: 0,
    focusStartTime: null,
    cognitiveLoad: 0,
    cognitiveLoadLabel: 'LOW',
    nextSafeWindow: 'Monitoring...',
  },
};

let contextSignals = {
  idleState: 'active',
  tabUrl: '',
  tabSwitchRate: 0,
  timeSinceLastSwitch: 0,
  lastTabSwitchTime: Date.now(),
  switchCount: 0,
  typingSpeed: 0,
  mouseActivity: 0,
  mouseIdleMs: 0,
};

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

  setTimeout(() => {
    contextSignals.switchCount = Math.max(0, contextSignals.switchCount - 1);
  }, 120000);

  try {
    const tab = await chrome.tabs.get(info.tabId);
    contextSignals.tabUrl = tab.url || '';
  } catch (e) {}

  // Immediately reset smoothing toward new site on tab switch
  const quickScore = computeInterruptibilityScore(contextSignals);
  resetSmoothing(quickScore);

  updateContext();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id === tabId) {
      contextSignals.tabUrl = tab.url || '';
      const quickScore = computeInterruptibilityScore(contextSignals);
      resetSmoothing(quickScore);
      updateContext();
    }
  }
});

// ─── Safe Window Detection ────────────────────────────────────────────────────

function checkSafeWindow() {
  const { typingSpeed = 0, mouseIdleMs = 0, tabSwitchRate = 0 } = contextSignals;

  const wasBusy = lastTypingSpeed > 5;
  const nowIdle = typingSpeed === 0 && mouseIdleMs > 15000;
  const tabSwitch = tabSwitchRate > 0 && contextSignals.timeSinceLastSwitch < 5000;

  if (wasBusy && nowIdle && state.queue.length > 0) {
    console.log('AAIE: Safe window — flushing queue');
    setTimeout(flushQueue, 2000);
  }

  if (tabSwitch && state.queue.length > 0) {
    state.insights.nextSafeWindow = 'Now (tab switch detected)';
  } else if (typingSpeed > 10) {
    state.insights.nextSafeWindow = `~${Math.round(typingSpeed / 3)} min`;
  } else {
    state.insights.nextSafeWindow = 'Soon';
  }

  lastTypingSpeed = typingSpeed;
}

// ─── Update Context ───────────────────────────────────────────────────────────

function updateContext() {
  const rawScore = computeInterruptibilityScore(contextSignals);
  const { score, state: newUserState } = applyHysteresis(rawScore, state.userState);

  const wasDeepFocus = state.userState === USER_STATES.DEEP_FOCUS;
  const nowDeepFocus = newUserState === USER_STATES.DEEP_FOCUS;
  if (!wasDeepFocus && nowDeepFocus) {
    state.insights.focusStartTime = Date.now();
  }

  state.userState = newUserState;
  state.interruptibilityScore = score;
  state.interactionLevel = getInteractionLevel(newUserState);
  state.typingSpeed = contextSignals.typingSpeed || 0;

  // Context mode label for header
  const url = contextSignals.tabUrl || '';
  state.interactionLevel.contextMode =
    ['zoom.us', 'meet.google', 'teams.microsoft', 'whereby', 'webex'].some(u => url.includes(u)) ? 'Meeting' :
    ['github.com', 'gitlab', 'vscode', 'replit', 'leetcode', 'codesandbox', 'stackoverflow', 'programiz', 'onlinegdb', 'hackerrank', 'codepen', 'stackblitz'].some(u => url.includes(u)) ? 'Coding' :
    ['docs.google', 'notion.so', 'figma.com', 'overleaf', 'linear.app'].some(u => url.includes(u)) ? 'Deep Work' :
    ['youtube', 'netflix', 'twitter', 'reddit', 'instagram', 'twitch'].some(u => url.includes(u)) ? 'Casual' :
    newUserState === USER_STATES.IDLE ? 'Idle' : 'Browsing';

  // Cognitive load
  const rapidSwitching = contextSignals.tabSwitchRate > 6;
  const erraticMouse   = contextSignals.mouseActivity > 200;
  const highTyping     = contextSignals.typingSpeed > 30;
  const cognitiveLoad  = (rapidSwitching ? 40 : 0) + (erraticMouse ? 30 : 0) + (highTyping ? 30 : 0);

  state.insights.cognitiveLoad = cognitiveLoad;
  state.insights.cognitiveLoadLabel =
    cognitiveLoad > 60 ? 'HIGH — consider a break' :
    cognitiveLoad > 30 ? 'MEDIUM' : 'LOW';

  checkSafeWindow();

  // ── Motivation Nudge ──────────────────────────────────────────────────────
  // FIX: use Date.now() - lastTabSwitchTime so timeOnTask keeps growing
  // while on same tab. timeSinceLastSwitch resets to 0 on every tab switch.
  const timeOnTask = (Date.now() - contextSignals.lastTabSwitchTime) / 1000;
  const nudge = getMotivationMessage({
    idleTime:    contextSignals.mouseIdleMs / 1000,
    timeOnTask,
    typingSpeed: contextSignals.typingSpeed,
    url:         contextSignals.tabUrl,
  });
  if (nudge) {
    state.motivationNudge = nudge;
    chrome.runtime.sendMessage({ type: 'MOTIVATION_NUDGE', message: nudge }).catch(() => {});
  }
  // ─────────────────────────────────────────────────────────────────────────

  saveState();
}

// ─── Notification Pipeline ────────────────────────────────────────────────────

function handleIncomingNotification(raw) {
  const alreadyExists =
    state.notifications.some(n => n.id === raw.id) ||
    state.queue.some(n => n.id === raw.id);
  if (alreadyExists) return;

  const classified = classifyNotification(raw, contextSignals.tabUrl);

  const boost = getLearningBoost(raw);
  if (boost > 0 && classified.priority === 'LOW') classified.priority = 'MEDIUM';
  if (boost < 0 && classified.priority === 'HIGH') classified.priority = 'MEDIUM';
  if (boost < 0 && classified.priority === 'MEDIUM') classified.priority = 'LOW';

  classified._typingSpeed = contextSignals.typingSpeed || 0;
  classified._sessionMinutes = Math.round((contextSignals.timeSinceLastSwitch || 0) / 60000);

  const decided = makeDecision(classified, {
    userState: state.userState,
    interruptibilityScore: state.interruptibilityScore,
    typingSpeed: contextSignals.typingSpeed || 0,
    tabUrl: contextSignals.tabUrl || '',
  });

  if (decided.decision === DECISIONS.ALLOW) {
    state.notifications.unshift(decided);
    if (state.notifications.length > 50) state.notifications.pop();
    showChromeNotification(decided);
  } else if (decided.decision === DECISIONS.DELAY) {
    state.queue.unshift(decided);
    state.insights.totalDelayed++;
    // No popup for delayed — silently queued, released later
  } else {
    state.blocked.unshift(decided);
    state.insights.totalBlocked++;
    state.insights.distractionsAvoided++;
    // Blocked = no notification at all. Silently stored for insights only.
  }

  saveState();
}

function flushQueue() {
  const toRelease = [...state.queue];
  state.queue = [];
  toRelease.forEach(n => {
    n.decision = DECISIONS.ALLOW;
    n.reason = 'Released from queue — user became idle';
    state.notifications.unshift(n);
  });
  saveState();
}

// ─── Chrome Notifications ─────────────────────────────────────────────────────

function showChromeNotification(notification) {
  const emoji = { gmail: '📧', discord: '💬', whatsapp: '💚', telegram: '✈️' };
  const sender = notification.sender?.match(/^([^<]+)/)?.[1]?.trim() || notification.sender || 'Unknown';
  chrome.notifications.create(`notif-${notification.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `${emoji[notification.source] || '🔔'} ${sender}`,
    message: notification.subject || notification.body || '',
    contextMessage: `AAIE ✓ · ${notification.priority} · ${state.userState}`,
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

// ─── Notification Button Clicks ───────────────────────────────────────────────

chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  const id = notifId.replace('notif-', '');
  const notification = state.notifications.find(n => n.id === id);
  if (!notification) return;

  if (notification.source === 'gmail') {
    if (buttonIndex === 0) await gmailMarkRead(notification.messageId);
    else if (buttonIndex === 1) await gmailArchive(notification.messageId);
    state.notifications = state.notifications.filter(n => n.id !== id);
    saveState();
  } else {
    if (buttonIndex === 0 && notification.source === 'discord' && notification.webhookUrl) {
      await sendDiscordReply(notification.webhookUrl, 'OK!');
    } else if (buttonIndex === 1) {
      state.notifications = state.notifications.filter(n => n.id !== id);
      saveState();
    }
  }
  chrome.notifications.clear(notifId);
});

// ─── Gmail ────────────────────────────────────────────────────────────────────

chrome.alarms.create('pollGmail', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollGmail') await pollGmail();
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

    await chrome.storage.local.set({ processedEmailIds: processedEmailIds.slice(-200) });
  } catch (e) {
    console.error('Gmail poll error:', e);
  }
}

async function authenticateGmail() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
      chrome.storage.local.set({ gmailToken: token });
      resolve(token);
    });
  });
}

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
        try { sendResponse({ token: await authenticateGmail() }); }
        catch (e) { sendResponse({ error: e.message }); }
        break;
      case 'GMAIL_MARK_READ': {
        const n = state.notifications.find(n => n.messageId === msg.messageId);
        if (n) recordInteraction(n, 'read');
        sendResponse(await gmailMarkRead(msg.messageId));
        break;
      }
      case 'GMAIL_ARCHIVE': {
        const n = state.notifications.find(n => n.messageId === msg.messageId);
        if (n) recordInteraction(n, 'archived');
        sendResponse(await gmailArchive(msg.messageId));
        break;
      }
      case 'DISCORD_SEND': {
        const n = state.notifications.find(n => n.webhookUrl === msg.webhookUrl);
        if (n) recordInteraction(n, 'replied');
        sendResponse(await sendDiscordReply(msg.webhookUrl, msg.content));
        break;
      }
      case 'TELEGRAM_SEND':
        try {
          const res = await fetch('http://localhost:3001/telegram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: msg.chatId, text: msg.text }),
          });
          sendResponse(await res.json());
        } catch (e) { sendResponse({ error: e.message }); }
        break;
      case 'WHATSAPP_REPLY': {
        const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'INJECT_MESSAGE', text: msg.text });
          sendResponse({ ok: true });
        } else {
          sendResponse({ error: 'WhatsApp Web not open' });
        }
        break;
      }
      case 'DISMISS_NOTIFICATION': {
        const n = state.notifications.find(n => n.id === msg.id);
        if (n) recordInteraction(n, 'dismissed');
        state.notifications = state.notifications.filter(n => n.id !== msg.id);
        saveState();
        sendResponse({ ok: true });
        break;
      }
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
      case 'DISMISS_NUDGE':
        state.motivationNudge = null;
        saveState();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true;
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
  } catch (e) { return { error: e.message }; }
}

const DISCORD_API = 'http://localhost:3001/discord/messages';
let lastFetchTime = 0;

async function pollDiscord() {
  try {
    const res = await fetch(`${DISCORD_API}?since=${lastFetchTime}`);
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) return;
    data.messages.forEach(msg => {
      handleIncomingNotification({
        id: msg.id,
        source: 'discord',
        sender: msg.sender,
        subject: msg.body,
        body: msg.body,
        timestamp: msg.receivedAt,
        webhookUrl: msg.webhookUrl,
      });
      if (msg.receivedAt > lastFetchTime) lastFetchTime = msg.receivedAt;
    });
  } catch (err) {
    console.error('Discord polling error:', err);
  }
}

setInterval(pollDiscord, 3000);
pollDiscord();

// ─── Telegram Polling ─────────────────────────────────────────────────────────

async function pollTelegram() {
  try {
    const res = await fetch('http://localhost:3001/telegram/messages');
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) return;
    data.messages.forEach(msg => {
      handleIncomingNotification({
        id: msg.id,
        source: 'telegram',
        sender: msg.sender,
        subject: msg.body,
        body: msg.body,
        timestamp: msg.timestamp,
        chatId: msg.chatId,
      });
    });
  } catch (err) {
    console.error('Telegram polling error:', err);
  }
}

setInterval(pollTelegram, 3000);

// ─── Learning Layer ───────────────────────────────────────────────────────────

let learningData = {
  senderScores: {},
  sourceScores: {},
  keywordScores: {},
  totalInteractions: 0,
};

async function loadLearningData() {
  const { aaieLearn } = await chrome.storage.local.get('aaieLearn');
  if (aaieLearn) learningData = { ...learningData, ...aaieLearn };
}

function saveLearningData() {
  chrome.storage.local.set({ aaieLearn: learningData });
}

function recordInteraction(notification, interactionType) {
  const sender = notification.sender?.match(/^([^<]+)/)?.[1]?.trim() || notification.sender || 'unknown';
  const source = notification.source || 'unknown';

  if (!learningData.senderScores[sender]) {
    learningData.senderScores[sender] = { opened: 0, dismissed: 0, replied: 0, archived: 0 };
  }
  learningData.senderScores[sender][interactionType] =
    (learningData.senderScores[sender][interactionType] || 0) + 1;

  if (!learningData.sourceScores[source]) {
    learningData.sourceScores[source] = { opened: 0, dismissed: 0 };
  }
  if (interactionType === 'dismissed') learningData.sourceScores[source].dismissed++;
  else learningData.sourceScores[source].opened++;

  const text = `${notification.subject || ''} ${notification.body || ''}`.toLowerCase();
  text.split(/\s+/).filter(w => w.length > 4).forEach(kw => {
    if (!learningData.keywordScores[kw]) learningData.keywordScores[kw] = 0;
    learningData.keywordScores[kw] += interactionType === 'dismissed' ? -0.1 : 0.2;
    learningData.keywordScores[kw] = Math.max(-2, Math.min(2, learningData.keywordScores[kw]));
  });

  learningData.totalInteractions++;
  saveLearningData();

  state.insights.learningData = {
    totalInteractions: learningData.totalInteractions,
    topSenders: getTopSenders(),
    mostDismissed: getMostDismissed(),
  };
  saveState();
}

function getTopSenders() {
  return Object.entries(learningData.senderScores)
    .map(([sender, s]) => ({ sender, score: (s.opened || 0) * 2 + (s.replied || 0) * 3 - (s.dismissed || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.sender);
}

function getMostDismissed() {
  return Object.entries(learningData.senderScores)
    .filter(([, s]) => (s.dismissed || 0) > 1)
    .sort((a, b) => b[1].dismissed - a[1].dismissed)
    .slice(0, 3)
    .map(([sender]) => sender);
}

function getLearningBoost(notification) {
  const sender = notification.sender?.match(/^([^<]+)/)?.[1]?.trim() || '';
  const scores = learningData.senderScores[sender];
  if (!scores) return 0;
  const openRate = scores.opened / Math.max(1, scores.opened + scores.dismissed);
  if (openRate > 0.7) return 1;
  if (openRate < 0.2) return -1;
  return 0;
}

// ─── Storage + Init ───────────────────────────────────────────────────────────

function saveState() {
  chrome.storage.local.set({ aaieState: state });
}

chrome.storage.local.get('aaieState', (result) => {
  if (result.aaieState) {
    state = { ...state, ...result.aaieState };
  }
  updateContext();
});

loadLearningData();
setTimeout(pollGmail, 3000);

console.log('AAIE background service worker started');