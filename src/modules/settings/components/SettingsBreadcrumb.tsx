import { Link } from 'react-router-dom';

interface SettingsBreadcrumbProps {
    currentLabel: string;
}

export function SettingsBreadcrumb({ currentLabel }: SettingsBreadcrumbProps) {
    return (
        <nav
            aria-label="Breadcrumb"
            className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] sm:mb-4"
        >
            <Link
                to="/app/dashboard"
                className="font-medium text-emr-muted transition-colors hover:text-primary dark:text-gray-400"
            >
                Dashboard
            </Link>
            <span className="text-emr-muted/50 dark:text-gray-600" aria-hidden>
                /
            </span>
            <span className="font-medium text-emr-muted dark:text-gray-400">Settings</span>
            <span className="text-emr-muted/50 dark:text-gray-600" aria-hidden>
                /
            </span>
            <span className="font-semibold text-emr-text dark:text-gray-200">{currentLabel}</span>
        </nav>
    );
}
