/**
 * Real NPI check-digit validation (CMS NPI Final Rule, 69 FR 3434): prepend the fixed US
 * health-industry issuer prefix "80840" to an NPI's first 9 digits, run the standard Luhn
 * algorithm over the resulting 14-digit string, and the result must equal the NPI's 10th digit.
 * A shape-only regex (`^[1-9]\d{9}$`) accepts any 10 digits starting 1-9 — this additionally
 * proves the number is internally consistent, not just well-formed.
 */
export function npiCheckDigit(first9Digits) {
    const digits = `80840${first9Digits}`.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        const posFromRight = digits.length - i; // 1-indexed; rightmost = 1
        let d = digits[i];
        if (posFromRight % 2 === 0) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    }
    return (10 - (sum % 10)) % 10;
}

export function isValidNpi(npi) {
    if (!/^[1-9]\d{9}$/.test(npi)) return false;
    return npiCheckDigit(npi.slice(0, 9)) === Number(npi[9]);
}
