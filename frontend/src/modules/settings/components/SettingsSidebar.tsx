import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
    SETTINGS_NAV_ITEMS,
    type SettingsNavId,
} from '../config/settingsNav.config';
import {
    settingsNavItemActiveClass,
    settingsNavItemClass,
    settingsSidebarClass,
    settingsSidebarLabelClass,
} from '../../../styles/settingsPageClasses';

interface SettingsSidebarProps {
    activeId: SettingsNavId;
    onNavigate: (id: SettingsNavId) => void;
}

export function SettingsSidebar({ activeId, onNavigate }: SettingsSidebarProps) {
    const [search, setSearch] = useState('');

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return SETTINGS_NAV_ITEMS;
        return SETTINGS_NAV_ITEMS.filter(
            (item) =>
                item.label.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q)
        );
    }, [search]);

    return (
        <aside className={settingsSidebarClass} aria-label="Settings navigation">
            <div className="flex h-full flex-col px-3 py-4 sm:px-3.5 lg:py-5">
                <p className={settingsSidebarLabelClass}>Settings</p>

                <div className="relative mt-3">
                    <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emr-muted/80 dark:text-gray-500"
                        aria-hidden
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search settings…"
                        className="w-full rounded-lg border border-emr-border/80 bg-white py-2 pl-8 pr-2.5 text-[12px] text-emr-text shadow-sm outline-none transition placeholder:text-emr-muted/70 focus:border-primary/35 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-primary/40"
                        aria-label="Search settings"
                    />
                </div>

                <nav className="mt-4 flex flex-1 flex-col gap-0.5 lg:mt-5" aria-label="Settings modules">
                    {filteredItems.length === 0 ? (
                        <p className="px-2.5 py-2 text-[12px] text-emr-muted dark:text-gray-500">
                            No matching settings.
                        </p>
                    ) : (
                        filteredItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeId === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onNavigate(item.id)}
                                    className={`${settingsNavItemClass} ${isActive ? settingsNavItemActiveClass : ''}`}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                            isActive
                                                ? 'border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/20'
                                                : 'border-emr-border/70 bg-white text-emr-muted group-hover:border-primary/15 group-hover:text-primary dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-400'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate leading-tight">{item.label}</span>
                                        <span className="mt-0.5 block truncate text-[11px] font-normal text-emr-muted/90 dark:text-gray-500">
                                            {item.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })
                    )}
                </nav>
            </div>
        </aside>
    );
}
