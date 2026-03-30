import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import IconSparkles from '../Icon/IconSparkles';
import { IRootState } from '../../store';
import { toggleRTL, toggleTheme, toggleSidebar } from '../../store/themeConfigSlice';
import { logout } from '../../store/authSlice';
import { useTranslation } from 'react-i18next';
import Dropdown from '../Dropdown';
import { notificationsAPI } from '../../services/api';
import IconMenu from '../Icon/IconMenu';
import IconCalendar from '../Icon/IconCalendar';
import IconEdit from '../Icon/IconEdit';
import IconSearch from '../Icon/IconSearch';
import IconXCircle from '../Icon/IconXCircle';
import IconSun from '../Icon/IconSun';
import IconMoon from '../Icon/IconMoon';
import IconLaptop from '../Icon/IconLaptop';
import IconMailDot from '../Icon/IconMailDot';
import IconArrowLeft from '../Icon/IconArrowLeft';
import IconInfoCircle from '../Icon/IconInfoCircle';
import IconBellBing from '../Icon/IconBellBing';
import IconMail from '../Icon/IconMail';
import IconLockDots from '../Icon/IconLockDots';
import IconLogout from '../Icon/IconLogout';
import IconMenuDashboard from '../Icon/Menu/IconMenuDashboard';
import IconCaretDown from '../Icon/IconCaretDown';
import IconMenuApps from '../Icon/Menu/IconMenuApps';
import IconMenuComponents from '../Icon/Menu/IconMenuComponents';
import IconMenuElements from '../Icon/Menu/IconMenuElements';
import IconMenuDatatables from '../Icon/Menu/IconMenuDatatables';
import IconMenuForms from '../Icon/Menu/IconMenuForms';
import IconMenuPages from '../Icon/Menu/IconMenuPages';
import IconMenuMore from '../Icon/Menu/IconMenuMore';
import mdCareLogo from '../../assets/images/mdcare-logo.png';

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
            const all: any = document.querySelectorAll('ul.horizontal-menu .nav-link.active');
            for (let i = 0; i < all.length; i++) {
                all[0]?.classList.remove('active');
            }
            const ul: any = selector.closest('ul.sub-menu');
            if (ul) {
                let ele: any = ul.closest('li.menu').querySelectorAll('.nav-link');
                if (ele) {
                    ele = ele[0];
                    setTimeout(() => {
                        ele?.classList.add('active');
                    });
                }
            }
        }
    }, [location]);

    const isRtl = useSelector((state: IRootState) => state.themeConfig.rtlClass) === 'rtl' ? true : false;

    const themeConfig = useSelector((state: IRootState) => state.themeConfig);

    // Notifications state
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

    // Filter to show only unread notifications
    const unreadNotifications = notifications.filter((notif) => !notif.isRead);

    // Fetch notifications
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

    // Format startDate and startTime from metadata
    const formatStartDateTime = (notification: Notification) => {
        try {
            const metadata = notification.metadata;
            if (!metadata) {
                // Fallback to createdAt
                const date = new Date(notification.createdAt);
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
            }

            // Check for startDate and startTime (appointment notifications)
            if (metadata.startDate && metadata.startTime) {
                // Format startDate
                const date = new Date(metadata.startDate);
                const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
                
                // startTime is already formatted (e.g., "8:00 AM")
                return `${formattedDate}, ${metadata.startTime}`;
            }
            
            // Check for holidayDate (holiday notifications)
            if (metadata.holidayDate) {
                // holidayDate is already formatted (e.g., "12/12/2026")
                return metadata.holidayDate;
            }
            
            // Fallback to createdAt if no date/time in metadata
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

    // Get badge color based on notification type (filled badges)
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

    // Mark notification as read
    const markNotificationAsRead = async (notificationId: string) => {
        try {
            await notificationsAPI.markAsRead(notificationId);
            // Remove the notification from the list since we only show unread ones
            setNotifications(notifications.filter((notif) => notif._id !== notificationId));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Remove notification
    const removeNotification = async (notificationId: string) => {
        try {
            await notificationsAPI.deleteNotification(notificationId);
            setNotifications(notifications.filter((notif) => notif._id !== notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };


    const [search, setSearch] = useState(false);

    const { t } = useTranslation();

    const getInitial = (name?: string) => {
        return name ? name.charAt(0).toUpperCase() : "?";
      };
      
      const getColor = (name?: string) => {
        const colors = ["bg-indigo-500", "bg-green-500", "bg-blue-500", "bg-pink-500"];
        const index = name ? name.charCodeAt(0) % colors.length : 0;
        return colors[index];
      };
      
      const isValidImage =
        profilePhoto &&
        (profilePhoto.startsWith("http") || profilePhoto.startsWith("data:"));

    return (
        <header className={`z-40 ${themeConfig.semidark && themeConfig.menu === 'horizontal' ? 'dark' : ''}`}>
            <div className="shadow-sm">
                <div className="relative bg-white flex w-full items-center px-5 py-2.5 dark:bg-black">
                    <div className="horizontal-logo flex lg:hidden justify-between items-center ltr:mr-2 rtl:ml-2">
                        <Link to="/" className="main-logo flex items-center shrink-0 space-x-2 rtl:space-x-reverse">
                            {/* Dark mode: show full MD Care logo image */}
                            <img className="h-8 w-auto object-contain hidden dark:inline" src={mdCareLogo} alt="MD Care" />
                            {/* Light mode: show styled MD CARE text */}
                            <span className=" text-2xl font-extrabold tracking-wide text-primary align-middle dark:hidden">
                                MD CARE
                            </span>
                        </Link>
                        <button
                            type="button"
                            className="collapse-icon flex-none dark:text-[#d0d2d6] hover:text-primary dark:hover:text-primary flex lg:hidden ltr:ml-2 rtl:mr-2 p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:bg-white-light/90 dark:hover:bg-dark/60"
                            onClick={() => {
                                dispatch(toggleSidebar());
                            }}
                        >
                            <IconMenu className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="sm:flex-1 ltr:sm:ml-0 ltr:ml-auto sm:rtl:mr-0 rtl:mr-auto flex items-center space-x-1.5 lg:space-x-2 rtl:space-x-reverse dark:text-[#d0d2d6]">
                        <div className="sm:ltr:mr-auto sm:rtl:ml-auto">
                            {/*<form
                                className={`${search && '!block'} sm:relative absolute inset-x-0 sm:top-0 top-1/2 sm:translate-y-0 -translate-y-1/2 sm:mx-0 mx-4 z-10 sm:block hidden`}
                                onSubmit={() => setSearch(false)}
                            >
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="form-input ltr:pl-9 rtl:pr-9 ltr:sm:pr-4 rtl:sm:pl-4 ltr:pr-9 rtl:pl-9 peer sm:bg-transparent bg-gray-100 placeholder:tracking-widest"
                                        placeholder="Search..."
                                    />
                                    <button type="button" className="absolute w-9 h-9 inset-0 ltr:right-auto rtl:left-auto appearance-none peer-focus:text-primary">
                                        <IconSearch className="mx-auto" />
                                    </button>
                                    <button type="button" className="hover:opacity-80 sm:hidden block absolute top-1/2 -translate-y-1/2 ltr:right-2 rtl:left-2" onClick={() => setSearch(false)}>
                                        <IconXCircle />
                                    </button>
                                </div>
                            </form>
                            <button
                                type="button"
                                onClick={() => setSearch(!search)}
                                className="search_btn sm:hidden p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:bg-white-light/90 dark:hover:bg-dark/60"
                            >
                                <IconSearch className="w-4.5 h-4.5 mx-auto dark:text-[#d0d2d6]" />
                            </button>*/}
                        </div>
                        <div>
                            {themeConfig.theme === 'light' ? (
                                <button
                                    className={`${
                                        themeConfig.theme === 'light' &&
                                        'flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60'
                                    }`}
                                    onClick={() => {
                                        dispatch(toggleTheme('dark'));
                                    }}
                                >
                                    <IconSun />
                                </button>
                            ) : (
                                ''
                            )}
                            {themeConfig.theme === 'dark' && (
                                <button
                                    className={`${
                                        themeConfig.theme === 'dark' &&
                                        'flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60'
                                    }`}
                                    onClick={() => {
                                        dispatch(toggleTheme('system'));
                                    }}
                                >
                                    <IconMoon />
                                </button>
                            )}
                            {themeConfig.theme === 'system' && (
                                <button
                                    className={`${
                                        themeConfig.theme === 'system' &&
                                        'flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60'
                                    }`}
                                    onClick={() => {
                                        dispatch(toggleTheme('light'));
                                    }}
                                >
                                    <IconLaptop />
                                </button>
                            )}
                        </div>
                        <div className="dropdown shrink-0">
                            <Dropdown
                                offset={[0, 8]}
                                placement={`${isRtl ? 'bottom-start' : 'bottom-end'}`}
                                btnClassName="block p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60 relative"
                                button={
                                    <>
                                        <IconMailDot />
                                        {unreadNotifications.length > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full px-1.5 border-2 border-white dark:border-black">
                                                {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
                                            </span>
                                        )}
                                    </>
                                }
                            >
                                <ul className="!py-0 text-dark dark:text-white-dark w-[85vw] max-w-[85vw] sm:max-w-[375px] sm:w-[375px] text-xs bg-white dark:bg-[#1b2e4b] rounded-lg shadow-2xl border border-white-light/20 dark:border-white/10 overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)' }}>
                                    <li className="mb-0" onClick={(e) => e.stopPropagation()}>
                                        <div className="hover:!bg-transparent overflow-hidden relative p-2.5 sm:p-3 md:p-4 bg-gradient-to-r from-primary to-primary/80 dark:from-primary/90 dark:to-primary/70 w-full">
                                            <h4 className="font-semibold relative z-10 text-sm sm:text-base md:text-lg text-white flex items-center gap-1.5 sm:gap-2">
                                                <IconMailDot className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                                <span className="truncate">Notifications</span>
                                                {unreadNotifications.length > 0 && (
                                                    <span className="ml-auto bg-white/20 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                                                        {unreadNotifications.length}
                                                    </span>
                                                )}
                                            </h4>
                                        </div>
                                    </li>
                                    {loadingNotifications ? (
                                        <li className="mb-5 py-8" onClick={(e) => e.stopPropagation()}>
                                            <div className="!grid place-content-center hover:!bg-transparent text-center min-h-[200px] px-4">
                                                <div className="mx-auto mb-4 text-primary">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                                </div>
                                                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Loading notifications...</p>
                                            </div>
                                        </li>
                                    ) : unreadNotifications.length > 0 ? (
                                        <>
                                            <li onClick={(e) => e.stopPropagation()}>
                                                <div className="max-h-[50vh] sm:max-h-[400px] overflow-y-auto transition-all duration-300 ease-in-out">
                                                    {(showMore ? unreadNotifications : unreadNotifications.slice(0, 5)).map((notification) => {
                                                        return (
                                                            <div 
                                                                key={notification._id} 
                                                                className="flex flex-col py-2.5 sm:py-3 px-2.5 sm:px-3 md:px-5 hover:bg-white-light/40 dark:hover:bg-dark/40 border-b border-white-light/30 dark:border-white/5 last:border-b-0 transition-all duration-300 ease-in-out cursor-pointer bg-primary/5 dark:bg-primary/10 hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/20 hover:-translate-y-0.5 hover:scale-[1.01] rounded-md mx-1 my-0.5"
                                                                onClick={(e) => {
                                                                    // Don't mark as read if clicking on delete button
                                                                    if (!(e.target as HTMLElement).closest('button')) {
                                                                        markNotificationAsRead(notification._id);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-start gap-2 sm:gap-3">
                                                                    <div className="flex-1 min-w-0 pr-1">
                                                                        <div className="text-xs sm:text-sm mb-2 break-words leading-relaxed font-semibold dark:text-white-light">
                                                                            {notification.message}
                                                                        </div>
                                                                        <div className="mt-2">
                                                                            <span className={`badge ${getTypeBadgeClass(notification.type)} capitalize text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 inline-block`}>
                                                                                {notification.type.replace('-', ' ')}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0">
                                                                        <span className="w-2 h-2 bg-primary rounded-full shrink-0"></span>
                                                                        <span className="font-medium bg-white-light/50 dark:bg-dark/50 rounded-md text-dark/70 px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs whitespace-nowrap dark:text-white-dark/80">
                                                                            {formatStartDateTime(notification)}
                                                                        </span>
                                                                        <button 
                                                                            type="button" 
                                                                            className="text-gray-400 hover:text-danger transition-colors mt-0.5 shrink-0 p-0.5" 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                removeNotification(notification._id);
                                                                            }}
                                                                        >
                                                                            <IconXCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </li>
                                            {unreadNotifications.length > 5 && !showMore && (
                                                <li className="border-t border-white-light/30 text-center dark:border-white/5">
                                                    <button 
                                                        type="button" 
                                                        className="text-primary font-semibold group dark:text-gray-400 justify-center !py-2.5 sm:!py-3 md:!py-4 !h-[40px] sm:!h-[44px] md:!h-[48px] w-full hover:bg-white-light/20 dark:hover:bg-dark/20 transition-colors text-[11px] sm:text-xs md:text-sm px-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowMore(true);
                                                        }}
                                                    >
                                                        <span className="group-hover:underline">Show More ({unreadNotifications.length - 5} more)</span>
                                                    </button>
                                                </li>
                                            )}
                                            {showMore && unreadNotifications.length > 5 && (
                                                <li className="border-t border-white-light/30 text-center dark:border-white/5">
                                                    <button 
                                                        type="button" 
                                                        className="text-primary font-semibold group dark:text-gray-400 justify-center !py-2.5 sm:!py-3 md:!py-4 !h-[40px] sm:!h-[44px] md:!h-[48px] w-full hover:bg-white-light/20 dark:hover:bg-dark/20 transition-colors text-[11px] sm:text-xs md:text-sm px-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowMore(false);
                                                        }}
                                                    >
                                                        <span className="group-hover:underline">Show Less</span>
                                                    </button>
                                                </li>
                                            )}
                                        </>
                                    ) : (
                                        <li className="mb-5 py-6 sm:py-8 px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="!grid place-content-center hover:!bg-transparent text-center">
                                                <div className="mx-auto ring-4 ring-primary/20 rounded-full mb-3 sm:mb-4 text-primary p-2 sm:p-3">
                                                    <IconInfoCircle fill={true} className="w-8 h-8 sm:w-10 sm:h-10" />
                                                </div>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">No notifications available.</p>
                                            </div>
                                        </li>
                                    )}
                                </ul>
                            </Dropdown>
                        </div>
                        <NavLink
                            to="/app/ai-assistant"
                            className="flex shrink-0 items-center justify-center rounded-full bg-white-light/40 p-2 hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:hover:bg-dark/60"
                            title="AI Assistant"
                        >
                            <IconSparkles className="h-5 w-5" />
                        </NavLink>
                        <div className="dropdown shrink-0 flex">
    <Dropdown
      offset={[0, 8]}
      placement={`${isRtl ? "bottom-start" : "bottom-end"}`}
      btnClassName="relative group block"
      button={
        isValidImage ? (
          <img
            className="w-9 h-9 rounded-full object-cover saturate-50 group-hover:saturate-100"
            src={profilePhoto}
            alt="userProfile"
          />
        ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold bg-primary">
            {getInitial(displayName)}
          </div>
        )
      }
    >
      <ul className="text-dark dark:text-white-dark !py-0 w-[230px] font-semibold dark:text-white-light/90">
        
        {/* Profile */}
        <li>
          <div className="flex items-center px-4 py-4">
            {isValidImage ? (
              <img
                className="rounded-md w-10 h-10 object-cover shrink-0"
                src={profilePhoto}
                alt="userProfile"
              />
            ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold bg-primary">
                {getInitial(displayName)}
              </div>
            )}

            <div className="ltr:pl-4 rtl:pr-4 truncate min-w-0">
              <h4 className="text-base truncate">
                {displayName || "User"}
              </h4>
              <p className="text-black/60 dark:text-dark-light/60 text-sm truncate">
                {displayEmail || "—"}
              </p>
            </div>
          </div>
        </li>

        {/* Logout */}
        <li className="border-t border-white-light dark:border-white-light/10">
          <button
            onClick={handleLogout}
            className="text-danger !py-3 w-full text-left"
          >
            <IconLogout className="w-4.5 h-4.5 ltr:mr-2 rtl:ml-2 rotate-90 shrink-0" />
            Sign Out
          </button>
        </li>
      </ul>
    </Dropdown>
  </div>
                    </div>
                </div>

                {/* horizontal menu */}
                <ul className="horizontal-menu hidden py-1.5 font-semibold px-6 lg:space-x-1.5 xl:space-x-8 rtl:space-x-reverse bg-white border-t border-[#ebedf2] dark:border-[#191e3a] dark:bg-black text-black dark:text-white-dark">
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuDashboard className="shrink-0" />
                                <span className="px-1">{t('dashboard')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li>
                                <NavLink to="/">{t('sales')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/analytics">{t('analytics')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/finance">{t('finance')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/crypto">{t('crypto')}</NavLink>
                            </li>
                        </ul>
                    </li>
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuApps className="shrink-0" />
                                <span className="px-1">{t('apps')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li>
                                <NavLink to="/apps/chat">{t('chat')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/apps/mailbox">{t('mailbox')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/apps/todolist">{t('todo_list')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/apps/notes">{t('notes')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/apps/scrumboard">{t('scrumboard')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/apps/contacts">{t('contacts')}</NavLink>
                            </li>
                            <li className="relative">
                                <button type="button">
                                    {t('invoice')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/apps/invoice/list">{t('list')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/apps/invoice/preview">{t('preview')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/apps/invoice/add">{t('add')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/apps/invoice/edit">{t('edit')}</NavLink>
                                    </li>
                                </ul>
                            </li>
                            <li>
                                <NavLink to="/apps/calendar">{t('calendar')}</NavLink>
                            </li>
                        </ul>
                    </li>
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuComponents className="shrink-0" />
                                <span className="px-1">{t('components')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li>
                                <NavLink to="/components/tabs">{t('tabs')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/accordions">{t('accordions')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/modals">{t('modals')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/cards">{t('cards')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/carousel">{t('carousel')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/countdown">{t('countdown')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/counter">{t('counter')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/sweetalert">{t('sweet_alerts')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/timeline">{t('timeline')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/notifications">{t('notifications')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/media-object">{t('media_object')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/list-group">{t('list_group')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/pricing-table">{t('pricing_tables')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/components/lightbox">{t('lightbox')}</NavLink>
                            </li>
                        </ul>
                    </li>
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuElements className="shrink-0" />
                                <span className="px-1">{t('elements')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li>
                                <NavLink to="/elements/alerts">{t('alerts')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/avatar">{t('avatar')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/badges">{t('badges')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/breadcrumbs">{t('breadcrumbs')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/buttons">{t('buttons')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/buttons-group">{t('button_groups')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/color-library">{t('color_library')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/dropdown">{t('dropdown')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/infobox">{t('infobox')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/jumbotron">{t('jumbotron')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/loader">{t('loader')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/pagination">{t('pagination')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/popovers">{t('popovers')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/progress-bar">{t('progress_bar')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/search">{t('search')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/tooltips">{t('tooltips')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/treeview">{t('treeview')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/elements/typography">{t('typography')}</NavLink>
                            </li>
                        </ul>
                    </li>
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuDatatables className="shrink-0" />
                                <span className="px-1">{t('tables')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li>
                                <NavLink to="/tables">{t('tables')}</NavLink>
                            </li>
                            <li className="relative">
                                <button type="button">
                                    {t('datatables')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/datatables/basic">{t('basic')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/advanced">{t('advanced')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/skin">{t('skin')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/order-sorting">{t('order_sorting')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/multi-column">{t('multi_column')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/multiple-tables">{t('multiple_tables')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/alt-pagination">{t('alt_pagination')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/checkbox">{t('checkbox')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/range-search">{t('range_search')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/export">{t('export')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/datatables/column-chooser">{t('column_chooser')}</NavLink>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuForms className="shrink-0" />
                                <span className="px-1">{t('forms')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li>
                                <NavLink to="/forms/basic">{t('basic')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/input-group">{t('input_group')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/layouts">{t('layouts')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/validation">{t('validation')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/input-mask">{t('input_mask')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/select2">{t('select2')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/touchspin">{t('touchspin')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/checkbox-radio">{t('checkbox_and_radio')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/switches">{t('switches')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/wizards">{t('wizards')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/file-upload">{t('file_upload')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/quill-editor">{t('quill_editor')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/markdown-editor">{t('markdown_editor')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/date-picker">{t('date_and_range_picker')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/forms/clipboard">{t('clipboard')}</NavLink>
                            </li>
                        </ul>
                    </li>
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuPages className="shrink-0" />
                                <span className="px-1">{t('pages')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li className="relative">
                                <button type="button">
                                    {t('users')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/users/profile">{t('profile')}</NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/users/user-account-settings">{t('account_settings')}</NavLink>
                                    </li>
                                </ul>
                            </li>
                            <li>
                                <NavLink to="/pages/knowledge-base">{t('knowledge_base')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/pages/contact-us-boxed" target="_blank">
                                    {t('contact_us_boxed')}
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/pages/contact-us-cover" target="_blank">
                                    {t('contact_us_cover')}
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/pages/faq">{t('faq')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/pages/coming-soon-boxed" target="_blank">
                                    {t('coming_soon_boxed')}
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/pages/coming-soon-cover" target="_blank">
                                    {t('coming_soon_cover')}
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/pages/maintenence" target="_blank">
                                    {t('maintenence')}
                                </NavLink>
                            </li>
                            <li className="relative">
                                <button type="button">
                                    {t('error')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/pages/error404" target="_blank">
                                            {t('404')}
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/pages/error500" target="_blank">
                                            {t('500')}
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/pages/error503" target="_blank">
                                            {t('503')}
                                        </NavLink>
                                    </li>
                                </ul>
                            </li>
                            <li className="relative">
                                <button type="button">
                                    {t('login')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/auth/cover-login" target="_blank">
                                            {t('login_cover')}
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/auth/boxed-signin" target="_blank">
                                            {t('login_boxed')}
                                        </NavLink>
                                    </li>
                                </ul>
                            </li>
                            <li className="relative">
                                <button type="button">
                                    {t('register')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/auth/cover-register" target="_blank">
                                            {t('register_cover')}
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/auth/boxed-signup" target="_blank">
                                            {t('register_boxed')}
                                        </NavLink>
                                    </li>
                                </ul>
                            </li>
                            <li className="relative">
                                <button type="button">
                                    {t('password_recovery')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/auth/cover-password-reset" target="_blank">
                                            {t('recover_id_cover')}
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/auth/boxed-password-reset" target="_blank">
                                            {t('recover_id_boxed')}
                                        </NavLink>
                                    </li>
                                </ul>
                            </li>
                            <li className="relative">
                                <button type="button">
                                    {t('lockscreen')}
                                    <div className="ltr:ml-auto rtl:mr-auto rtl:rotate-90 -rotate-90">
                                        <IconCaretDown />
                                    </div>
                                </button>
                                <ul className="rounded absolute top-0 ltr:left-[95%] rtl:right-[95%] min-w-[180px] bg-white z-[10] text-dark dark:text-white-dark dark:bg-[#1b2e4b] shadow p-0 py-2 hidden">
                                    <li>
                                        <NavLink to="/auth/cover-lockscreen" target="_blank">
                                            {t('unlock_cover')}
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink to="/auth/boxed-lockscreen" target="_blank">
                                            {t('unlock_boxed')}
                                        </NavLink>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                    <li className="menu nav-item relative">
                        <button type="button" className="nav-link">
                            <div className="flex items-center">
                                <IconMenuMore className="shrink-0" />
                                <span className="px-1">{t('more')}</span>
                            </div>
                            <div className="right_arrow">
                                <IconCaretDown />
                            </div>
                        </button>
                        <ul className="sub-menu">
                            <li>
                                <NavLink to="/dragndrop">{t('drag_and_drop')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/charts">{t('charts')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/font-icons">{t('font_icons')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="/widgets">{t('widgets')}</NavLink>
                            </li>
                            <li>
                                <NavLink to="https://mdcare.sbthemes.com" target="_blank">
                                    {t('documentation')}
                                </NavLink>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>
        </header>
    );
};

export default Header;
