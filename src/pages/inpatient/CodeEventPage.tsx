import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useCodeEvent } from '../../features/code-event/hooks/useCodeEvent';
import { CodeEventLiveHeader } from '../../features/code-event/components/CodeEventLiveHeader';
import { CodeEventTimelinePanel } from '../../features/code-event/components/CodeEventTimelinePanel';
import { CodeCprTimerWidget } from '../../features/code-event/components/CodeCprTimerWidget';
import { CodeTeamMembersPanel } from '../../features/code-event/components/CodeTeamMembersPanel';
import { CodeCloseEventPanel } from '../../features/code-event/components/CodeCloseEventPanel';
import { CodeEventEmptyState } from '../../features/code-event/components/CodeEventEmptyState';
import AppButton from '../../components/ui/AppButton';

export default function CodeEventPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { event, loading, error, appendTimelineEntry, saveTeam, closeEvent, generateNote } = useCodeEvent(eventId);

    if (loading && !event) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading code event…</p>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="panel mx-auto max-w-lg p-6">
                <CodeEventEmptyState
                    title="Code event not found"
                    description={error instanceof Error ? error.message : 'This event may have been closed or removed.'}
                    action={
                        <AppButton type="button" onClick={() => navigate('/app/dashboard')}>
                            Return to IPD dashboard
                        </AppButton>
                    }
                />
            </div>
        );
    }

    const readOnly = event.status === 'closed';

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <CodeEventLiveHeader event={event} />

            <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
                    <div className="lg:col-span-7 xl:col-span-8">
                        <CodeEventTimelinePanel
                            timeline={event.timeline}
                            readOnly={readOnly}
                            onAddEntry={async (entry) => {
                                try {
                                    await appendTimelineEntry(entry);
                                    toast.success('Timeline updated');
                                } catch {
                                    toast.error('Could not save timeline entry');
                                }
                            }}
                        />
                    </div>
                    <div className="flex flex-col gap-3 lg:col-span-5 xl:col-span-4">
                        <CodeCprTimerWidget timeline={event.timeline} disabled={readOnly} />
                        <CodeTeamMembersPanel
                            teamMembers={event.teamMembers}
                            readOnly={readOnly}
                            onSave={async (members) => {
                                try {
                                    await saveTeam(members);
                                    toast.success('Team updated');
                                } catch {
                                    toast.error('Could not save team');
                                }
                            }}
                        />
                        <CodeCloseEventPanel
                            calledAt={event.calledAt}
                            readOnly={readOnly}
                            closed={readOnly}
                            initial={{
                                endTime: event.endTime ?? undefined,
                                outcome: event.outcome ?? undefined,
                                postEventDisposition: event.postEventDisposition ?? undefined,
                                debriefNotes: event.debriefNotes ?? undefined,
                            }}
                            onClose={async (payload) => {
                                await closeEvent(payload);
                            }}
                            onGenerateNote={generateNote}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
