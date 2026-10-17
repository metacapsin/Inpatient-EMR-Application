import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

interface AddPatientModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const EMPTY = {
    firstName: '',
    middleName: '',
    lastName: '',
    dOB: '',
    sex: '',
    mobilePhone: '',
    email: '',
    address1: '',
    city: '',
    state: '',
    zipCode: '',
};

type FormState = typeof EMPTY;

const INPUT =
    'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100';
const LABEL = 'mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300';

export default function AddPatientModal({ open, onClose, onCreated }: AddPatientModalProps) {
    const [form, setForm] = useState<FormState>(EMPTY);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const validate = (): boolean => {
        const next: Partial<Record<keyof FormState, string>> = {};
        if (!form.firstName.trim()) next.firstName = 'First name is required.';
        if (!form.lastName.trim()) next.lastName = 'Last name is required.';
        if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email.';
        if (form.dOB && new Date(form.dOB) > new Date()) next.dOB = 'Date of birth cannot be in the future.';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const close = () => {
        if (saving) return;
        setForm(EMPTY);
        setErrors({});
        onClose();
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            // Empty optional fields are omitted so the API stores NULL instead of empty strings.
            const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''));
            await api.post('/Patient/createPatient', payload);
            toast.success('Patient added.');
            setForm(EMPTY);
            setErrors({});
            onCreated();
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to add patient.');
        } finally {
            setSaving(false);
        }
    };

    const field = (key: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <div>
            <label className={LABEL} htmlFor={`add-patient-${key}`}>
                {label}
            </label>
            <input id={`add-patient-${key}`} className={INPUT} value={form[key]} onChange={set(key)} {...props} />
            {errors[key] ? <p className="mt-1 text-xs font-medium text-red-600">{errors[key]}</p> : null}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add patient">
            <form
                onSubmit={submit}
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl dark:bg-[#141210]"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Patient</h2>
                    <button type="button" onClick={close} className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    {field('firstName', 'First name *', { autoFocus: true, maxLength: 100 })}
                    {field('middleName', 'Middle name', { maxLength: 100 })}
                    {field('lastName', 'Last name *', { maxLength: 100 })}
                    {field('dOB', 'Date of birth', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
                    <div>
                        <label className={LABEL} htmlFor="add-patient-sex">
                            Gender
                        </label>
                        <select id="add-patient-sex" className={INPUT} value={form.sex} onChange={set('sex')}>
                            <option value="">Select</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="O">Other</option>
                            <option value="U">Unknown</option>
                        </select>
                    </div>
                    {field('mobilePhone', 'Phone', { type: 'tel', maxLength: 30 })}
                    <div className="sm:col-span-3">{field('email', 'Email', { type: 'email', maxLength: 200 })}</div>
                    <div className="sm:col-span-3">{field('address1', 'Address', { maxLength: 200 })}</div>
                    {field('city', 'City', { maxLength: 100 })}
                    {field('state', 'State', { maxLength: 50 })}
                    {field('zipCode', 'ZIP code', { maxLength: 20 })}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={close}
                        className="h-9 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Add Patient'}
                    </button>
                </div>
            </form>
        </div>
    );
}
