import { useState, useRef, useCallback, useEffect } from 'react';

const COMMANDS = [
  { patterns: ['mark.*read', 'read.*email', 'mark read'], action: 'MARK_READ' },
  { patterns: ['archive', 'archive.*email'], action: 'ARCHIVE' },
  { patterns: ['reply.*okay', 'reply okay', 'send okay'], action: 'REPLY_OKAY', text: 'Okay!' },
  { patterns: ['reply.*later', "i'll do it later", 'do.*later'], action: 'REPLY_LATER', text: "I'll get back to you later." },
  { patterns: ['reply.*yes', 'reply yes'], action: 'REPLY_YES', text: 'Yes!' },
  { patterns: ['reply.*no', 'reply no'], action: 'REPLY_NO', text: 'No, sorry.' },
  { patterns: ['ignore', 'dismiss', 'block'], action: 'DISMISS' },
  { patterns: ['what.*miss', 'missed', 'queue', 'show queue'], action: 'SHOW_QUEUE' },
  { patterns: ['flush.*queue', 'release.*queue', 'show.*delayed'], action: 'FLUSH_QUEUE' },
  { patterns: ['stop.*listening', 'cancel', 'never mind'], action: 'STOP' },
];

function parseIntent(transcript) {
  const t = transcript.toLowerCase().trim();

  for (const cmd of COMMANDS) {
    for (const pattern of cmd.patterns) {
      if (new RegExp(pattern).test(t)) {
        return { action: cmd.action, text: cmd.text, raw: transcript };
      }
    }
  }

  // Check for freeform reply: "reply <message>"
  const replyMatch = t.match(/^reply\s+(.+)/);
  if (replyMatch) {
    return { action: 'REPLY_CUSTOM', text: replyMatch[1], raw: transcript };
  }

  return { action: 'UNKNOWN', raw: transcript };
}

export function useVoice({ onIntent }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }

      setTranscript(final || interim);

      if (final) {
        const intent = parseIntent(final);
        onIntent?.(intent);
        setTimeout(() => {
          setIsListening(false);
          setTranscript('');
        }, 800);
      }
    };

    recognition.onerror = (e) => {
      setError(e.error === 'no-speech' ? 'No speech detected' : `Error: ${e.error}`);
      setIsListening(false);
      setTimeout(() => setError(''), 3000);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported, onIntent]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    setError('');
    setTranscript('');
    setIsListening(true);
    recognitionRef.current.start();
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    parseIntent,
    COMMANDS,
  };
}
