import React, { useState, useMemo } from 'react';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

const SOURCE_META = {
  gmail:    { icon: '📩', label: 'Emails',    color: '#dc2626', bg: '#fef2f2' },
  discord:  { icon: '💬', label: 'Messages',  color: '#6366f1', bg: '#eef2ff' },
  whatsapp: { icon: '💚', label: 'Messages',  color: '#16a34a', bg: '#f0fdf4' },
  telegram: { icon: '✈️', label: 'Messages',  color: '#0088cc', bg: '#eff6ff' },
};

function buildSummary(notifications, queue, blocked) {
  const all = [...notifications, ...queue, ...blocked];
  if (all.length === 0) return null;

  // Group by source
  const bySource = {};
  all.forEach(n => {
    if (!bySource[n.source]) bySource[n.source] = { urgent: [], normal: [], blocked: [] };
    if (blocked.find(b => b.id === n.id)) bySource[n.source].blocked.push(n);
    else if (n.priority === 'HIGH') bySource[n.source].urgent.push(n);
    else bySource[n.source].normal.push(n);
  });

  // Top urgent across all sources
  const topUrgent = all
    .filter(n => n.priority === 'HIGH' && notifications.find(x => x.id === n.id))
    .slice(0, 3);

  // Stats
  const totalUrgent = all.filter(n => n.priority === 'HIGH').length;
  const totalQueued = queue.length;
  const totalBlocked = blocked.length;
  const totalAllowed = notifications.length;

  return { bySource, topUrgent, totalUrgent, totalQueued, totalBlocked, totalAllowed };
}

