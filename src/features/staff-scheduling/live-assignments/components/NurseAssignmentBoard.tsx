import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useState } from 'react';
import type { NurseAssignmentRow } from '../../../../types/staffing.types';
import { NurseAssignmentCard } from './NurseAssignmentCard';
import { BedChip } from './BedChip';

interface NurseAssignmentBoardProps {
    nurses: NurseAssignmentRow[];
    saving?: boolean;
    onDragEnd: (activeId: string, overId: string | undefined) => void;
}

export function NurseAssignmentBoard({ nurses, saving, onDragEnd }: NurseAssignmentBoardProps) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [activeBed, setActiveBed] = useState<{ bed: NurseAssignmentRow['assignedBeds'][0]; nurseId: string } | null>(
        null
    );

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveBed(null);
        onDragEnd(String(event.active.id), event.over ? String(event.over.id) : undefined);
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={(e) => {
                const nurseId = (e.active.data.current as { nurseId?: string } | undefined)?.nurseId;
                const bedId = (e.active.data.current as { bedId?: string } | undefined)?.bedId;
                if (!nurseId || !bedId) return;
                const nurse = nurses.find((n) => n.nurseId === nurseId);
                const bed = nurse?.assignedBeds.find((b) => b.bedId === bedId);
                if (bed) setActiveBed({ bed, nurseId });
            }}
            onDragCancel={() => setActiveBed(null)}
            onDragEnd={handleDragEnd}
        >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {nurses.map((nurse) => (
                    <NurseAssignmentCard key={nurse.id} nurse={nurse} saving={saving} />
                ))}
            </div>
            <DragOverlay dropAnimation={null}>
                {activeBed ? <BedChip bed={activeBed.bed} nurseId={activeBed.nurseId} disabled /> : null}
            </DragOverlay>
        </DndContext>
    );
}
