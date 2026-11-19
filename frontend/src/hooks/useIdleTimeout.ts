import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppDispatch, IRootState } from '../store';
import { logoutUser } from '../store/authSlice';

const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const IDLE_WARNING_TOAST_ID = 'idle-timeout-warning';

/** SEC-07: auto-signs out an inactive staff session after IDLE_TIMEOUT_MS, with a one-minute
 *  warning first. No-ops when there's no session to time out. Mount once near the app root. */
export function useIdleTimeout() {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const token = useSelector((s: IRootState) => s.auth.token);
    const timers = useRef<{ warn?: ReturnType<typeof setTimeout>; logout?: ReturnType<typeof setTimeout> }>({});

    useEffect(() => {
        if (!token) return;

        function clearTimers() {
            if (timers.current.warn) clearTimeout(timers.current.warn);
            if (timers.current.logout) clearTimeout(timers.current.logout);
        }

        function reset() {
            clearTimers();
            timers.current.warn = setTimeout(() => {
                toast.warning('You will be signed out soon due to inactivity.', {
                    id: IDLE_WARNING_TOAST_ID,
                    duration: WARNING_BEFORE_MS,
                });
            }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
            timers.current.logout = setTimeout(() => {
                toast.dismiss(IDLE_WARNING_TOAST_ID);
                toast.error('Signed out due to inactivity.');
                void dispatch(logoutUser());
                navigate('/login', { replace: true });
            }, IDLE_TIMEOUT_MS);
        }

        reset();
        ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
        return () => {
            clearTimers();
            ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
        };
    }, [token, dispatch, navigate]);
}
