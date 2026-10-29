import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, UserPlus, CheckCircle2, ChevronRight } from 'lucide-react';
import api, { userAPI } from '../../services/api';
import AuthInputField from '../../components/auth/AuthInputField';
import AuthButton from '../../components/auth/AuthButton';

const STEPS = ['Facility setup', 'Invite staff', 'Done'] as const;

const ROLE_OPTIONS = ['physician', 'nurse', 'pharmacist', 'billing', 'staff'] as const;

interface StaffInvite {
  email: string;
  firstName: string;
  role: (typeof ROLE_OPTIONS)[number];
}

const OnboardingWizardPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  // Step 0: facility
  const [wardName, setWardName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [bedLabel, setBedLabel] = useState('');
  const [facilitySaving, setFacilitySaving] = useState(false);
  const [facilityDone, setFacilityDone] = useState(false);

  // Step 1: staff invites
  const [invites, setInvites] = useState<StaffInvite[]>([{ email: '', firstName: '', role: 'nurse' }]);
  const [inviting, setInviting] = useState(false);

  const updateInvite = (i: number, patch: Partial<StaffInvite>) =>
    setInvites((prev) => prev.map((inv, idx) => (idx === i ? { ...inv, ...patch } : inv)));

  const onCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    setFacilitySaving(true);
    try {
      const ward = (await api.post('/Wards/CreateWard', { wardName: wardName.trim() })).data.data;
      const room = (await api.post('/Rooms/CreateRoom', { wardId: ward.id, roomNumber: roomNumber.trim() })).data.data;
      await api.post('/Beds/CreateBed', { roomId: room.id, bedLabel: bedLabel.trim() });
      setFacilityDone(true);
      toast.success('Ward, room and bed created');
      setStep(1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not create facility records');
    } finally {
      setFacilitySaving(false);
    }
  };

  const onInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const toSend = invites.filter((i) => i.email.trim());
      for (const inv of toSend) {
        await userAPI.registerUser({
          email: inv.email.trim(),
          password: `Temp-${Math.random().toString(36).slice(2, 10)}A1!`,
          firstName: inv.firstName.trim(),
          role: inv.role,
        });
      }
      toast.success(toSend.length ? `${toSend.length} staff member(s) invited` : 'No staff invited — you can add them later from Settings');
      setStep(2);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not invite staff');
    } finally {
      setInviting(false);
    }
  };

  const onFinish = async () => {
    setFinishing(true);
    try {
      await api.put('/tenants/current/onboarding-status', { onboardingStatus: 'complete' });
      toast.success('Setup complete — welcome aboard');
      navigate('/app/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not finish setup');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(165deg,#f4efeb_0%,#ffffff_42%,#f7f4f1_100%)] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome — let's set up your hospital</h1>
        <p className="mt-1 text-sm text-slate-500">A few quick steps before your team starts using the EMR.</p>

        <ol className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-400">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex items-center gap-1 ${i === step ? 'text-violet-700' : i < step ? 'text-emerald-600' : ''}`}>
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]">{i + 1}</span>}
              {label}
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300" />}
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
          {step === 0 && (
            <form onSubmit={onCreateFacility} className="space-y-4">
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet-600" />
                <h2 className="text-sm font-semibold text-slate-800">Add your first ward, room and bed</h2>
              </div>
              <p className="text-xs text-slate-500">You can add the rest later from Settings → Facility. This just gets you started.</p>
              <AuthInputField label="Ward name" required value={wardName} onChange={(e) => setWardName(e.target.value)} placeholder="ICU" />
              <AuthInputField label="Room number" required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="101" />
              <AuthInputField label="Bed label" required value={bedLabel} onChange={(e) => setBedLabel(e.target.value)} placeholder="Bed-1" />
              <AuthButton loading={facilitySaving}>Continue</AuthButton>
              {facilityDone && <p className="text-xs text-emerald-600">Facility created.</p>}
            </form>
          )}

          {step === 1 && (
            <form onSubmit={onInviteStaff} className="space-y-4">
              <div className="mb-2 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-violet-600" />
                <h2 className="text-sm font-semibold text-slate-800">Invite your staff</h2>
              </div>
              <p className="text-xs text-slate-500">Optional — add a physician, nurse, or anyone else. Leave blank and continue to skip.</p>
              {invites.map((inv, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_120px] gap-2">
                  <AuthInputField label={i === 0 ? 'Email' : ''} type="email" value={inv.email} onChange={(e) => updateInvite(i, { email: e.target.value })} />
                  <AuthInputField label={i === 0 ? 'First name' : ''} value={inv.firstName} onChange={(e) => updateInvite(i, { firstName: e.target.value })} />
                  <div className="space-y-2">
                    {i === 0 && <label className="block text-[13px] font-semibold text-slate-700">Role</label>}
                    <select
                      value={inv.role}
                      onChange={(e) => updateInvite(i, { role: e.target.value as StaffInvite['role'] })}
                      className="h-11 w-full rounded-[10px] border border-slate-200/70 bg-[#eef1f7] px-2 text-sm"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setInvites((prev) => [...prev, { email: '', firstName: '', role: 'nurse' }])}
                className="text-xs font-medium text-violet-700 hover:text-violet-600"
              >
                + Add another
              </button>
              <AuthButton loading={inviting}>Continue</AuthButton>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-800">You're all set</h2>
              <p className="text-xs text-slate-500">Facility and staff are in place. Finish to start using the EMR.</p>
              <AuthButton loading={finishing} onClick={onFinish}>
                Go to dashboard
              </AuthButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizardPage;
