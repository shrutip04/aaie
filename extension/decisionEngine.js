// decisionEngine.js - Pure logic, no dependencies
import { detectTaskFromUrl, isRelevantToTask } from './taskRelevance.js';

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

// ─── Smoothing State ──────────────────────────────────────────────────────────

let _smoothedScore = 50;
let _pendingState = null;
let _pendingCount = 0;

export function resetSmoothing(towardScore) {
  _smoothedScore = Math.round(_smoothedScore * 0.3 + towardScore * 0.7);
  _pendingState = null;
  _pendingCount = 0;
}

export function applyHysteresis(rawScore, currentState) {
  _smoothedScore = Math.round(_smoothedScore * 0.1 + rawScore * 0.9);

  const newState = rawScoreToState(_smoothedScore);

  if (newState === currentState) {
    _pendingState = null;
    _pendingCount = 0;
    return { score: _smoothedScore, state: currentState };
  }

  const movingToMoreFocus =
    newState === USER_STATES.DEEP_FOCUS ||
    (newState === USER_STATES.LIGHT_FOCUS && currentState === USER_STATES.CASUAL);

  const threshold = movingToMoreFocus ? 1 : 1;

  if (_pendingState === newState) {
    _pendingCount++;
  } else {
    _pendingState = newState;
    _pendingCount = 1;
  }

  if (_pendingCount >= threshold) {
    _pendingState = null;
    _pendingCount = 0;
    return { score: _smoothedScore, state: newState };
  }

  return { score: _smoothedScore, state: currentState };
}

function rawScoreToState(score) {
  if (score <= 45) return USER_STATES.DEEP_FOCUS;
  if (score <= 68) return USER_STATES.LIGHT_FOCUS;
  if (score <= 88) return USER_STATES.CASUAL;
  return USER_STATES.IDLE;
}

export function scoreToUserState(score) {
  if (score <= 45) return USER_STATES.DEEP_FOCUS;
  if (score <= 68) return USER_STATES.LIGHT_FOCUS;
  if (score <= 88) return USER_STATES.CASUAL;
  return USER_STATES.IDLE;
}

// ─── URL Classification ───────────────────────────────────────────────────────

const DEEP_FOCUS_URLS = [
  'github.com', 'gitlab.com', 'bitbucket.org',
  'vscode.dev', 'codesandbox.io', 'replit.com',
  'codepen.io', 'jsfiddle.net', 'stackblitz.com',
  'programiz.com', 'onlinegdb.com', 'ideone.com',
  'onecompiler.com', 'hackerrank.com', 'leetcode.com',
  'codeforces.com', 'geeksforgeeks.org', 'codechef.com',
  'topcoder.com', 'interviewbit.com', 'w3schools.com',
  'docs.google.com', 'notion.so', 'figma.com',
  'overleaf.com', 'confluence.atlassian.com',
  'linear.app', 'trello.com', 'jira.atlassian.com',
  'stackoverflow.com', 'developer.mozilla.org',
  'coursera.org', 'udemy.com',
];

const CASUAL_URLS = [
  'youtube.com', 'twitter.com', 'x.com', 'reddit.com',
  'instagram.com', 'netflix.com', 'twitch.tv',
  'facebook.com', 'tiktok.com',
];

const COMM_URLS = [
  'mail.google.com', 'slack.com', 'discord.com',
  'teams.microsoft.com', 'web.whatsapp.com', 'telegram.org',
];

const MEETING_URLS = [
  'zoom.us', 'meet.google.com', 'teams.microsoft.com',
  'whereby.com', 'webex.com', 'around.co',
];

function classifyUrl(url) {
  if (!url || url.startsWith('chrome://')) return 'neutral';
  if (MEETING_URLS.some(u => url.includes(u))) return 'meeting';
  if (DEEP_FOCUS_URLS.some(u => url.includes(u))) return 'deepfocus';
  if (COMM_URLS.some(u => url.includes(u))) return 'comms';
  if (CASUAL_URLS.some(u => url.includes(u))) return 'casual';
  return 'neutral';
}

// ─── Interruptibility Score ───────────────────────────────────────────────────

