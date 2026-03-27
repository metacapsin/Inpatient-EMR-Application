import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTriage } from '../../hooks/useTriage';
import { ChatMessage } from './ChatMessage';
import { QuickReplyButtons, getQuickReplyOptions } from './QuickReplyButtons';
import { TriageChatContainer } from './TriageChatContainer';
import { AssessmentSummary } from './AssessmentSummary';
import { detectEmergencySymptom } from '../../utils/emergencySymptoms';

const SYMPTOM_STARTERS = ['Fever', 'Cough', 'Headache', 'Stomach Pain', 'Sore Throat', 'Fatigue'];

export interface TriageChatProps {
  patientId: string | null;
}

const TriageChat: React.FC<TriageChatProps> = ({ patientId }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRegionRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    error,
    currentRiskLevel,
    sendMessage,
    resetConversation,
  } = useTriage(patientId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const lastAssistantMsg = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
    ? messages[messages.length - 1]
    : null;
  const fq = lastAssistantMsg?.fullResponse?.followUpQuestion;
  const isCompleted = lastAssistantMsg?.fullResponse && (fq == null || (typeof fq === 'string' && !fq.trim()));
  const completionData = isCompleted ? lastAssistantMsg!.fullResponse! : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setShowEmergencyAlert(false);

    const isEmergency = detectEmergencySymptom(message);
    if (isEmergency) {
      setShowEmergencyAlert(true);
      await sendMessage(message, false, true);
    } else {
      await sendMessage(message);
    }
  };

  const handleSymptomStarter = useCallback((symptom: string) => {
    setInputMessage('');
    sendMessage(symptom);
  }, [sendMessage]);

  const handleReset = useCallback(() => {
    resetConversation();
    setInputMessage('');
    setShowEmergencyAlert(false);
  }, [resetConversation]);

  const lastFollowUpQuestion = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
    ? messages[messages.length - 1].fullResponse?.followUpQuestion ?? null
    : null;

  const handleQuickReply = useCallback((value: string) => {
    setInputMessage('');
    sendMessage(value);
  }, [sendMessage]);

  const hasQuickReplies = !isCompleted && lastFollowUpQuestion && getQuickReplyOptions(lastFollowUpQuestion).length > 0;

  return (
    <TriageChatContainer currentRiskLevel={currentRiskLevel} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div
          ref={chatRegionRef}
          role="log"
          aria-live="polite"
          aria-label="Assessment conversation"
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50"
        >
          {showEmergencyAlert && (
            <div
              role="alert"
              className="rounded-xl border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/70 p-4 shadow-lg"
            >
              <p className="font-bold text-red-800 dark:text-red-200 text-base sm:text-lg">
                ⚠️ POSSIBLE MEDICAL EMERGENCY
              </p>
              <p className="mt-2 text-sm text-red-800 dark:text-red-200 leading-relaxed">
                Seek emergency medical care immediately or call emergency services.
              </p>
            </div>
          )}

          {messages.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-10 sm:py-14 px-5 text-center"
              aria-hidden="true"
            >
              <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300 font-medium mb-3">
                Tell us how you&apos;re feeling
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-5">
                Tap a symptom below or describe your condition
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-md">
                {SYMPTOM_STARTERS.map((symptom) => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => handleSymptomStarter(symptom)}
                    disabled={isLoading}
                    className="rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-primary hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors min-h-[44px] touch-manipulation"
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="space-y-5 list-none p-0 m-0 w-full max-w-full" role="list">
            {(() => {
              const firstAssistantIndex = messages.findIndex((m) => m.role === 'assistant');
              return messages.map((msg, index) => {
                const isFirstAssistantMessage =
                  msg.role === 'assistant' && index === firstAssistantIndex;
                return (
                  <li
                    key={msg.id}
                    className={`w-full max-w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <ChatMessage
                      id={msg.id}
                      role={msg.role}
                      content={msg.content}
                      timestamp={msg.timestamp}
                      fullResponse={msg.fullResponse}
                      isFirstAssistantMessage={isFirstAssistantMessage}
                    />
                  </li>
                );
              });
            })()}
          </ul>

          {isLoading && (
            <div
              className="flex w-full max-w-full justify-start"
              role="status"
              aria-live="polite"
              aria-label="Analyzing symptoms"
            >
              <div className="chat-bubble chat-bubble-assistant px-4 py-3 flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">Analyzing symptoms…</span>
              </div>
            </div>
          )}

          {error && (
            <div
              id="triage-error"
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200"
            >
              <p className="font-medium">{error}</p>
            </div>
          )}

          {isCompleted && completionData && (
            <div className="w-full max-w-full flex justify-start mt-2">
              <AssessmentSummary
                data={completionData}
                onStartNew={handleReset}
                bookAppointmentPath="/app/appointments/add"
                className="w-full max-w-full"
              />
            </div>
          )}

          <div ref={messagesEndRef} className="h-2" aria-hidden="true" />
        </div>

        {/* Quick-reply buttons – only show when options exist */}
        {hasQuickReplies && lastFollowUpQuestion && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Choose one:</p>
            <QuickReplyButtons
              question={lastFollowUpQuestion}
              onSelect={handleQuickReply}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Message input area – always visible, never shrink */}
        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <label htmlFor="triage-input" className="sr-only">
            Describe your symptoms
          </label>
          <div className="relative flex-1 min-w-0">
            <input
              id="triage-input"
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isCompleted ? "New symptoms or follow-up…" : "Describe symptoms…"}
              disabled={isLoading}
              autoComplete="off"
              className="w-full h-9 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-3 pr-16 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              aria-describedby={error ? 'triage-error' : undefined}
              aria-invalid={!!error}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isLoading ? '…' : 'Ask'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleReset}
            title="Start new assessment"
            className="flex-shrink-0 h-9 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition-colors whitespace-nowrap"
          >
            New
          </button>
        </form>
      </div>
    </TriageChatContainer>
  );
};

export default TriageChat;
