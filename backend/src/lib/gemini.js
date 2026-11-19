import { config } from '../config.js';
import { ApiError } from './http.js';

/**
 * Server-side Google Gemini client (REST `generateContent`). The API key never leaves the backend.
 * Disabled (every call throws 503 AI_DISABLED) when GEMINI_API_KEY is unset, and always stubbed
 * under NODE_ENV=test unless AI_TEST_LIVE=1 so the suite never calls Google.
 */
const BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');

export function isAiEnabled() {
    if (!config.ai.apiKey) return false;
    if (config.env === 'test' && process.env.AI_TEST_LIVE !== '1') return false;
    return true;
}

/** Test seam: when set, replaces the HTTP call (returns the text the model would have produced). */
let stubResponder = null;
export function __setGeminiStubForTests(fn) {
    stubResponder = fn;
}

/**
 * @param {{ system: string, user: string, json?: boolean, maxOutputTokens?: number, temperature?: number, history?: {role:'user'|'model', text:string}[] }} opts
 * @returns {Promise<{ text: string, model: string, usage: { promptTokens: number, outputTokens: number } }>}
 */
export async function generateText(opts) {
    const model = config.ai.model;
    if (stubResponder) {
        const text = await stubResponder(opts);
        return { text, model: `stub:${model}`, usage: { promptTokens: 0, outputTokens: 0 } };
    }
    if (!isAiEnabled()) throw new ApiError(503, 'AI features are not configured for this environment', undefined, 'AI_DISABLED');

    const contents = [];
    for (const turn of opts.history ?? []) {
        if (!turn?.text?.trim()) continue;
        contents.push({ role: turn.role === 'model' ? 'model' : 'user', parts: [{ text: turn.text }] });
    }
    contents.push({ role: 'user', parts: [{ text: opts.user }] });

    const body = {
        systemInstruction: { parts: [{ text: opts.system }] },
        contents,
        generationConfig: {
            temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
            maxOutputTokens: opts.maxOutputTokens ?? 1024,
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        },
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.ai.timeoutMs);
    let res;
    try {
        res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.apiKey },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
    } catch (e) {
        clearTimeout(timer);
        if (e?.name === 'AbortError') throw new ApiError(504, 'AI request timed out', undefined, 'AI_TIMEOUT');
        throw new ApiError(502, 'AI provider unreachable', undefined, 'AI_UNREACHABLE');
    }
    clearTimeout(timer);

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = payload?.error?.message || `AI provider error (${res.status})`;
        // Never forward the key or raw provider payloads to clients; log a short line without PHI.
        console.error(`[gemini] ${res.status} ${msg.slice(0, 200)}`);
        throw new ApiError(502, 'AI provider error', undefined, 'AI_PROVIDER_ERROR');
    }
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
    if (!text) {
        const reason = payload?.candidates?.[0]?.finishReason || payload?.promptFeedback?.blockReason || 'empty';
        throw new ApiError(502, `AI returned no content (${reason})`, undefined, 'AI_EMPTY');
    }
    return {
        text,
        model,
        usage: {
            promptTokens: Number(payload?.usageMetadata?.promptTokenCount ?? 0),
            outputTokens: Number(payload?.usageMetadata?.candidatesTokenCount ?? 0),
        },
    };
}

/** Strip ```json fences and parse; throws 502 AI_BAD_JSON on failure. */
export function parseJsonText(text) {
    let t = text.trim();
    if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
        return JSON.parse(t);
    } catch {
        throw new ApiError(502, 'AI returned malformed JSON', undefined, 'AI_BAD_JSON');
    }
}
