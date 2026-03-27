import React from 'react';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskIndicatorProps {
  level: RiskLevel | string | null | undefined;
  /** For accessibility: announced when level changes */
  'aria-live'?: 'polite' | 'assertive';
  className?: string;
  /** Show a short patient-friendly subtitle under the badge */
  showSubtitle?: boolean;
}

const RISK_STYLES: Record<string, { bg: string; text: string; border: string; label: string; subtitle: string }> = {
  LOW: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-400 dark:border-emerald-700',
    label: 'LOW RISK',
    subtitle: 'Monitor symptoms at home',
  },
  MEDIUM: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-400 dark:border-amber-700',
    label: 'MEDIUM RISK',
    subtitle: 'Consider contacting a healthcare provider',
  },
  HIGH: {
    bg: 'bg-red-100 dark:bg-red-950/70',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-400 dark:border-red-600',
    label: 'HIGH RISK',
    subtitle: 'Seek urgent medical care immediately',
  },
};

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({
  level,
  'aria-live': ariaLive = 'polite',
  className = '',
  showSubtitle: showSubtitleProp = true,
}) => {
  const normalized = (level ?? '').toUpperCase() as RiskLevel;
  const style = RISK_STYLES[normalized] ?? {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
    label: normalized ? `${normalized} RISK` : '—',
    subtitle: '',
  };

  const friendlyLabel = style.label;
  const showSubtitle = showSubtitleProp && normalized && style.subtitle;

  const iconSvg =
    normalized === 'LOW'
      ? (
        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        )
      : normalized === 'MEDIUM'
        ? (
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          )
        : normalized === 'HIGH'
          ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            )
          : null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        role="status"
        aria-live={ariaLive}
        aria-label={friendlyLabel}
        className={`inline-flex items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 text-sm font-bold uppercase tracking-wide shadow-sm ${normalized === 'HIGH' ? 'ring-2 ring-red-300 dark:ring-red-800' : ''} ${style.bg} ${style.text} ${style.border}`}
      >
        {iconSvg}
        <span className="sr-only">{friendlyLabel}: </span>
        {normalized ? friendlyLabel : '—'}
      </div>
      {showSubtitle && (
        <p className={`text-sm font-medium leading-relaxed ${style.text} opacity-95`}>
          {style.subtitle}
        </p>
      )}
    </div>
  );
};

export default RiskIndicator;
