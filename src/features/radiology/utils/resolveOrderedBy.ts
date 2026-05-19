import type { IRootState } from '../../../store';

export function resolveOrderedBy(user: IRootState['auth']['user']): { id: string; name: string } {
    if (!user) return { id: 'unknown', name: 'Unknown user' };
    const id = String(user.id ?? user._id ?? user.username ?? user.email ?? 'unknown');
    const name =
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        String(user.name ?? user.displayName ?? user.username ?? user.email ?? 'Clinical user');
    return { id, name };
}
