import { PropsWithChildren } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import { getPlatformAdmin, platformAuthAPI } from '../../services/platformApi';
import logoLight from '../../assets/images/codavia-logo.svg';
import logoDark from '../../assets/images/codavia-logo_dark.svg';

const PlatformShell = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const admin = getPlatformAdmin();

  const onLogout = () => {
    platformAuthAPI.logout();
    navigate('/platform/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-emr-canvas">
      <header className="flex items-center justify-between border-b border-emr-border bg-white px-6 py-3.5">
        <Link to="/platform/tenants" className="flex items-center gap-3">
          <img className="h-7 w-auto dark:hidden" src={logoLight} alt="Codavia Health" />
          <img className="hidden h-7 w-auto dark:inline" src={logoDark} alt="Codavia Health" />
          <span className="h-5 w-px bg-emr-border" />
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emr-text">
            <ShieldCheck className="h-4 w-4 text-[#97704f]" />
            Super Admin Console
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {admin && <span className="text-xs text-emr-muted">{admin.email}</span>}
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-medium text-emr-muted hover:text-emr-text">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
};

export default PlatformShell;
