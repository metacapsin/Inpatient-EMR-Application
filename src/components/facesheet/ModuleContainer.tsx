import type { PropsWithChildren } from 'react';
import { FacesheetModuleBreadcrumb } from './FacesheetModuleBreadcrumb';

/**
 * Facesheet module workspace: canvas padding + enterprise card.
 * Route content must fill remaining height (flex chain for TabView / flowsheet modules).
 */
export function ModuleContainer({ children }: PropsWithChildren) {
    return (
        <section className="facesheet-module-surface" aria-label="Clinical module">
            <div className="facesheet-module-canvas">
                <article className="facesheet-module-card">
                    <FacesheetModuleBreadcrumb />
                    <div className="facesheet-module-card-body">
                        <div className="facesheet-module-route">{children}</div>
                    </div>
                </article>
            </div>
        </section>
    );
}
