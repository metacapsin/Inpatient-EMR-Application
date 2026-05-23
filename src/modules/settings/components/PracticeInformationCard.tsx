import { forwardRef, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { practiceAPI, commonAPI } from '../../../services/api';
import {
    autoFormatEIN,
    autoFormatPhone,
    autoFormatZip,
    formatPhoneDisplay,
} from '../utils/practiceFormatters';
import { SettingsCardHeader } from './SettingsCardHeader';
import {
    settingsFieldLabelClass,
    settingsFieldValueClass,
    settingsGhostButtonClass,
    settingsSecondaryCardClass,
    settingsSectionLabelClass,
} from '../../../styles/settingsPageClasses';

interface PracticeField {
    label: string;
    value: string;
}

interface PracticeSection {
    title: string;
    fields: PracticeField[];
}

function buildSections(info: any): PracticeSection[] {
    const address = [info.address, info.address2, info.city].filter(Boolean).join(', ');

    return [
        {
            title: 'General',
            fields: [
                { label: 'Practice Name', value: info.name || '—' },
                { label: 'Practice Type', value: info.type || info.practiceType || 'Acute Care — Inpatient' },
            ],
        },
        {
            title: 'Contact',
            fields: [
                { label: 'Address', value: address || '—' },
                { label: 'Phone', value: formatPhoneDisplay(info.phone) },
                { label: 'Fax', value: info.fax ? formatPhoneDisplay(info.fax) : '—' },
            ],
        },
        {
            title: 'Identifiers',
            fields: [
                { label: 'NPI', value: info.groupNpi || '—' },
                { label: 'EIN', value: info.ein || '—' },
            ],
        },
        {
            title: 'Compliance',
            fields: [
                { label: 'State', value: info.state || '—' },
                { label: 'Zip', value: info.zip || '—' },
            ],
        },
    ];
}

function PracticeFieldGrid({ fields }: { fields: PracticeField[] }) {
    return (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map(({ label, value }) => (
                <div key={label} className="min-w-0">
                    <dt className={settingsFieldLabelClass}>{label}</dt>
                    <dd className={`${settingsFieldValueClass} mt-0.5 break-words`}>{value}</dd>
                </div>
            ))}
        </dl>
    );
}

