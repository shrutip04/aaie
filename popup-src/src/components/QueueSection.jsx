import React, { useState } from 'react';

export default function QueueSection({ queue, onFlush }) {
  const [expanded, setExpanded] = useState(false);

  if (queue.length === 0) return null;

  const SOURCE_ICONS = { gmail: '📧', discord: '💬', whatsapp: '💚' };

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 10,
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div
          onClick={() => setExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 13px', cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>⏸</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                {queue.length} queued notification{queue.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 11, color: '#b45309' }}>Held to protect your focus</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onFlush?.(); }}
              style={{
                fontSize: 11, fontWeight: 500, padding: '4px 10px',
                border: '1px solid #f59e0b60', borderRadius: 6,
                background: '#f59e0b15', color: '#b45309',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Release all
            </button>
            <span style={{ fontSize: 12, color: '#b45309' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Expanded list */}
        {expanded && (
          <div style={{ borderTop: '1px solid #fde68a' }}>
            {queue.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 13px', borderBottom: '1px solid #fde68a22'
              }}>
                <span style={{ fontSize: 14 }}>{SOURCE_ICONS[n.source] || '📨'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#92400e', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {n.sender?.match(/^([^<]+)/)?.[1]?.trim() || n.sender}
                  </div>
                  <div style={{ fontSize: 11, color: '#b45309', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {n.subject || n.body}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: '#d97706', whiteSpace: 'nowrap' }}>
                  {n.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
