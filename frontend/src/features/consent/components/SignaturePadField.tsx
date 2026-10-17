import { useCallback, useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

type Props = {
    label: string;
    value: string;
    onChange: (dataUrl: string) => void;
    error?: string;
    disabled?: boolean;
    /** Inside ConsentSignatureFrame — no duplicate label/border. */
    embedded?: boolean;
};

export function SignaturePadField({ label, value, onChange, error, disabled, embedded }: Props) {
    const padRef = useRef<SignatureCanvas | null>(null);
    const [history, setHistory] = useState<string[]>([]);

    const syncValue = useCallback(() => {
        const pad = padRef.current;
        if (!pad || pad.isEmpty()) {
            onChange('');
            return;
        }
        onChange(pad.toDataURL('image/png'));
    }, [onChange]);

    useEffect(() => {
        const pad = padRef.current;
        if (!pad || !value) return;
        if (pad.isEmpty() && value.startsWith('data:image')) {
            try {
                pad.fromDataURL(value);
            } catch {
                /* ignore invalid restore */
            }
        }
    }, [value]);

    const pushHistory = () => {
        const pad = padRef.current;
        if (!pad || pad.isEmpty()) return;
        setHistory((h) => [...h.slice(-8), pad.toDataURL('image/png')]);
    };

    const handleClear = () => {
        padRef.current?.clear();
        setHistory([]);
        onChange('');
    };

    const handleUndo = () => {
        const pad = padRef.current;
        if (!pad) return;
        setHistory((h) => {
            const next = [...h];
            const prev = next.pop();
            pad.clear();
            if (prev) {
                try {
                    pad.fromDataURL(prev);
                    onChange(prev);
                } catch {
                    onChange('');
                }
            } else {
                onChange('');
            }
            return next;
        });
    };

    const pad = (
            <div
                className={cn(
                    'relative overflow-hidden bg-white dark:bg-[#1a1816]',
                    !embedded && 'rounded-lg border',
                    error && !embedded ? 'border-red-400 dark:border-red-600' : !embedded && 'border-gray-200 dark:border-white/10',
                    disabled && 'pointer-events-none opacity-60',
                )}
            >
                <SignatureCanvas
                    ref={padRef}
                    penColor="#1a1a1a"
                    canvasProps={{
                        className: 'h-28 w-full touch-none sm:h-32',
                        'aria-label': label,
                    }}
                    onBegin={pushHistory}
                    onEnd={syncValue}
                />
                <div className="flex gap-1 border-t border-gray-100 bg-gray-50/90 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
                    <button
                        type="button"
                        onClick={handleUndo}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-white/10"
                    >
                        <Undo2 className="h-3 w-3" aria-hidden />
                        Undo
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-white/10"
                    >
                        <Eraser className="h-3 w-3" aria-hidden />
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            pushHistory();
                            handleClear();
                        }}
                        className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-white/10"
                    >
                        <RotateCcw className="h-3 w-3" aria-hidden />
                        Reset
                    </button>
                </div>
            </div>
    );

    if (embedded) return pad;

    return (
        <div className="space-y-1.5">
            {label ? (
                <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                    {label}
                </label>
            ) : null}
            {pad}
            {error ? (
                <p className="text-[11px] font-medium text-primary-700 dark:text-primary-300" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
