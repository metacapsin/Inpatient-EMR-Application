import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { MedicationExplanation } from '../types/medication';

interface MedicationAIExplanationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: MedicationExplanation | null;
  loading: boolean;
  error: string | null;
}

const MedicationAIExplanationSidebar: React.FC<MedicationAIExplanationSidebarProps> = ({
  isOpen,
  onClose,
  explanation,
  loading,
  error,
}) => {
  if (!isOpen) return null;

  // Prevent focus on sidebar open
  React.useEffect(() => {
    if (isOpen) {
      // Remove focus from any active element
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        onClick={onClose}
        onMouseDown={(e) => e.preventDefault()}
      />
      
      {/* Sidebar */}
      <div 
        className="fixed right-0 top-0 h-full w-full md:w-1/2 bg-white dark:bg-[#0e1726] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col outline-none"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-primary text-white shrink-0 border-b border-primary/20">
          <h5 className="text-lg font-semibold">AI Medication Explanation</h5>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Generating AI explanation...</p>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-4">
              <p className="text-danger font-semibold mb-2">Error</p>
              <p className="text-danger/80 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && explanation && (
            <div className="space-y-6">
              {/* Medication Name & Type */}
              <div className="border-b border-white-light dark:border-[#191e3a] pb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {explanation.medicationName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Type: <span className="font-semibold text-gray-900 dark:text-white">{explanation.medicationType}</span>
                </p>
              </div>

              {/* Used For */}
              {explanation.usedFor.length > 0 && (
                <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                  <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Used For
                  </h6>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {explanation.usedFor.map((use, index) => (
                      <li key={index}>{use}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* How It Works */}
              {explanation.howItWorks && (
                <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                  <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                    How It Works
                  </h6>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {explanation.howItWorks}
                  </p>
                </div>
              )}

              {/* How To Take */}
              <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  How To Take
                  </h6>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Dose:</span>
                    <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                      {explanation.howToTake.dose}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Route:</span>
                    <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                      {explanation.howToTake.route}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                    <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                      {explanation.howToTake.duration}
                    </span>
                  </div>
                  {explanation.howToTake.instructions.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-600 dark:text-gray-400 block mb-2">Instructions:</span>
                      <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                        {explanation.howToTake.instructions.map((instruction, index) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Important Precautions */}
              {explanation.importantPrecautions.length > 0 && (
                <div className="panel p-4 border border-warning/20 bg-warning/5">
                  <h6 className="text-warning text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Important Precautions
                  </h6>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {explanation.importantPrecautions.map((precaution, index) => (
                      <li key={index}>{precaution}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Common Side Effects */}
              {explanation.commonSideEffects.length > 0 && (
                <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                  <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Common Side Effects
                  </h6>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {explanation.commonSideEffects.map((effect, index) => (
                      <li key={index}>{effect}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Serious Side Effects */}
              {explanation.seriousSideEffects.length > 0 && (
                <div className="panel p-4 border border-danger/20 bg-danger/5">
                  <h6 className="text-danger text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Serious Side Effects
                  </h6>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {explanation.seriousSideEffects.map((effect, index) => (
                      <li key={index}>{effect}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* When to Contact Doctor */}
              {explanation.whenToContactDoctor.length > 0 && (
                <div className="panel p-4 border border-primary/20 bg-primary/5">
                  <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    When to Contact Doctor
                  </h6>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {explanation.whenToContactDoctor.map((contact, index) => (
                      <li key={index}>{contact}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Additional Notes */}
              {explanation.additionalNotes && (
                <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                  <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Additional Notes
                  </h6>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {explanation.additionalNotes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MedicationAIExplanationSidebar;
