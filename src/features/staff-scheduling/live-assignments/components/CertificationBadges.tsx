import type { StaffingCertification } from '../../../../types/staffing.types';

const CERT_STYLES: Record<StaffingCertification, string> = {
    ACLS: 'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100',
    BLS: 'border-gray-200/80 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200',
    TNCC: 'border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-100',
    CCRN: 'border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100',
};

interface CertificationBadgesProps {
    certifications: StaffingCertification[];
    maxVisible?: number;
}

export function CertificationBadges({ certifications, maxVisible = 4 }: CertificationBadgesProps) {
    if (certifications.length === 0) return null;
    const visible = certifications.slice(0, maxVisible);
    const hidden = certifications.length - visible.length;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visible.map((cert) => (
                <span
                    key={cert}
                    className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${CERT_STYLES[cert]}`}
                >
                    {cert}
                </span>
            ))}
            {hidden > 0 ? (
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">+{hidden}</span>
            ) : null}
        </div>
    );
}
