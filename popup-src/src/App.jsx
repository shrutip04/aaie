// background.js - AAIE Service Worker

import {
  classifyNotification,
  makeDecision,
  computeInterruptibilityScore,
  scoreToUserState,
  getInteractionLevel,
  DECISIONS,
  USER_STATES,
} from './decisionEngine.js';

let state = {
  userState: USER_STATES.CASUAL,
  interruptibilityScore: 80,
  interactionLevel: { canView: true, canAct: true, label: 'Full actions' },
  notifications: [],
  queue: [],
  blocked: [],
  insights: { distractionsAvoided: 0, totalBlocked: 0, totalDelayed: 0, focusStartTime: null },
};

let contextSignals = {
  idleState: 'active', tabUrl: '',
  tabSwitchRate: 0, timeSinceLastSwitch: 0,
  lastTabSwitchTime: Date.now(), switchCount: 0,
};

// ── Context Engine ────────────────────────────────────────────────────────────

chrome.idle.setDetectionInterval(30);

chrome.idle.onStateChanged.addListener((idleState) => {
  contextSignals.idleState = idleState;
  updateContext();
  if (idleState === 'idle' || idleState === 'locked') flushQueue();
});

chrome.tabs.onActivated.addListener(async (info) => {
  const now = Date.now();
  contextSignals.timeSinceLastSwitch = now - contextSignals.lastTabSwitchTime;
  contextSignals.lastTabSwitchTime = now;
  contextSignals.switchCount++;
  setTimeout(() => { contextSignals.switchCount = Math.max(0, contextSignals.switchCount - 1); }, 60000);
  try {
    const tab = await chrome.tabs.get(info.tabId);
    contextSignals.tabUrl = tab.url || '';
  } catch (e) {}
  updateContext();
  scheduleDemoNotification(contextSignals.tabUrl);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id === tabId) { contextSignals.tabUrl = tab.url || ''; updateContext(); }
  }
});

function updateContext() {
  const score = computeInterruptibilityScore(contextSignals);
  const userState = scoreToUserState(score);
  const interactionLevel = getInteractionLevel(userState);
  const wasDeep = state.userState === USER_STATES.DEEP_FOCUS;
  const nowDeep = userState === USER_STATES.DEEP_FOCUS;
  if (!wasDeep && nowDeep) state.insights.focusStartTime = Date.now();
  state.userState = userState;
  state.interruptibilityScore = score;
  state.interactionLevel = interactionLevel;
  saveState();
}

// ── Demo: fire a relevant notification 2s after each tab switch ───────────────

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
    return { id, source: 'discord', sender: 'DevTeam #backend',
      subject: 'URGENT: PR #247 blocks prod deploy — review NOW',
      body: 'URGENT: PR #247 blocks prod deploy — review NOW',
      timestamp: Date.now(), webhookUrl: '' };
  }
  if (url.includes('youtube.com') || url.includes('netflix.com') || url.includes('reddit.com')) {
    return { id, source: 'gmail', sender: 'Newsletter <deals@shop.com>',
      subject: 'Flash sale: 50% off everything today only!',
      body: 'Flash sale: 50% off everything today only!',
      timestamp: Date.now(), messageId: id };
  }
  if (url.includes('docs.google.com') || url.includes('notion.so')) {
    return { id, source: 'gmail', sender: 'Sarah Chen <sarah@acme.com>',
      subject: 'Action required: Q4 report sign-off by 5pm today',
      body: 'Action required: Q4 report sign-off by 5pm today',
      timestamp: Date.now(), messageId: id };
  }
  if (url.includes('figma.com')) {
    return { id, source: 'discord', sender: 'Design #review',
      subject: 'Client feedback on landing page — changes needed',
      body: 'Client feedback on landing page — changes needed',
      timestamp: Date.now(), webhookUrl: '' };
  }
  if (url.includes('web.whatsapp.com') || url.includes('mail.google.com') || url.includes('slack.com')) return null;
  return { id, source: 'gmail', sender: 'Alex Kumar <alex@work.com>',
    subject: "Can we move tomorrow's meeting to 3pm?",
    body: "Can we move tomorrow's meeting to 3pm?",
    timestamp: Date.now(), messageId: id };
}

// ── Notification Pipeline ─────────────────────────────────────────────────────

function handleIncomingNotification(raw) {
  const exists = [...state.notifications, ...state.queue, ...state.blocked].some(n => n.id === raw.id);
  if (exists) return;

  const classified = classifyNotification(raw);
  const decided = makeDecision(classified, {
    userState: state.userState,
    interruptibilityScore: state.interruptibilityScore,
  });

  if (decided.decision === DECISIONS.ALLOW) {
    state.notifications.unshift(decided);
    if (state.notifications.length > 50) state.notifications.pop();
    showDesktopNotification(decided);
  } else if (decided.decision === DECISIONS.DELAY) {
    state.queue.unshift(decided);
    state.insights.totalDelayed++;
    showQueuedToast(decided);
  } else {
    state.blocked.unshift(decided);
    state.insights.totalBlocked++;
    state.insights.distractionsAvoided++;
    showBlockedToast(decided);
  }
  saveState();
}

// ── Desktop Notifications ─────────────────────────────────────────────────────

const SOURCE_EMOJI = { gmail: '📧', discord: '💬', whatsapp: '💚' };

