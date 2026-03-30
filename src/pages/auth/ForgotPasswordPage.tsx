import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { isAxiosError } from 'axios';
import { authService } from '../../services/auth.service';
import AuthInputField from '../../components/auth/AuthInputField';
import loginIllustration from '../../assets/images/login-02.png';
import mdCareLogo from '../../assets/images/mdcare-logo.png';

const schema = yup.object({
  email: yup.string().email('Enter a valid email').required('Email is required'),
});

type FormValues = yup.InferType<typeof schema>;

const ForgotPasswordPage = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: FormValues) => {
    const id = 'forgot-pw';
    toast.loading('Sending reset link…', { id });
    try {
      await authService.forgotPassword({ email: values.email.trim() });
      toast.success('Reset link sent to your email', { id, duration: 6000 });
    } catch (err: unknown) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          err.response?.statusText ||
          'Could not send reset email.'
        : 'Could not send reset email.';
      toast.error(message, { id, duration: 5000 });
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 font-inter">
      {/* LEFT PANEL */}
      <aside className="relative hidden lg:flex min-h-screen overflow-hidden">
        <div className="absolute inset-0 rounded-r-[80px] bg-[#9c7554]" />
        <img
          src={loginIllustration}
          alt=""
          className="absolute bottom-0 left-0 h-auto max-w-[110%] object-contain"
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
          <div className="rounded-2xl bg-white p-10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            {/* LOGO */}
            <div className="mb-4 flex justify-center">
              <img src={mdCareLogo} alt="MD Care" className="h-20 object-contain" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <h1 className="text-center text-xl font-semibold text-slate-900">Forgot password</h1>
                
              </div>

              <AuthInputField
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="name@organization.org"
                icon={<Mail className="h-[18px] w-[18px]" />}
                error={errors.email?.message}
                {...register('email')}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg py-2.5 text-white font-medium
  bg-gradient-to-r from-[#4e57cd] to-[#97704f]
  shadow-md hover:opacity-90 transition"
              >
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>

              {/* <div className="text-center text-sm">
                <Link to="/login" className=" hover:underline">
                  Back to sign in
                </Link>
              </div> */}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
