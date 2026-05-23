import { useCallback, useRef } from 'react';
import { Bold, Italic, List, Underline } from 'lucide-react';

type Props = {
    value: string;
    onChange: (html: string) => void;
    disabled?: boolean;
};

export function DenialRichTextEditor({ value, onChange, disabled }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    const exec = useCallback(
        (command: string) => {
            if (disabled) return;
            document.execCommand(command, false);
            if (ref.current) onChange(ref.current.innerHTML);
        },
        [disabled, onChange]
    );

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
                {[
                    { cmd: 'bold', icon: Bold, label: 'Bold' },
                    { cmd: 'italic', icon: Italic, label: 'Italic' },
                    { cmd: 'underline', icon: Underline, label: 'Underline' },
                    { cmd: 'insertUnorderedList', icon: List, label: 'Bullet list' },
                ].map(({ cmd, icon: Icon, label }) => (
                    <button
                        key={cmd}
                        type="button"
                        disabled={disabled}
                        title={label}
                        onClick={() => exec(cmd)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.06]"
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                    </button>
                ))}
            </div>
            <div
                ref={ref}
                contentEditable={!disabled}
                suppressContentEditableWarning
                className="min-h-[120px] rounded-b-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-white/10 dark:bg-[#161412] dark:text-gray-100"
                dangerouslySetInnerHTML={{ __html: value }}
                onInput={() => {
                    if (ref.current) onChange(ref.current.innerHTML);
                }}
            />
        </div>
    );
}