function senderShort(n) {
  return n.sender?.match(/^([^<]+)/)?.[1]?.trim() || n.sender || 'Unknown';
}

function showDesktopNotification(n) {
  chrome.notifications.create(`allow-${n.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: `${SOURCE_EMOJI[n.source] || '🔔'} ${senderShort(n)}`,
    message: n.subject || n.body || '',
    contextMessage: `AAIE ✓ ALLOWED · ${n.priority} priority · ${state.userState}`,
    priority: n.priority === 'HIGH' ? 2 : 1,
    requireInteraction: n.priority === 'HIGH',
    buttons: n.source === 'gmail'
      ? [{ title: '✓ Mark Read' }, { title: '📦 Archive' }]
      : [{ title: '↩ Reply OK' }, { title: '✕ Dismiss' }],
  });
}

function showQueuedToast(n) {
  chrome.notifications.create(`delay-${n.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: `⏸ QUEUED: ${senderShort(n)}`,
    message: n.subject || n.body || '',
    contextMessage: `AAIE · ${n.reason}`,
    priority: 0,
  });
}

function showBlockedToast(n) {
  chrome.notifications.create(`block-${n.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: `🛡️ BLOCKED: ${senderShort(n)}`,
    message: n.subject || n.body || '',
    contextMessage: `AAIE · ${n.reason}`,
    priority: -1,
  });
}

// ── Notification button clicks ────────────────────────────────────────────────

chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  const notification = state.notifications.find(n => notifId.includes(n.id));
  if (!notification) return;
  if (notification.source === 'gmail') {
    if (btnIdx === 0) await gmailMarkRead(notification.messageId);
    if (btnIdx === 1) await gmailArchive(notification.messageId);
  } else {
    if (btnIdx === 0) {
      if (notification.source === 'discord' && notification.webhookUrl) {
        await sendDiscordReply(notification.webhookUrl, 'OK!');
      } else if (notification.source === 'whatsapp') {
        const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
        if (tabs.length > 0) chrome.tabs.sendMessage(tabs[0].id, { type: 'INJECT_MESSAGE', text: 'OK!' });
      }
    }
  }
  state.notifications = state.notifications.filter(n => n.id !== notification.id);
  chrome.notifications.clear(notifId);
  saveState();
});

chrome.notifications.onClicked.addListener((notifId) => {
  chrome.notifications.clear(notifId);
  chrome.action.openPopup?.().catch(() => {});
});

// ── Queue ─────────────────────────────────────────────────────────────────────

function flushQueue() {
  const toRelease = [...state.queue];
  state.queue = [];
  toRelease.forEach(n => {
    n.decision = DECISIONS.ALLOW;
    n.reason = 'Released from queue — user became idle';
    state.notifications.unshift(n);
    showDesktopNotification(n);
  });
  saveState();
}

// ── Gmail Polling ─────────────────────────────────────────────────────────────

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
        id: msg.id, source: 'gmail', sender: from, subject,
        body: subject, messageId: msg.id, timestamp: Date.now(),
      });
      processedEmailIds.push(msg.id);
    }
    await chrome.storage.local.set({ processedEmailIds: processedEmailIds.slice(-200) });
  } catch (e) { console.error('Gmail poll:', e); }
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
  if (!gmailToken) return;
  await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

async function gmailArchive(messageId) {
  const { gmailToken } = await chrome.storage.local.get('gmailToken');
  if (!gmailToken) return;
  await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
  });
}

// ── Discord ───────────────────────────────────────────────────────────────────

async function sendDiscordReply(webhookUrl, content) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (e) { console.error('Discord:', e); }
}

// ── Message Handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'NEW_NOTIFICATION': handleIncomingNotification(msg.payload); sendResponse({ ok: true }); break;
      case 'GET_STATE': sendResponse(state); break;
      case 'GMAIL_AUTH':
        try { sendResponse({ token: await authenticateGmail() }); }
        catch (e) { sendResponse({ error: e.message }); }
        break;
      case 'GMAIL_MARK_READ': await gmailMarkRead(msg.messageId); sendResponse({ ok: true }); break;
      case 'GMAIL_ARCHIVE': await gmailArchive(msg.messageId); sendResponse({ ok: true }); break;
      case 'DISCORD_SEND': await sendDiscordReply(msg.webhookUrl, msg.content); sendResponse({ ok: true }); break;
      case 'WHATSAPP_REPLY': {
        const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
        if (tabs.length > 0) chrome.tabs.sendMessage(tabs[0].id, { type: 'INJECT_MESSAGE', text: msg.text });
        sendResponse({ ok: true }); break;
      }
      case 'DISMISS_NOTIFICATION':
        state.notifications = state.notifications.filter(n => n.id !== msg.id);
        saveState(); sendResponse({ ok: true }); break;
      case 'FLUSH_QUEUE': flushQueue(); sendResponse({ ok: true }); break;
      case 'INJECT_DEMO': handleIncomingNotification(msg.notification); sendResponse({ ok: true }); break;
      default: sendResponse({ error: 'Unknown' });
    }
  })();
  return true;
});

// ── Storage ───────────────────────────────────────────────────────────────────

function saveState() { chrome.storage.local.set({ aaieState: state }); }

chrome.storage.local.get('aaieState', (result) => {
  if (result.aaieState) state = { ...state, ...result.aaieState };
  updateContext();
});

console.log('AAIE ✓ running');