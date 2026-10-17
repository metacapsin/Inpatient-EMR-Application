import React from 'react';
import { RiskIndicator } from './RiskIndicator';

export interface TriageChatContainerProps {
  children: React.ReactNode;
  currentRiskLevel?: string | null;
  className?: string;
}

/**
 * Wraps the symptom checker chat in a card layout with optional risk badge in the header.
 * Used for consistent layout, shadows, and responsive height.
 */
export const TriageChatContainer: React.FC<TriageChatContainerProps> = ({
  children,
  currentRiskLevel,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col w-full rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden ${className}`}
      role="region"
      aria-label="Symptom checker conversation"
    >
      <header className="flex-shrink-0 flex items-center justify-end gap-4 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        {currentRiskLevel ? (
          <RiskIndicator level={currentRiskLevel} aria-live="polite" showSubtitle={false} className="flex-shrink-0" />
        ) : (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Answer the questions below to see your risk level.
          </span>
        )}
      </header>
      {children}
    </div>
  );
};

export default TriageChatContainer;
