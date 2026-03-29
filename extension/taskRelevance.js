// taskRelevance.js — plug into decisionEngine.js

export const TASK_TYPES = {
  CODING:        'CODING',
  ENTERTAINMENT: 'ENTERTAINMENT',
  GENERAL:       'GENERAL',
};

export const NOTIF_CATEGORIES = {
  CODING:    'CODING',
  MARKETING: 'MARKETING',
  GENERAL:   'GENERAL',
};

// ─── 1. Detect current task from URL ─────────────────────────────────────────

const CODING_URLS = [
  'github.com', 'gitlab.com', 'bitbucket.org',
  'leetcode.com', 'hackerrank.com', 'codeforces.com',
  'codepen.io', 'replit.com', 'stackblitz.com',
  'vscode.dev', 'codesandbox.io', 'stackoverflow.com',
  'jsfiddle.net', 'onecompiler.com', 'codechef.com',
];

const ENTERTAINMENT_URLS = [
  'youtube.com', 'netflix.com', 'twitch.tv',
  'reddit.com', 'instagram.com', 'tiktok.com',
  'twitter.com', 'x.com', 'facebook.com',
];

export function detectTaskFromUrl(url = '') {
  if (!url || url.startsWith('chrome://')) return TASK_TYPES.GENERAL;
  if (CODING_URLS.some(u => url.includes(u)))        return TASK_TYPES.CODING;
  if (ENTERTAINMENT_URLS.some(u => url.includes(u))) return TASK_TYPES.ENTERTAINMENT;
  return TASK_TYPES.GENERAL;
}

// ─── 2. Classify notification content by category ────────────────────────────

const CODING_KEYWORDS = [
  'bug', 'fix', 'deploy', 'commit', 'pull request', 'pr', 'merge',
  'build', 'pipeline', 'ci', 'error', 'crash', 'server', 'repo',
  'code', 'test', 'leetcode', 'interview', 'contest', 'submission',
  'issue', 'review', 'branch', 'release', 'down', 'alert',
];

const MARKETING_KEYWORDS = [
  'sale', 'offer', 'discount', 'off', 'deal', 'promo', 'coupon',
  'limited time', 'buy now', 'shop', 'subscribe', 'newsletter',
  'exclusive', 'free shipping', 'flash sale', 'unsubscribe',
  'marketing', 'ad', 'sponsored',
];

export function classifyNotificationCategory(notification) {
  const text = `${notification.subject || ''} ${notification.body || ''} ${notification.sender || ''}`.toLowerCase();
  if (CODING_KEYWORDS.some(k => text.includes(k)))    return NOTIF_CATEGORIES.CODING;
  if (MARKETING_KEYWORDS.some(k => text.includes(k))) return NOTIF_CATEGORIES.MARKETING;
  return NOTIF_CATEGORIES.GENERAL;
}

// ─── 3. Check relevance of notification to current task ──────────────────────

export function isRelevantToTask(notification, taskType) {
  const category = classifyNotificationCategory(notification);

  switch (taskType) {
    case TASK_TYPES.CODING:
      if (category === NOTIF_CATEGORIES.MARKETING) return false;
      if (category === NOTIF_CATEGORIES.CODING)    return true;
      return false; // GENERAL not relevant during coding

    case TASK_TYPES.ENTERTAINMENT:
      return category !== NOTIF_CATEGORIES.MARKETING;

    case TASK_TYPES.GENERAL:
    default:
      return true;
  }
}