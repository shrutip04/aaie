import React from 'react';

function StatBox({ label, value, sub, color = '#6366f1' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid #e8e6e1',
      padding: '12px 14px', flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1917', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CogLoadBar({ load = 0, label = 'LOW' }) {
  const color = load > 60 ? '#ef4444' : load > 30 ? '#f59e0b' : '#059669';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b6a65' }}>Cognitive load</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      </div>
      <div style={{ height: 6, background: '#f0ede8', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${load}%`,
          background: color, borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function Insights({ insights = {}, userState }) {
  const {
    distractionsAvoided = 0,
    totalBlocked = 0,
    totalDelayed = 0,
    cognitiveLoad = 0,
    cognitiveLoadLabel = 'LOW',
    nextSafeWindow = 'Monitoring...',
    focusStartTime = null,
  } = insights;

  const focusMins = focusStartTime
    ? Math.round((Date.now() - focusStartTime) / 60000)
    : 0;

  return (
    <div style={{ padding: '12px 14px' }}>

      {/* Stat row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <StatBox label="Blocked" value={totalBlocked} sub="low priority" color="#ef4444" />
        <StatBox label="Delayed" value={totalDelayed} sub="queued safely" color="#f59e0b" />
        <StatBox label="Focus time" value={focusMins > 0 ? `${focusMins}m` : '—'} sub="this session" color="#6366f1" />
      </div>

      {/* Cognitive load bar */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e8e6e1',
        padding: '12px 14px', marginBottom: 10,
      }}>
        <CogLoadBar load={cognitiveLoad} label={cognitiveLoadLabel} />

        {cognitiveLoad > 60 && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#dc2626',
          }}>
            🧠 High cognitive load detected. Consider a 5-min break.
          </div>
        )}
      </div>

      {/* Next safe window */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e8e6e1',
        padding: '12px 14px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>
          NEXT SAFE WINDOW
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
          {nextSafeWindow}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          Delayed notifications will release then
        </div>
      </div>

      {/* Focus shield */}
      <div style={{
        background: '#f5f3ff', borderRadius: 10, border: '1px solid #c4b5fd',
        padding: '12px 14px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 2 }}>
          🛡 Focus shield active
        </div>
        <div style={{ fontSize: 11, color: '#7c3aed' }}>
          {distractionsAvoided} distractions avoided this session
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          Current state: <strong>{userState}</strong>
        </div>
      </div>

    </div>
  );
}