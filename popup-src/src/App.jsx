import React, { useState, useCallback } from 'react';
import Header from './components/Header.jsx';
import NotificationFeed from './components/NotificationFeed.jsx';
import QueueSection from './components/QueueSection.jsx';
import VoiceUI from './components/VoiceUI.jsx';
import Insights from './components/Insights.jsx';
import Summary from './components/Summary.jsx';
import { useExtensionState } from './hooks/useExtensionState.js';

const TABS = [
  { id: 'feed', label: '📨 Feed' },
  { id: 'summary', label: '🗂 Summary' },
  { id: 'voice', label: '🎤 Voice' },
  { id: 'insights', label: '📊 Insights' },
];

const isExtension = typeof chrome !== 'undefined' && chrome?.runtime?.id;

const DEMO_NOTIFICATIONS = [
  {
    id: () => `demo-gmail-${Date.now()}`,
    source: 'gmail', sender: 'Sarah Chen <sarah@acme.com>',
    subject: 'URGENT: Server down — need you NOW',
    body: 'URGENT: Server down — need you NOW',
    label: '🚨 Urgent Gmail', messageId: 'demo-msg-1',
  },
  {
    id: () => `demo-discord-${Date.now()}`,
    source: 'discord', sender: 'DevTeam #backend',
    subject: 'PR #247 needs review before deploy',
    body: 'PR #247 needs review before deploy',
    label: '💬 Discord PR', webhookUrl: '',
  },
  {
    id: () => `demo-wa-${Date.now()}`,
    source: 'whatsapp', sender: 'Mom',
    subject: 'Are you coming home for dinner?',
    body: 'Are you coming home for dinner?',
    label: '💚 WhatsApp',
  },
  {
    id: () => `demo-news-${Date.now()}`,
    source: 'gmail', sender: 'newsletter@producthunt.com',
    subject: 'Top 10 products this week 🚀',
    body: 'Top 10 products this week',
    label: '📰 Newsletter (low)', messageId: 'demo-msg-news',
  },
];

