// contentSignals.js - Sends typing + mouse signals to background service worker

let typingSpeed = 0;
let mouseActivity = 0;
let keyTimestamps = [];
let lastMouseMove = Date.now();
let mouseCount = 0;

// Track typing speed (keystrokes in last 10 seconds)
document.addEventListener('keydown', () => {
  const now = Date.now();
  keyTimestamps.push(now);
  keyTimestamps = keyTimestamps.filter(t => now - t < 10000);
  typingSpeed = keyTimestamps.length;
}, true);

// Track mouse movement bursts
document.addEventListener('mousemove', () => {
  mouseCount++;
  lastMouseMove = Date.now();
}, { passive: true });

// Send signals to background every 5 seconds
setInterval(() => {
  const mouseIdleMs = Date.now() - lastMouseMove;

  chrome.runtime.sendMessage({
    type: 'CONTENT_SIGNALS',
    payload: {
      typingSpeed,
      mouseActivity: mouseCount,
      mouseIdleMs,
    }
  }).catch(() => {});

  mouseCount = 0; // reset per interval
}, 5000);