(function () {
  'use strict';

  // ── Inject Notification interceptor into page world ───────────────────────
  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('whatsappInjector.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  // ── Listen for intercepted WA notifications ───────────────────────────────
  window.addEventListener('AAIE_WA_NOTIFICATION', (e) => {
    const { title, body, tag } = e.detail;
    if (!title && !body) return;
    chrome.runtime.sendMessage({
      type: 'NEW_NOTIFICATION',
      payload: {
        id: `wa-notif-${tag || Date.now()}`,
        source: 'whatsapp',
        sender: title || 'WhatsApp',
        body: body || '',
        subject: body || '',
        timestamp: Date.now(),
      },
    }).catch(() => {});
  });

  // ── MutationObserver backup (catches messages even without WA notifications)
  let seenIds = new Set();

  function getCurrentChatName() {
    return (
      document.querySelector('header [data-testid="conversation-info-header-chat-title"] span')?.innerText ||
      document.querySelector('header ._amie span')?.innerText ||
      'WhatsApp'
    );
  }

  function scanMessages() {
    const rows = document.querySelectorAll('[data-id]');
    rows.forEach((row) => {
      const msgId = row.getAttribute('data-id');
      if (!msgId || seenIds.has(msgId)) return;
      if (msgId.startsWith('true_')) return; // skip outgoing

      const textEl =
        row.querySelector('.selectable-text span') ||
        row.querySelector('span[dir="ltr"]') ||
        row.querySelector('span[dir="auto"]');
      const text = textEl?.innerText?.trim();
      if (!text) return;

      seenIds.add(msgId);

      const sender =
        row.querySelector('._akbu')?.innerText?.trim() ||
        getCurrentChatName();

      chrome.runtime.sendMessage({
        type: 'NEW_NOTIFICATION',
        payload: {
          id: `wa-${msgId}`,
          source: 'whatsapp',
          sender: sender,
          body: text,
          subject: text,
          timestamp: Date.now(),
        },
      }).catch(() => {});
    });
  }

  function startObserver() {
    const target = document.querySelector('#main') || document.body;
    const observer = new MutationObserver(() => scanMessages());
    observer.observe(target, { childList: true, subtree: true });
    scanMessages(); // initial scan
    console.log('AAIE: WhatsApp observer active');
  }

  // ── Reply injection ───────────────────────────────────────────────────────
  function injectAndSend(text) {
    const input =
      document.querySelector('[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('div[contenteditable="true"].copyable-text') ||
      document.querySelector('[data-testid="conversation-compose-box-input"]');

    if (!input) return false;

    input.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));

    setTimeout(() => {
      const sendBtn =
        document.querySelector('[data-testid="send"]') ||
        document.querySelector('button[aria-label="Send"]') ||
        document.querySelector('span[data-icon="send"]')?.closest('button');
      if (sendBtn) sendBtn.click();
      else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    }, 300);

    return true;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'INJECT_MESSAGE') sendResponse({ ok: injectAndSend(msg.text) });
    if (msg.type === 'PING') sendResponse({ ok: true });
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  function waitForApp() {
    const ready = document.querySelector('#app') || document.querySelector('#main');
    if (ready) {
      injectScript();
      setTimeout(startObserver, 2000);
    } else {
      setTimeout(waitForApp, 1000);
    }
  }

  waitForApp();

})();