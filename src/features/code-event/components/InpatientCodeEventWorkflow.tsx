import { useNavigate } from 'react-router-dom';
import { usePatientActiveCodeEvent } from '../hooks/usePatientActiveCodeEvent';
import { CodeActivateButton } from './CodeActivateButton';
import { CodeActivateModal, type CodeActivateContext } from './CodeActivateModal';
import { CodeEventTypeBadge } from './CodeEventTypeBadge';
import { useState } from 'react';
import { CODE_EVENT_SECTION_CARD_CLASS } from '../constants/codeEventLayout';
import AppButton from '../../../components/ui/AppButton';

type Props = {
    context: CodeActivateContext;
};

export function InpatientCodeEventWorkflow({ context }: Props) {
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const patientId = context.patientId ?? '';
    const { data: active, isLoading } = usePatientActiveCodeEvent(patientId);

    return (
        <div className={CODE_EVENT_SECTION_CARD_CLASS}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Code event workflow</h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Code Blue · Rapid Response · resuscitation timeline · team tracking
                    </p>
                </div>
                <CodeActivateButton label="Activate Code" onClick={() => setModalOpen(true)} />
            </div>

            {isLoading ? (
                <p className="mt-4 text-xs text-gray-500">Checking for active events…</p>
            ) : active ? (
                <div className="mt-4 rounded-lg border border-red-200/80 bg-red-50/80 p-4 dark:border-red-900/40 dark:bg-red-950/30">
                    <div className="flex flex-wrap items-center gap-2">
                        <CodeEventTypeBadge eventType={active.eventType} />
                        <span className="text-xs font-medium text-red-900 dark:text-red-100">{active.location}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                        Active event in progress · team lead {active.teamLeadName}
                    </p>
                    <AppButton type="button" className="mt-3" onClick={() => navigate(`/app/inpatient/code-event/${active.id}`)}>
                        Open code event workspace
                    </AppButton>
                </div>
            ) : (
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    No active code event for this patient. Use Activate Code to start documentation.
                </p>
            )}

            <CodeActivateModal
                open={modalOpen}
                context={context}
                onClose={() => setModalOpen(false)}
                onActivated={(id) => navigate(`/app/inpatient/code-event/${id}`)}
            />
        </div>
    );
}
