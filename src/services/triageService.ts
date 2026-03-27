import {
  triageAPI,
  type TriageCompletionData,
  type TriageCompletionResponse,
} from './api';

export interface TriageSendResult {
  success: boolean;
  data?: TriageCompletionData;
  metadata?: {
    sessionId?: string;
    conversationLength?: number;
    isNewSession?: boolean;
    model?: string;
    timestamp?: string;
  };
  error?: string;
  message?: string;
}

class TriageService {
  private currentSessionId: string | null = null;
  private currentPatientId: string | null = null;

  setPatientContext(patientId: string | null, sessionId?: string): void {
    this.currentPatientId = patientId;
    this.currentSessionId = sessionId ?? null;
  }

  async sendTriageMessage(
    userMessage: string,
    resetConversation = false,
    signal?: AbortSignal,
    forceComplete = false
  ): Promise<TriageSendResult> {
    try {
      const payload = {
        userContent: userMessage,
        patientId: this.currentPatientId,
        sessionId: this.currentSessionId,
        resetConversation,
        ...(forceComplete && { forceComplete: true }),
      };

      const response = await triageAPI.completion(payload, signal ? { signal } : undefined);
      const res = response.data as TriageCompletionResponse;

      if (res.sessionId) {
        this.currentSessionId = res.sessionId;
      }

      if (res.success && res.data) {
        return {
          success: true,
          data: res.data,
          metadata: {
            sessionId: res.sessionId,
            conversationLength: res.conversationLength,
            isNewSession: res.isNewSession,
            model: res.model,
            timestamp: res.timestamp,
          },
        };
      }

      return {
        success: false,
        error: res.error || 'Failed to process triage request',
        message: res.message,
      };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'AbortError' || name === 'CanceledError') {
        return { success: false, error: 'Request cancelled.', message: name };
      }
      const axiosError = err as { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string; code?: string };
      const status = axiosError.response?.status;
      const code = axiosError.code;
      const serverError = axiosError.response?.data?.error || axiosError.response?.data?.message;
      let userMessage: string;
      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        userMessage = 'The request took too long. Please try again.';
      } else if (status === 401) {
        userMessage = 'Session expired. Please sign in again.';
      } else if (status === 404) {
        userMessage = 'Assessment service is unavailable. Please try again later.';
      } else if (status && status >= 500) {
        userMessage = 'Unable to complete assessment. Please try again later.';
      } else if (serverError && typeof serverError === 'string') {
        userMessage = serverError;
      } else {
        userMessage = 'Unable to complete assessment. Please check your connection and try again.';
      }
      return {
        success: false,
        error: userMessage,
        message: axiosError.message,
      };
    }
  }

  resetConversation(): void {
    this.currentSessionId = null;
  }

  clearPatientContext(): void {
    this.currentPatientId = null;
    this.currentSessionId = null;
  }
}

export default new TriageService();
