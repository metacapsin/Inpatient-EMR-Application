import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, X } from 'lucide-react';
import { platformTenantsAPI, type Tenant } from '../../services/platformApi';

interface Props {
  tenant: Tenant;
  onClose: () => void;
  onDeleted: (tenantId: string) => void;
}

type Impact = { patientCount: number; userCount: number; encounterCount: number };

const DeleteTenantModal = ({ tenant, onClose, onDeleted }: Props) => {
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingImpact(true);
    platformTenantsAPI
      .deletionImpact(tenant.id)
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.response?.data?.message || 'Could not load what this would delete');
      })
      .finally(() => {
        if (!cancelled) setLoadingImpact(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  const canDelete = confirmText.trim() === tenant.name && !loadingImpact && !deleting;

  const onConfirmDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await platformTenantsAPI.remove(tenant.id, confirmText.trim());
      toast.success(`${tenant.name} deleted`);
      onDeleted(tenant.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not delete tenant');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-emr-border bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <h2 className="text-base font-semibold text-emr-text">Delete tenant</h2>
          </div>
          <button onClick={onClose} className="text-emr-muted hover:text-emr-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadingImpact ? (
          <p className="text-sm text-emr-muted">Checking what this will remove…</p>
        ) : impact ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Deleting <strong>{tenant.name}</strong> will permanently remove{' '}
            <strong>
              {impact.patientCount} patient{impact.patientCount === 1 ? '' : 's'}
            </strong>
            , {impact.userCount} staff account{impact.userCount === 1 ? '' : 's'}, and {impact.encounterCount} admission
            {impact.encounterCount === 1 ? '' : 's'} — along with every other clinical record under it. This cannot be undone.
          </div>
        ) : (
          <p className="mb-4 text-sm text-rose-700">Could not load deletion impact — try again.</p>
        )}

        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Type <span className="font-mono text-rose-700">{tenant.name}</span> to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={tenant.name}
          className="mb-4 h-11 w-full rounded-[10px] border border-slate-200/70 bg-[#eef1f7] px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400/60 focus:outline-none focus:ring-[3px] focus:ring-rose-500/15"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-emr-border px-3 py-2 text-xs font-medium text-emr-text hover:bg-emr-hover">
            Cancel
          </button>
          <button
            onClick={onConfirmDelete}
            disabled={!canDelete}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTenantModal;
