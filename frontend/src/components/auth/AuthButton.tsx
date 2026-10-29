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
      'bg-gradient-to-r from-[#714e30] to-[#97704f]',
      'shadow-md',
      'hover:opacity-90',
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
