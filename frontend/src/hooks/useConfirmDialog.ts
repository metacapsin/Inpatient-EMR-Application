import { useCallback, useState } from 'react';
import type { ConfirmVariant } from '../components/shared/ConfirmDialog';

export type ConfirmRequest = {
    title: string;
    message: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
};

type Pending = ConfirmRequest & {
    resolve: (ok: boolean) => void;
};

/**
 * Imperative confirm helper for any module:
 * `if (!(await confirm({ title, message }))) return;`
 */
export function useConfirmDialog() {
    const [pending, setPending] = useState<Pending | null>(null);
    const [busy, setBusy] = useState(false);

    const confirm = useCallback((req: ConfirmRequest) => {
        return new Promise<boolean>((resolve) => {
            setPending({ ...req, resolve });
        });
    }, []);

    const onCancel = useCallback(() => {
        pending?.resolve(false);
        setPending(null);
        setBusy(false);
    }, [pending]);

    const onConfirm = useCallback(() => {
        pending?.resolve(true);
        setPending(null);
    }, [pending]);

    return {
        confirm,
        busy,
        setBusy,
        dialogProps: {
            open: Boolean(pending),
            title: pending?.title ?? '',
            message: pending?.message ?? '',
            detail: pending?.detail,
            confirmLabel: pending?.confirmLabel,
            cancelLabel: pending?.cancelLabel,
            variant: pending?.variant ?? ('danger' as ConfirmVariant),
            busy,
            onCancel,
            onConfirm,
        },
    };
}
