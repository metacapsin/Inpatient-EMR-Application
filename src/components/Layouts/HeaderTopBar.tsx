import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toggleSidebar } from '../../store/themeConfigSlice';
import IconMenu from '../Icon/IconMenu';
import mdCareLogo from '../../assets/images/mdcare-logo.png';
import mdCareLogoDark from '../../assets/images/mdcare-logo_dark.png';
import { MainNavMenu } from './MainNavMenu';

/** Logo + main nav row (mobile menu button + desktop top links). */
export function HeaderTopBar() {
    const dispatch = useDispatch();

    return (
        <>
            <div className="flex shrink-0 items-center gap-1 lg:hidden">
                <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-primary/10 hover:text-primary"
                    onClick={() => dispatch(toggleSidebar())}
                    aria-label="Open menu"
                >
                    <IconMenu className="h-5 w-5" />
                </button>
                <Link to="/app/dashboard" className="main-logo flex shrink-0 items-center">
                    <img className="h-7 w-auto dark:hidden sm:h-8" src={mdCareLogo} alt="MD Care" />
                    <img className="hidden h-7 w-auto dark:inline sm:h-8" src={mdCareLogoDark} alt="MD Care" />
                </Link>
            </div>

            <Link to="/app/dashboard" className="main-logo hidden shrink-0 items-center lg:flex">
                <img className="h-8 w-auto dark:hidden" src={mdCareLogo} alt="" />
                <img className="hidden h-8 w-auto dark:inline" src={mdCareLogoDark} alt="" />
            </Link>

            <MainNavMenu variant="top" />
        </>
    );
}
