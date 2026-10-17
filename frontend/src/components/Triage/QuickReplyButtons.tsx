import React, { useMemo } from 'react';

export interface QuickReplyButtonsProps {
  /** The follow-up question text; used to decide which options to show */
  question: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Duration options for time/duration questions. */
const DURATION_OPTIONS = [
  '1 hour',
  'A few hours',
  '1 day',
  '2–3 days',
  '4–7 days',
  'More than a week',
] as const;

/** Detect if question is about duration (how long, since when, etc.). Must run before Yes/No. */
function isDurationQuestion(q: string): boolean {
  return (
    /\b(how long|since when|for how long|how long have|how long has)\b/i.test(q) ||
    (/\b(how many|number of)\b/i.test(q) && /\b(days?|hours?|weeks?)\b/i.test(q))
  );
}

/** Detect if question is clearly a yes/no question (not duration). */
function isYesNoQuestion(q: string): boolean {
  if (isDurationQuestion(q)) return false;
  return (
    /\b(are you|do you|is it|does it|did you)\b/i.test(q) ||
    (/\b(have you|has (the|it|this))\b/i.test(q) && !/\b(how|when|many)\b/i.test(q)) ||
    (q.length < 120 && /\b(any|experienced|feeling)\b/i.test(q) && /\?\s*$/.test(q.trim()))
  );
}

/** Detect question type and return suggested quick replies (numeric, severity, yes/no, duration). */
export function getQuickReplyOptions(question: string): string[] {
  const q = question.toLowerCase();
  const trimmed = question.trim();

  if (/\b(how severe|severity|how bad|how would you describe)\b/i.test(q) || /\b(mild|moderate|severe)\b/i.test(q)) {
    return ['Mild', 'Moderate', 'Severe'];
  }
  if (/\b(scale|rate|score|from 1 to 10|1-10|pain level)\b/i.test(q)) {
    return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  }
  /** Duration: check before Yes/No so "How long have you..." never defaults to Yes/No */
  if (isDurationQuestion(q)) {
    return [...DURATION_OPTIONS];
  }
  /** Yes/No: only for clear yes/no questions */
  if (isYesNoQuestion(q) && /\?\s*$/.test(trimmed)) {
    return ['Yes', 'No'];
  }
  return [];
}

export const QuickReplyButtons: React.FC<QuickReplyButtonsProps> = ({
  question,
  onSelect,
  disabled = false,
  className = '',
}) => {
  const options = useMemo(() => getQuickReplyOptions(question), [question]);

  if (options.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-3 sm:gap-4 ${className}`}
      role="group"
      aria-label="Quick reply options"
    >
      {options.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(label)}
          disabled={disabled}
          className="rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-3 sm:px-5 sm:py-2.5 text-sm sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-primary hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px] sm:min-h-[44px] touch-manipulation"
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default QuickReplyButtons;
