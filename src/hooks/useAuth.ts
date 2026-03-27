import { useSelector, useDispatch } from 'react-redux';
import { IRootState, AppDispatch } from '../store';
import { logout, loginUser, registerUser, fetchCloudSubscriptions, User } from '../store/authSlice';

export const useAuth = () => {
    const dispatch = useDispatch<AppDispatch>();
    const token = useSelector((state: IRootState) => state.auth.token);
    const user = useSelector((state: IRootState) => state.auth.user);
    const role = useSelector((state: IRootState) => state.auth.role);
    const cloudSubscriptions = useSelector((state: IRootState) => state.auth.cloudSubscriptions);
    const loading = useSelector((state: IRootState) => state.auth.loading);

    return {
        token,
        user,
        role,
        cloudSubscriptions,
        loading,
        login: (email: string, password: string) => dispatch(loginUser({ email, password })),
        register: (username: string, email: string, password: string, address?: string, industry?: string, subdomain?: string) =>
            dispatch(registerUser({ username, email, password, address, industry, subdomain })),
        logout: () => dispatch(logout()),
        fetchCloudSubscriptions: () => dispatch(fetchCloudSubscriptions()),
    };
};

