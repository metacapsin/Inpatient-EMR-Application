import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock } from 'lucide-react';
import AuthCard from '../../components/auth/AuthCard';
import AuthInputField from '../../components/auth/AuthInputField';
import AuthButton from '../../components/auth/AuthButton';
import { authAPI } from '../../services/api';
import { logout } from '../../store/authSlice';
import type { AppDispatch } from '../../store';

/** Consumes an invite/reset token (see /auth/reset-password) to let a newly-invited admin set their password. */
const SetPasswordPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    const toastId = 'set-password';
    toast.loading('Setting password…', { id: toastId });
    try {
      await authAPI.resetPassword({ token, newPassword, confirmPassword });
      toast.success('Password set — you can sign in now', { id: toastId });
      // This browser may still hold someone else's tenant session (e.g. the admin who sent the
      // invite, or whoever last used this device). Without clearing it, /login's own "already
      // signed in" redirect would bounce the new admin straight into that stranger's dashboard
      // instead of showing them the login form.
      dispatch(logout());
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'That link is invalid or has expired', { id: toastId, duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(165deg,#f4efeb_0%,#ffffff_42%,#f7f4f1_100%)] px-6">
        <AuthCard>
          <p className="text-sm text-slate-600">This link is missing its token. Use the link from your invite email.</p>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(165deg,#f4efeb_0%,#ffffff_42%,#f7f4f1_100%)] px-6">
      <AuthCard>
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Set your password</h1>
        <p className="mb-6 text-sm text-slate-500">You've been invited as an administrator. Choose a password to finish setting up your account.</p>
        <form onSubmit={onSubmit} className="space-y-5">
          <AuthInputField
            label="New password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            icon={<Lock className="h-4 w-4" />}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            suffix={
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="p-1 text-slate-400 hover:text-slate-700">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <AuthInputField
            label="Confirm password"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            minLength={8}
            icon={<Lock className="h-4 w-4" />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            suffix={
              <button type="button" onClick={() => setShowConfirmPassword((s) => !s)} className="p-1 text-slate-400 hover:text-slate-700">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <AuthButton loading={submitting}>Set password &amp; continue</AuthButton>
        </form>
      </AuthCard>
    </div>
  );
};

export default SetPasswordPage;
