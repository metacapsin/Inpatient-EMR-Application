import crypto from 'node:crypto';
import { config } from '../config.js';

// AES-256-GCM at-rest encryption for the few secret fields this app itself stores (e.g. a webhook
// recipient's Authorization header value, SEC-12). Not for passwords — those stay bcrypt — this is
// for values the app needs back in plaintext later to use them itself.
const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // 96-bit nonce, the GCM-recommended size

function keyBuf() {
    const key = config.encryptionKey;
    // 64 hex chars = 32 bytes = AES-256. Validated at startup in config.js when required (production);
    // re-checked here so a bad key fails the specific operation instead of crashing boot in dev.
    if (!/^[0-9a-f]{64}$/i.test(key || '')) {
        throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) — see backend/.env.example');
    }
    return Buffer.from(key, 'hex');
}

/**
 * @param {string} plaintext
 * @returns {string} `iv:authTag:ciphertext`, each base64 — safe to store in a TEXT column
 */
export function encryptSecret(plaintext) {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, keyBuf(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/**
 * @param {string} stored
 * @returns {string}
 */
export function decryptSecret(stored) {
    const [ivB64, tagB64, ctB64] = String(stored).split(':');
    if (!ivB64 || !tagB64 || !ctB64) throw new Error('Malformed encrypted value');
    const decipher = crypto.createDecipheriv(ALGO, keyBuf(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
}

/** True for a value already in `encryptSecret()`'s `iv:tag:ciphertext` shape — used by the one-off
 * migration backfill to tell an already-encrypted row from a legacy plaintext one. */
export function looksEncrypted(value) {
    return typeof value === 'string' && /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(value);
}
