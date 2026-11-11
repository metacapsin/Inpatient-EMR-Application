import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
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
    <ConfirmDialog
      open
      title="Delete tenant"
      message={
        loadingImpact
          ? 'Checking what this will remove…'
          : impact
            ? `Deleting ${tenant.name} will permanently remove ${impact.patientCount} patient(s), ${impact.userCount} staff account(s), and ${impact.encounterCount} admission(s) — along with every other clinical record under it.`
            : 'Could not load deletion impact — try again.'
      }
      detail={tenant.name}
      confirmLabel="Delete permanently"
      variant="danger"
      busy={deleting}
      confirmDisabled={!canDelete}
      onCancel={onClose}
      onConfirm={() => void onConfirmDelete()}
    >
      <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
        Type <span className="font-mono text-danger">{tenant.name}</span> to confirm
      </label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={tenant.name}
        disabled={deleting}
        className="h-10 w-full rounded-lg border border-emr-border/90 bg-white px-3 text-sm text-gray-900 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-100"
      />
      {confirmText.trim() && confirmText.trim() !== tenant.name ? (
        <p className="mt-1.5 text-xs text-danger">Name must match exactly before delete is enabled.</p>
      ) : null}
    </ConfirmDialog>
  );
};

export default DeleteTenantModal;
