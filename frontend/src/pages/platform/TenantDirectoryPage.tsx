import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, RefreshCw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import PlatformShell from './PlatformShell';
import DeleteTenantModal from './DeleteTenantModal';
import { platformTenantsAPI, type Tenant } from '../../services/platformApi';

const STATUS_STYLES: Record<Tenant['status'], string> = {
  trial: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  suspended: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ONBOARDING_STYLES: Record<Tenant['onboardingStatus'], string> = {
  provisioned: 'text-emr-muted',
  in_progress: 'text-amber-600',
  complete: 'text-emerald-600',
};

const MODULE_OPTIONS = ['adt', 'patients', 'medication', 'billing', 'staffing'];

const TenantDirectoryPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTenants(await platformTenantsAPI.list());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleSuspend = async (t: Tenant) => {
    const next = t.status === 'suspended' ? 'active' : 'suspended';
    try {
      const updated = await platformTenantsAPI.update(t.id, { status: next });
      setTenants((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    }
  };

  const toggleModule = async (t: Tenant, m: string) => {
    const next = t.enabledModules.includes(m) ? t.enabledModules.filter((x) => x !== m) : [...t.enabledModules, m];
    try {
      const updated = await platformTenantsAPI.update(t.id, { enabledModules: next });
      setTenants((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    }
  };

  return (
    <PlatformShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-emr-text">Tenant Directory</h1>
          <p className="text-sm text-emr-muted">Every hospital provisioned on this platform</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-emr-border bg-white px-3 py-2 text-xs font-medium text-emr-text hover:bg-emr-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <Link
            to="/platform/tenants/new"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#714e30] to-[#97704f] px-3 py-2 text-xs font-semibold text-white shadow-md hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New tenant
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-emr-border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-emr-hover text-xs uppercase text-emr-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Onboarding</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-emr-border">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-emr-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-emr-muted">
                  No tenants yet. Create the first one.
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <Fragment key={t.id}>
                <tr className="text-emr-text">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-emr-muted">{t.plan ?? '—'}</td>
                  <td className="px-4 py-3 text-emr-muted">
                    <button
                      onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                      className="flex items-center gap-1 text-xs font-medium text-[#97704f] hover:underline"
                    >
                      {t.enabledModules.length} of {MODULE_OPTIONS.length}
                      {editingId === t.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </td>
                  <td className={`px-4 py-3 text-xs ${ONBOARDING_STYLES[t.onboardingStatus]}`}>{t.onboardingStatus.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-emr-muted">{t.userCount}</td>
                  <td className="px-4 py-3 text-emr-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => toggleSuspend(t)} className="text-xs font-medium text-[#97704f] hover:underline">
                        {t.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => setDeletingTenant(t)}
                        className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === t.id && (
                  <tr className="bg-emr-hover/50">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-emr-muted">Enabled modules:</span>
                        {MODULE_OPTIONS.map((m) => (
                          <button
                            key={m}
                            onClick={() => toggleModule(t, m)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              t.enabledModules.includes(m) ? 'border-[#97704f] bg-[#97704f]/10 text-[#714e30]' : 'border-slate-200 text-slate-500'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {deletingTenant && (
        <DeleteTenantModal
          tenant={deletingTenant}
          onClose={() => setDeletingTenant(null)}
          onDeleted={(id) => {
            setTenants((prev) => prev.filter((x) => x.id !== id));
            setDeletingTenant(null);
          }}
        />
      )}
    </PlatformShell>
  );
};

export default TenantDirectoryPage;
