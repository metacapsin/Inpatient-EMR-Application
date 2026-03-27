import React, { memo, useMemo } from 'react';
import type { TriageCompletionData } from '../../services/api';
import { RiskIndicator } from './RiskIndicator';
import { SymptomSummary } from './SymptomSummary';
import { GuidanceCard } from './GuidanceCard';
import { FollowUpQuestionCard } from './FollowUpQuestionCard';

/**
 * Strips the API disclaimer text from a string so it appears only in the Note section.
 */
function stripDisclaimer(
  text: string | undefined | null,
  disclaimer: string | undefined
): string {
  if (!text?.trim()) return '';
  if (!disclaimer?.trim()) return text.trim();
  const d = disclaimer.trim();
  let result = text;
  if (result.includes(d)) {
    result = result.replace(d, '');
  }
  // Remove "Note:" or "Disclaimer:" labels that may wrap the disclaimer
  result = result.replace(/\s*(?:Note|Disclaimer)\s*:\s*$/im, '').trim();
  result = result.replace(/^\s*(?:Note|Disclaimer)\s*:\s*/im, '').trim();
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Strips content from "Follow-up Question:" or "Disclaimer:" onward.
 * Only the clean guidance text before those sections is returned.
 */
function stripFollowUpAndDisclaimerSections(text: string | undefined | null): string {
  if (!text?.trim()) return '';
  const t = text.trim();
  const fuIdx = t.search(/\bFollow-up\s+Question\s*:/i);
  const disIdx = t.search(/\bDisclaimer\s*:/i);
  let cutAt = t.length;
  if (fuIdx >= 0) cutAt = Math.min(cutAt, fuIdx);
  if (disIdx >= 0) cutAt = Math.min(cutAt, disIdx);
  return t.slice(0, cutAt).trim();
}

export interface ChatMessageProps {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  fullResponse?: TriageCompletionData;
  /** When true, show symptoms, risk level, guidance, and disclaimer. When false, show only follow-up question. */
  isFirstAssistantMessage?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = memo(function ChatMessage({
  id,
  role,
  content,
  timestamp,
  fullResponse,
  isFirstAssistantMessage = false,
}) {
  const isUser = role === 'user';
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const { strippedGuidance, strippedFollowUpQuestion, strippedContent } = useMemo(() => {
    const disclaimer = fullResponse?.disclaimer;
    const g = stripFollowUpAndDisclaimerSections(stripDisclaimer(fullResponse?.guidance, disclaimer));
    const fq = stripFollowUpAndDisclaimerSections(stripDisclaimer(fullResponse?.followUpQuestion ?? null, disclaimer));
    const c = stripFollowUpAndDisclaimerSections(content);
    return {
      strippedGuidance: g,
      strippedFollowUpQuestion: fq,
      strippedContent: c,
    };
  }, [fullResponse?.guidance, fullResponse?.followUpQuestion, fullResponse?.disclaimer, content]);

  const hasStructuredResponse =
    !isUser &&
    fullResponse &&
    (fullResponse.symptomsIdentified?.length ||
      fullResponse.riskLevel ||
      fullResponse.guidance ||
      fullResponse.followUpQuestion);

  /** Subsequent AI messages: show only the follow-up question to keep the conversation focused. */
  const showFullContent = isUser || isFirstAssistantMessage;

  return (
    <article
      id={`triage-msg-${id}`}
      role="listitem"
      className={`flex w-full ${isUser ? 'message-user ml-auto mr-0 max-w-[85%] sm:max-w-[75%]' : 'message-ai mr-0 ml-0 w-full max-w-full'}`}
      aria-label={isUser ? 'Your message' : 'Assessment response'}
    >
      <div
        className={`flex flex-col gap-3 w-full px-4 py-3.5 sm:px-5 sm:py-4 transition-all duration-200 chat-bubble ${
          isUser
            ? 'chat-bubble-user'
            : 'chat-bubble-assistant'
        }`}
      >
        {/* 1. Symptoms detected – first AI response only */}
        {showFullContent && !isUser && fullResponse?.symptomsIdentified && fullResponse.symptomsIdentified.length > 0 && (
          <SymptomSummary symptoms={fullResponse.symptomsIdentified} />
        )}

        {/* 2. Risk Level – first AI response only */}
        {showFullContent && !isUser && fullResponse?.riskLevel && (
          <section
            aria-labelledby={`triage-risk-heading-${id}`}
            className="rounded-lg border border-slate-200/80 dark:border-slate-600/60 bg-slate-50/60 dark:bg-slate-700/40 p-3.5 sm:p-4"
          >
            <h3 id={`triage-risk-heading-${id}`} className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Risk level
            </h3>
            <RiskIndicator level={fullResponse.riskLevel} aria-live="polite" showSubtitle />
          </section>
        )}

        {/* Fallback: raw content when no structured sections (e.g. user msgs or edge cases) */}
        {!hasStructuredResponse && (
          <p className="text-sm sm:text-base font-medium leading-relaxed">{isUser ? content : strippedContent}</p>
        )}

        {/* 3. Guidance – first AI response only; hide when complete so Assessment Summary below shows it */}
        {showFullContent && !isUser && strippedGuidance && strippedFollowUpQuestion && (
          <GuidanceCard guidance={strippedGuidance} disclaimer={fullResponse?.disclaimer} />
        )}

        {/* 4. Next Question – always show for assistant messages; this is the focus for subsequent responses */}
        {!isUser && strippedFollowUpQuestion && (
          <FollowUpQuestionCard question={strippedFollowUpQuestion} />
        )}

        {/* 5. Disclaimer – first AI response only */}
        {showFullContent && !isUser && fullResponse?.disclaimer && (
          <aside
            aria-label="Disclaimer"
            className="mt-1 pt-3 border-t border-slate-200/70 dark:border-slate-600/70"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-medium">Note:</span> {fullResponse.disclaimer}
            </p>
          </aside>
        )}

        {/* Subsequent assistant msg with no follow-up (edge case): show content; hide when completion has Assessment Summary below */}
        {!isUser && !strippedFollowUpQuestion && !showFullContent && strippedContent && !fullResponse && (
          <p className="text-sm sm:text-base font-medium leading-relaxed">{strippedContent}</p>
        )}

        <time
          dateTime={timestamp}
          className={`text-[11px] mt-0.5 opacity-75 ${isUser ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {time}
        </time>
      </div>
    </article>
  );
});

export default ChatMessage;
