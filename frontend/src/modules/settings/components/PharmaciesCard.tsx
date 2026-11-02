import { forwardRef, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Star } from 'lucide-react';
import { SettingsCardHeader } from './SettingsCardHeader';
import { settingsFieldLabelClass, settingsGhostButtonClass, settingsSecondaryCardClass } from '../../../styles/settingsPageClasses';
import { deactivatePharmacy, listPharmacies, savePharmacy } from '../../../services/medicationManagement.service';
import type { Pharmacy, PharmacyInput } from '../../../types/medicationManagement';

const INPUT = 'h-9 w-full rounded-lg border border-emr-border/90 bg-white px-2.5 text-[13px] text-emr-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-100';
const EMPTY: PharmacyInput = { name: '', ncpdpId: '', npi: '', phone: '', fax: '', address: { line1: '', city: '', state: '', zip: '' }, isDefault: false };

/** Tenant pharmacy directory used by e-prescribing (transmit target). Admin-managed. */
export const PharmaciesCard = forwardRef<HTMLElement>(function PharmaciesCard(_, ref) {
    const [rows, setRows] = useState<Pharmacy[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<PharmacyInput>(EMPTY);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setRows(await listPharmacies());
        } catch {
            toast.error('Could not load pharmacies');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, []);

    const set = (k: keyof PharmacyInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
    const setAddr = (k: 'line1' | 'city' | 'state' | 'zip') => (v: string) => setForm((f) => ({ ...f, address: { ...(f.address ?? {}), [k]: v } }));

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name?.trim()) return toast.error('Pharmacy name is required');
        if (form.npi && !/^[1-9]\d{9}$/.test(form.npi)) return toast.error('Pharmacy NPI must be 10 digits');
        setSaving(true);
        const r = await savePharmacy(form);
        setSaving(false);
        if (!r.ok) return toast.error(r.message);
        toast.success('Pharmacy added');
        setForm(EMPTY);
        setAdding(false);
        await load();
    }

    async function makeDefault(p: Pharmacy) {
        const r = await savePharmacy({ name: p.name, isDefault: true }, p.id);
        if (!r.ok) return toast.error(r.message);
        await load();
    }

    async function remove(p: Pharmacy) {
        const r = await deactivatePharmacy(p.id);
        if (!r.ok) return toast.error(r.message);
        toast.success(`${p.name} deactivated`);
        await load();
    }

    return (
        <section ref={ref} id="settings-pharmacies" className={settingsSecondaryCardClass} aria-labelledby="pharmacies-heading">
            <SettingsCardHeader
                title="Pharmacies"
                description="Directory of pharmacies prescriptions can be transmitted to (NCPDP / NPI identifiers)."
                actions={
                    <button type="button" className={settingsGhostButtonClass} onClick={() => setAdding((v) => !v)}>
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        {adding ? 'Close' : 'Add pharmacy'}
                    </button>
                }
            />
            <h2 id="pharmacies-heading" className="sr-only">Pharmacies</h2>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                {adding ? (
                    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-emr-border/80 bg-emr-hover/30 p-3 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2 lg:grid-cols-4">
                        <label className="sm:col-span-2"><span className={settingsFieldLabelClass}>Name *</span><input className={INPUT} value={form.name} onChange={(e) => set('name')(e.target.value)} /></label>
                        <label><span className={settingsFieldLabelClass}>NCPDP ID</span><input className={INPUT} value={form.ncpdpId ?? ''} onChange={(e) => set('ncpdpId')(e.target.value)} /></label>
                        <label><span className={settingsFieldLabelClass}>NPI</span><input className={INPUT} inputMode="numeric" value={form.npi ?? ''} onChange={(e) => set('npi')(e.target.value.replace(/\D/g, '').slice(0, 10))} /></label>
                        <label><span className={settingsFieldLabelClass}>Phone</span><input className={INPUT} value={form.phone ?? ''} onChange={(e) => set('phone')(e.target.value)} /></label>
                        <label><span className={settingsFieldLabelClass}>Fax</span><input className={INPUT} value={form.fax ?? ''} onChange={(e) => set('fax')(e.target.value)} /></label>
                        <label className="sm:col-span-2"><span className={settingsFieldLabelClass}>Address</span><input className={INPUT} value={form.address?.line1 ?? ''} onChange={(e) => setAddr('line1')(e.target.value)} /></label>
                        <label><span className={settingsFieldLabelClass}>City</span><input className={INPUT} value={form.address?.city ?? ''} onChange={(e) => setAddr('city')(e.target.value)} /></label>
                        <label><span className={settingsFieldLabelClass}>State</span><input className={INPUT} value={form.address?.state ?? ''} onChange={(e) => setAddr('state')(e.target.value)} /></label>
                        <label><span className={settingsFieldLabelClass}>ZIP</span><input className={INPUT} value={form.address?.zip ?? ''} onChange={(e) => setAddr('zip')(e.target.value)} /></label>
                        <label className="flex items-end gap-2 text-[13px] text-emr-text dark:text-gray-200"><input type="checkbox" className="accent-primary" checked={Boolean(form.isDefault)} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} /> Default pharmacy</label>
                        <div className="flex items-end sm:col-span-2 lg:col-span-4">
                            <button type="submit" disabled={saving} className={settingsGhostButtonClass}>{saving ? 'Saving…' : 'Save pharmacy'}</button>
                        </div>
                    </form>
                ) : null}

                {loading ? (
                    <div className="h-4 w-40 animate-pulse rounded bg-emr-border/50 dark:bg-white/10" />
                ) : rows.length === 0 ? (
                    <p className="text-[13px] text-emr-muted dark:text-gray-400">No pharmacies yet. Add one so prescriptions can be transmitted.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-[13px]">
                            <thead className="text-[11px] uppercase tracking-wide text-emr-muted dark:text-gray-500">
                                <tr><th className="py-1.5 pr-3">Name</th><th className="py-1.5 pr-3">NCPDP</th><th className="py-1.5 pr-3">NPI</th><th className="py-1.5 pr-3">Phone</th><th className="py-1.5 pr-3">Address</th><th className="py-1.5" /></tr>
                            </thead>
                            <tbody>
                                {rows.map((p) => (
                                    <tr key={p.id} className="border-t border-emr-border/60 dark:border-white/10">
                                        <td className="py-2 pr-3 font-medium text-emr-text dark:text-gray-100">
                                            {p.name}
                                            {p.isDefault ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Default</span> : null}
                                        </td>
                                        <td className="py-2 pr-3">{p.ncpdpId || '—'}</td>
                                        <td className="py-2 pr-3">{p.npi || '—'}</td>
                                        <td className="py-2 pr-3">{p.phone || '—'}</td>
                                        <td className="py-2 pr-3">{[p.address?.line1, p.address?.city, p.address?.state, p.address?.zip].filter(Boolean).join(', ') || '—'}</td>
                                        <td className="py-2 text-right">
                                            <div className="inline-flex gap-1">
                                                {!p.isDefault ? <button type="button" title="Make default" className={settingsGhostButtonClass} onClick={() => void makeDefault(p)}><Star className="h-3.5 w-3.5" aria-hidden /></button> : null}
                                                <button type="button" title="Deactivate" className={settingsGhostButtonClass} onClick={() => void remove(p)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
});
