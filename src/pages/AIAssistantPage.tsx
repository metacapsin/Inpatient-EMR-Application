import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { aiChatbotAPI, patientDataAPI } from '../services/api';
import { QuickQuestions, ChatMessages, ChatInput } from '../components/AIChatAssistant';
import IconSparkles from '../components/Icon/IconSparkles';

const SYSTEM_CONTENT = `You are an AI medical assistant analyzing patient data. Provide concise, structured medical responses based on the patient context provided. Use clear language and only use information from the given patient data.`;

function buildStructuredQuery(patientData: Record<string, unknown>, message: string): string {
  return `You are an AI medical assistant analyzing patient data.

Patient Context:
${JSON.stringify(patientData)}

Question: ${message}

Provide a concise, structured medical response based on the available patient information.`;
}

const WELCOME_MESSAGE = `Hello! I'm your AI medical assistant. I can help you analyze your health data, answer questions about your medical history, medications, vitals, and provide insights based on your health records. What would you like to know?`;

function getInitialMessages(): Array<{ content: string; isUser: boolean; createdAt?: string }> {
  return [
    {
      content: WELCOME_MESSAGE,
      isUser: false,
      createdAt: new Date().toISOString(),
    },
  ];
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

const AIAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ content: string; isUser: boolean; createdAt?: string }>>(getInitialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [patientContext, setPatientContext] = useState<Record<string, unknown> | null>(null);
  const [quickQuestionsOpen, setQuickQuestionsOpen] = useState(false);

  // Lock body scroll so only the messages container scrolls
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const patientId = getPatientId();
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await patientDataAPI.getFaceSheet(patientId);
        if (cancelled) return;
        if (response.data?.status === 'success' && response.data?.data) {
          const data = response.data.data;
          setPatientContext({
            vitals: data.vitals ?? [],
            diagnoses: data.diagnoses ?? [],
            History: data.History ?? [],
            medications: data.medications ?? [],
            prescriptions: data.prescriptions ?? [],
            allergies: data.allergies ?? [],
            immunizations: data.immunizations ?? [],
            notes: data.notes ?? [],
          });
        } else {
          setPatientContext({});
        }
      } catch {
        if (!cancelled) setPatientContext({});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const patientId = getPatientId();
    if (!patientId) {
      setMessages((prev) => [
        ...prev,
        { content: trimmed, isUser: true, createdAt: new Date().toISOString() },
        {
          content: 'Patient ID not found. Please log in as a patient.',
          isUser: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      setInputValue('');
      return;
    }

    setMessages((prev) => [...prev, { content: trimmed, isUser: true, createdAt: new Date().toISOString() }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const patientData = patientContext ?? {};
      const query = buildStructuredQuery(patientData, trimmed);
      const response = await aiChatbotAPI.sendStructuredMessage({
        systemContent: SYSTEM_CONTENT,
        query,
        maxTokens: 1024,
        temperature: 0.3,
      });
      const data = response.data as any;
      const content =
        (typeof data?.message?.content === 'string' && data.message.content) ||
        data?.data?.response ||
        data?.data?.message ||
        data?.response ||
        (typeof data?.message === 'string' ? data.message : null) ||
        (typeof data === 'string' ? data : null);
      const answer = typeof content === 'string' ? content : 'Sorry, I could not generate a response. Please try again.';
      setMessages((prev) => [
        ...prev,
        { content: answer, isUser: false, createdAt: new Date().toISOString() },
      ]);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ?? err?.response?.data?.error ?? 'Failed to get a response. Please try again.';
      setMessages((prev) => [
        ...prev,
        { content: errorMessage, isUser: false, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSendQuestion(question);
    setQuickQuestionsOpen(false); // 🔥 close bottom sheet
  };

  return (
<div className="flex flex-col h-[100dvh] min-h-0 flex-1 overflow-hidden">      {/* Breadcrumb + title: fixed at top, no scroll */}
<div className="shrink-0 mb-2 px-2 md:px-0">
        <ul className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <li>
            <Link to="/app/dashboard" className="text-primary hover:underline font-medium">
              Home
            </Link>
          </li>
          <li className="text-gray-400 dark:text-gray-500">/</li>
          <li className="text-gray-900 dark:text-white font-semibold">AI Assistant</li>
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-[#97704f] flex items-center justify-center shrink-0">
            <IconSparkles className="text-white w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">AI Chat Assistant</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
             Ask questions about your health records
            </p>
          </div>
        </div>
      </div>

      {/* Chat layout: on mobile chat first (primary) + Quick Questions accordion below; on desktop sidebar + chat */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row rounded-none md:rounded-xl border border-white-light dark:border-dark bg-white dark:bg-black overflow-hidden shadow-sm">

  {/* Chat Section */}
  <div className="order-1 md:order-2 flex-1 flex flex-col min-h-0 overflow-hidden px-2 md:px-0">

  {/* Chat Messages (scrollable area) */}
  <div className="flex-1 overflow-y-auto">
    <ChatMessages messages={messages} isLoading={isLoading} />
  </div>

  {/* Sticky Input */}
  <div className="sticky bottom-0 z-10 bg-white dark:bg-black">
    <ChatInput
      value={inputValue}
      onChange={setInputValue}
      onSubmit={() => handleSendQuestion(inputValue)}
      disabled={isLoading}
      placeholder="Ask me anything about this patient..."
    />
  </div>

</div>

  {/* Quick Questions */}
  <aside className="order-2 md:order-1 w-full md:w-64 shrink-0 md:min-h-0 md:h-full flex flex-col border-t md:border-t-0 md:border-r border-white-light dark:border-dark bg-gray-50/50 dark:bg-dark/20 overflow-hidden min-w-0">

    {/* Desktop Sidebar */}
    <div className="hidden md:flex flex-col h-full min-h-0 overflow-hidden w-full">
      <QuickQuestions
        onSelectQuestion={handleSendQuestion}
        disabled={isLoading}
      />
    </div>

    {/* Mobile Bottom Sheet */}
    <div className="md:hidden">
    <button
  type="button"
  onClick={() => setQuickQuestionsOpen(true)}
  className="w-full px-3 py-2 text-left border-t text-sm font-semibold flex items-center justify-between"
>
  <span>Quick Questions</span>

  <svg
    className="w-4 h-4 text-gray-500"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
</button>

{quickQuestionsOpen && (
  <div
    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end"
    onClick={() => setQuickQuestionsOpen(false)}
  >
    
    <div
      className="w-full bg-white dark:bg-black rounded-t-xl max-h-[70vh] flex flex-col animate-[slideUp_0.25s_ease]"
      onClick={(e) => e.stopPropagation()}
    >
      
      
      <div className="p-3 border-b flex justify-between items-center shrink-0">
        <span className="text-sm font-semibold">Quick Questions</span>

        <button
          onClick={() => setQuickQuestionsOpen(false)}
          className="text-gray-500 text-sm font-medium"
        >
          ✕
        </button>
      </div>

      
      <div className="overflow-y-auto p-3 flex-1 pb-4">
        <QuickQuestions
          onSelectQuestion={handleQuickQuestion}
          disabled={isLoading}
          hideHeader
        />
      </div>

    </div>

  </div>
)}
    </div>

  </aside>
</div>
    </div>
  );
};

export default AIAssistantPage;
