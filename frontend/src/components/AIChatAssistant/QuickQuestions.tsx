import React from 'react';

const QUICK_QUESTIONS = [
  "What medications am I currently taking?",
  "What is my medical history?",
  "Do I have any recorded allergies?",
  "What are my recent vital signs?",
  "What diagnoses do I have?",
  "Summarize my medical notes",
  "Show my recent notes",
  "Analyze trends in my notes",
  "What are my latest clinical notes?",
  "Highlight important findings in my notes",
  "Show my progress notes timeline",
];

export interface QuickQuestionsProps {
  onSelectQuestion: (text: string) => void;
  disabled?: boolean;
  /** When true, hide the "Quick Questions" header (e.g. when used inside an accordion that has its own label) */
  hideHeader?: boolean;
}

const QuickQuestions: React.FC<QuickQuestionsProps> = ({ onSelectQuestion, disabled = false, hideHeader = false }) => {
  return (
    <div className="h-full min-h-0 flex flex-col rounded-xl border-0 bg-transparent shadow-none overflow-hidden w-full min-w-0">
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-white-light dark:border-dark shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Questions</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Click to ask</p>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-1">
        {QUICK_QUESTIONS.map((question, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelectQuestion(question)}
            disabled={disabled}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark/50 border border-transparent hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50 dark:disabled:hover:bg-dark/50 min-w-0 break-words overflow-hidden"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickQuestions;
