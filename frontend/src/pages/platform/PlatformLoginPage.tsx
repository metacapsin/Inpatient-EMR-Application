import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import AuthInputField from '../../components/auth/AuthInputField';
import { platformAuthAPI } from '../../services/platformApi';
import logoLight from '../../assets/images/codavia-logo.svg';
import logoDark from '../../assets/images/codavia-logo_dark.svg';

const PlatformLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const toastId = 'platform-login';
    toast.loading('Signing in…', { id: toastId });
    try {
      await platformAuthAPI.login(email.trim(), password);
      toast.success('Welcome back', { id: toastId });
      navigate('/platform/tenants', { replace: true });
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Sign in failed. Check your credentials.';
      toast.error(message, { id: toastId, duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(165deg,#f4efeb_0%,#ffffff_42%,#f7f4f1_100%)] px-6">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-[#97704f]/15 bg-white p-10 shadow-[0_30px_60px_rgba(151,112,79,0.14)]">
          <div className="mb-4 flex justify-center">
            <img src={logoLight} alt="Codavia Health" className="h-14 object-contain dark:hidden" />
            <img src={logoDark} alt="Codavia Health" className="hidden h-14 object-contain dark:block" />
          </div>

          <div className="mb-6 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#97704f]" />
            Super Admin Console
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <AuthInputField
              label="Email"
              type="email"
              required
              icon={<Mail className="h-[18px] w-[18px]" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="superadmin@example.com"
            />
            <AuthInputField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              icon={<Lock className="h-[18px] w-[18px]" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              suffix={
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="p-1 text-slate-400 hover:text-slate-700">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gradient-to-r from-[#714e30] to-[#97704f] py-2.5 font-medium text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Not a platform administrator?{' '}
            <Link to="/login" className="font-medium text-[#97704f] hover:underline">
              Go to tenant sign-in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlatformLoginPage;