export default function App() {
  const { state, loading, sendAction } = useExtensionState();
  const [activeTab, setActiveTab] = useState('feed');
  const [toast, setToast] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const fireDemoNotification = useCallback(async (template) => {
    const notification = { ...template, id: template.id(), timestamp: Date.now() };
    delete notification.label;
    if (isExtension) {
      await sendAction({ type: 'INJECT_DEMO', notification });
    }
    showToast(`Fired: ${template.label}`);
    setDemoOpen(false);
  }, [sendAction]);

  const dismissNudge = useCallback(async () => {
    await sendAction({ type: 'DISMISS_NUDGE' });
  }, [sendAction]);

  const handleAction = useCallback(async (action) => {
    switch (action.type) {
      case 'GMAIL_MARK_READ':
        await sendAction({ type: 'GMAIL_MARK_READ', messageId: action.messageId });
        await sendAction({ type: 'DISMISS_NOTIFICATION', id: action.id });
        showToast('Marked as read ✓');
        break;
      case 'GMAIL_ARCHIVE':
        await sendAction({ type: 'GMAIL_ARCHIVE', messageId: action.messageId });
        await sendAction({ type: 'DISMISS_NOTIFICATION', id: action.id });
        showToast('Archived ✓');
        break;
      case 'REPLY': {
        const n = action.notification;
        if (n.source === 'discord' && n.webhookUrl) {
          await sendAction({ type: 'DISCORD_SEND', webhookUrl: n.webhookUrl, content: action.text });
          showToast('Replied on Discord ✓');
        } else if (n.source === 'whatsapp') {
          await sendAction({ type: 'WHATSAPP_REPLY', text: action.text });
          showToast('Replied on WhatsApp ✓');
        } else if (n.source === 'telegram' && n.chatId) {
          await sendAction({ type: 'TELEGRAM_SEND', chatId: n.chatId, text: action.text });
          showToast('Replied on Telegram ✓');
        } else {
          showToast('Reply sent ✓');
        }
        break;
      }
      case 'DISMISS_NOTIFICATION':
        await sendAction({ type: 'DISMISS_NOTIFICATION', id: action.id });
        showToast('Dismissed', 'neutral');
        break;
    }
  }, [sendAction]);

  const handleVoiceIntent = useCallback(async (intent) => {
    const top = state.notifications[0];
    switch (intent.action) {
      case 'MARK_READ':
        if (top?.source === 'gmail') handleAction({ type: 'GMAIL_MARK_READ', id: top.id, messageId: top.messageId, notification: top });
        break;
      case 'ARCHIVE':
        if (top?.source === 'gmail') handleAction({ type: 'GMAIL_ARCHIVE', id: top.id, messageId: top.messageId, notification: top });
        break;
      case 'REPLY_OKAY': case 'REPLY_YES': case 'REPLY_NO': case 'REPLY_LATER': case 'REPLY_CUSTOM':
        if (top) handleAction({ type: 'REPLY', id: top.id, notification: top, text: intent.text });
        break;
      case 'DISMISS':
        if (top) handleAction({ type: 'DISMISS_NOTIFICATION', id: top.id, notification: top });
        break;
      case 'SHOW_QUEUE':
        setActiveTab('feed');
        showToast(`${state.queue.length} queued`, 'neutral');
        break;
      case 'FLUSH_QUEUE':
        await sendAction({ type: 'FLUSH_QUEUE' });
        showToast('Queue released ✓');
        break;
      case 'UNKNOWN':
        showToast(`Didn't catch that`, 'error');
        break;
    }
  }, [state, handleAction, sendAction]);

  const handleGmailAuth = useCallback(async () => {
    if (!isExtension) { showToast('Extension only', 'neutral'); return; }
    const res = await sendAction({ type: 'GMAIL_AUTH' });
    if (res?.token) showToast('Gmail connected ✓');
    else showToast('Gmail auth failed', 'error');
  }, [sendAction]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 28 }}>🧠</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading AAIE...</div>
      </div>
    );
  }

  return (
    <div style={{ width: 400, minHeight: 560, background: '#f8f7f5', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, system-ui, sans-serif', position: 'relative' }}>

      <Header
        userState={state.userState}
        interruptibilityScore={state.interruptibilityScore}
        interactionLevel={state.interactionLevel}
        onGmailAuth={handleGmailAuth}
      />

      {/* ── Motivation Nudge Banner ───────────────────────────────────────── */}
      {state.motivationNudge && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderBottom: '1px solid #5a67d8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
              {state.motivationNudge}
            </span>
          </div>
          <button
            onClick={dismissNudge}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: 11,
              padding: '3px 8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ✕ Got it
          </button>
        </div>
      )}
      {/* ─────────────────────────────────────────────────────────────────── */}

      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e8e6e1', padding: '0 16px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            fontSize: 12, fontWeight: 500, padding: '9px 12px',
            border: 'none', background: 'none',
            color: activeTab === tab.id ? '#6366f1' : '#6b6a65',
            borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
          }}>
            {tab.label}
          </button>
        ))}
        <button onClick={() => setDemoOpen(v => !v)} style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 600,
          padding: '5px 10px', border: '1px solid #6366f1',
          borderRadius: 6, background: demoOpen ? '#6366f1' : '#eef2ff',
          color: demoOpen ? '#fff' : '#6366f1',
          cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center',
        }}>
          ⚡ Demo
        </button>
        {state.queue.length > 0 && (
          <div style={{ alignSelf: 'center', marginLeft: 6, background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
            {state.queue.length}
          </div>
        )}
      </div>

      {demoOpen && (
        <div style={{ background: '#1e1b4b', padding: '12px 16px', borderBottom: '2px solid #6366f1' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', marginBottom: 8, letterSpacing: '0.5px' }}>
            🎯 FIRE DEMO NOTIFICATION
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {DEMO_NOTIFICATIONS.map((n, i) => (
              <button key={i} onClick={() => fireDemoNotification(n)} style={{
                textAlign: 'left', fontSize: 12, padding: '7px 10px',
                background: '#2e2a5e', border: '1px solid #4338ca',
                borderRadius: 7, color: '#c7d2fe', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 500,
              }}>
                {n.label} — <span style={{ color: '#818cf8', fontWeight: 400 }}>{n.subject}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#6366f1', marginTop: 8 }}>
            Decision based on current state: <strong style={{ color: '#a5b4fc' }}>{state.userState}</strong>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
        {activeTab === 'feed' && (
          <>
            <QueueSection queue={state.queue} onFlush={() => sendAction({ type: 'FLUSH_QUEUE' })} />
            <NotificationFeed
              notifications={state.notifications}
              canAct={state.interactionLevel?.canAct ?? true}
              onAction={handleAction}
            />
          </>
        )}
        {activeTab === 'summary' && (
          <Summary
            notifications={state.notifications}
            queue={state.queue}
            blocked={state.blocked}
            userState={state.userState}
            onAction={handleAction}
          />
        )}
        {activeTab === 'voice' && (
          <VoiceUI
            onIntent={handleVoiceIntent}
            notifications={state.notifications}
          />
        )}
        {activeTab === 'insights' && (
          <Insights insights={state.insights} userState={state.userState} />
        )}
      </div>

      {toast && (
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'neutral' ? '#6b6a65' : '#059669',
          color: '#fff', fontSize: 12, fontWeight: 500,
          padding: '7px 16px', borderRadius: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap', zIndex: 100, animation: 'slideIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}