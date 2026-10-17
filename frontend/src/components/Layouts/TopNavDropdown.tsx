import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import IconCaretDown from '../Icon/IconCaretDown';
import type { MainNavLink } from './mainNavConfig';
import {
    emrTopNavDropdownClass,
    emrTopNavItemActiveClass,
    emrTopNavItemBaseClass,
    emrTopNavItemIdleClass,
} from '../../styles/emrLayoutClasses';

export function dropdownItemClass(isActive: boolean) {
    return [
        'block px-3 py-2 text-[12.5px] font-medium transition-colors duration-150',
        isActive
            ? 'bg-emr-active font-semibold text-emr-accent dark:bg-primary/15 dark:text-primary-200'
            : 'text-emr-text hover:bg-emr-hover hover:text-emr-accent dark:text-gray-300 dark:hover:bg-white/5',
    ].join(' ');
}

export function TopNavDropdownPanel({
    open,
    children,
    className = '',
    menuId = 'top-nav-dropdown-menu',
    align = 'start',
}: {
    open: boolean;
    children: ReactNode;
    className?: string;
    menuId?: string;
    /** `end` anchors the panel to the trigger's right edge (nav items near global search). */
    align?: 'start' | 'end';
}) {
    return (
        <div
            className={[
                'absolute top-full z-[60] pt-1.5',
                align === 'end' ? 'right-0 left-auto' : 'left-0',
                open ? 'pointer-events-auto' : 'pointer-events-none',
            ].join(' ')}
        >
            <div
                id={menuId}
                role="menu"
                aria-hidden={!open}
                className={[
                    emrTopNavDropdownClass,
                    'origin-top transition-all duration-200 ease-out',
                    open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-[0.98] opacity-0',
                    className,
                ].join(' ')}
            >
                {children}
            </div>
        </div>
    );
}

interface TopNavDropdownProps {
    label: string;
    items: readonly MainNavLink[];
    sectionActive: boolean;
    icon: ReactNode;
    minWidthClass?: string;
    menuAlign?: 'start' | 'end';
    onNavigate?: () => void;
}

export function TopNavDropdown({
    label,
    items,
    sectionActive,
    icon,
    minWidthClass = 'min-w-[220px]',
    menuAlign = 'start',
    onNavigate,
}: TopNavDropdownProps) {
    const menuId = useId();
    const [open, setOpen] = useState(false);
    const [hover, setHover] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);

    const isOpen = open || hover;

    const close = useCallback(() => {
        setOpen(false);
        setHover(false);
    }, []);

    const focusItem = useCallback((index: number) => {
        const links = menuRef.current?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]');
        links?.[index]?.focus();
    }, []);

    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        switch (event.key) {
            case 'ArrowDown':
            case 'Enter':
            case ' ':
                event.preventDefault();
                setOpen(true);
                requestAnimationFrame(() => focusItem(0));
                break;
            case 'Escape':
                close();
                break;
            default:
                break;
        }
    };

    const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        const links = menuRef.current?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]');
        if (!links?.length) return;

        const currentIndex = Array.from(links).findIndex((el) => el === document.activeElement);

        switch (event.key) {
            case 'ArrowDown': {
                event.preventDefault();
                const next = currentIndex < links.length - 1 ? currentIndex + 1 : 0;
                focusItem(next);
                break;
            }
            case 'ArrowUp': {
                event.preventDefault();
                const prev = currentIndex > 0 ? currentIndex - 1 : links.length - 1;
                focusItem(prev);
                break;
            }
            case 'Escape':
                event.preventDefault();
                close();
                triggerRef.current?.focus();
                break;
            case 'Tab':
                close();
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            close();
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [isOpen, close]);

    const triggerClass = [
        emrTopNavItemBaseClass,
        'group',
        sectionActive || isOpen ? emrTopNavItemActiveClass : emrTopNavItemIdleClass,
    ].join(' ');

    return (
        <li
            className="relative shrink-0"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <button
                ref={triggerRef}
                type="button"
                className={triggerClass}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                onClick={() => setOpen((o) => !o)}
                onKeyDown={handleTriggerKeyDown}
            >
                {icon}
                <span className="whitespace-nowrap">{label}</span>
                <IconCaretDown
                    className={`h-3 w-3 shrink-0 opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                />
            </button>

            <TopNavDropdownPanel open={isOpen} menuId={menuId} className={minWidthClass} align={menuAlign}>
                <ul
                    ref={menuRef}
                    className="py-0.5"
                    role="presentation"
                    onKeyDown={handleMenuKeyDown}
                >
                    {items.map((item) => (
                        <li key={item.to} role="none">
                            <NavLink
                                to={item.to}
                                end={item.end}
                                title={item.title}
                                role="menuitem"
                                className={({ isActive }) => dropdownItemClass(isActive)}
                                onClick={() => {
                                    close();
                                    onNavigate?.();
                                }}
                            >
                                <span className="line-clamp-2 leading-snug">{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </TopNavDropdownPanel>
        </li>
    );
}
