import AppButton from '@/components/ui/AppButton';
import { CarePlanHeader } from './CarePlanHeader';
import { CarePlanSuggestionsBanner } from './CarePlanSuggestionsBanner';
import { CarePlanDiagnosisList } from './CarePlanDiagnosisList';
import { CarePlanDetailTabs } from './CarePlanDetailTabs';
import { CarePlanFooter } from './CarePlanFooter';
import { InfectionMonitoringBanner } from './InfectionMonitoringBanner';
import { useCarePlan } from '../state/CarePlanContext';

type CarePlanWorksurfaceProps = {
    patientName: string;
    mrn: string;
    encounterLabel: string;
};

export function CarePlanWorksurface({ patientName, mrn, encounterLabel }: CarePlanWorksurfaceProps) {
    const { savePlan, saveState } = useCarePlan();

    return (
        <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200/80 bg-white p-0 shadow-none dark:border-gray-700/80 dark:bg-[#0c0a08]/40">
            <CarePlanHeader patientName={patientName} mrn={mrn} encounterLabel={encounterLabel} />
            <InfectionMonitoringBanner />
            <CarePlanSuggestionsBanner />
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <CarePlanDiagnosisList />
                <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-[#0f0d0b]">
                    <CarePlanDetailTabs />
                </main>
            </div>
            <CarePlanFooter />
            {saveState === 'dirty' ? (
                <div className="fixed bottom-20 right-4 z-30 hidden sm:block">
                    <AppButton type="button" className="!text-xs" onClick={() => void savePlan()}>
                        Save changes
                    </AppButton>
                </div>
            ) : null}
        </div>
    );
}
