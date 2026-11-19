import crypto from 'node:crypto';

// RFC 4226 (HOTP) + RFC 6238 (TOTP), implemented directly on Node's built-in crypto so MFA needs no
// new dependency. 160-bit secret, SHA-1/6-digit/30s step — the parameters every authenticator app
// (Google Authenticator, Authy, 1Password, etc.) assumes when no algorithm/digits/period is given.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TIME_STEP_SEC = 30;

function base32Encode(buf) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return output;
}

function base32Decode(str) {
    const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const char of clean) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

/** @returns {string} a fresh base32-encoded 160-bit secret, suitable for manual entry into an authenticator app. */
export function generateTotpSecret() {
    return base32Encode(crypto.randomBytes(20));
}

function hotp(secretBuf, counter) {
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, '0');
}

/** @param {string} base32Secret @param {number} [at] ms since epoch */
export function generateTotpCode(base32Secret, at = Date.now()) {
    return hotp(base32Decode(base32Secret), Math.floor(at / 1000 / TIME_STEP_SEC));
}

/**
 * Accepts a code from one step before/after now (±30s) to tolerate clock drift between the
 * server and the authenticator app, without widening the window enough to matter for brute force
 * (the rate limiter on the verify route is the real defense there).
 * @param {string} base32Secret @param {string} code @param {number} [at] ms since epoch
 */
export function verifyTotpCode(base32Secret, code, at = Date.now()) {
    if (!/^\d{6}$/.test(String(code || ''))) return false;
    const counter = Math.floor(at / 1000 / TIME_STEP_SEC);
    const secretBuf = base32Decode(base32Secret);
    for (let drift = -1; drift <= 1; drift++) {
        if (hotp(secretBuf, counter + drift) === code) return true;
    }
    return false;
}

/** @returns {string} an otpauth:// URI for authenticator apps that support scanning/pasting a URI. */
export function buildOtpauthUri({ secret, accountName, issuer = 'Codavia Health' }) {
    const label = encodeURIComponent(`${issuer}:${accountName}`);
    const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: String(TIME_STEP_SEC) });
    return `otpauth://totp/${label}?${params.toString()}`;
}

/** @returns {string[]} 10 human-typeable single-use backup codes (plaintext — caller must hash before storing). */
export function generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return codes;
}

export function hashBackupCode(code) {
    return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
