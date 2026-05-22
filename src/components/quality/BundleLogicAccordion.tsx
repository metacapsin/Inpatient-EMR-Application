import { memo } from 'react';
import { BookOpen } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { BUNDLE_LOGIC_SECTIONS } from '../../constants/quality/bundleRules';
import { qmModuleDescClass, qmModuleTitleClass, qmRulesHeaderClass, qmRulesModuleClass } from '../../styles/qualityDashboardClasses';

function BundleLogicAccordionInner() {
    return (
        <section className={qmRulesModuleClass} aria-labelledby="bundle-logic-heading">
            <div className={qmRulesHeaderClass}>
                <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
                <h2 id="bundle-logic-heading" className={qmModuleTitleClass}>
                    Bundle criteria
                </h2>
                <span className={qmModuleDescClass}>· 4h rule engine</span>
            </div>
            <Accordion type="multiple" className="px-2 pb-1" defaultValue={[]}>
                {BUNDLE_LOGIC_SECTIONS.map((section) => (
                    <AccordionItem
                        key={section.id}
                        value={section.id}
                        className="border-emr-border/60 dark:border-white/10"
                    >
                        <AccordionTrigger className="py-2 text-xs font-semibold text-emr-text hover:no-underline dark:text-gray-200">
                            {section.title}
                        </AccordionTrigger>
                        <AccordionContent>
                            <ul className="space-y-1 pb-1.5" role="list">
                                {section.rules.map((rule, i) => (
                                    <li
                                        key={i}
                                        className="flex gap-1.5 text-[11px] leading-snug text-emr-muted dark:text-gray-400"
                                    >
                                        <span
                                            className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary"
                                            aria-hidden
                                        />
                                        {rule}
                                    </li>
                                ))}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </section>
    );
}

export const BundleLogicAccordion = memo(BundleLogicAccordionInner);
