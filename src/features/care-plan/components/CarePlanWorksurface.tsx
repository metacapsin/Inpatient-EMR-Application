import { CarePlanHeader } from './CarePlanHeader';
import { CarePlanSuggestionsBanner } from './CarePlanSuggestionsBanner';
import { CarePlanDiagnosisList } from './CarePlanDiagnosisList';
import { CarePlanDetailTabs } from './CarePlanDetailTabs';
import { CarePlanFooter } from './CarePlanFooter';
import { CARE_PLAN_SURFACE_CLASS } from '../constants/carePlanLayout';

type CarePlanWorksurfaceProps = {
    patientName: string;
    mrn: string;
    encounterLabel: string;
};

export function CarePlanWorksurface({ patientName, mrn, encounterLabel }: CarePlanWorksurfaceProps) {
    return (
        <div className={CARE_PLAN_SURFACE_CLASS}>
            <CarePlanHeader patientName={patientName} mrn={mrn} encounterLabel={encounterLabel} />
            <CarePlanSuggestionsBanner />
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <CarePlanDiagnosisList />
                <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-[#0f0d0b]">
                    <CarePlanDetailTabs />
                </main>
            </div>
            <CarePlanFooter />
        </div>
    );
}
