import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CodeActivateButton } from './CodeActivateButton';
import { CodeActivateModal, type CodeActivateContext } from './CodeActivateModal';
import { usePatientActiveCodeEvent } from '../hooks/usePatientActiveCodeEvent';

type Props = {
    context: CodeActivateContext;
    size?: 'sm' | 'md';
};

/** Compact emergency control for patient chart headers */
export function CodeHeaderButton({ context, size = 'sm' }: Props) {
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const patientId = context.patientId ?? '';
    const activeQuery = usePatientActiveCodeEvent(patientId);

    const activeId = activeQuery.data?.id;

    function handleClick() {
        if (activeId) {
            navigate(`/app/inpatient/code-event/${activeId}`);
            return;
        }
        setModalOpen(true);
    }

    return (
        <>
            <CodeActivateButton
                size={size}
                label={activeId ? 'Active code' : 'Code'}
                onClick={handleClick}
            />
            <CodeActivateModal
                open={modalOpen}
                context={context}
                onClose={() => setModalOpen(false)}
                onActivated={(id) => navigate(`/app/inpatient/code-event/${id}`)}
            />
        </>
    );
}
