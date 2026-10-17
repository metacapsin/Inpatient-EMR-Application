/**
 * Websocket-ready unit broadcast for code activation.
 * Falls back to no-op when sockets are unavailable; callers may poll active events instead.
 */

export type CodeEventBroadcastMessage = {
    type: 'code_event_activated';
    eventId: string;
    unitId: string;
    eventType: string;
    location: string;
    patientId: string;
};

type Listener = (msg: CodeEventBroadcastMessage) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;

export function subscribeCodeEventBroadcast(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function emit(msg: CodeEventBroadcastMessage): void {
    listeners.forEach((fn) => {
        try {
            fn(msg);
        } catch {
            /* ignore listener errors */
        }
    });
}

/** Connect when VITE_CODE_EVENT_WS_URL is set; otherwise polling/mock only */
export function connectCodeEventWebSocket(unitId: string): void {
    const url = import.meta.env.VITE_CODE_EVENT_WS_URL as string | undefined;
    if (!url?.trim()) return;
    try {
        socket?.close();
        socket = new WebSocket(`${url.replace(/\/$/, '')}?unitId=${encodeURIComponent(unitId)}`);
        socket.onmessage = (ev) => {
            try {
                const data = JSON.parse(String(ev.data)) as CodeEventBroadcastMessage;
                if (data?.type === 'code_event_activated') emit(data);
            } catch {
                /* ignore parse errors */
            }
        };
    } catch {
        socket = null;
    }
}

export function disconnectCodeEventWebSocket(): void {
    socket?.close();
    socket = null;
}

/** Local + optional remote announce when activating an event */
export function announceCodeEventToUnit(msg: CodeEventBroadcastMessage): void {
    emit(msg);
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
    }
}
