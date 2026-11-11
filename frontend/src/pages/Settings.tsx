import { useState } from 'react';
import { SETTINGS_NAV_ITEMS, type SettingsNavId } from '../modules/settings/config/settingsNav.config';
import { SettingsSidebar } from '../modules/settings/components/SettingsSidebar';
import { SettingsBreadcrumb } from '../modules/settings/components/SettingsBreadcrumb';
import { FacilityManagementCard } from '../modules/settings/components/FacilityManagementCard';
import { PracticeInformationCard } from '../modules/settings/components/PracticeInformationCard';
import { PharmaciesCard } from '../modules/settings/components/PharmaciesCard';
import { CareNotificationsCard } from '../modules/settings/components/CareNotificationsCard';
import { ClinicalAlertsCard } from '../modules/settings/components/ClinicalAlertsCard';
import { ConnectedAppsCard } from '../modules/settings/components/ConnectedAppsCard';
import {
    settingsContentClass,
    settingsContentInnerClass,
    settingsWorkspaceClass,
} from '../styles/settingsPageClasses';

const Settings: React.FC = () => {
    const [activeId, setActiveId] = useState<SettingsNavId>('facility');
    const activeNav = SETTINGS_NAV_ITEMS.find((item) => item.id === activeId) ?? SETTINGS_NAV_ITEMS[0];

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
                </div>
            </div>
        </div>
    );
};

export default Settings;
