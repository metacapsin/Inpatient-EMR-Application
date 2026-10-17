import React from 'react';
import { Link } from 'react-router-dom';
import { TriageChat } from '../../components/Triage';
import { usePatientPortalId } from '../../hooks/usePatientPortalId';

const PatientAssessment: React.FC = () => {
  const patientId = usePatientPortalId();

  if (!patientId) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <p className="text-red-600 dark:text-red-400 font-medium mb-3">
          Patient ID not found. Please log in as a patient.
        </p>
        <Link
          to="/app/dashboard"
          className="inline-flex items-center text-primary font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="patient-assessment-page flex flex-col h-full min-h-0 min-w-0">
      <div className="w-full flex flex-col flex-1 min-h-0 gap-2 sm:gap-3">
        <nav aria-label="Breadcrumb" className="flex-shrink-0 flex items-center gap-2 text-xs sm:text-sm">
          <Link
            to="/app/dashboard"
            className="text-slate-500 dark:text-slate-400 hover:text-primary font-medium transition-colors"
          > 
            Home
          </Link>
          <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">/</span>
          <span className="text-slate-900 dark:text-white font-semibold">Symptom Checker</span>
        </nav>

        <header className="flex-shrink-0 space-y-0.5">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Symptom Checker
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
          Answer a few questions to assess your symptoms.          </p>
        </header>

        <div
          role="alert"
          aria-labelledby="medical-notice-heading"
          className="triage-disclaimer flex-shrink-0 flex items-start gap-2 py-1"
        >
          <span className="flex-shrink-0 text-lg" aria-hidden="true">⚠</span>
          <div className="min-w-0">
            <h2 id="medical-notice-heading" className="font-semibold text-amber-900 dark:text-amber-900 text-sm leading-tight">
              Medical Notice
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-amber-900 dark:text-amber-900">
            For informational purposes only. Not a medical diagnosis. Consult a licensed provider.

            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <TriageChat patientId={patientId} />
        </div>
      </div>
    </div>
  );
};

export default PatientAssessment;
