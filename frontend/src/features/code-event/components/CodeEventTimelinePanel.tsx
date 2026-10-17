import { useState } from 'react';
import type { CodeEventTimelineEntry } from '../../../types/codeEvent';
import { CODE_EVENT_SECTION_CARD_CLASS } from '../constants/codeEventLayout';
import { CodeEventTimelineFeed } from './CodeEventTimelineFeed';
import { CodeEventTimelineForm } from './CodeEventTimelineForm';

type Props = {
    timeline: CodeEventTimelineEntry[];
    onAddEntry: (entry: CodeEventTimelineEntry) => Promise<void>;
    readOnly?: boolean;
};

export function CodeEventTimelinePanel({ timeline, onAddEntry, readOnly }: Props) {
    const [busy, setBusy] = useState(false);

    return (
        <section className={CODE_EVENT_SECTION_CARD_CLASS}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Resuscitation timeline</h2>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">Chronological activity · rapid documentation</p>
            <div className="mt-4 max-h-[min(52vh,520px)] overflow-y-auto pr-1">
                <CodeEventTimelineFeed entries={timeline} />
            </div>
            {!readOnly ? (
                <CodeEventTimelineForm
                    busy={busy}
                    disabled={readOnly}
                    onSubmit={async (entry) => {
                        setBusy(true);
                        try {
                            await onAddEntry(entry);
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            ) : null}
        </section>
    );
}
