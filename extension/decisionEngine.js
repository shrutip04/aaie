// decisionEngine.js - Pure logic, no dependencies

export const USER_STATES = {
  DEEP_FOCUS: 'Deep Focus',
  LIGHT_FOCUS: 'Light Focus',
  CASUAL: 'Casual',
  IDLE: 'Idle',
};

export const DECISIONS = {
  ALLOW: 'allow',
  DELAY: 'delay',
  BLOCK: 'block',
};

export const PRIORITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const INTENT = {
  MESSAGE: 'MESSAGE',
  TASK: 'TASK',
  CALL: 'CALL',
  INFO: 'INFO',
};

// Task keyword map per context
const TASK_KEYWORDS = {
  coding: ['bug', 'deploy', 'repo', 'pr', 'pull request', 'commit', 'error',
    'build', 'ci', 'pipeline', 'crash', 'fix', 'server', 'down', 'issue'],
  study:  ['assignment', 'deadline', 'exam', 'quiz', 'submit', 'grade', 'lecture', 'homework'],
  work:   ['meeting', 'standup', 'review', 'client', 'invoice', 'deadline', 'report', 'presentation'],
  comms:  ['reply', 'message', 'dm', 'mention', 'tagged'],
};

function detectTaskContext(tabUrl = '') {
  if (['github', 'vscode', 'replit', 'codesandbox', 'leetcode', 'stackoverflow'].some(u => tabUrl.includes(u))) return 'coding';
  if (['notion', 'docs.google', 'overleaf', 'figma'].some(u => tabUrl.includes(u))) return 'work';
  if (['discord', 'slack', 'whatsapp', 'mail'].some(u => tabUrl.includes(u))) return 'comms';
  return 'general';
}

// Classify a raw notification into structured metadata
export function classifyNotification(notification, tabUrl = '') {
  const text = `${notification.subject || ''} ${notification.body || ''} ${notification.sender || ''}`.toLowerCase();
  const taskContext = detectTaskContext(tabUrl);
  const contextKeywords = TASK_KEYWORDS[taskContext] || [];

  // Priority heuristics
  let priority = PRIORITY.LOW;
  const highKeywords = ['urgent', 'asap', 'emergency', 'critical', 'deadline', 'important',
    'action required', 'meeting', 'call', 'server', 'down', 'error', 'crash'];
  const medKeywords = ['follow up', 'reply', 'response', 'update', 'reminder', 'fyi', 'question', 'tomorrow'];

  if (highKeywords.some(k => text.includes(k))) priority = PRIORITY.HIGH;
  else if (medKeywords.some(k => text.includes(k))) priority = PRIORITY.MEDIUM;
  if (notification.senderImportant) priority = PRIORITY.HIGH;

  // Intent classification
  let intent = INTENT.MESSAGE;
  if (text.includes('task') || text.includes('todo') || text.includes('deadline')) intent = INTENT.TASK;
  else if (text.includes('call') || text.includes('meet') || text.includes('zoom')) intent = INTENT.CALL;
  else if (text.includes('fyi') || text.includes('newsletter') || text.includes('update')) intent = INTENT.INFO;

  // Task relevance (Engine 3)
  const matchedKeywords = contextKeywords.filter(k => text.includes(k));
  let relevance = 'LOW';
  if (matchedKeywords.length >= 2 || priority === PRIORITY.HIGH) relevance = 'HIGH';
  else if (matchedKeywords.length === 1 || priority === PRIORITY.MEDIUM) relevance = 'MEDIUM';

  // Interruption cost (Engine 4)
  const interruptionCost = notification._typingSpeed
    ? Math.min(100, (notification._typingSpeed * 3) + (notification._sessionMinutes || 0) * 2)
    : 0;

  return {
    ...notification,
    priority,
    intent,
    relevance,
    taskContext,
    matchedKeywords,
    interruptionCost,
    classifiedAt: Date.now(),
  };
}

