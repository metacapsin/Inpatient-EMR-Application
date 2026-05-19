import { useState } from 'react';
import type { CodeEventTeamMember, CodeTeamRole } from '../../../types/codeEvent';
import { CODE_TEAM_ROLES } from '../constants/codeEventOptions';
import { CODE_EVENT_SECTION_CARD_CLASS, CODE_EVENT_TABLE_WRAP_CLASS } from '../constants/codeEventLayout';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/codeEventFormatters';
import AppButton from '../../../components/ui/AppButton';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { listStaff } from '../../../services/staffScheduling.service';
import { useEffect } from 'react';

const fieldClass =
    'h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

type Props = {
    teamMembers: CodeEventTeamMember[];
    onSave: (members: CodeEventTeamMember[]) => Promise<void>;
    readOnly?: boolean;
};

export function CodeTeamMembersPanel({ teamMembers, onSave, readOnly }: Props) {
    const [rows, setRows] = useState<CodeEventTeamMember[]>(teamMembers);
    const [staffOptions, setStaffOptions] = useState<{ value: string; label: string }[]>([]);
    const [busy, setBusy] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftUserId, setDraftUserId] = useState('');
    const [draftRole, setDraftRole] = useState<CodeTeamRole>('RN');
    const [draftArrived, setDraftArrived] = useState(() => new Date().toISOString());

    useEffect(() => setRows(teamMembers), [teamMembers]);

    useEffect(() => {
        void listStaff().then((list) =>
            setStaffOptions(list.map((s) => ({ value: s.id, label: s.displayName, keywords: s.displayName })))
        );
    }, []);

    async function persist(next: CodeEventTeamMember[]) {
        setBusy(true);
        try {
            await onSave(next);
            setRows(next);
        } finally {
            setBusy(false);
        }
    }

    function addMember() {
        const name = draftName.trim() || staffOptions.find((o) => o.value === draftUserId)?.label || '';
        if (!name) return;
        const member: CodeEventTeamMember = {
            userId: draftUserId || `manual-${Date.now()}`,
            name,
            role: draftRole,
            arrivedAt: draftArrived,
        };
        void persist([...rows, member]);
        setDraftName('');
        setDraftUserId('');
        setDraftArrived(new Date().toISOString());
    }

    function removeAt(index: number) {
        void persist(rows.filter((_, i) => i !== index));
    }

    return (
        <section className={CODE_EVENT_SECTION_CARD_CLASS}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Response team</h2>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">Staff arrival documentation</p>

            <div className={`mt-3 ${CODE_EVENT_TABLE_WRAP_CLASS}`}>
                <table className="w-full min-w-[480px] text-left text-xs">
                    <thead>
                        <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:border-white/10">
                            <th className="px-2 py-2">Staff</th>
                            <th className="px-2 py-2">Role</th>
                            <th className="px-2 py-2">Arrived</th>
                            {!readOnly ? <th className="px-2 py-2 w-12" /> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={readOnly ? 3 : 4} className="px-2 py-4 text-center text-gray-500">
                                    No team members logged
                                </td>
                            </tr>
                        ) : (
                            rows.map((m, i) => (
                                <tr key={`${m.userId}-${i}`} className="border-b border-gray-100 dark:border-white/5">
                                    <td className="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">{m.name}</td>
                                    <td className="px-2 py-2">{m.role}</td>
                                    <td className="px-2 py-2 font-mono text-[11px]">{new Date(m.arrivedAt).toLocaleString()}</td>
                                    {!readOnly ? (
                                        <td className="px-2 py-2">
                                            <button
                                                type="button"
                                                className="text-[11px] font-semibold text-red-700 hover:underline dark:text-red-300"
                                                onClick={() => removeAt(i)}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    ) : null}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!readOnly ? (
                <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 dark:border-white/10 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Staff name</label>
                        <SearchableSelect
                            allowEmpty
                            placeholder="Search staff…"
                            value={draftUserId}
                            options={staffOptions}
                            onChange={(v) => {
                                setDraftUserId(String(v));
                                const label = staffOptions.find((o) => o.value === v)?.label;
                                if (label) setDraftName(label);
                            }}
                        />
                        <input
                            className={`${fieldClass} mt-2`}
                            placeholder="Or type name"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Role</label>
                        <select className={fieldClass} value={draftRole} onChange={(e) => setDraftRole(e.target.value as CodeTeamRole)}>
                            {CODE_TEAM_ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-gray-600 dark:text-gray-400">Arrived at</label>
                        <input
                            type="datetime-local"
                            className={fieldClass}
                            value={toDatetimeLocalValue(draftArrived)}
                            onChange={(e) => setDraftArrived(fromDatetimeLocalValue(e.target.value))}
                        />
                    </div>
                    <div className="flex items-end sm:col-span-2">
                        <AppButton type="button" disabled={busy} onClick={addMember}>
                            Add team member
                        </AppButton>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
