import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { loginUser } from '../../store/authSlice';
import type { AppDispatch, IRootState } from '../../store';
import AuthCard from '../../components/auth/AuthCard';
import AuthInputField from '../../components/auth/AuthInputField';
import AuthButton from '../../components/auth/AuthButton';
import loginIllustration from '../../assets/images/login-02.png';
import mdCareLogo from '../../assets/images/mdcare-logo.png';

const schema = yup.object({
  email: yup.string().email('Enter a valid email').required('Email is required'),
  password: yup.string().required('Password is required'),
  rememberMe: yup.boolean().default(false),
});

type FormValues = yup.InferType<typeof schema>;

const isTokenValid = (t: string | null): boolean => {
  if (!t) return false;
  try {
    const parts = t.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    return Boolean(payload.exp && payload.exp > Date.now() / 1000);
  } catch {
    return false;
  }
};

/** Provider-style login card: width, radius, padding, border, shadow (Sign in button unchanged). */
const loginCardClassName =
  'w-full max-w-[420px] rounded-xl border border-slate-200/80 bg-white p-8 sm:p-9 ' +
  'shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.06),0_16px_40px_-12px_rgba(15,23,42,0.08)]';

const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((s: IRootState) => s.auth.token);
  const authLoading = useSelector((s: IRootState) => s.auth.loading);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      email: typeof localStorage !== 'undefined' ? localStorage.getItem('rememberedEmail') || '' : '',
      password: '',
      rememberMe: typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('rememberedEmail')),
    },
  });

  useEffect(() => {
    if (isTokenValid(token)) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [token, navigate]);

  const onSubmit = async (values: FormValues) => {
    const toastId = 'login';
    toast.loading('Signing in…', { id: toastId });
    try {
      if (values.rememberMe) {
        localStorage.setItem('rememberedEmail', values.email.trim());
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      await dispatch(loginUser({ email: values.email.trim(), password: values.password })).unwrap();
      toast.success('Welcome back', { id: toastId });
      navigate('/app/dashboard', { replace: true });
    } catch (err: unknown) {
      const message =
        typeof err === 'string'
          ? err
          : err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
            ? (err as { message: string }).message
            : 'Sign in failed. Check your credentials.';
      toast.error(message, { id: toastId, duration: 5000 });
    }
  };

  const busy = isSubmitting || authLoading;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 font-inter">

  {/* LEFT PANEL */}
  <aside className="relative hidden lg:flex min-h-screen overflow-hidden">

{/* Solid Background + Right Curve */}
<div className="absolute inset-0 bg-[#9c7554] rounded-r-[80px]" />

{/* Illustration */}
<img
  src={loginIllustration}
  alt=""
  className="absolute bottom-0 left-0 max-w-[110%] h-auto object-contain"
/>

</aside>

  {/* MOBILE */}
  <div className="relative flex min-h-[160px] items-end justify-center overflow-hidden lg:hidden">
    <div className="absolute inset-0 bg-[#9c7554]" />
    <img
      src={loginIllustration}
      alt=""
      className="relative z-10 h-[120px] object-contain"
    />
  </div>

  {/* RIGHT PANEL */}
  <main className="flex items-center justify-center bg-[#f3f4f6] px-6">

    <div className="w-full max-w-[520px]">

      <div className="bg-white rounded-2xl p-10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">

        {/* LOGO */}
        <div className="mb-4 flex justify-center">
          <img
            src={mdCareLogo}
            alt="MD Care"
            className="h-20 object-contain"
          />
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          <AuthInputField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="name@organization.org"
            icon={<Mail className="h-[18px] w-[18px]" />}
            error={errors.email?.message}
            {...register('email')}
          />

          <AuthInputField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={errors.password?.message}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
            {...register('password')}
          />

          {/* REMEMBER */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" {...register('rememberMe')} />
              Remember me
            </label>

            <Link to="/forgot-password" className=" hover:underline">
              Forgot password?
            </Link>
          </div>

          {/* BUTTON */}
          <button
  type="submit"
  disabled={busy}
  className="w-full rounded-lg py-2.5 text-white font-medium
  bg-gradient-to-r from-[#4e57cd] to-[#97704f]
  shadow-md hover:opacity-90 transition"
>
  {busy ? 'Signing in...' : 'Login'}
</button>

        </form>

      </div>
    </div>

  </main>

</div>
  );
};

export default LoginPage;
