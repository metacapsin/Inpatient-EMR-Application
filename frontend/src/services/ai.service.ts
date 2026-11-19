import api from './api';
import type { MedicationExplanation, ParsedMedicationData } from '../types/medication';
import { getApiErrorMessage } from '../lib/httpError';

/**
 * Server-side AI assistant. All model calls go through the backend (`/api/ai/*`), which holds the
 * provider key, minimises patient context, rate-limits per user and writes an audit row.
 */

export interface AiStatus {
    enabled: boolean;
    model: string;
    disclaimer: string;
}

export interface AiChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

export interface AiChatResponse {
    content: string;
    disclaimer: string;
    model: string;
}

export type MedicationExplanationResult = MedicationExplanation & { disclaimer: string; model: string };

function unwrap<T>(data: unknown): T {
    const o = data as { status?: string; data?: T; message?: string } | null;
    if (o && o.status === 'success' && o.data !== undefined) return o.data;
    throw new Error((o && o.message) || 'Unexpected AI response');
}

export async function getAiStatus(): Promise<AiStatus> {
    const { data } = await api.get<unknown>('/api/ai/status');
    return unwrap<AiStatus>(data);
}

export async function explainMedication(med: ParsedMedicationData, patientId?: string): Promise<MedicationExplanationResult> {
    try {
        const { data } = await api.post<unknown>('/api/ai/medication-explanation', {
            ...(patientId ? { patientId } : {}),
            brandName: med.brandName,
            genericName: med.genericName,
            description: med.description,
            strength: med.strength,
            route: med.route,
            type: med.type,
            doseInstruction: med.doseInstruction,
            frequency: med.frequency,
            duration: med.duration,
            quantity: med.quantity,
            refills: med.refills,
        });
        return unwrap<MedicationExplanationResult>(data);
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to generate medication explanation'));
    }
}

export async function askAboutPatient(args: { patientId: string; query: string; history?: AiChatTurn[] }): Promise<AiChatResponse> {
    try {
        const { data } = await api.post<{ status: string; content?: string; message?: { content?: string }; disclaimer?: string; model?: string }>(
            '/api/ai/chatbot',
            { patientId: args.patientId, query: args.query, history: (args.history ?? []).slice(-10) },
        );
        const content = data?.content ?? data?.message?.content ?? '';
        if (!content) throw new Error('AI returned no answer');
        return { content, disclaimer: data.disclaimer ?? '', model: data.model ?? '' };
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to get a response from the AI assistant'));
    }
}
