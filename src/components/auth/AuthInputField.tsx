import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type AuthInputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  icon?: ReactNode;
  /** Renders inside the field on the right (e.g. password visibility toggle). */
  suffix?: ReactNode;
};

const AuthInputField = forwardRef<HTMLInputElement, AuthInputFieldProps>(
  ({ label, error, icon, suffix, className, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    const padLeft = icon ? 'pl-10' : 'pl-3.5';
    const padRight = suffix ? 'pr-11' : 'pr-3.5';
    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-semibold tracking-wide text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-11 w-full rounded-[10px] border border-slate-200/70 bg-[#eef1f7] py-2.5 text-[15px] leading-snug text-slate-900 placeholder:text-slate-400',
              'transition-[border-color,box-shadow,background-color] duration-200',
              'hover:border-slate-300/90 hover:bg-[#e8ecf4]',
              'focus:border-violet-400/60 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-violet-500/15',
              padLeft,
              padRight,
              error && 'border-red-300 focus:border-red-400 focus:ring-red-500/15',
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center">{suffix}</div>
          )}
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    );
  }
);

AuthInputField.displayName = 'AuthInputField';

export default AuthInputField;
