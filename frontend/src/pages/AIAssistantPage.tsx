import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QuickQuestions, ChatMessages, ChatInput } from '../components/AIChatAssistant';
import IconSparkles from '../components/Icon/IconSparkles';
import { askAboutPatient, getAiStatus, type AiChatTurn } from '../services/ai.service';
import { getPatientById } from '../services/patient.service';

const WELCOME_MESSAGE =
    'I can summarise what is documented in this chart (problems, allergies, medications, latest vitals and labs) and answer questions about it. I only use the record; I do not give dosing or treatment advice.';

type ChatMessage = { content: string; isUser: boolean; createdAt?: string };

function initialMessages(): ChatMessage[] {
    return [{ content: WELCOME_MESSAGE, isUser: false, createdAt: new Date().toISOString() }];
}

/**
 * Staff-facing chart assistant. The patient context is built server-side from `patientId`
 * (`POST /api/ai/chatbot`); the browser never holds a provider key or serialises the chart.
 */
const AIAssistantPage: React.FC = () => {
    const [params] = useSearchParams();
    const patientId = params.get('patientId')?.trim() || '';

    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickQuestionsOpen, setQuickQuestionsOpen] = useState(false);

    const statusQuery = useQuery({ queryKey: ['ai', 'status'], queryFn: getAiStatus, staleTime: 60_000, retry: false });
    const patientQuery = useQuery({
        queryKey: ['ai', 'patient', patientId],
        queryFn: () => getPatientById(patientId),
        enabled: Boolean(patientId),
        staleTime: 60_000,
    });

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        setMessages(initialMessages());
    }, [patientId]);

    const history = useMemo<AiChatTurn[]>(
        () =>
            messages
                .slice(1)
                .map((m) => ({ role: m.isUser ? ('user' as const) : ('assistant' as const), content: m.content })),
        [messages]
    );

    const aiDisabled = statusQuery.isSuccess && !statusQuery.data.enabled;
    const aiUnavailable = statusQuery.isError;

    const handleSendQuestion = async (question: string) => {
        const trimmed = question.trim();
        if (!trimmed || !patientId || isLoading) return;
        const now = new Date().toISOString();
        setMessages((prev) => [...prev, { content: trimmed, isUser: true, createdAt: now }]);
        setInputValue('');
        setIsLoading(true);
        try {
            const res = await askAboutPatient({ patientId, query: trimmed, history });
            setMessages((prev) => [...prev, { content: res.content, isUser: false, createdAt: new Date().toISOString() }]);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to get a response. Please try again.';
            setMessages((prev) => [...prev, { content: msg, isUser: false, createdAt: new Date().toISOString() }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickQuestion = (question: string) => {
        void handleSendQuestion(question);
        setQuickQuestionsOpen(false);
    };

    const patientLabel = patientQuery.data
        ? `${patientQuery.data.fullName}${patientQuery.data.mrn ? ` · MRN ${patientQuery.data.mrn}` : ''}`
        : patientId
          ? 'Loading patient…'
          : 'No patient selected';

    const inputDisabled = isLoading || !patientId || aiDisabled || aiUnavailable;

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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#97704f]">
                        <IconSparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white md:text-xl">Chart assistant</h1>
                        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{patientLabel}</p>
                    </div>
                    {patientId ? (
                        <Link
                            to={`/app/facesheet/${encodeURIComponent(patientId)}/demographic`}
                            className="text-sm font-semibold text-primary hover:underline"
                        >
                            Open chart
                        </Link>
                    ) : null}
                </div>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                    {statusQuery.data?.disclaimer ?? 'AI-generated content. Verify against the medical record before clinical use.'}
                </p>
            </div>

            {!patientId ? (
                <div className="mx-2 mb-2 rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 md:mx-0">
                    <p>Open a patient chart and use the sparkle button in the header, or pick a patient from the list.</p>
                    <Link to="/app/patients/list" className="mt-3 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                        Go to patient list
                    </Link>
                </div>
            ) : aiDisabled || aiUnavailable ? (
                <div
                    role="alert"
                    className="mx-2 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100 md:mx-0"
                >
                    {aiUnavailable
                        ? 'The AI assistant is not available for your account or organisation.'
                        : 'The AI assistant is not configured for this environment. Ask your administrator to set the AI provider key.'}
                </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-white-light bg-white shadow-sm dark:border-dark dark:bg-black md:flex-row md:rounded-xl">
                <div className="order-1 flex min-h-0 flex-1 flex-col overflow-hidden px-2 md:order-2 md:px-0">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <ChatMessages messages={messages} isLoading={isLoading} />
                    </div>
                    <div className="sticky bottom-0 z-10 shrink-0 bg-white dark:bg-black">
                        <ChatInput
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={() => void handleSendQuestion(inputValue)}
                            disabled={inputDisabled}
                            placeholder={patientId ? 'Ask about what is documented for this patient…' : 'Select a patient first'}
                        />
                    </div>
                </div>

                <aside className="order-2 flex w-full shrink-0 flex-col overflow-hidden border-t border-white-light bg-gray-50/50 dark:border-dark dark:bg-dark/20 md:order-1 md:h-full md:w-64 md:min-h-0 md:border-r md:border-t-0">
                    <div className="hidden min-h-0 w-full flex-col overflow-hidden md:flex md:h-full">
                        <QuickQuestions onSelectQuestion={(q) => void handleSendQuestion(q)} disabled={inputDisabled} />
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
                                    aria-label="Quick questions"
                                >
                                    <div className="flex shrink-0 items-center justify-between border-b p-3">
                                        <span className="text-sm font-semibold">Quick Questions</span>
                                        <button type="button" onClick={() => setQuickQuestionsOpen(false)} className="text-sm font-medium text-gray-500">
                                            ✕
                                        </button>
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-4">
                                        <QuickQuestions onSelectQuestion={handleQuickQuestion} disabled={inputDisabled} hideHeader />
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