// Core decision engine
export function makeDecision(notification, context) {
  const { userState, interruptibilityScore, typingSpeed = 0 } = context;
  const { priority, relevance } = notification;

  let decision = DECISIONS.ALLOW;
  let reason = '';

  const extremeWork = typingSpeed > 25 && interruptibilityScore < 15;

  if (userState === USER_STATES.IDLE) {
    decision = DECISIONS.ALLOW;
    reason = 'User is idle — delivering all';
  } else if (userState === USER_STATES.DEEP_FOCUS) {
    if (priority === PRIORITY.HIGH && relevance === 'HIGH') {
      decision = DECISIONS.ALLOW;
      reason = 'Critical + task-relevant — interrupting deep focus';
    } else if (priority === PRIORITY.HIGH && !extremeWork) {
      decision = DECISIONS.ALLOW;
      reason = 'High priority — allowed during deep focus';
    } else if (priority === PRIORITY.MEDIUM) {
      decision = DECISIONS.DELAY;
      reason = 'Queued — protecting deep focus';
    } else {
      decision = DECISIONS.BLOCK;
      reason = 'Blocked — low priority during deep work';
    }
  } else if (userState === USER_STATES.LIGHT_FOCUS) {
    if (priority === PRIORITY.HIGH || relevance === 'HIGH') {
      decision = DECISIONS.ALLOW;
      reason = 'Allowed during light focus';
    } else if (priority === PRIORITY.MEDIUM && relevance !== 'LOW') {
      decision = DECISIONS.ALLOW;
      reason = 'Allowed during light focus';
    } else {
      decision = DECISIONS.DELAY;
      reason = 'Queued — low relevance during light focus';
    }
  } else {
    if (priority === PRIORITY.LOW && relevance === 'LOW') {
      decision = DECISIONS.DELAY;
      reason = 'Low relevance — queued';
    } else {
      decision = DECISIONS.ALLOW;
      reason = 'Casual browsing — allowed';
    }
  }

  return { ...notification, decision, reason, decidedAt: Date.now() };
}

// Determine interaction permissions based on user state
export function getInteractionLevel(userState) {
  const levels = {
    [USER_STATES.DEEP_FOCUS]: { canView: false, canAct: false, label: 'No interactions' },
    [USER_STATES.LIGHT_FOCUS]: { canView: true, canAct: false, label: 'View only' },
    [USER_STATES.CASUAL]: { canView: true, canAct: true, label: 'Full actions' },
    [USER_STATES.IDLE]: { canView: true, canAct: true, label: 'Full actions' },
  };
  return levels[userState] || levels[USER_STATES.CASUAL];
}

// Compute interruptibility score from all signals
export function computeInterruptibilityScore(signals) {
  const {
    idleState,
    tabUrl,
    tabSwitchRate,
    timeSinceLastSwitch,
    typingSpeed = 0,
    mouseActivity = 0,
    mouseIdleMs = 0,
  } = signals;

  if (idleState === 'idle' || idleState === 'locked') return 100;

  let score = 50;

  // URL-based base score
  const deepFocusUrls = ['docs.google', 'notion.so', 'github.com', 'figma.com',
    'vscode', 'codesandbox', 'replit', 'overleaf', 'leetcode', 'stackoverflow'];
  const casualUrls = ['youtube', 'twitter', 'reddit', 'instagram', 'netflix', 'news', 'twitch'];
  const commUrls = ['mail.google', 'slack.com', 'discord.com', 'teams.microsoft', 'web.whatsapp'];

  const url = tabUrl || '';
  if (deepFocusUrls.some(u => url.includes(u))) score = 20;
  else if (commUrls.some(u => url.includes(u))) score = 65;
  else if (casualUrls.some(u => url.includes(u))) score = 85;
  else score = 50;

  // Typing speed (most important signal)
  if (typingSpeed > 20)      score = Math.max(score - 25, 5);
  else if (typingSpeed > 10) score = Math.max(score - 15, 10);
  else if (typingSpeed > 3)  score = Math.max(score - 5, 15);
  else if (typingSpeed === 0) score = Math.min(score + 15, 95);

  // Mouse inactivity
  if (mouseIdleMs > 120000)     score = Math.min(score + 20, 100);
  else if (mouseIdleMs > 30000) score = Math.min(score + 10, 95);

  // High mouse activity = browsing
  if (mouseActivity > 100) score = Math.min(score + 10, 90);

  // Tab switching
  if (tabSwitchRate > 8)      score = Math.min(score + 20, 100);
  else if (tabSwitchRate > 4) score = Math.min(score + 10, 90);

  // Stability bonus
  if (timeSinceLastSwitch > 10 * 60 * 1000)     score = Math.max(score - 15, 5);
  else if (timeSinceLastSwitch > 5 * 60 * 1000) score = Math.max(score - 8, 10);

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function scoreToUserState(score) {
  if (score <= 25) return USER_STATES.DEEP_FOCUS;
  if (score <= 55) return USER_STATES.LIGHT_FOCUS;
  if (score <= 85) return USER_STATES.CASUAL;
  return USER_STATES.IDLE;
}