export function computeInterruptibilityScore(signals) {
  const {
    idleState,
    tabUrl,
    tabSwitchRate = 0,
    timeSinceLastSwitch = 0,
    typingSpeed = 0,
    mouseActivity = 0,
    mouseIdleMs = 0,
  } = signals;

  if (idleState === 'locked') return 100;
  if (idleState === 'idle') return 95;

  const urlType = classifyUrl(tabUrl);

  if (urlType === 'meeting') return 8;

  let score;
  switch (urlType) {
    case 'deepfocus': score = 20; break;
    case 'comms':     score = 60; break;
    case 'casual':    score = 78; break;
    default:          score = 52; break;
  }

  if (typingSpeed > 20) {
    score = Math.min(score, 12);
  } else if (typingSpeed > 12) {
    score = Math.min(score, 25);
  } else if (typingSpeed > 5) {
    score = Math.min(score, 45);
  } else if (typingSpeed > 0) {
    score = Math.min(score, 58);
  } else {
    if (urlType === 'deepfocus') {
      score = Math.min(score + 12, 48);
    } else if (urlType === 'casual') {
      score = Math.min(score + 15, 95);
    } else {
      score = Math.min(score + 10, 80);
    }
  }

  if (mouseIdleMs > 180000) {
    if (urlType === 'deepfocus') {
      score = Math.min(score + 5, 50);
    } else {
      score = Math.min(score + 22, 100);
    }
  } else if (mouseIdleMs > 60000) {
    if (urlType !== 'deepfocus') {
      score = Math.min(score + 10, 88);
    }
  }

  if (mouseActivity > 150 && urlType !== 'deepfocus') {
    score = Math.min(score + 8, 88);
  }

  if (tabSwitchRate > 10) {
    score = Math.min(score + 30, 100);
  } else if (tabSwitchRate > 6) {
    score = Math.min(score + 15, 90);
  } else if (tabSwitchRate > 3) {
    score = Math.min(score + 6, 78);
  }

  if (timeSinceLastSwitch > 15 * 60 * 1000) {
    score = Math.max(score - 22, 5);
  } else if (timeSinceLastSwitch > 8 * 60 * 1000) {
    score = Math.max(score - 14, 8);
  } else if (timeSinceLastSwitch > 3 * 60 * 1000) {
    score = Math.max(score - 7, 10);
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Task Context ─────────────────────────────────────────────────────────────

const TASK_KEYWORDS = {
  coding: ['bug', 'deploy', 'repo', 'pr', 'pull request', 'commit', 'error',
    'build', 'ci', 'pipeline', 'crash', 'fix', 'server', 'down', 'issue'],
  study:  ['assignment', 'deadline', 'exam', 'quiz', 'submit', 'grade', 'lecture', 'homework'],
  work:   ['meeting', 'standup', 'review', 'client', 'invoice', 'deadline', 'report', 'presentation'],
  comms:  ['reply', 'message', 'dm', 'mention', 'tagged'],
};

function detectTaskContext(tabUrl = '') {
  const urlType = classifyUrl(tabUrl);
  if (urlType === 'deepfocus') return 'coding';
  if (urlType === 'meeting') return 'work';
  if (urlType === 'comms') return 'comms';
  return 'general';
}

// ─── Notification Classification ──────────────────────────────────────────────

export function classifyNotification(notification, tabUrl = '') {
  const text = `${notification.subject || ''} ${notification.body || ''} ${notification.sender || ''}`.toLowerCase();
  const taskContext = detectTaskContext(tabUrl);
  const contextKeywords = TASK_KEYWORDS[taskContext] || [];

  let priority = PRIORITY.LOW;
  const highKeywords = ['urgent', 'asap', 'emergency', 'critical', 'deadline', 'important',
    'action required', 'meeting', 'call', 'server', 'down', 'error', 'crash'];
  const medKeywords = ['follow up', 'reply', 'response', 'update', 'reminder', 'fyi', 'question', 'tomorrow'];

  if (highKeywords.some(k => text.includes(k))) priority = PRIORITY.HIGH;
  else if (medKeywords.some(k => text.includes(k))) priority = PRIORITY.MEDIUM;
  if (notification.senderImportant) priority = PRIORITY.HIGH;

  let intent = INTENT.MESSAGE;
  if (text.includes('task') || text.includes('todo') || text.includes('deadline')) intent = INTENT.TASK;
  else if (text.includes('call') || text.includes('meet') || text.includes('zoom')) intent = INTENT.CALL;
  else if (text.includes('fyi') || text.includes('newsletter') || text.includes('update')) intent = INTENT.INFO;

  const matchedKeywords = contextKeywords.filter(k => text.includes(k));
  let relevance = 'LOW';
  if (matchedKeywords.length >= 2 || priority === PRIORITY.HIGH) relevance = 'HIGH';
  else if (matchedKeywords.length === 1 || priority === PRIORITY.MEDIUM) relevance = 'MEDIUM';

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

// ─── Decision Engine ──────────────────────────────────────────────────────────

export function makeDecision(notification, context) {
  const { userState, interruptibilityScore, typingSpeed = 0, tabUrl = '' } = context;
  const { priority, relevance } = notification;

  // ── Task-Relevance Gate ──────────────────────────────────────────────────
  const taskType     = detectTaskFromUrl(tabUrl);
  const taskRelevant = isRelevantToTask(notification, taskType);

  if (!taskRelevant && userState !== USER_STATES.IDLE && userState !== USER_STATES.CASUAL) {
    return { ...notification, decision: DECISIONS.BLOCK, reason: 'Blocked — not relevant to your current task' };
  }
  // ─────────────────────────────────────────────────────────────────────────

  let decision = DECISIONS.ALLOW;
  let reason = '';

  const extremeWork = typingSpeed > 20 && interruptibilityScore < 20;

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
    } else if (priority === PRIORITY.HIGH && extremeWork) {
      decision = DECISIONS.DELAY;
      reason = 'Queued — extreme focus, urgent held briefly';
    } else if (priority === PRIORITY.MEDIUM) {
      decision = DECISIONS.DELAY;
      reason = 'Queued — protecting deep focus';
    } else if (taskRelevant && taskType === 'CODING') {
      decision = DECISIONS.ALLOW;
      reason = 'Allowed — directly relevant to your coding task';
    } else {
      decision = DECISIONS.BLOCK;
      reason = 'Blocked — low priority during deep work';
    }

  } else if (userState === USER_STATES.LIGHT_FOCUS) {
    if (priority === PRIORITY.HIGH) {
      decision = DECISIONS.ALLOW;
      reason = 'High priority — allowed during light focus';
    } else if (priority === PRIORITY.MEDIUM && relevance !== 'LOW') {
      decision = DECISIONS.ALLOW;
      reason = 'Relevant — allowed during light focus';
    } else if (priority === PRIORITY.MEDIUM) {
      decision = DECISIONS.DELAY;
      reason = 'Queued — low relevance during light focus';
    } else if (taskRelevant && taskType === 'CODING') {
      decision = DECISIONS.ALLOW;
      reason = 'Allowed — directly relevant to your coding task';
    } else {
      decision = DECISIONS.DELAY;
      reason = 'Queued — low priority during light focus';
    }

  } else {
    // Casual — allow everything, no queuing
    decision = DECISIONS.ALLOW;
    reason = 'Casual browsing — allowed';
  }

  return { ...notification, decision, reason, decidedAt: Date.now() };
}

// ─── Interaction Level ────────────────────────────────────────────────────────

export function getInteractionLevel(userState) {
  const levels = {
    [USER_STATES.DEEP_FOCUS]:  { canView: false, canAct: false, label: 'No interactions' },
    [USER_STATES.LIGHT_FOCUS]: { canView: true,  canAct: false, label: 'View only' },
    [USER_STATES.CASUAL]:      { canView: true,  canAct: true,  label: 'Full actions' },
    [USER_STATES.IDLE]:        { canView: true,  canAct: true,  label: 'Full actions' },
  };
  return levels[userState] || levels[USER_STATES.CASUAL];
}