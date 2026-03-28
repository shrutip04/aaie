// content.js - WhatsApp Web Content Script
// Uses MutationObserver to detect new messages without official API

(function () {
  'use strict';

  let lastMessageIds = new Set();
  let observer = null;

  // ─── Extract messages from WhatsApp Web DOM ──────────────────────────────

  function extractMessages() {
    // WhatsApp Web message selectors (updated for current WA Web structure)
    const messageRows = document.querySelectorAll('[data-id]');
    const newMessages = [];

    messageRows.forEach((row) => {
      const msgId = row.getAttribute('data-id');
      if (!msgId || lastMessageIds.has(msgId)) return;

      // Only incoming messages (not sent by us)
      if (msgId.startsWith('true_')) return;

      // Extract text
      const textEl = row.querySelector('.selectable-text span[dir="ltr"], .selectable-text span[dir="auto"]');
      const text = textEl?.innerText?.trim();
      if (!text) return;

      // Extract sender (from group chats or DMs)
      const senderEl = row.querySelector('._akbu span[aria-label]') ||
                       row.querySelector('span[data-pre-plain-text]') ||
                       row.closest('[data-id]')?.querySelector('._ao3e');
      const sender = senderEl?.getAttribute('aria-label') ||
                     senderEl?.getAttribute('data-pre-plain-text')?.match(/\] (.*?):/)?.[1] ||
                     getCurrentChatName();

      // Extract timestamp
      const timeEl = row.querySelector('._ak8q span, ._ao3e + span');
      const timestamp = timeEl?.getAttribute('data-pre-plain-text') || new Date().toISOString();

      newMessages.push({ msgId, sender, text, timestamp });
      lastMessageIds.add(msgId);
    });

    return newMessages;
  }

  function getCurrentChatName() {
    const header = document.querySelector('._amie span[title]') ||
                   document.querySelector('[data-testid="conversation-header"] span[title]');
    return header?.getAttribute('title') || 'WhatsApp';
  }

  // ─── Send new messages to background ────────────────────────────────────

  function sendToBackground(messages) {
    messages.forEach((msg) => {
      chrome.runtime.sendMessage({
        type: 'NEW_NOTIFICATION',
        payload: {
          id: `wa-${msg.msgId}`,
          source: 'whatsapp',
          sender: msg.sender,
          body: msg.text,
          subject: msg.text,
          timestamp: Date.now(),
          meta: { msgId: msg.msgId },
        },
      });
    });
  }

  // ─── MutationObserver ────────────────────────────────────────────────────

  function startObserver() {
    const target = document.querySelector('#main') || document.body;

    observer = new MutationObserver((mutations) => {
      let hasNewContent = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          hasNewContent = true;
          break;
        }
      }
      if (!hasNewContent) return;

      const newMessages = extractMessages();
      if (newMessages.length > 0) {
        sendToBackground(newMessages);
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
    });

    console.log('AAIE: WhatsApp observer active');
  }

  // ─── Inject message into WA input ───────────────────────────────────────

  function injectAndSend(text) {
    const inputBox = document.querySelector('[contenteditable="true"][data-tab="10"]') ||
                     document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                     document.querySelector('div[contenteditable="true"].copyable-text.selectable-text');

    if (!inputBox) {
      console.error('AAIE: WhatsApp input box not found');
      return false;
    }

    // Focus and set text
    inputBox.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);

    // Dispatch input event so React state updates
    inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));

    // Small delay then click send
    setTimeout(() => {
      const sendBtn = document.querySelector('[data-testid="send"]') ||
                      document.querySelector('button[aria-label="Send"]') ||
                      document.querySelector('span[data-icon="send"]')?.closest('button');

      if (sendBtn) {
        sendBtn.click();
      } else {
        // Fallback: press Enter
        inputBox.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
        }));
      }
    }, 300);

    return true;
  }

  // ─── Listen for commands from background ─────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'INJECT_MESSAGE') {
      const ok = injectAndSend(msg.text);
      sendResponse({ ok });
    }
    if (msg.type === 'PING') {
      sendResponse({ ok: true, url: location.href });
    }
  });

  // ─── Init ────────────────────────────────────────────────────────────────

  // Wait for WhatsApp Web to finish loading
  function waitForApp() {
    const ready = document.querySelector('#app') || document.querySelector('#main');
    if (ready) {
      setTimeout(startObserver, 2000);
    } else {
      setTimeout(waitForApp, 1000);
    }
  }

  waitForApp();
})();
