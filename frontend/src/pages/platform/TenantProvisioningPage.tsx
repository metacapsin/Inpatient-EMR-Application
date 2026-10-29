import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Building2, UserPlus, Mail, CheckCircle2 } from 'lucide-react';
import PlatformShell from './PlatformShell';
import AuthInputField from '../../components/auth/AuthInputField';
import AuthButton from '../../components/auth/AuthButton';
import { platformTenantsAPI, type Tenant } from '../../services/platformApi';

const MODULE_OPTIONS = ['adt', 'patients', 'medication', 'billing', 'staffing'];

const TenantProvisioningPage = () => {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  // Step 1: provision the tenant
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('starter');
  const [modules, setModules] = useState<string[]>(['adt', 'patients']);
  const [creating, setCreating] = useState(false);

  // Step 2: invite the tenant's first admin
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showLinkManually, setShowLinkManually] = useState(false);

  const toggleModule = (m: string) => setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const onCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await platformTenantsAPI.create({ name: name.trim(), plan, enabledModules: modules });
      setTenant(created);
      toast.success(`${created.name} provisioned`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not create tenant');
    } finally {
      setCreating(false);
    }
  };

  const [emailSent, setEmailSent] = useState(false);

  const onInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setInviting(true);
    try {
      const invite = await platformTenantsAPI.inviteAdmin(tenant.id, { email: email.trim(), firstName, lastName });
      setEmailSent(invite.emailSent ?? false);
      toast.success(`Invite sent to ${invite.email}`);
      if (invite.devSetPasswordToken) {
        setInviteLink(`${window.location.origin}/set-password?token=${invite.devSetPasswordToken}`);
      } else {
        navigate('/platform/tenants');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not send invite');
    } finally {
      setInviting(false);
    }
  };

  return (
    <PlatformShell>
      <button onClick={() => navigate('/platform/tenants')} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-emr-muted hover:text-emr-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to directory
      </button>

      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-xl border border-emr-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#97704f]" />
            <h2 className="text-sm font-semibold text-emr-text">1. Provision tenant</h2>
          </div>
          {tenant ? (
            <p className="text-sm text-emerald-700">
              "{tenant.name}" created — status <span className="font-semibold">{tenant.status}</span>, Stripe subscription{' '}
              <span className="font-mono text-xs">{tenant.stripeSubscriptionId}</span> (stubbed).
            </p>
          ) : (
            <form onSubmit={onCreateTenant} className="space-y-4">
              <AuthInputField label="Hospital / organization name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Riverside General Hospital" />
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-slate-700">Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-slate-200/70 bg-[#eef1f7] px-3 text-sm text-slate-900 focus:border-[#97704f]/60 focus:outline-none focus:ring-[3px] focus:ring-[#97704f]/15"
                >
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-slate-700">Enabled modules</label>
                <div className="flex flex-wrap gap-2">
                  {MODULE_OPTIONS.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => toggleModule(m)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        modules.includes(m) ? 'border-[#97704f] bg-[#97704f]/10 text-[#714e30]' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <AuthButton loading={creating}>Create tenant</AuthButton>
            </form>
          )}
        </div>

        <div className={`rounded-xl border border-emr-border bg-white p-6 shadow-sm ${!tenant ? 'opacity-40' : ''}`}>
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#97704f]" />
            <h2 className="text-sm font-semibold text-emr-text">2. Invite the tenant's first admin</h2>
          </div>
          {inviteLink ? (
            <div className="space-y-3">
              {emailSent ? (
                <>
                  <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Invite email sent to {email || 'the new admin'}. They'll get a link to set their password.
                  </p>
                  {showLinkManually ? (
                    <code className="block break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{inviteLink}</code>
                  ) : (
                    <button
                      onClick={() => setShowLinkManually(true)}
                      className="flex items-center gap-1 text-xs font-medium text-emr-muted hover:text-emr-text"
                    >
                      <Mail className="h-3 w-3" /> Show the link anyway (e.g. to send it yourself)
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-amber-700">No mail transport is configured, so no email was actually sent — here's the set-password link directly:</p>
                  <code className="block break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{inviteLink}</code>
                </>
              )}
              <button onClick={() => navigate('/platform/tenants')} className="text-xs font-medium text-[#97704f] hover:underline">
                Done — back to directory
              </button>
            </div>
          ) : (
            <form onSubmit={onInviteAdmin} className="space-y-4">
              <fieldset disabled={!tenant} className="space-y-4">
                <AuthInputField label="Admin email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <AuthInputField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  <AuthInputField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <AuthButton loading={inviting} disabled={!tenant}>
                  Send invite
                </AuthButton>
              </fieldset>
            </form>
          )}
        </div>
      </div>
    </PlatformShell>
  );
};

export default TenantProvisioningPage;
