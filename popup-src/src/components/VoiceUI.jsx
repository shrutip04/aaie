import React, { useState, useCallback } from 'react';
import { useVoice } from '../hooks/useVoice.js';

const QUICK_COMMANDS = [
  { label: 'Mark read', icon: '✓', intent: { action: 'MARK_READ' } },
  { label: 'Archive', icon: '📦', intent: { action: 'ARCHIVE' } },
  { label: 'Reply OK', icon: '👍', intent: { action: 'REPLY_OKAY', text: 'Okay!' } },
  { label: 'Dismiss', icon: '✕', intent: { action: 'DISMISS' } },
  { label: 'Show queue', icon: '⏸', intent: { action: 'SHOW_QUEUE' } },
];

export default function VoiceUI({ onIntent }) {
  const [lastAction, setLastAction] = useState(null);

  const handleIntent = useCallback((intent) => {
    setLastAction(intent);
    onIntent?.(intent);
    setTimeout(() => setLastAction(null), 3000);
  }, [onIntent]);

  const { isListening, transcript, error, isSupported, startListening, stopListening } = useVoice({
    onIntent: handleIntent,
  });

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e8e6e1',
        borderRadius: 10,
        padding: '12px 13px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b6a65', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Voice control
          </span>
          {isListening && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#6366f1',
              background: '#eef2ff', padding: '2px 8px', borderRadius: 5,
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              Listening…
            </span>
          )}
        </div>

        {/* Mic button + transcript */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={!isSupported}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: 'none', cursor: isSupported ? 'pointer' : 'not-allowed',
              background: isListening ? '#ef4444' : '#6366f1',
              color: '#fff', fontSize: 20,
              transition: 'all 0.2s',
              flexShrink: 0,
              boxShadow: isListening ? '0 0 0 8px #ef444420' : '0 2px 8px #6366f130',
            }}
          >
            🎤
          </button>
          <div style={{ flex: 1 }}>
            {!isSupported && (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Speech API not supported</div>
            )}
            {isSupported && !isListening && !transcript && !lastAction && (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Tap mic to speak a command</div>
            )}
            {isListening && (
              <div style={{ fontSize: 13, color: '#6366f1', fontStyle: 'italic' }}>
                {transcript || 'Listening…'}
              </div>
            )}
            {lastAction && !isListening && (
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Heard:</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#059669' }}>
                  ✓ {lastAction.action.replace(/_/g, ' ')}
                  {lastAction.text ? ` — "${lastAction.text}"` : ''}
                </div>
              </div>
            )}
            {error && (
              <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>
            )}
          </div>
        </div>

        {/* Quick commands */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {QUICK_COMMANDS.map(cmd => (
            <button
              key={cmd.label}
              onClick={() => handleIntent(cmd.intent)}
              style={{
                fontSize: 11, padding: '4px 9px',
                border: '1px solid #e8e6e1', borderRadius: 6,
                background: '#f8f7f5', color: '#6b6a65',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              <span>{cmd.icon}</span> {cmd.label}
            </button>
          ))}
        </div>

        {/* Command help */}
        <div style={{ marginTop: 9, padding: '7px 9px', background: '#f8f7f5', borderRadius: 7 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>TRY SAYING</div>
          {[
            '"Mark email as read"',
            '"Reply I\'ll get back to you later"',
            '"What did I miss?"',
            '"Ignore this"',
          ].map(cmd => (
            <div key={cmd} style={{ fontSize: 11, color: '#6b6a65', fontFamily: 'DM Mono, monospace', marginBottom: 2 }}>
              {cmd}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
