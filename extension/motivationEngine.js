// motivationEngine.js

let _lastMessageTime = 0;
// const COOLDOWN_MS = 5 * 60 * 1000; // production
const COOLDOWN_MS = 30 * 1000; // demo — 30 seconds

const IDLE_MESSAGES = [
  "You've been inactive for a while — want to get back to something?",
  "Still there? A small task might get the momentum going.",
  "Looks like you've drifted — ready to refocus?",
];

const MEETING_MESSAGES = [
  "Long session detected — stay hydrated 💧",
  "Quick stretch can help 🧘",
  "Been in there a while — breathe and stay sharp.",
];

const CASUAL_MESSAGES = [
  "Enjoying your break! Ready to switch back soon? 😊",
  "Nice downtime — your focused work is waiting whenever you are.",
  "Break's been good — feeling recharged yet?",
];

function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _cooledDown() {
  return Date.now() - _lastMessageTime >= COOLDOWN_MS;
}

function _isMeeting(url = '') {
  return ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'whereby.com', 'webex.com']
    .some(u => url.includes(u));
}

function _isCasual(url = '') {
  return ['youtube.com', 'netflix.com', 'twitch.tv', 'instagram.com',
    'tiktok.com', 'reddit.com', 'facebook.com', 'twitter.com', 'x.com']
    .some(u => url.includes(u));
}

export function getMotivationMessage(signals) {
  const {
    idleTime    = 0,
    timeOnTask  = 0,
    typingSpeed = 0,
    url         = '',
  } = signals;

  if (!_cooledDown()) return null;

  let message = null;

  if (idleTime > 10) {
    message = _pick(IDLE_MESSAGES);
  } else if (_isMeeting(url) && timeOnTask > 60 && typingSpeed < 3) {
    // demo: 60 seconds | production: 45 * 60
    message = _pick(MEETING_MESSAGES);
  } else if (_isCasual(url) && timeOnTask > 60) {
    // demo: 60 seconds | production: 20 * 60
    message = _pick(CASUAL_MESSAGES);
  }

  if (message) _lastMessageTime = Date.now();
  return message;
}