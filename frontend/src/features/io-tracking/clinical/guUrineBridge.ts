export const GU_URINE_IO_EVENT = 'mdcare:gu-urine-output';

export interface GuUrineIoDetail {
    encounterId: string;
    patientId: string;
    urineOutputLast4hMl: number;
    urineColor?: string;
    foleyPresent?: boolean;
}

export function emitGuUrineOutputUpdate(detail: GuUrineIoDetail): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(GU_URINE_IO_EVENT, { detail }));
}
