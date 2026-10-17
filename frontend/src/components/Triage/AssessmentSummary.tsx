import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { TriageCompletionData } from '../../services/api';
import { RiskIndicator } from './RiskIndicator';
import { SymptomSummary } from './SymptomSummary';
import { GuidanceCard } from './GuidanceCard';

export interface AssessmentSummaryProps {
  data: TriageCompletionData;
  onStartNew: () => void;
  bookAppointmentPath?: string;
  className?: string;
}

const HIGH_RISK_WARNING = 'Based on your answers, we recommend you speak with a healthcare provider or seek care soon. This is not a diagnosis—always follow the advice of your doctor.';

/** Strip "Follow-up Question: ..." from guidance so it is not shown in the summary (only in chat). */
function stripFollowUpSectionFromGuidance(guidance: string | undefined): string {
  if (!guidance?.trim()) return '';
  const idx = guidance.search(/\bFollow-up\s+Question\s*:/i);
  if (idx < 0) return guidance.trim();
  return guidance.slice(0, idx).trim();
}

export const AssessmentSummary: React.FC<AssessmentSummaryProps> = ({
  data,
  onStartNew,
  bookAppointmentPath = '/app/appointments/add',
  className = '',
}) => {
  const isHighRisk = (data.riskLevel ?? '').toUpperCase() === 'HIGH';
  const summaryGuidance = useMemo(() => stripFollowUpSectionFromGuidance(data.guidance), [data.guidance]);

  return (
    <section
      aria-labelledby="assessment-summary-heading"
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden ${className}`}
    >
      <div className="px-5 sm:px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <h2 id="assessment-summary-heading" className="text-lg font-bold text-slate-900 dark:text-white">
          Assessment Summary
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Here&apos;s a summary you can keep for your records or share with your doctor.
        </p>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Risk Level */}
        {data.riskLevel && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Risk Level
            </h3>
            <RiskIndicator level={data.riskLevel} showSubtitle />
          </div>
        )}

        {/* Detected Symptoms */}
        {data.symptomsIdentified && data.symptomsIdentified.length > 0 && (
          <SymptomSummary symptoms={data.symptomsIdentified} />
        )}

        {/* Guidance – follow-up question text is stripped; only for chat, not summary */}
        {summaryGuidance && <GuidanceCard guidance={summaryGuidance} disclaimer={data.disclaimer} />}

        {/* Disclaimer */}
        {data.disclaimer && (
          <aside aria-label="Disclaimer" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-medium">Note:</span> {data.disclaimer}
            </p>
          </aside>
        )}

        {/* Doctor Warning – red alert when HIGH risk */}
        {isHighRisk && (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
              Doctor Warning
            </h3>
            <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
              {HIGH_RISK_WARNING}
            </p>
          </div>
        )}

        {/* Final page buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onStartNew}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-opacity"
          >
            Start New Assessment
          </button>
          <Link
            to={bookAppointmentPath}
            className="rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-colors text-center"
          >
            Book Appointment
          </Link>
        </div>
      </div>
    </section>
  );
};

export default AssessmentSummary;
