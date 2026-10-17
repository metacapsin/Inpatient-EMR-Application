import { PropsWithChildren } from 'react';
import { cn } from '../../lib/utils';

type AuthCardProps = PropsWithChildren<{
  className?: string;
}>;

const AuthCard = ({ children, className }: AuthCardProps) => (
  <div
    className={cn(
      'w-full max-w-[400px] rounded-2xl border border-slate-200/60 bg-white p-8',
      'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-6px_rgba(15,23,42,0.08),0_22px_56px_-14px_rgba(79,60,40,0.12)]',
      'sm:p-9',
      className
    )}
  >
    {children}
  </div>
);

export default AuthCard;
