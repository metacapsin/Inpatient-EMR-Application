import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SETTINGS_NAV_ITEMS, type SettingsNavId } from '../modules/settings/config/settingsNav.config';
import { SettingsSidebar } from '../modules/settings/components/SettingsSidebar';
import { SettingsBreadcrumb } from '../modules/settings/components/SettingsBreadcrumb';
import { FacilityManagementCard } from '../modules/settings/components/FacilityManagementCard';
import { PracticeInformationCard } from '../modules/settings/components/PracticeInformationCard';
import { PharmaciesCard } from '../modules/settings/components/PharmaciesCard';
import { CareNotificationsCard } from '../modules/settings/components/CareNotificationsCard';
import { ClinicalAlertsCard } from '../modules/settings/components/ClinicalAlertsCard';
import { ConnectedAppsCard } from '../modules/settings/components/ConnectedAppsCard';
import { AuditTrailCard } from '../modules/settings/components/AuditTrailCard';
import { SecurityCard } from '../modules/settings/components/SecurityCard';
import {
    settingsContentClass,
    settingsContentInnerClass,
    settingsWorkspaceClass,
} from '../styles/settingsPageClasses';

const NAV_IDS = new Set(SETTINGS_NAV_ITEMS.map((item) => item.id));

const Settings: React.FC = () => {
    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const initialId = tabParam && NAV_IDS.has(tabParam as SettingsNavId) ? (tabParam as SettingsNavId) : 'facility';
    const [activeId, setActiveId] = useState<SettingsNavId>(initialId);
    const activeNav = SETTINGS_NAV_ITEMS.find((item) => item.id === activeId) ?? SETTINGS_NAV_ITEMS[0];
    const patientIdParam = searchParams.get('patientId') ?? undefined;

    return (
        <div className={settingsWorkspaceClass}>
            <SettingsSidebar activeId={activeId} onNavigate={setActiveId} />

            <div className={settingsContentClass}>
                <div className={settingsContentInnerClass}>
                    <SettingsBreadcrumb currentLabel={activeNav.label} />

                    {activeId === 'facility' ? <FacilityManagementCard /> : null}
                    {activeId === 'practice' ? <PracticeInformationCard /> : null}
                    {activeId === 'pharmacies' ? <PharmaciesCard /> : null}
                    {activeId === 'careNotifications' ? <CareNotificationsCard /> : null}
                    {activeId === 'clinicalAlerts' ? <ClinicalAlertsCard /> : null}
                    {activeId === 'connectedApps' ? <ConnectedAppsCard /> : null}
                    {activeId === 'auditTrail' ? <AuditTrailCard initialPatientId={patientIdParam} /> : null}
                    {activeId === 'security' ? <SecurityCard /> : null}
                </div>
            </div>
        </div>
    );
};

export default Settings;
