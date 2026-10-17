import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { RadiologyOrder } from '../types/radiologyOrder.types';
import { resolveOrderId } from '../utils/radiologyMappers';
import { RADIOLOGY_SECTION_CARD_CLASS } from '../constants/radiologyLayout';
import AppButton from '../../../components/ui/AppButton';
import { RadiologyEmptyState } from './RadiologyEmptyState';

type ImageViewerTabProps = {
    orders: RadiologyOrder[];
};

export function ImageViewerTab({ orders }: ImageViewerTabProps) {
    const withViewer = useMemo(
        () => orders.filter((o) => o.dicomViewerUrl?.trim()),
        [orders]
    );
    const [selectedId, setSelectedId] = useState('');

    const selected = useMemo(() => {
        if (!withViewer.length) return null;
        const id = selectedId || resolveOrderId(withViewer[0]);
        return withViewer.find((o) => resolveOrderId(o) === id) ?? withViewer[0];
    }, [withViewer, selectedId]);

    const url = selected?.dicomViewerUrl?.trim() ?? '';

    if (!withViewer.length) {
        return (
            <RadiologyEmptyState
                title="No images available to view"
                description="DICOM viewer links appear after a study is performed and a PACS URL is associated with the imaging order."
            />
        );
    }

    const openExternal = () => {
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2 py-1.5 lg:px-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <select
                    value={selected ? resolveOrderId(selected) : ''}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="h-9 min-w-[12rem] flex-1 rounded-lg border border-gray-200/80 bg-white px-2 text-xs dark:border-white/10 dark:bg-[#1a1816]"
                    aria-label="Select study for viewer"
                >
                    {withViewer.map((o) => (
                        <option key={resolveOrderId(o)} value={resolveOrderId(o)}>
                            {o.modality} — {o.bodyRegion}
                        </option>
                    ))}
                </select>
                <AppButton type="button" onClick={openExternal} className="!px-3 !py-1.5 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Open in new window
                </AppButton>
            </div>

            <div className={`flex min-h-[360px] flex-1 flex-col overflow-hidden ${RADIOLOGY_SECTION_CARD_CLASS} bg-black/5 dark:bg-black/30`}>
                {url ? (
                    <iframe
                        title="DICOM viewer"
                        src={url}
                        className="h-full min-h-[360px] w-full flex-1 border-0"
                        allow="fullscreen"
                    />
                ) : null}
            </div>
        </div>
    );
}
