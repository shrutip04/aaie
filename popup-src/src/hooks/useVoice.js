import { useState, useRef, useCallback } from 'react';

export async function refineWithAI(rawText, context = '') {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Convert this voice message into a clean, natural reply. Keep it short (1-2 sentences max). Fix grammar. Sound friendly.${context ? `\n\nContext: ${context}` : ''}\n\nVoice input: "${rawText}"\n\nReturn ONLY the reply text, nothing else.`
        }]
      })
    });
    const data = await response.json();
    return data.content?.[0]?.text?.trim() || rawText;
  } catch (e) {
    return rawText;
  }
}

export function parseIntent(transcript) {
  const t = transcript.toLowerCase().trim();
  if (/mark.*(read|done)|read it/.test(t)) return { action: 'MARK_READ' };
  if (/archiv/.test(t)) return { action: 'ARCHIVE' };
  if (/dismiss|ignore|skip/.test(t)) return { action: 'DISMISS' };
  if (/flush|release queue/.test(t)) return { action: 'FLUSH_QUEUE' };
  if (/queue|waiting|missed/.test(t)) return { action: 'SHOW_QUEUE' };
  if (/^(ok|okay|yes|sure|got it|fine)\.?$/.test(t)) return { action: 'REPLY_OKAY', text: 'Okay!' };
  if (/^no\.?$/.test(t)) return { action: 'REPLY_NO', text: 'No, sorry.' };
  const replyMatch = t.match(/^(reply|respond|send|tell them|say)\s+(.+)/);
  if (replyMatch) return { action: 'REPLY_CUSTOM', text: replyMatch[2] };
  if (t.length > 3) return { action: 'REPLY_CUSTOM', text: transcript };
  return { action: 'UNKNOWN', raw: transcript };
}

export function useVoice({ onIntent, mode = 'command', topNotif = null }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refinedText, setRefinedText] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) { setError('Speech not supported'); return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setRefinedText('');
      setError('');
    };

    recognition.onend = () => setIsListening(false);

    recognition.onerror = (e) => {
      setError(e.error === 'no-speech' ? 'No speech detected' : `Error: ${e.error}`);
      setIsListening(false);
      setTimeout(() => setError(''), 3000);
    };

    recognition.onresult = async (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }

      setTranscript(final || interim);

      if (!final) return;

      // In reply mode OR if intent is a reply → refine with AI
      const intent = parseIntent(final);
      const isReply = mode === 'reply' || intent.action === 'REPLY_CUSTOM';

      if (isReply) {
        setIsRefining(true);
        const context = topNotif
          ? `Replying to ${topNotif.sender?.match(/^([^<]+)/)?.[1]?.trim() || topNotif.sender}: "${topNotif.subject || topNotif.body}"`
          : '';
        const refined = await refineWithAI(final, context);
        setRefinedText(refined);
        setIsRefining(false);
        onIntent?.({ action: 'REPLY_CUSTOM', text: refined, raw: final });
      } else {
        onIntent?.(intent);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, mode, topNotif, onIntent]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, isRefining, refinedText, error, isSupported, startListening, stopListening };
}