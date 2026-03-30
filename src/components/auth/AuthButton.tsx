import { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

const AuthButton = ({ children, className, loading, disabled, type = 'submit', ...props }: AuthButtonProps) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cn(
      'relative w-full overflow-hidden rounded-[10px] py-3.5 text-[15px] font-semibold tracking-wide text-white transition-all duration-300',
      'bg-gradient-to-r from-violet-700 via-violet-600 to-primary-800',
      'shadow-[0_10px_28px_-6px_rgba(91,33,182,0.35),0_6px_16px_-4px_rgba(79,60,40,0.28)]',
      'hover:from-violet-600 hover:via-violet-500 hover:to-primary-700 hover:shadow-[0_14px_36px_-8px_rgba(91,33,182,0.32),0_8px_20px_-6px_rgba(79,60,40,0.22)]',
      'active:scale-[0.99] active:brightness-[0.97]',
      'disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none',
      className
    )}
    {...props}
  >
    {loading ? (
      <span className="flex items-center justify-center gap-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
        Please wait…
      </span>
    ) : (
      children
    )}
  </button>
);

export default AuthButton;
