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
