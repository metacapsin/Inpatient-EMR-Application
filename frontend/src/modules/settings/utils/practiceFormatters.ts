export function formatPhoneDisplay(val: string) {
    if (!val) return '—';
    const d = val.replace(/\D/g, '').slice(0, 10);
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return val;
}

export function autoFormatPhone(val: string) {
    const d = val.replace(/\D/g, '').slice(0, 10);
    if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    if (d.length > 0) return `(${d}`;
    return '';
}

export function autoFormatZip(val: string) {
    const d = val.replace(/\D/g, '').slice(0, 9);
    if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
    return d;
}

export function autoFormatEIN(val: string) {
    const d = val.replace(/\D/g, '').slice(0, 9);
    if (d.length > 2) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return d;
}

/**
 * Real NPI check digit (CMS NPI Final Rule, 69 FR 3434): prepend the US health-industry issuer
 * prefix "80840" to the first 9 digits and run the standard Luhn algorithm over the resulting
 * 14-digit string. Mirrors `backend/src/lib/npi.js` so client and server agree — a shape-only
 * regex (10 digits, first 1-9) accepts any number; this additionally proves it's a real NPI.
 */
export function npiCheckDigit(first9Digits: string): number {
    const digits = `80840${first9Digits}`.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        const posFromRight = digits.length - i;
        let d = digits[i];
        if (posFromRight % 2 === 0) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    }
    return (10 - (sum % 10)) % 10;
}

export function isValidNpi(npi: string): boolean {
    if (!/^[1-9]\d{9}$/.test(npi)) return false;
    return npiCheckDigit(npi.slice(0, 9)) === Number(npi[9]);
}
