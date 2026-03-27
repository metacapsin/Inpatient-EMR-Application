import React from 'react';

export interface FollowUpQuestionCardProps {
  question: string;
  className?: string;
}

function isEmptyQuestion(q: string | undefined): boolean {
  const t = q?.trim() ?? '';
  return !t || /^none\.?$/i.test(t);
}

export const FollowUpQuestionCard: React.FC<FollowUpQuestionCardProps> = ({ question, className = '' }) => {
  if (isEmptyQuestion(question)) return null;

  return (
    <section
      aria-labelledby="triage-followup-heading"
      className={`rounded-lg border border-violet-200/80 dark:border-violet-700/50 bg-violet-50/70 dark:bg-violet-950/40 p-3.5 sm:p-4 ${className}`}
    >
      <h3
        id="triage-followup-heading"
        className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-2 uppercase tracking-wide"
      >
        Next question
      </h3>
      <p className="text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-relaxed font-medium">
        {question}
      </p>
    </section>
  );
};

export default FollowUpQuestionCard;
