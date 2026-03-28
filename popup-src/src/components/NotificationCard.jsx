import React, { useState } from 'react';

const SOURCE_STYLES = {
  gmail:    { icon: '📧', label: 'Gmail',    bg: '#fef2f2', color: '#dc2626' },
  discord:  { icon: '💬', label: 'Discord',  bg: '#eef2ff', color: '#6366f1' },
  whatsapp: { icon: '💚', label: 'WhatsApp', bg: '#f0fdf4', color: '#16a34a' },
};

const PRIORITY_STYLES = {
  HIGH:   { label: 'High',   bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  MEDIUM: { label: 'Med',    bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
  LOW:    { label: 'Low',    bg: '#f8f7f5', color: '#9ca3af', border: '#e5e7eb' },
};

const QUICK_REPLIES = ['On it!', 'Got it', 'Give me 5 mins', "I'll check", 'Later today'];

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default function NotificationCard({ notification: n, canAct, canView, onAction }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const src   = SOURCE_STYLES[n.source]   || SOURCE_STYLES.gmail;
  const pri   = PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.LOW;

  const senderName = n.sender?.match(/^([^<]+)/)?.[1]?.trim() || n.sender || 'Unknown';
  const preview    = n.subject || n.body || '';

  // Relevance badge
  const relevanceColor = { HIGH: '#059669', MEDIUM: '#d97706', LOW: '#9ca3af' }[n.relevance] || '#9ca3af';

  function act(type, extra = {}) {
    onAction?.({ type, id: n.id, notification: n, ...extra });
  }

  function sendReply(text) {
    act('REPLY', { text });
    setReplyText('');
    setReplyOpen(false);
  }

  // ── Deep focus: hide entirely ──
  if (canView === false) return null;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e8e6e1',
      overflow: 'hidden',
      marginBottom: 8,
      transition: 'box-shadow 0.15s',
    }}>
      {/* ── Header row ── */}
      <div
        style={{ padding: '11px 13px 8px', cursor: 'pointer' }}
        onClick={() => setCollapsed(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {/* Source badge */}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
            background: src.bg, color: src.color, letterSpacing: '0.3px',
          }}>
            {src.icon} {src.label}
          </span>

          {/* Priority badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
            background: pri.bg, color: pri.color,
            border: `1px solid ${pri.border}`,
          }}>
            {pri.label}
          </span>

          {/* Relevance dot */}
          <span style={{
            fontSize: 10, color: relevanceColor, fontWeight: 600,
          }}>
            ● {n.relevance} relevance
          </span>

          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{timeAgo(n.timestamp)}</span>
          <span style={{ fontSize: 11, color: '#c4c2be', marginLeft: 4 }}>{collapsed ? '▲' : '▼'}</span>
        </div>

        {/* Sender */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1917', marginBottom: 3 }}>
          {senderName}
        </div>

        {/* Preview */}
        {!collapsed && (
          <div style={{
            fontSize: 12, color: '#6b6a65', lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {preview}
          </div>
        )}

        {/* Decision reason */}
        {!collapsed && (
          <div style={{
            marginTop: 6, fontSize: 11, color: '#a8a5a0',
            fontStyle: 'italic',
          }}>
            {n.reason}
          </div>
        )}

        {/* Task context match (if any) */}
        {!collapsed && n.matchedKeywords?.length > 0 && (
          <div style={{
            marginTop: 4, fontSize: 10, color: '#059669', fontWeight: 600,
          }}>
            Task match: {n.matchedKeywords.join(', ')}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      {!collapsed && (
        <>
          {/* View-only banner */}
          {canView && !canAct && (
            <div style={{
              padding: '6px 13px', background: '#fffbeb',
              borderTop: '1px solid #fcd34d',
              fontSize: 11, color: '#d97706', fontWeight: 500,
            }}>
              ⚡ Light focus — view only. Actions unlock when you take a break.
            </div>
          )}

          {/* Full actions */}
          {canAct && (
            <>
              {/* Quick replies for discord/whatsapp */}
              {(n.source === 'discord' || n.source === 'whatsapp') && !replyOpen && (
                <div style={{
                  display: 'flex', gap: 4, flexWrap: 'wrap',
                  padding: '0 13px 8px',
                }}>
                  {QUICK_REPLIES.map(r => (
                    <button
                      key={r}
                      onClick={() => sendReply(r)}
                      style={{
                        fontSize: 11, padding: '3px 9px',
                        border: '1px solid #e8e6e1', borderRadius: 20,
                        background: '#f8f7f5', color: '#6b6a65',
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.1s',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom reply input */}
              {replyOpen && (
                <div style={{ padding: '0 13px 10px', display: 'flex', gap: 6 }}>
                  <input
                    autoFocus
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendReply(replyText)}
                    placeholder="Type reply..."
                    style={{
                      flex: 1, fontSize: 12, padding: '6px 10px',
                      border: '1px solid #6366f140', borderRadius: 8,
                      fontFamily: 'inherit', outline: 'none',
                      background: '#f8f7f5',
                    }}
                  />
                  <button
                    onClick={() => sendReply(replyText)}
                    style={{
                      fontSize: 12, padding: '6px 12px',
                      background: '#6366f1', color: '#fff',
                      border: 'none', borderRadius: 8,
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                    }}
                  >
                    Send
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div style={{
                display: 'flex', gap: 5, padding: '0 13px 11px',
                borderTop: '1px solid #f0ede8', paddingTop: 8,
              }}>
                {n.source === 'gmail' && (
                  <>
                    <Btn label="✓ Read" onClick={() => act('GMAIL_MARK_READ', { messageId: n.messageId })} color="#059669" />
                    <Btn label="Archive" onClick={() => act('GMAIL_ARCHIVE', { messageId: n.messageId })} color="#d97706" />
                  </>
                )}
                {(n.source === 'discord' || n.source === 'whatsapp') && (
                  <Btn
                    label={replyOpen ? 'Cancel' : '↩ Reply'}
                    onClick={() => setReplyOpen(v => !v)}
                    color="#6366f1"
                  />
                )}
                <Btn label="Dismiss" onClick={() => act('DISMISS_NOTIFICATION')} color="#9ca3af" />
              </div>
            </>
          )}

          {/* Dismiss always available even in view-only */}
          {canView && !canAct && (
            <div style={{ padding: '0 13px 11px' }}>
              <Btn label="Dismiss" onClick={() => act('DISMISS_NOTIFICATION')} color="#9ca3af" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Btn({ label, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 600, padding: '5px 11px',
        border: `1px solid ${color}50`, borderRadius: 7,
        background: `${color}12`, color,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}