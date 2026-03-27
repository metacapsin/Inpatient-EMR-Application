import { useState, useCallback, useRef, useEffect } from 'react';
import triageService from '../services/triageService';
import type { TriageCompletionData } from '../services/api';

const SEND_DEBOUNCE_MS = 400;
const SESSION_STORAGE_KEY = 'triageSessionId';

export interface TriageMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  fullResponse?: TriageCompletionData;
}

export interface UseTriageReturn {
  messages: TriageMessage[];
  isLoading: boolean;
  error: string | null;
  currentRiskLevel: string | null;
  sessionId: string | null;
  sendMessage: (userMessage: string, resetConversation?: boolean, forceComplete?: boolean) => Promise<{
    userMessage: TriageMessage;
    aiMessage: TriageMessage;
    data: TriageCompletionData;
    metadata: { sessionId?: string; conversationLength?: number; isNewSession?: boolean; model?: string; timestamp?: string };
  } | null>;
  resetConversation: () => void;
  clear: () => void;
}

export function useTriage(patientId: string | null): UseTriageReturn {
  const [messages, setMessages] = useState<TriageMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRiskLevel, setCurrentRiskLevel] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSendTimeRef = useRef<number>(0);

  useEffect(() => {
    if (patientId) {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      triageService.setPatientContext(patientId, stored || undefined);
      if (stored) setSessionId(stored);
    } else {
      triageService.clearPatientContext();
    }
  }, [patientId]);

  useEffect(() => {
    if (sessionId) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      } catch {
        /* ignore */
      }
    } else {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (userMessage: string, resetConversation = false, forceComplete = false): Promise<{
      userMessage: TriageMessage;
      aiMessage: TriageMessage;
      data: TriageCompletionData;
      metadata: { sessionId?: string; conversationLength?: number; isNewSession?: boolean; model?: string; timestamp?: string };
    } | null> => {
      if (!userMessage?.trim()) return null;
      const now = Date.now();
      if (now - lastSendTimeRef.current < SEND_DEBOUNCE_MS && !resetConversation && !forceComplete) return null;
      lastSendTimeRef.current = now;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      const newUserMessage: TriageMessage = {
        id: Date.now(),
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newUserMessage]);

      try {
        const result = await triageService.sendTriageMessage(
          userMessage,
          resetConversation,
          abortControllerRef.current?.signal,
          forceComplete
        );

        if (result.error === 'Request cancelled.') return null;

        if (result.success && result.data && result.metadata) {
          setSessionId(result.metadata.sessionId ?? null);
          setCurrentRiskLevel(result.data.riskLevel ?? null);

          const displayContent =
            result.data.followUpQuestion ?? result.data.guidance ?? 'Assessment updated.';

          const aiMessage: TriageMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: displayContent,
            fullResponse: result.data,
            timestamp: result.metadata.timestamp ?? new Date().toISOString(),
          };
          setMessages((prev) => [...prev, aiMessage]);

          return {
            userMessage: newUserMessage,
            aiMessage,
            data: result.data,
            metadata: result.metadata,
          };
        }

        setError(result.error ?? 'Request failed');
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    setCurrentRiskLevel(null);
    setSessionId(null);
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    triageService.resetConversation();
  }, []);

  const clear = useCallback(() => {
    resetConversation();
    triageService.clearPatientContext();
  }, [resetConversation]);

  return {
    messages,
    isLoading,
    error,
    currentRiskLevel,
    sessionId,
    sendMessage,
    resetConversation,
    clear,
  };
}
