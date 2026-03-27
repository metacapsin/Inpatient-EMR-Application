import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface AbnormalValue {
  testName?: string;
  name?: string;
  value?: string;
  result?: string;
  referenceRange?: string;
  interpretation?: string;
}

interface NormalValue {
  testName?: string;
  name?: string;
  value?: string;
  result?: string;
  referenceRange?: string;
  interpretation?: string;
}

interface AbnormalHighlights {
  summary?: string;
  abnormalValues?: AbnormalValue[];
  normalValues?: NormalValue[];
  recommendations?: string[];
  rawData?: any;
}

interface LabAIHighlightsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  highlights: AbnormalHighlights | null;
  loading: boolean;
  error: string | null;
}

const LabAIHighlightsSidebar: React.FC<LabAIHighlightsSidebarProps> = ({
  isOpen,
  onClose,
  highlights,
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
          <h5 className="text-lg font-semibold">AI Lab Abnormal Highlights</h5>
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
              <p className="text-gray-600 dark:text-gray-400">Loading AI highlights...</p>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-4">
              <p className="text-danger font-semibold mb-2">Error</p>
              <p className="text-danger/80 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && highlights && (
            <div className="space-y-6">
              {/* Summary */}
              {highlights.summary && (
                <div className="border-b border-white-light dark:border-[#191e3a] pb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Summary</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {highlights.summary}
                  </p>
                </div>
              )}

              {/* Abnormal Values */}
              {highlights.abnormalValues && highlights.abnormalValues.length > 0 && (
                <div className="panel p-4 border border-warning/20 bg-warning/5">
                  <h6 className="text-warning text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Abnormal Values
                  </h6>
                  <div className="space-y-4">
                    {highlights.abnormalValues.map((value, index) => (
                      <div key={index} className="bg-white dark:bg-[#0e1726] rounded-lg p-3 border border-warning/30">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Test Name:</span>
                            <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                              {value.testName || value.name || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Value:</span>
                            <span className="font-semibold ml-2 text-warning">
                              {value.value || value.result || '—'}
                            </span>
                          </div>
                          {value.referenceRange && (
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Reference Range:</span>
                              <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                                {value.referenceRange}
                              </span>
                            </div>
                          )}
                          {value.interpretation && (
                            <div className="sm:col-span-2">
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Interpretation:</span>
                              <p className="text-gray-900 dark:text-white mt-1">{value.interpretation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Normal Values */}
              {highlights.normalValues && highlights.normalValues.length > 0 && (
                <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                  <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Normal Values
                  </h6>
                  <div className="space-y-3">
                    {highlights.normalValues.map((value, index) => (
                      <div key={index} className="bg-white-light/50 dark:bg-dark/50 rounded-lg p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Test Name:</span>
                            <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                              {value.testName || value.name || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Value:</span>
                            <span className="font-semibold ml-2 text-primary">
                              {value.value || value.result || '—'}
                            </span>
                          </div>
                          {value.referenceRange && (
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Reference Range:</span>
                              <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                                {value.referenceRange}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {highlights.recommendations && highlights.recommendations.length > 0 && (
                <div className="panel p-4 border border-primary/20 bg-primary/5">
                  <h6 className="text-primary text-sm uppercase font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Recommendations
                  </h6>
                  <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {highlights.recommendations.map((recommendation, index) => (
                      <li key={index}>{recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Raw Data (Collapsible) */}
              {highlights.rawData && (
                <details className="panel p-4 border border-white-light dark:border-[#191e3a]">
                  <summary className="text-primary text-sm uppercase font-semibold cursor-pointer flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Raw Data
                  </summary>
                  <div className="mt-3 p-3 bg-white-light/50 dark:bg-dark/50 rounded-lg">
                    <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                      {JSON.stringify(highlights.rawData, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Empty State */}
              {!highlights.summary && 
               (!highlights.abnormalValues || highlights.abnormalValues.length === 0) &&
               (!highlights.normalValues || highlights.normalValues.length === 0) &&
               (!highlights.recommendations || highlights.recommendations.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No highlights available for this lab order.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LabAIHighlightsSidebar;
