import type { User } from '../store/authSlice';

/** Prefer stable provider identifiers for sign-off audit trails. */
export function providerSignUserIdFromUser(user: User | null): string {
    if (!user) return '';
    const raw = user.id ?? user._id ?? user.providerId ?? user.userId;
    return typeof raw === 'string' ? raw.trim() : '';
}

export function providerDisplayNameFromUser(user: User | null): string {
    if (!user) return '';
    const name = user.name ?? user.displayName ?? user.fullName ?? user.username ?? user.email;
    return String(name ?? '').trim();
}
