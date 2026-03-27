import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import IconSparkles from '../Icon/IconSparkles';
import { patientDataAPI } from '../../services/api';
import { generateAnswer, type FaceSheetData } from '../../utils/faceSheetAnswerGenerator';
import QuickQuestions from './QuickQuestions';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';

export interface AIChatAssistantProps {
  open: boolean;
  onClose: () => void;
  faceSheetData?: FaceSheetData | null;
}

function getPatientId(): string {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return '';
    const currentUser = JSON.parse(userStr);
    return currentUser.patientId || currentUser.rcopiaID || '';
  } catch {
    return '';
  }
}

const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  open,
  onClose,
  faceSheetData: faceSheetDataProp,
}) => {
  const [messages, setMessages] = useState<Array<{ content: string; isUser: boolean }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [faceSheetData, setFaceSheetData] = useState<FaceSheetData | null>(faceSheetDataProp ?? null);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !faceSheetDataProp) {
      const patientId = getPatientId();
      if (!patientId) {
        setDataError('Patient ID not found. Please log in as a patient.');
        setFaceSheetData(null);
        return;
      }
      setDataError(null);
      let cancelled = false;
      (async () => {
        try {
          const response = await patientDataAPI.getFaceSheet(patientId);
          if (cancelled) return;
          if (response.data?.status === 'success' && response.data?.data) {
            const data = response.data.data;
            setFaceSheetData({
              vitals: data.vitals || [],
              diagnoses: data.diagnoses || [],
              History: data.History || [],
              medications: data.medications || [],
              prescriptions: data.prescriptions || [],
              allergies: data.allergies || [],
              immunizations: data.immunizations || [],
              documents: data.documents || [],
              labDocuments: data.labDocuments || [],
              notes: data.notes || [],
              screening: data.screening || [],
              futureAppointments: data.futureAppointments || [],
            });
          } else {
            setDataError('Could not load patient data. Please try again.');
          }
        } catch {
          if (!cancelled) setDataError('Could not load patient data. Please try again.');
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (open && faceSheetDataProp) {
      setFaceSheetData(faceSheetDataProp);
      setDataError(null);
    }
  }, [open, faceSheetDataProp]);

  const dataToUse = faceSheetDataProp ?? faceSheetData;

  const handleSendQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { content: trimmed, isUser: true }]);
    setInputValue('');

    if (dataError) {
      setMessages((prev) => [...prev, { content: dataError, isUser: false }]);
      return;
    }

    if (!dataToUse) {
      setMessages((prev) => [
        ...prev,
        { content: 'Loading patient data... Please try again in a moment.', isUser: false },
      ]);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const answer = generateAnswer(trimmed, dataToUse);
      setMessages((prev) => [...prev, { content: answer, isUser: false }]);
      setIsLoading(false);
    }, 300);
  };

  const handleQuickQuestion = (text: string) => {
    handleSendQuestion(text);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-black rounded-2xl shadow-2xl border border-white-light dark:border-dark flex flex-col w-full max-w-4xl h-[85vh] max-h-[700px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <IconSparkles className="text-white text-sm w-4 h-4" />
            </div>
            <span className="font-semibold">AI Assistant</span>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content: sidebar + chat */}
        <div className="flex flex-1 min-h-0">
          <div className="w-64 shrink-0 border-r border-white-light dark:border-dark p-3">
            <QuickQuestions onSelectQuestion={handleQuickQuestion} disabled={isLoading} />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <ChatMessages messages={messages} isLoading={isLoading} />
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={() => handleSendQuestion(inputValue)}
              disabled={isLoading}
              placeholder="Type your question..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatAssistant;