export const PracticeInformationCard = forwardRef<HTMLElement>(function PracticeInformationCard(_, ref) {
    const [practiceInfo, setPracticeInfo] = useState<any>(null);
    const [practiceLoading, setPracticeLoading] = useState(true);
    const [practiceEdit, setPracticeEdit] = useState(false);
    const [practiceForm, setPracticeForm] = useState<any>({});
    const [practiceSaving, setPracticeSaving] = useState(false);
    const [practiceErrors, setPracticeErrors] = useState<any>({});
    const [states, setStates] = useState<any[]>([]);
    const [stateOpen, setStateOpen] = useState(false);
    const stateRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (stateRef.current && !stateRef.current.contains(e.target as Node)) setStateOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        practiceAPI
            .getList()
            .then((res) => {
                const list = res.data?.data ?? res.data ?? [];
                setPracticeInfo(list[0] ?? null);
            })
            .catch(() => {})
            .finally(() => setPracticeLoading(false));
    }, []);

    useEffect(() => {
        if (practiceEdit && practiceInfo?._id) {
            setPracticeErrors({});
            Promise.all([practiceAPI.getById(practiceInfo._id), commonAPI.getStates('US')])
                .then(([infoRes, statesRes]) => {
                    const detail = infoRes.data?.data ?? infoRes.data ?? practiceInfo;
                    setPracticeForm({
                        ...detail,
                        phone: detail.phone ? autoFormatPhone(detail.phone) : '',
                        fax: detail.fax ? autoFormatPhone(detail.fax) : '',
                    });
                    setStates(statesRes.data?.data ?? statesRes.data ?? []);
                })
                .catch(() => {
                    setPracticeForm({
                        ...practiceInfo,
                        phone: practiceInfo.phone ? autoFormatPhone(practiceInfo.phone) : '',
                        fax: practiceInfo.fax ? autoFormatPhone(practiceInfo.fax) : '',
                    });
                });
        }
    }, [practiceEdit, practiceInfo]);

    const handleFieldChange = (key: string, raw: string) => {
        let val = raw;
        if (key === 'phone' || key === 'fax') val = autoFormatPhone(raw);
        else if (key === 'zip') val = autoFormatZip(raw);
        else if (key === 'ein') val = autoFormatEIN(raw);
        else if (key === 'groupNpi') val = raw.replace(/\D/g, '').slice(0, 10);
        setPracticeForm((p: any) => ({ ...p, [key]: val }));
        if (practiceErrors[key]) setPracticeErrors((p: any) => ({ ...p, [key]: '' }));
    };

    const handlePracticeSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        const f = practiceForm;

        const namePattern = /^(?!\s)(?!.*\s$).+$/;
        const addressPattern = /^(?! )[A-Za-z0-9,.\/\-#]+(?: [A-Za-z0-9,.\/\-#]+)*(?<! )$/;
        const cityPattern = /^(?! )[A-Za-z.'\-]+(?: [A-Za-z.'\-]+)*(?<! )$/;
        const zipPattern = /^\d{5}(-\d{4})?$/;
        const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
        const einPattern = /^\d{2}-\d{7}$/;
        const npiPattern = /^[1-9]\d{9}$/;

        if (!f.name?.trim()) errs.name = 'Name is required.';
        else if (f.name.length < 3) errs.name = 'Name must be at least 3 characters.';
        else if (f.name.length > 35) errs.name = 'Name must be at most 35 characters.';
        else if (!namePattern.test(f.name)) errs.name = 'Name cannot have leading or trailing spaces.';

        if (!f.address?.trim()) errs.address = 'Address is required.';
        else if (f.address.length < 5) errs.address = 'Address must be at least 5 characters.';
        else if (f.address.length > 250) errs.address = 'Address must be at most 250 characters.';
        else if (!addressPattern.test(f.address))
            errs.address = 'Address: only alphanumeric and , . - # / allowed, no leading/trailing spaces.';

        if (f.address2?.trim()) {
            if (f.address2.length < 5) errs.address2 = 'Address 2 must be at least 5 characters.';
            else if (f.address2.length > 250) errs.address2 = 'Address 2 must be at most 250 characters.';
            else if (!addressPattern.test(f.address2))
                errs.address2 = 'Address 2: only alphanumeric and , . - # / allowed, no leading/trailing spaces.';
        }

        if (!f.city?.trim()) errs.city = 'City is required.';
        else if (f.city.length < 3) errs.city = 'City must be at least 3 characters.';
        else if (f.city.length > 50) errs.city = 'City must be at most 50 characters.';
        else if (!cityPattern.test(f.city))
            errs.city = "City: only letters, . ' - allowed, no leading/trailing spaces.";

        if (!f.state?.trim()) errs.state = 'State is required.';
        if (!f.zip?.trim()) errs.zip = 'Zip is required.';
        else if (!zipPattern.test(f.zip)) errs.zip = 'Zip must be 12345 or 12345-6789.';

        if (!f.phone?.trim()) errs.phone = 'Phone is required.';
        else {
            const digits = f.phone.replace(/\D/g, '');
            if (digits.length !== 10) errs.phone = 'Phone must be a valid 10-digit number.';
            else if (!phonePattern.test(f.phone)) errs.phone = 'Phone must be a valid 10-digit number.';
            else if (digits[0] === '0' || digits[0] === '1') errs.phone = 'Area code cannot start with 0 or 1.';
            else if (digits[3] === '0' || digits[3] === '1')
                errs.phone = 'Exchange code cannot start with 0 or 1.';
        }

        if (f.fax?.trim() && f.fax.length > 14) errs.fax = 'Fax must be at most 14 characters.';
        if (f.ein?.trim() && !einPattern.test(f.ein)) errs.ein = 'EIN must be in format 12-3456789.';
        if (f.groupNpi?.trim() && !npiPattern.test(f.groupNpi))
            errs.groupNpi = 'NPI must be exactly 10 digits, first digit 1-9.';

        if (Object.keys(errs).length) {
            setPracticeErrors(errs);
            return;
        }

        setPracticeSaving(true);
        try {
            const res = await practiceAPI.update(practiceInfo._id, practiceForm);
            const updated = res.data?.data ?? res.data ?? practiceForm;
            setPracticeInfo({ ...practiceForm, ...updated });
            setPracticeEdit(false);
            toast.success('Practice information updated successfully.');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update practice information.');
        } finally {
            setPracticeSaving(false);
        }
    };

    const sections = practiceInfo ? buildSections(practiceInfo) : [];

    return (
        <section
            ref={ref}
            id="settings-practice"
            className={settingsSecondaryCardClass}
            aria-labelledby="practice-information-heading"
        >
            <SettingsCardHeader
                title="Practice Information"
                description="Organization profile, contact details, and regulatory identifiers."
                actions={
                    !practiceEdit && practiceInfo ? (
                        <button
                            type="button"
                            onClick={() => setPracticeEdit(true)}
                            className={settingsGhostButtonClass}
                        >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                        </button>
                    ) : practiceEdit ? (
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="submit"
                                form="practice-form"
                                disabled={practiceSaving}
                                className={settingsGhostButtonClass}
                            >
                                {practiceSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPracticeEdit(false)}
                                className="inline-flex items-center rounded-lg border border-emr-border/90 bg-white px-3 py-1.5 text-[12px] font-semibold text-emr-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-[#1c1916] dark:hover:border-red-900/40 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : null
                }
            />
            <h2 id="practice-information-heading" className="sr-only">
                Practice Information
            </h2>

            <div className="px-4 py-4 sm:px-5 sm:py-5">
                {practiceLoading ? (
                    <div className="space-y-4">
                        <div className="h-4 w-32 animate-pulse rounded bg-emr-border/50 dark:bg-white/10" />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="h-3 w-20 animate-pulse rounded bg-emr-border/40 dark:bg-white/10" />
                                    <div className="h-4 w-full animate-pulse rounded bg-emr-border/50 dark:bg-white/10" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : !practiceEdit ? (
                    practiceInfo ? (
                        <div className="space-y-5">
                            {sections.map((section, index) => (
                                <div key={section.title}>
                                    {index > 0 ? (
                                        <hr className="mb-5 border-emr-border/60 dark:border-white/[0.06]" />
                                    ) : null}
                                    <p className={`${settingsSectionLabelClass} mb-3`}>{section.title}</p>
                                    <PracticeFieldGrid fields={section.fields} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[13px] text-emr-muted dark:text-gray-400">
                            No practice information found.
                        </p>
                    )
                ) : (
                    <form id="practice-form" onSubmit={handlePracticeSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {(
                            [
                                { label: 'Practice Name', key: 'name', required: true },
                                { label: 'Address', key: 'address', required: true },
                                { label: 'Address 2', key: 'address2' },
                                { label: 'City', key: 'city', required: true },
                            ] as { label: string; key: string; required?: boolean }[]
                        ).map(({ label, key, required }) => (
                            <div key={key}>
                                <label className="mb-1 block text-[12px] font-semibold text-emr-muted dark:text-gray-400">
                                    {label} {required ? <span className="text-red-600">*</span> : null}
                                </label>
                                <input
                                    className={`form-input w-full text-[13px] ${practiceErrors[key] ? 'border-red-500' : ''}`}
                                    value={practiceForm[key] ?? ''}
                                    onChange={(e) => handleFieldChange(key, e.target.value)}
                                />
                                {practiceErrors[key] ? (
                                    <p className="mt-1 text-xs text-red-500">{practiceErrors[key]}</p>
                                ) : null}
                            </div>
                        ))}

                        <div ref={stateRef} className="relative">
                            <label className="mb-1 block text-[12px] font-semibold text-emr-muted dark:text-gray-400">
                                State <span className="text-red-600">*</span>
                            </label>
                            <button
                                type="button"
                                className="form-input flex h-9 w-full items-center justify-between text-left text-[13px]"
                                onClick={() => setStateOpen((o) => !o)}
                            >
                                <span className={practiceForm.state ? '' : 'text-gray-400'}>
                                    {practiceForm.state
                                        ? (states.find(
                                              (s: any) =>
                                                  (s.abbreviation ?? s.code ?? s.name) === practiceForm.state
                                          )?.name ?? practiceForm.state)
                                        : 'Select state…'}
                                </span>
                                <svg
                                    className="h-4 w-4 shrink-0 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {practiceErrors.state ? (
                                <p className="mt-1 text-xs text-red-500">{practiceErrors.state}</p>
                            ) : null}
                            {stateOpen ? (
                                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-emr-border bg-white shadow-lg dark:border-white/10 dark:bg-[#1b2e4b]">
                                    <li
                                        className="cursor-pointer px-3 py-1.5 text-sm text-gray-400 hover:bg-primary/10"
                                        onMouseDown={() => {
                                            setPracticeForm((p: any) => ({ ...p, state: '' }));
                                            setStateOpen(false);
                                        }}
                                    >
                                        Select state…
                                    </li>
                                    {states.map((s: any) => {
                                        const val = s.abbreviation ?? s.code ?? s.name;
                                        return (
                                            <li
                                                key={s._id}
                                                className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-primary/10 ${
                                                    practiceForm.state === val
                                                        ? 'bg-primary/10 font-medium text-primary'
                                                        : 'text-gray-900 dark:text-white'
                                                }`}
                                                onMouseDown={() => {
                                                    setPracticeForm((p: any) => ({ ...p, state: val }));
                                                    setStateOpen(false);
                                                }}
                                            >
                                                {s.name}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : null}
                        </div>

                        {(
                            [
                                { label: 'Zip', key: 'zip', required: true },
                                { label: 'Phone', key: 'phone', required: true },
                                { label: 'Fax', key: 'fax' },
                                { label: 'EIN', key: 'ein' },
                                { label: 'NPI', key: 'groupNpi' },
                            ] as { label: string; key: string; required?: boolean }[]
                        ).map(({ label, key, required }) => (
                            <div key={key}>
                                <label className="mb-1 block text-[12px] font-semibold text-emr-muted dark:text-gray-400">
                                    {label} {required ? <span className="text-red-600">*</span> : null}
                                </label>
                                <input
                                    className={`form-input w-full text-[13px] ${practiceErrors[key] ? 'border-red-500' : ''}`}
                                    value={practiceForm[key] ?? ''}
                                    placeholder={
                                        key === 'zip'
                                            ? '12345 or 12345-6789'
                                            : key === 'phone' || key === 'fax'
                                              ? '(123) 456-7890'
                                              : key === 'ein'
                                                ? '12-3456789'
                                                : key === 'groupNpi'
                                                  ? '10-digit NPI'
                                                  : undefined
                                    }
                                    inputMode={key === 'groupNpi' ? 'numeric' : undefined}
                                    onChange={(e) => handleFieldChange(key, e.target.value)}
                                />
                                {practiceErrors[key] ? (
                                    <p className="mt-1 text-xs text-red-500">{practiceErrors[key]}</p>
                                ) : null}
                            </div>
                        ))}
                    </form>
                )}
            </div>
        </section>
    );
});
