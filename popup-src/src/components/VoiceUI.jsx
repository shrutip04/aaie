import React, { useState, useCallback, useRef } from 'react';

const QUICK_COMMANDS = [
  { label: 'Mark read', icon: '✓', intent: { action: 'MARK_READ' } },
  { label: 'Archive', icon: '📦', intent: { action: 'ARCHIVE' } },
  { label: 'Reply OK', icon: '👍', intent: { action: 'REPLY_OKAY', text: 'Okay!' } },
  { label: 'Dismiss', icon: '✕', intent: { action: 'DISMISS' } },
  { label: 'Show queue', icon: '⏸', intent: { action: 'SHOW_QUEUE' } },
  { label: 'Flush queue', icon: '📬', intent: { action: 'FLUSH_QUEUE' } },
];

const COMMAND_HINTS = ['"Mark email as read"', '"Flush the queue"', '"Dismiss this"', '"Archive it"'];
const REPLY_HINTS = ['"Tell mom I\'ll call later"', '"I\'m in a meeting"', '"On my way"', '"Can we reschedule?"'];

function parseIntent(text) {
  const t = text.toLowerCase().trim();
  if (/mark.*(read|done)|read it/.test(t)) return { action: 'MARK_READ', text };
  if (/archiv/.test(t)) return { action: 'ARCHIVE', text };
  if (/dismiss|ignore|skip|not now/.test(t)) return { action: 'DISMISS', text };
  if (/flush|release|show.*(queue|all)/.test(t)) return { action: 'FLUSH_QUEUE', text };
  if (/queue|waiting|missed/.test(t)) return { action: 'SHOW_QUEUE', text };
  if (/^(ok|okay|yes|sure|got it|fine|sounds good)\.?$/.test(t)) return { action: 'REPLY_OKAY', text: 'Okay!' };
  if (/^no\.?$/.test(t)) return { action: 'REPLY_NO', text: 'No, sorry.' };
  if (/reply|respond|send|tell|say/.test(t)) {
    const replyText = t.replace(/^(reply|respond|send|tell them|say)\s*/i, '').trim();
    return { action: 'REPLY_CUSTOM', text: replyText || text };
  }
  if (t.length > 3) return { action: 'REPLY_CUSTOM', text };
  return { action: 'UNKNOWN', text };
}

// ── AI reply refinement ───────────────────────────────────────────────────────
// Replace YOUR_ANTHROPIC_API_KEY_HERE with your key from console.anthropic.com
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';

async function refineReply(rawText, context = '') {
  return rawText;
}

