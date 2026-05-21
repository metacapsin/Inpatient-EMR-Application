import type { ReactNode } from 'react';
import {
    CARE_PLAN_MODAL_SECTION_CLASS,
    CARE_PLAN_MODAL_SECTION_HINT_CLASS,
    CARE_PLAN_MODAL_SECTION_TITLE_CLASS,
} from '../constants/carePlanLayout';

type CarePlanModalSectionProps = {
    title: string;
    hint?: string;
    children: ReactNode;
};

export function CarePlanModalSection({ title, hint, children }: CarePlanModalSectionProps) {
    return (
        <section className={CARE_PLAN_MODAL_SECTION_CLASS}>
            <div>
                <h3 className={CARE_PLAN_MODAL_SECTION_TITLE_CLASS}>{title}</h3>
                {hint ? <p className={`mt-1 ${CARE_PLAN_MODAL_SECTION_HINT_CLASS}`}>{hint}</p> : null}
            </div>
            {children}
        </section>
    );
}
