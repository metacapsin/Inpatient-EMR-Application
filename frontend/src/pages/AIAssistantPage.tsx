import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { aiChatbotAPI, patientDataAPI } from '../services/api';
import { QuickQuestions, ChatMessages, ChatInput } from '../components/AIChatAssistant';
import IconSparkles from '../components/Icon/IconSparkles';
import { usePatientPortalId } from '../hooks/usePatientPortalId';

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

const AIAssistantPage: React.FC = () => {
    const patientPortalId = usePatientPortalId();
    const [messages, setMessages] = useState<Array<{ content: string; isUser: boolean; createdAt?: string }>>(
        getInitialMessages
    );
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [patientContext, setPatientContext] = useState<Record<string, unknown> | null>(null);
    const [quickQuestionsOpen, setQuickQuestionsOpen] = useState(false);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        if (!patientPortalId) return;
        let cancelled = false;
        (async () => {
            try {
                const response = await patientDataAPI.getFaceSheet(patientPortalId);
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
        return () => {
            cancelled = true;
        };
    }, [patientPortalId]);

    const handleSendQuestion = async (question: string) => {
        const trimmed = question.trim();
        if (!trimmed) return;

        if (!patientPortalId) {
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
            const data = response.data as Record<string, unknown>;
            const message = data?.message as Record<string, unknown> | string | undefined;
            const content =
                (typeof message === 'object' && message && typeof message.content === 'string' && message.content) ||
                (data?.data as Record<string, unknown> | undefined)?.response ||
                (data?.data as Record<string, unknown> | undefined)?.message ||
                data?.response ||
                (typeof message === 'string' ? message : null) ||
                (typeof data === 'string' ? data : null);
            const answer =
                typeof content === 'string' ? content : 'Sorry, I could not generate a response. Please try again.';
            setMessages((prev) => [...prev, { content: answer, isUser: false, createdAt: new Date().toISOString() }]);
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            const errorMessage =
                ax?.response?.data?.message ?? ax?.response?.data?.error ?? 'Failed to get a response. Please try again.';
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
        setQuickQuestionsOpen(false);
    };

    return (
        <div className="flex h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-2 shrink-0 px-2 md:px-0">
                <ul className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <li>
                        <Link to="/app/dashboard" className="font-medium text-primary hover:underline">
                            Home
                        </Link>
                    </li>
                    <li className="text-gray-400 dark:text-gray-500">/</li>
                    <li className="font-semibold text-gray-900 dark:text-white">AI Assistant</li>
                </ul>
                <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#97704f]">
                        <IconSparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white md:text-xl">AI Chat Assistant</h1>
                        <p className="truncate text-sm text-gray-500 dark:text-gray-400">Ask questions about your health records</p>
                    </div>
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-white-light bg-white shadow-sm dark:border-dark dark:bg-black md:flex-row md:rounded-xl">
                <div className="order-1 flex min-h-0 flex-1 flex-col overflow-hidden px-2 md:order-2 md:px-0">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <ChatMessages messages={messages} isLoading={isLoading} />
                    </div>
                    <div className="sticky bottom-0 z-10 shrink-0 bg-white dark:bg-black">
                        <ChatInput
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={() => handleSendQuestion(inputValue)}
                            disabled={isLoading}
                            placeholder="Ask me anything about this patient..."
                        />
                    </div>
                </div>

                <aside className="order-2 flex w-full shrink-0 flex-col overflow-hidden border-t border-white-light bg-gray-50/50 dark:border-dark dark:bg-dark/20 md:order-1 md:h-full md:w-64 md:min-h-0 md:border-r md:border-t-0">
                    <div className="hidden min-h-0 w-full flex-col overflow-hidden md:flex md:h-full">
                        <QuickQuestions onSelectQuestion={handleSendQuestion} disabled={isLoading} />
                    </div>

                    <div className="md:hidden">
                        <button
                            type="button"
                            onClick={() => setQuickQuestionsOpen(true)}
                            className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-sm font-semibold"
                        >
                            <span>Quick Questions</span>
                            <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {quickQuestionsOpen && (
                            <div
                                className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
                                onClick={() => setQuickQuestionsOpen(false)}
                                role="presentation"
                            >
                                <div
                                    className="flex max-h-[70vh] w-full flex-col rounded-t-xl bg-white animate-[slideUp_0.25s_ease] dark:bg-black"
                                    onClick={(e) => e.stopPropagation()}
                                    role="dialog"
                                    aria-modal="true"
                                >
                                    <div className="flex shrink-0 items-center justify-between border-b p-3">
                                        <span className="text-sm font-semibold">Quick Questions</span>
                                        <button type="button" onClick={() => setQuickQuestionsOpen(false)} className="text-sm font-medium text-gray-500">
                                            ✕
                                        </button>
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-4">
                                        <QuickQuestions onSelectQuestion={handleQuickQuestion} disabled={isLoading} hideHeader />
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