export default function VoiceUI({ onIntent, notifications = [] }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [refinedText, setRefinedText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('command');
  const recognitionRef = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const topNotif = notifications[0] || null;
  const topSender = topNotif?.sender?.match(/^([^<]+)/)?.[1]?.trim() || topNotif?.sender || null;

  const handleIntent = useCallback((intent) => {
    setLastAction(intent);
    onIntent?.(intent);
    setTimeout(() => setLastAction(null), 4000);
  }, [onIntent]);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    setError('');
    setTranscript('');
    setRefinedText('');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      setError(e.error === 'no-speech' ? 'No speech detected — try again' : `Error: ${e.error}`);
      setIsListening(false);
      setTimeout(() => setError(''), 3000);
    };

    recognition.onresult = async (e) => {
      const results = Array.from(e.results);
      const interim = results.map(r => r[0].transcript).join('');
      setTranscript(interim);

      if (e.results[e.results.length - 1].isFinal) {
        const final = e.results[e.results.length - 1][0].transcript.trim();
        setTranscript(final);

        if (mode === 'reply') {
          // Always refine in reply mode
          setIsRefining(true);
          const context = topNotif
            ? `Replying to ${topSender} on ${topNotif.source}: "${topNotif.subject || topNotif.body}"`
            : '';
          const refined = await refineReply(final, context);
          setRefinedText(refined);
          setIsRefining(false);
          handleIntent({ action: 'REPLY_CUSTOM', text: refined, raw: final });
        } else {
          const intent = parseIntent(final);
          if (intent.action === 'REPLY_CUSTOM') {
            // Refine freeform replies even in command mode
            setIsRefining(true);
            const context = topNotif
              ? `Replying to ${topSender} on ${topNotif.source}: "${topNotif.subject || topNotif.body}"`
              : '';
            const refined = await refineReply(final, context);
            setRefinedText(refined);
            setIsRefining(false);
            handleIntent({ ...intent, text: refined, raw: final });
          } else {
            handleIntent(intent);
          }
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, mode, topNotif, topSender, handleIntent]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const hints = mode === 'command' ? COMMAND_HINTS : REPLY_HINTS;

  return (
    <div style={{ padding: '0 14px 14px' }}>

      {/* Mode switcher */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 10,
        background: '#fff', borderRadius: 8, padding: 4,
        border: '1px solid #e8e6e1',
      }}>
        {['command', 'reply'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, fontSize: 12, fontWeight: 600, padding: '6px 0',
            borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: mode === m ? '#6366f1' : 'transparent',
            color: mode === m ? '#fff' : '#6b6a65',
            transition: 'all 0.15s',
          }}>
            {m === 'command' ? '⌨️ Commands' : '↩ Reply Mode'}
          </button>
        ))}
      </div>

      {/* Reply target card */}
      {mode === 'reply' && topNotif && (
        <div style={{
          background: '#f5f3ff', border: '1px solid #c4b5fd',
          borderRadius: 8, padding: '8px 11px', marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Replying to:</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{topSender}</div>
          <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>
            "{(topNotif.subject || topNotif.body || '').slice(0, 60)}"
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
            via {topNotif.source}
          </div>
        </div>
      )}

      {mode === 'reply' && !topNotif && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 8, padding: '8px 11px', marginBottom: 10,
          fontSize: 12, color: '#92400e',
        }}>
          No notification selected — go to Feed and let a message arrive
        </div>
      )}

      {/* Mic UI */}
      <div style={{
        background: '#fff', border: '1px solid #e8e6e1',
        borderRadius: 12, padding: 14, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: transcript && refinedText ? 10 : 0 }}>
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={!isSupported}
            style={{
              width: 54, height: 54, borderRadius: '50%',
              border: 'none', cursor: isSupported ? 'pointer' : 'not-allowed',
              background: isListening ? '#ef4444' : '#6366f1',
              color: '#fff', fontSize: 24, flexShrink: 0,
              transition: 'all 0.2s',
              boxShadow: isListening
                ? '0 0 0 10px #ef444422, 0 0 0 20px #ef444410'
                : '0 2px 12px #6366f140',
            }}
          >
            🎤
          </button>

          <div style={{ flex: 1 }}>
            {!isSupported && (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Speech not supported — use Chrome</div>
            )}

            {isSupported && !isListening && !transcript && !lastAction && !isRefining && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1917', marginBottom: 2 }}>
                  {mode === 'reply' ? 'Speak your reply' : 'Speak a command'}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Tap mic to start</div>
              </div>
            )}

            {isListening && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                    display: 'inline-block', animation: 'pulse 1s ease infinite',
                  }} />
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>Listening…</span>
                </div>
                {transcript && (
                  <div style={{ fontSize: 13, color: '#1a1917', fontStyle: 'italic' }}>
                    "{transcript}"
                  </div>
                )}
              </div>
            )}

            {isRefining && (
              <div style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}>
                🧠 Refining with AI…
              </div>
            )}

            {refinedText && !isListening && !isRefining && (
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>
                  ✓ Sending via {topNotif?.source || 'app'}:
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                  "{refinedText}"
                </div>
              </div>
            )}

            {lastAction && !isListening && !isRefining && !refinedText && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                ✓ {lastAction.action.replace(/_/g, ' ')}
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>
            )}
          </div>
        </div>

        {/* Before/after comparison */}
        {transcript && refinedText && transcript.toLowerCase().trim() !== refinedText.toLowerCase().trim() && (
          <div style={{
            background: '#f8f7f5', borderRadius: 8, padding: '8px 10px', fontSize: 11,
            borderTop: '1px solid #e8e6e1', marginTop: 10,
          }}>
            <div style={{ color: '#b0aead', marginBottom: 3 }}>🎤 You said: "{transcript}"</div>
            <div style={{ color: '#059669', fontWeight: 600 }}>🧠 AI sent: "{refinedText}"</div>
          </div>
        )}
      </div>

      {/* Quick commands */}
      {mode === 'command' && (
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #e8e6e1',
          padding: '11px 13px', marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', marginBottom: 8 }}>
            QUICK COMMANDS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {QUICK_COMMANDS.map(cmd => (
              <button key={cmd.label} onClick={() => handleIntent(cmd.intent)} style={{
                fontSize: 11, padding: '5px 10px',
                border: '1px solid #e8e6e1', borderRadius: 7,
                background: '#f8f7f5', color: '#6b6a65',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span>{cmd.icon}</span> {cmd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick replies */}
      {mode === 'reply' && (
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #e8e6e1',
          padding: '11px 13px', marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', marginBottom: 8 }}>
            QUICK REPLIES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {["On it!", "Give me 5 mins", "I'll check", "Later today", "Sounds good!", "Not now", "On my way!", "Can we reschedule?"].map(r => (
              <button key={r} onClick={() => handleIntent({ action: 'REPLY_CUSTOM', text: r })} style={{
                fontSize: 11, padding: '5px 10px',
                border: '1px solid #c4b5fd', borderRadius: 7,
                background: '#f5f3ff', color: '#6366f1',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hints */}
      <div style={{
        padding: '8px 10px', background: '#f8f7f5', borderRadius: 8, fontSize: 11, color: '#9ca3af',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>TRY SAYING</div>
        {hints.map(s => (
          <div key={s} style={{ fontFamily: 'monospace', marginBottom: 2 }}>{s}</div>
        ))}
      </div>

    </div>
  );
}