// NIST 800-63B: a minimum length and a check against commonly-used/compromised passwords beat
// composition rules (forced uppercase/digit/symbol) and periodic rotation, which push users toward
// predictable patterns. This is a small local list, not a breach-database lookup (no external call
// during registration) — it catches the passwords someone actually types out of habit.
const COMMON_PASSWORDS = new Set(
    [
        'password',
        'password1',
        'password123',
        '12345678',
        '123456789',
        '1234567890',
        'qwertyuiop',
        'qwerty123',
        'letmein123',
        'welcome123',
        'admin12345',
        'iloveyou12',
        'changeme123',
        'football123',
        'baseball123',
        'dragon1234',
        'monkey1234',
        'sunshine12',
        'princess12',
        'trustno1!!',
        'abc12345678',
        '1q2w3e4r5t',
        'passw0rd123',
        'letmein1234',
        'qwerty12345',
    ].map((p) => p.toLowerCase()),
);

export const PASSWORD_MIN_LENGTH = 10;

/** @param {string} password @returns {string | null} a user-facing rejection reason, or null if acceptable. */
export function checkPasswordPolicy(password) {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        return 'This password is too common. Choose something less predictable.';
    }
    return null;
}
