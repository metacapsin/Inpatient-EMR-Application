import React from 'react';
import { useSelector } from 'react-redux';
import { IRootState } from '../../store';

/** Admin can always pass — matches the backend's requireRole() default (SEC-04/05 reads; the
 *  separate, narrower requireClinicalRole() used for sign/dispense/acknowledge actions has no
 *  frontend equivalent yet, since no UI currently lets an admin attempt those actions). */
export function hasRole(role: string | null | undefined, allowed: readonly string[]): boolean {
    return role === 'admin' || (!!role && allowed.includes(role));
}

interface RoleGuardProps {
    roles: readonly string[];
    children: React.ReactNode;
    /** Shown instead of children when the role doesn't match. Defaults to a plain message — the
     *  backend is the real enforcement; this is just so the user isn't staring at a silently-broken
     *  page or a wall of failed network requests. */
    fallback?: React.ReactNode;
}

/** Role-gates a piece of UI to match a backend requireRole() gate (SEC-04/05/17). Render-only — the
 *  backend is the actual authority; this exists so a role without access sees a clear message
 *  instead of a page that renders and then silently 403s on every data fetch. */
const RoleGuard: React.FC<RoleGuardProps> = ({ roles, children, fallback }) => {
    const role = useSelector((state: IRootState) => state.auth.role);
    if (hasRole(role, roles)) return <>{children}</>;
    return (
        <>
            {fallback ?? (
                <div className="flex min-h-[40vh] items-center justify-center p-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Your role doesn't have access to this page.
                    </p>
                </div>
            )}
        </>
    );
};

export default RoleGuard;
