import { useState, useEffect, useCallback } from 'react';

const DEFAULT_STATE = {
  userState: 'Casual',
  interruptibilityScore: 80,
  interactionLevel: { canView: true, canAct: true, label: 'Full actions' },
  notifications: [],
  queue: [],
  blocked: [],
  insights: {
    distractionsAvoided: 0,
    totalBlocked: 0,
    totalDelayed: 0,
    focusStartTime: null,
  },
};

// Check if we're inside a real Chrome extension
const isExtension = typeof chrome !== 'undefined' && chrome?.runtime?.id;

export function useExtensionState() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isExtension) {
      // Dev mode: use mock data
      setState(getMockState());
      setLoading(false);
      return;
    }

    // Load initial state from background
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response) setState({ ...DEFAULT_STATE, ...response });
      setLoading(false);
    });

    // Listen for storage changes (background writes → popup updates)
    const listener = (changes) => {
      if (changes.aaieState?.newValue) {
        setState(changes.aaieState.newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const sendAction = useCallback((action) => {
    if (!isExtension) {
      console.log('[Dev] Action:', action);
      // Simulate action effects for dev mode
      simulateAction(action, setState);
      return Promise.resolve({ ok: true });
    }
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(action, resolve);
    });
  }, []);

  return { state, loading, sendAction };
}

// ─── Dev mock state ───────────────────────────────────────────────────────────

function getMockState() {
  return {
    userState: 'Light Focus',
    interruptibilityScore: 55,
    interactionLevel: { canView: true, canAct: false, label: 'View only' },
    notifications: [
      {
        id: 'mock-1',
        source: 'gmail',
        sender: 'Sarah Chen <sarah@acme.com>',
        subject: 'URGENT: Deploy review needed before 3pm',
        body: 'URGENT: Deploy review needed before 3pm',
        priority: 'HIGH',
        intent: 'TASK',
        relevance: 'HIGH',
        decision: 'allow',
        reason: 'High priority during light focus — allowed',
        timestamp: Date.now() - 120000,
        messageId: 'mock-msg-1',
      },
      {
        id: 'mock-2',
        source: 'discord',
        sender: 'team-eng',
        subject: '#backend: PR review comments added',
        body: '#backend: PR review comments added',
        priority: 'MEDIUM',
        intent: 'MESSAGE',
        relevance: 'MEDIUM',
        decision: 'allow',
        reason: 'Allowed during light focus',
        timestamp: Date.now() - 300000,
        webhookUrl: '',
      },
      {
        id: 'mock-3',
        source: 'whatsapp',
        sender: 'Mom',
        subject: 'Are you coming for dinner tonight?',
        body: 'Are you coming for dinner tonight?',
        priority: 'LOW',
        intent: 'MESSAGE',
        relevance: 'MEDIUM',
        decision: 'allow',
        reason: 'Allowed during light focus',
        timestamp: Date.now() - 600000,
      },
    ],
    queue: [
      {
        id: 'mock-q1',
        source: 'gmail',
        sender: 'newsletter@producthunt.com',
        subject: 'Top products this week 🚀',
        body: 'Top products this week',
        priority: 'LOW',
        intent: 'INFO',
        relevance: 'LOW',
        decision: 'delay',
        reason: 'Low priority during deep focus — queued for later',
        timestamp: Date.now() - 900000,
      },
    ],
    blocked: [],
    insights: {
      distractionsAvoided: 7,
      totalBlocked: 12,
      totalDelayed: 5,
      focusStartTime: Date.now() - 45 * 60 * 1000,
    },
  };
}

function simulateAction(action, setState) {
  if (action.type === 'DISMISS_NOTIFICATION') {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== action.id),
    }));
  }
  if (action.type === 'FLUSH_QUEUE') {
    setState(prev => ({
      ...prev,
      notifications: [...prev.queue.map(n => ({ ...n, decision: 'allow' })), ...prev.notifications],
      queue: [],
    }));
  }
}
