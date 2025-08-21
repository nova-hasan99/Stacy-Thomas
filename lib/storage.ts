import Cookies from 'js-cookie';

export interface StoredMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string; // stored as ISO string
}

export interface StoredSession {
  sessionId: string;
  messages: StoredMessage[];
  lastActivity: string;
}

const COOKIE_KEY = 'chatbot_session_id';
const EXPIRY_DAYS = 30;

// Generate localStorage key based on session ID
const getStorageKey = (sessionId: string) => `chatbot_session_${sessionId}`;

// Get or create session ID from cookie
export function getOrCreateSessionId(): string {
  let sessionId = Cookies.get(COOKIE_KEY);
  
  if (!sessionId) {
    // Generate new session ID if none exists
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    Cookies.set(COOKIE_KEY, sessionId, {
      expires: EXPIRY_DAYS,
      sameSite: 'strict',
    });
  }
  
  return sessionId;
}

// Save sessionId to cookie and messages to localStorage
export function saveSession(
  sessionId: string,
  messages: StoredMessage[]
): void {
  const session: StoredSession = {
    sessionId,
    messages,
    lastActivity: new Date().toISOString(),
  };

  // Save sessionId to cookie
  Cookies.set(COOKIE_KEY, sessionId, {
    expires: EXPIRY_DAYS,
    sameSite: 'strict',
  });

  // Save messages to localStorage with session-specific key
  const storageKey = getStorageKey(sessionId);
  localStorage.setItem(storageKey, JSON.stringify(session));
}

// Load session from localStorage based on session ID from cookie
export function loadSession(sessionId?: string): StoredSession | null {
  try {
    const currentSessionId = sessionId || Cookies.get(COOKIE_KEY);
    if (!currentSessionId) return null;
    
    const storageKey = getStorageKey(currentSessionId);
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const session: StoredSession = JSON.parse(stored);

    // Validate expiration
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const daysDiff =
      (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > EXPIRY_DAYS) {
      clearSession(currentSessionId);
      return null;
    }

    return {
      sessionId: currentSessionId,
      messages: session.messages,
      lastActivity: session.lastActivity,
    };
  } catch (error) {
    console.error('Error loading session:', error);
    if (sessionId) {
      clearSession(sessionId);
    }
    return null;
  }
}

// Remove session data for specific session ID
export function clearSession(sessionId?: string): void {
  const currentSessionId = sessionId || Cookies.get(COOKIE_KEY);
  
  if (currentSessionId) {
    const storageKey = getStorageKey(currentSessionId);
    localStorage.removeItem(storageKey);
  }
  
  // Only remove cookie if clearing current session
  if (!sessionId) {
    Cookies.remove(COOKIE_KEY);
  }
}

// Get all stored sessions for debugging/management
export function getAllStoredSessions(): StoredSession[] {
  const sessions: StoredSession[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('chatbot_session_')) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const session = JSON.parse(stored);
          sessions.push(session);
        }
      } catch (error) {
        console.error('Error parsing stored session:', error);
      }
    }
  }
  
  return sessions.sort((a, b) => 
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}