export default function Summary({ notifications = [], queue = [], blocked = [], userState, onAction }) {
  const [expanded, setExpanded] = useState(null);
  const summary = useMemo(() => buildSummary(notifications, queue, blocked), [notifications, queue, blocked]);

  if (!summary) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1917' }}>All clear</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No notifications to summarize</div>
      </div>
    );
  }

  const { bySource, topUrgent, totalUrgent, totalQueued, totalBlocked, totalAllowed } = summary;
  const total = totalAllowed + totalQueued + totalBlocked;

  return (
    <div style={{ padding: '12px 14px' }}>

      {/* Main summary banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 12, color: '#fff',
      }}>
        <div style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 6 }}>
          WHILE YOU WERE {userState?.toUpperCase() || 'FOCUSED'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          {total} notification{total !== 1 ? 's' : ''} managed
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {totalAllowed > 0 && (
            <span style={{ fontSize: 12, background: '#059669', borderRadius: 6, padding: '3px 9px', fontWeight: 600 }}>
              ✓ {totalAllowed} shown
            </span>
          )}
          {totalQueued > 0 && (
            <span style={{ fontSize: 12, background: '#d97706', borderRadius: 6, padding: '3px 9px', fontWeight: 600 }}>
              ⏸ {totalQueued} queued
            </span>
          )}
          {totalBlocked > 0 && (
            <span style={{ fontSize: 12, background: '#dc2626', borderRadius: 6, padding: '3px 9px', fontWeight: 600 }}>
              🛡 {totalBlocked} blocked
            </span>
          )}
        </div>
      </div>

      {/* Urgent callouts */}
      {topUrgent.length > 0 && (
        <div style={{
          background: '#fff7ed', border: '1.5px solid #fed7aa',
          borderRadius: 10, padding: '11px 13px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c2410c', marginBottom: 8, letterSpacing: '0.3px' }}>
            🚨 NEEDS ATTENTION ({totalUrgent} urgent)
          </div>
          {topUrgent.map(n => {
            const sender = n.sender?.match(/^([^<]+)/)?.[1]?.trim() || n.sender || 'Unknown';
            return (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 0', borderBottom: '1px solid #fed7aa',
              }}>
                <span style={{ fontSize: 14 }}>{SOURCE_META[n.source]?.icon || '🔔'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1917' }}>{sender}</div>
                  <div style={{ fontSize: 11, color: '#6b6a65', lineHeight: 1.4 }}>{n.subject || n.body}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{timeAgo(n.timestamp)}</div>
                </div>
                <button
                  onClick={() => onAction?.({ type: 'DISMISS_NOTIFICATION', id: n.id })}
                  style={{
                    fontSize: 10, padding: '3px 8px', border: '1px solid #fed7aa',
                    borderRadius: 5, background: '#fff', color: '#c2410c',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}
                >
                  Dismiss
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-source breakdown */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b6a65', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          By Source
        </div>
        {Object.entries(bySource).map(([source, groups]) => {
          const meta = SOURCE_META[source] || { icon: '🔔', label: 'Other', color: '#6366f1', bg: '#eef2ff' };
          const total = groups.urgent.length + groups.normal.length + groups.blocked.length;
          const isExpanded = expanded === source;

          return (
            <div key={source} style={{
              background: '#fff', borderRadius: 10, border: '1px solid #e8e6e1',
              marginBottom: 7, overflow: 'hidden',
            }}>
              <div
                onClick={() => setExpanded(isExpanded ? null : source)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 13px', cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: meta.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>
                  {meta.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1917' }}>
                    {meta.label} · {source.charAt(0).toUpperCase() + source.slice(1)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {groups.urgent.length > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>{groups.urgent.length} urgent · </span>}
                    {groups.normal.length} normal · {groups.blocked.length} blocked
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span style={{
                    fontSize: 18, fontWeight: 700, color: meta.color,
                    fontFamily: 'DM Mono, monospace',
                  }}>{total}</span>
                  <span style={{ fontSize: 11, color: '#c4c2be' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded message list */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f0ede8' }}>
                  {[...groups.urgent, ...groups.normal].slice(0, 5).map(n => {
                    const sender = n.sender?.match(/^([^<]+)/)?.[1]?.trim() || n.sender || 'Unknown';
                    return (
                      <div key={n.id} style={{
                        padding: '8px 13px', borderBottom: '1px solid #f8f7f5',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        {n.priority === 'HIGH' && (
                          <span style={{ fontSize: 9, background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                            URGENT
                          </span>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1917' }}>{sender}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{(n.subject || n.body || '').slice(0, 60)}</div>
                        </div>
                        <div style={{ fontSize: 10, color: '#c4c2be' }}>{timeAgo(n.timestamp)}</div>
                      </div>
                    );
                  })}
                  {groups.blocked.length > 0 && (
                    <div style={{ padding: '7px 13px', background: '#fafafa' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        🛡 {groups.blocked.length} blocked by focus mode
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI summary text */}
      <div style={{
        background: '#f5f3ff', borderRadius: 10, border: '1px solid #c4b5fd',
        padding: '11px 13px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 6 }}>
          🧠 AI Summary
        </div>
        <div style={{ fontSize: 12, color: '#4c1d95', lineHeight: 1.6 }}>
          {generateNaturalSummary(summary, userState)}
        </div>
      </div>

    </div>
  );
}

function generateNaturalSummary(summary, userState) {
  const { totalUrgent, totalQueued, totalBlocked, totalAllowed, bySource } = summary;
  const sources = Object.keys(bySource);
  const sourceStr = sources.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');

  let msg = '';
  if (totalUrgent > 0) {
    msg += `You have ${totalUrgent} urgent message${totalUrgent > 1 ? 's' : ''} that need attention. `;
  }
  if (totalQueued > 0) {
    msg += `${totalQueued} notification${totalQueued > 1 ? 's were' : ' was'} held back to protect your focus. `;
  }
  if (totalBlocked > 0) {
    msg += `${totalBlocked} low-priority item${totalBlocked > 1 ? 's were' : ' was'} automatically blocked. `;
  }
  if (!msg) {
    msg = `Everything is under control. ${totalAllowed} notification${totalAllowed !== 1 ? 's' : ''} came in from ${sourceStr}.`;
  }
  return msg.trim();
}