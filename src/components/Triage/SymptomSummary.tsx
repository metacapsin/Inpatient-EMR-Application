import React from 'react';

export interface SymptomSummaryProps {
  symptoms: string[];
  className?: string;
}

const SYMPTOM_EMOJI: Record<string, string> = {
  fever: '🤒',
  cough: '😷',
  headache: '🤕',
  'sore throat': '🫠',
  nausea: '🤢',
  vomiting: '🤮',
  fatigue: '😴',
  pain: '🩹',
  cold: '🥶',
  dizzy: '😵',
  breathing: '🫁',
  chest: '❤️‍🩹',
  stomach: '🫃',
  rash: '🔴',
  allergy: '🤧',
};

function getSymptomEmoji(symptom: string): string {
  const lower = symptom.toLowerCase();
  for (const [key, emoji] of Object.entries(SYMPTOM_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '•';
}

export const SymptomSummary: React.FC<SymptomSummaryProps> = ({ symptoms, className = '' }) => {
  if (!symptoms?.length) return null;

  return (
    <section
      aria-labelledby="triage-symptoms-heading"
      className={`rounded-lg border border-slate-200/70 dark:border-slate-600/50 bg-slate-50/60 dark:bg-slate-700/40 p-3.5 sm:p-4 ${className}`}
    >
      <h3
        id="triage-symptoms-heading"
        className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide"
      >
        Symptoms detected
      </h3>
      <ul className="flex flex-wrap gap-2 list-none pl-0 m-0" role="list">
        {symptoms.map((s, i) => (
          <li
            key={`${s}-${i}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/90 dark:bg-slate-700/60 px-3 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-600/60"
          >
            <span className="text-base leading-none" aria-hidden="true">{getSymptomEmoji(s)}</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default SymptomSummary;
