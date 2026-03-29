import React from 'react';

const STATE_CONFIG = {
  'Deep Focus': { color: '#6366f1', bg: '#eef2ff', icon: '🎯', desc: 'Protecting your concentration' },
  'Light Focus': { color: '#f59e0b', bg: '#fffbeb', icon: '⚡', desc: 'Selective interruptions only' },
  'Casual':      { color: '#10b981', bg: '#f0fdf4', icon: '🌿', desc: 'All notifications allowed' },
  'Idle':        { color: '#6b7280', bg: '#f9fafb', icon: '😴', desc: 'Flushing queued messages' },
};

const CONTEXT_MODE_CONFIG = {
  'Coding':    { icon: '💻', color: '#6366f1' },
  'Meeting':   { icon: '🎥', color: '#ef4444' },
  'Deep Work': { icon: '📝', color: '#8b5cf6' },
  'Casual':    { icon: '🌿', color: '#10b981' },
  'Idle':      { icon: '😴', color: '#6b7280' },
  'Browsing':  { icon: '🌐', color: '#f59e0b' },
};

export default function Header({ userState, interruptibilityScore, interactionLevel, onGmailAuth }) {
  const config = STATE_CONFIG[userState] || STATE_CONFIG['Casual'];
  const contextMode = interactionLevel?.contextMode;
  const modeConfig = CONTEXT_MODE_CONFIG[contextMode] || CONTEXT_MODE_CONFIG['Browsing'];

  return (
    <div style={{ background: config.bg, borderBottom: '1px solid #e8e6e1' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: config.color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16,
          }}>
            🧠
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1917', letterSpacing: '-0.2px' }}>AAIE</div>
            <div style={{ fontSize: 11, color: '#6b6a65' }}>Attention Engine</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {contextMode && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 9px',
              borderRadius: 6, background: `${modeConfig.color}15`,
              color: modeConfig.color, border: `1px solid ${modeConfig.color}33`,
            }}>
              {modeConfig.icon} {contextMode}
            </span>
          )}
          <button
            onClick={onGmailAuth}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid #e8e6e1', background: '#fff',
              color: '#6b6a65', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Connect Gmail
          </button>
        </div>
      </div>

      {/* State card */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: '#fff', borderRadius: 10, padding: '10px 14px',
          border: `1.5px solid ${config.color}22`,
          boxShadow: `0 1px 4px ${config.color}15`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 18 }}>{config.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: config.color }}>{userState}</div>
                <div style={{ fontSize: 11, color: '#6b6a65' }}>{config.desc}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: config.color, fontFamily: 'DM Mono, monospace' }}>
                {interruptibilityScore}
              </div>
              <div style={{ fontSize: 10, color: '#6b6a65' }}>interrupt score</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: '#f0efe9', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: config.color,
              width: `${interruptibilityScore}%`,
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>

          {/* Bottom row */}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#6b6a65' }}>Interaction:</span>
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: interactionLevel?.canAct ? '#059669' : interactionLevel?.canView ? '#d97706' : '#dc2626',
              }}>
                {interactionLevel?.label || 'Full actions'}
              </span>
            </div>
            {contextMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Context:</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: modeConfig.color }}>
                  {modeConfig.icon} {contextMode}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}