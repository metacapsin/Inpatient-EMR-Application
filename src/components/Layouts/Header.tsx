import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import IconSparkles from '../Icon/IconSparkles';
import { IRootState } from '../../store';
import { toggleTheme } from '../../store/themeConfigSlice';
import { logout } from '../../store/authSlice';
import Dropdown from '../Dropdown';
import { notificationsAPI } from '../../services/api';
import IconXCircle from '../Icon/IconXCircle';
import IconSun from '../Icon/IconSun';
import IconMoon from '../Icon/IconMoon';
import IconLaptop from '../Icon/IconLaptop';
import IconMailDot from '../Icon/IconMailDot';
import IconInfoCircle from '../Icon/IconInfoCircle';
import IconLogout from '../Icon/IconLogout';
import { HeaderTopBar } from './HeaderTopBar';
import { HeaderGlobalSearch } from './HeaderGlobalSearch';
import { emrHeaderUtilityBtnClass } from '../../styles/emrLayoutClasses';

const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector((state: IRootState) => state.auth.user);
    const patientData = useSelector((state: IRootState) => state.auth.patientData);

    const patient = patientData?.data ?? patientData;
    const displayName =
        patient?.fullName?.trim() ||
        (patient?.firstName != null || patient?.lastName != null
            ? [patient?.firstName, patient?.middleName, patient?.lastName].filter(Boolean).join(' ').trim()
            : null) ||
        patient?.displayName ||
        patient?.name ||
        user?.username ||
        user?.email ||
        'User';
    const displayEmail = patient?.emailAddress ?? patient?.email ?? user?.email ?? '';
    const profilePhoto =
        patient?.profilePictureUrl ??
        patient?.profilePhoto ??
        patient?.photo ??
        patient?.avatar ??
        patient?.image ??
        null;

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    useEffect(() => {
        const selector = document.querySelector('ul.horizontal-menu a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
            const all: Element[] = Array.from(document.querySelectorAll('ul.horizontal-menu .nav-link.active'));
            for (let i = 0; i < all.length; i++) {
                all[0]?.classList.remove('active');
            }
            const ul = selector.closest('ul.sub-menu');
            if (ul) {
                let ele = ul.closest('li.menu')?.querySelectorAll('.nav-link');
                if (ele) {
                    const link = ele[0];
                    setTimeout(() => {
                        link?.classList.add('active');
                    });
                }
            }
        }
    }, [location]);

    const isRtl = useSelector((state: IRootState) => state.themeConfig.rtlClass) === 'rtl' ? true : false;

    const themeConfig = useSelector((state: IRootState) => state.themeConfig);

    interface Notification {
        _id: string;
        userId: string;
        tenantId: string;
        type: string;
        action: string;
        message: string;
        metadata: any;
        isRead: boolean;
        status: boolean;
        createdBy: string;
        createdAt: string;
        modifiedAt: string;
    }

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [showMore, setShowMore] = useState(false);

    const unreadNotifications = notifications.filter((notif) => !notif.isRead);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoadingNotifications(true);
                const response = await notificationsAPI.getNotifications();
                if (response.data?.status === 'success' && Array.isArray(response.data?.data)) {
                    setNotifications(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching notifications:', error);
            } finally {
                setLoadingNotifications(false);
            }
        };

        fetchNotifications();
    }, []);

    const formatStartDateTime = (notification: Notification) => {
        try {
            const metadata = notification.metadata;
            if (!metadata) {
                const date = new Date(notification.createdAt);
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
            }

            if (metadata.startDate && metadata.startTime) {
                const date = new Date(metadata.startDate);
                const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
                return `${formattedDate}, ${metadata.startTime}`;
            }

            if (metadata.holidayDate) {
                return metadata.holidayDate;
            }

            const date = new Date(notification.createdAt);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch (error) {
            return '';
        }
    };

    const getTypeBadgeClass = (type: string) => {
        switch (type.toLowerCase()) {
            case 'appointment':
                return 'bg-primary text-white border-primary';
            case 'lab-order':
                return 'bg-info text-white border-info';
            case 'holiday':
                return 'bg-warning text-white border-warning';
            default:
                return 'bg-dark text-white border-dark';
        }
    };

    const markNotificationAsRead = async (notificationId: string) => {
        try {
            await notificationsAPI.markAsRead(notificationId);
            setNotifications(notifications.filter((notif) => notif._id !== notificationId));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const removeNotification = async (notificationId: string) => {
        try {
            await notificationsAPI.deleteNotification(notificationId);
            setNotifications(notifications.filter((notif) => notif._id !== notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getInitial = (name?: string) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    const isValidImage =
        profilePhoto &&
        (profilePhoto.startsWith('http') || profilePhoto.startsWith('data:'));

    return (
        <header
            className={`app-layout-header z-40 ${themeConfig.semidark && themeConfig.menu === 'horizontal' ? 'dark' : ''}`}
        >
            <div className="app-layout-header-bar">
                <div className="relative flex h-11 w-full min-w-0 items-center gap-2 px-3 sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,400px)_auto] lg:items-center lg:gap-4 lg:px-5">
                    <HeaderTopBar />

                    <div className="hidden min-w-0 justify-center lg:flex">
                        <HeaderGlobalSearch className="w-full max-w-[400px]" />
                    </div>

                    <div
                        className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-0 rtl:space-x-reverse dark:text-[#d0d2d6]"
                        role="toolbar"
                        aria-label="Application utilities"
                    >
                        <div>
                            {themeConfig.theme === 'light' ? (
                                <button
                                    type="button"
                                    className={emrHeaderUtilityBtnClass}
                                    aria-label="Switch to dark theme"
                                    onClick={() => {
                                        dispatch(toggleTheme('dark'));
                                    }}
                                >
                                    <IconSun />
                                </button>
                            ) : null}
                            {themeConfig.theme === 'dark' && (
                                <button
                                    type="button"
                                    className={emrHeaderUtilityBtnClass}
                                    aria-label="Switch to system theme"
                                    onClick={() => {
                                        dispatch(toggleTheme('system'));
                                    }}
                                >
                                    <IconMoon />
                                </button>
                            )}
                            {themeConfig.theme === 'system' && (
                                <button
                                    type="button"
                                    className={emrHeaderUtilityBtnClass}
                                    aria-label="Switch to light theme"
                                    onClick={() => {
                                        dispatch(toggleTheme('light'));
                                    }}
                                >
                                    <IconLaptop />
                                </button>
                            )}
                        </div>
                        <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-emr-border/80 sm:block dark:bg-white/10" aria-hidden />
                        <div className="dropdown shrink-0">
                            <Dropdown
                                offset={[0, 8]}
                                placement={`${isRtl ? 'bottom-start' : 'bottom-end'}`}
                                btnClassName={emrHeaderUtilityBtnClass}
                                button={
                                    <>
                                        <IconMailDot />
                                        {unreadNotifications.length > 0 && (
                                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-emr-danger px-1 text-[9px] font-bold leading-none text-white shadow-sm dark:border-[#141210]">
                                                {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
                                            </span>
                                        )}
                                    </>
                                }
                            >
                                <ul
                                    className="!py-0 w-[85vw] max-w-[85vw] overflow-hidden rounded-lg border border-white-light/20 bg-white text-xs text-dark shadow-2xl dark:border-white/10 dark:bg-[#1b2e4b] dark:text-white-dark sm:w-[375px] sm:max-w-[375px]"
                                    style={{
                                        boxShadow:
                                            '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                                    }}
                                >
                                    <li className="mb-0" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative w-full overflow-hidden bg-gradient-to-r from-primary to-primary/80 p-2.5 dark:from-primary/90 dark:to-primary/70 sm:p-3 md:p-4">
                                            <h4 className="relative z-10 flex items-center gap-1.5 text-sm font-semibold text-white sm:gap-2 sm:text-base md:text-lg">
                                                <IconMailDot className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                                                <span className="truncate">Notifications</span>
                                                {unreadNotifications.length > 0 && (
                                                    <span className="ml-auto shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white sm:px-2 sm:text-xs">
                                                        {unreadNotifications.length}
                                                    </span>
                                                )}
                                            </h4>
                                        </div>
                                    </li>
                                    {loadingNotifications ? (
                                        <li className="mb-5 py-8" onClick={(e) => e.stopPropagation()}>
                                            <div className="grid min-h-[200px] place-content-center px-4 text-center">
                                                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                                                <p className="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
                                                    Loading notifications...
                                                </p>
                                            </div>
                                        </li>
                                    ) : unreadNotifications.length > 0 ? (
                                        <>
                                            <li onClick={(e) => e.stopPropagation()}>
                                                <div className="max-h-[50vh] overflow-y-auto transition-all duration-300 ease-in-out sm:max-h-[400px]">
                                                    {(showMore ? unreadNotifications : unreadNotifications.slice(0, 5)).map(
                                                        (notification) => (
                                                            <div
                                                                key={notification._id}
                                                                className="mx-1 my-0.5 flex cursor-pointer flex-col rounded-md border-b border-white-light/30 bg-primary/5 px-2.5 py-2.5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-white-light/40 hover:shadow-lg hover:shadow-primary/10 dark:border-white/5 dark:bg-primary/10 dark:hover:bg-dark/40 dark:hover:shadow-primary/20 sm:px-3 sm:py-3 md:px-5"
                                                                onClick={(e) => {
                                                                    if (!(e.target as HTMLElement).closest('button')) {
                                                                        markNotificationAsRead(notification._id);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-start gap-2 sm:gap-3">
                                                                    <div className="min-w-0 flex-1 pr-1">
                                                                        <div className="mb-2 break-words text-xs font-semibold leading-relaxed dark:text-white-light sm:text-sm">
                                                                            {notification.message}
                                                                        </div>
                                                                        <div className="mt-2">
                                                                            <span
                                                                                className={`badge ${getTypeBadgeClass(notification.type)} inline-block px-1.5 py-0.5 text-[10px] capitalize sm:px-2 sm:py-1 sm:text-xs`}
                                                                            >
                                                                                {notification.type.replace('-', ' ')}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:gap-2">
                                                                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                                                                        <span className="whitespace-nowrap rounded-md bg-white-light/50 px-1 py-0.5 text-[9px] font-medium text-dark/70 dark:bg-dark/50 dark:text-white-dark/80 sm:px-1.5 md:px-2 sm:py-1 md:text-xs">
                                                                            {formatStartDateTime(notification)}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            className="mt-0.5 shrink-0 p-0.5 text-gray-400 transition-colors hover:text-danger"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                removeNotification(notification._id);
                                                                            }}
                                                                        >
                                                                            <IconXCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </li>
                                            {unreadNotifications.length > 5 && !showMore && (
                                                <li className="border-t border-white-light/30 text-center dark:border-white/5">
                                                    <button
                                                        type="button"
                                                        className="w-full justify-center px-2 py-2.5 text-[11px] font-semibold text-primary transition-colors hover:bg-white-light/20 dark:text-gray-400 dark:hover:bg-dark/20 sm:!h-[44px] sm:!py-3 sm:text-xs md:!h-[48px] md:!py-4 md:text-sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowMore(true);
                                                        }}
                                                    >
                                                        <span className="hover:underline">
                                                            Show More ({unreadNotifications.length - 5} more)
                                                        </span>
                                                    </button>
                                                </li>
                                            )}
                                            {showMore && unreadNotifications.length > 5 && (
                                                <li className="border-t border-white-light/30 text-center dark:border-white/5">
                                                    <button
                                                        type="button"
                                                        className="w-full justify-center px-2 py-2.5 text-[11px] font-semibold text-primary transition-colors hover:bg-white-light/20 dark:text-gray-400 dark:hover:bg-dark/20 sm:!h-[44px] sm:!py-3 sm:text-xs md:!h-[48px] md:!py-4 md:text-sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowMore(false);
                                                        }}
                                                    >
                                                        <span className="hover:underline">Show Less</span>
                                                    </button>
                                                </li>
                                            )}
                                        </>
                                    ) : (
                                        <li className="mb-5 px-4 py-6 sm:py-8" onClick={(e) => e.stopPropagation()}>
                                            <div className="grid place-content-center text-center">
                                                <div className="mx-auto mb-3 rounded-full p-2 text-primary ring-4 ring-primary/20 sm:mb-4 sm:p-3">
                                                    <IconInfoCircle fill={true} className="h-8 w-8 sm:h-10 sm:w-10" />
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                                                    No notifications available.
                                                </p>
                                            </div>
                                        </li>
                                    )}
                                </ul>
                            </Dropdown>
                        </div>
                        <NavLink
                            to="/app/ai-assistant"
                            className={emrHeaderUtilityBtnClass}
                            title="AI Assistant"
                            aria-label="AI Assistant"
                        >
                            <IconSparkles className="h-4 w-4" />
                        </NavLink>
                        <div className="dropdown flex shrink-0">
                            <Dropdown
                                offset={[0, 8]}
                                placement={`${isRtl ? 'bottom-start' : 'bottom-end'}`}
                                btnClassName="group relative ml-0.5 flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-emr-border/60 transition-all hover:ring-emr-accent/30 dark:ring-white/10"
                                button={
                                    isValidImage ? (
                                        <img
                                            className="h-7 w-7 rounded-md object-cover ring-1 ring-white/80 transition group-hover:ring-emr-accent/40 dark:ring-black/40"
                                            src={profilePhoto}
                                            alt="userProfile"
                                        />
                                    ) : (
                                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-white shadow-sm">
                                            {getInitial(displayName)}
                                        </div>
                                    )
                                }
                            >
                                <ul className="w-[230px] !py-0 font-semibold text-dark dark:text-white-light/90">
                                    <li>
                                        <div className="flex items-center px-4 py-4">
                                            {isValidImage ? (
                                                <img
                                                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                                                    src={profilePhoto}
                                                    alt="userProfile"
                                                />
                                            ) : (
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-semibold text-white">
                                                    {getInitial(displayName)}
                                                </div>
                                            )}
                                            <div className="min-w-0 truncate ltr:pl-4 rtl:pr-4">
                                                <h4 className="truncate text-base">{displayName || 'User'}</h4>
                                                <p className="truncate text-sm text-black/60 dark:text-dark-light/60">
                                                    {displayEmail || '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                    <li className="border-t border-white-light dark:border-white-light/10">
                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            className="!py-3 w-full text-left text-danger"
                                        >
                                            <IconLogout className="h-4.5 w-4.5 shrink-0 rotate-90 ltr:mr-2 rtl:ml-2" />
                                            Sign Out
                                        </button>
                                    </li>
                                </ul>
                            </Dropdown>
                        </div>
                    </div>
                </div>

                <div className="border-t border-emr-border/70 px-3 py-2 lg:hidden dark:border-white/10">
                    <HeaderGlobalSearch id="header-global-search-mobile" />
                </div>
            </div>
        </header>
    );
};

export default Header;
