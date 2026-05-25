import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toggleSidebar } from '../../store/themeConfigSlice';
import IconMenu from '../Icon/IconMenu';
import mdCareLogo from '../../assets/images/mdcare-logo.png';
import mdCareLogoDark from '../../assets/images/mdcare-logo_dark.png';
import { MainNavMenu } from './MainNavMenu';

/** Logo + primary navigation (left section of top bar). */
export function HeaderTopBar() {
    const dispatch = useDispatch();

    return (
        <div className="flex min-w-0 shrink-0 items-center gap-2 lg:gap-3">
            <div className="flex shrink-0 items-center gap-1 lg:hidden">
                <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-emr-text transition-colors hover:bg-emr-hover hover:text-emr-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emr-accent/40 dark:text-gray-300 dark:hover:bg-white/5"
                    onClick={() => dispatch(toggleSidebar())}
                    aria-label="Open menu"
                >
                    <IconMenu className="h-5 w-5" />
                </button>
                <Link to="/app/dashboard" className="main-logo flex shrink-0 items-center">
                    <img className="h-7 w-auto dark:hidden sm:h-7" src={mdCareLogo} alt="MD Care" />
                    <img className="hidden h-7 w-auto dark:inline sm:h-7" src={mdCareLogoDark} alt="MD Care" />
                </Link>
            </div>

            <Link
                to="/app/dashboard"
                className="main-logo hidden shrink-0 items-center rounded-md px-1 py-0.5 transition-opacity hover:opacity-90 lg:flex"
            >
                <img className="h-7 w-auto dark:hidden" src={mdCareLogo} alt="MD Care" />
                <img className="hidden h-7 w-auto dark:inline" src={mdCareLogoDark} alt="MD Care" />
            </Link>

            <span
                className="hidden h-6 w-px shrink-0 bg-emr-border/90 lg:block dark:bg-white/10"
                aria-hidden
            />

            <div className="min-w-0">
                <MainNavMenu variant="top" />
            </div>
        </div>
    );
}
