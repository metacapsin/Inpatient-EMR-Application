import net from 'node:net';
import { sendEmail } from './email.js';
import { parseAck } from './hl7Adt.js';

/**
 * Delivery adapters for ADT notifications, selected by `notification_recipients.transport`:
 *   stub           log only (dev / no vendor)
 *   https_webhook  POST the HL7 message as text/plain; `Authorization` header from auth_header_secret
 *   mllp           raw TCP with MLLP framing (<VT>msg<FS><CR>), waits for an ACK and checks MSA-1
 *   email          HL7 body via lib/email.js (nodemailer / stub)
 *   direct         reserved for Direct Secure Messaging — not configured
 * Each returns { ok: true, detail } or throws an Error whose message becomes `last_error`.
 */
const MLLP_SB = '\x0b', MLLP_EB = '\x1c', MLLP_CR = '\x0d';

async function viaWebhook(recipient, message) {
    if (!recipient.endpoint) throw new Error('Recipient has no endpoint URL');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
        const res = await fetch(recipient.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'x-application/hl7-v2+er7; charset=utf-8', ...(recipient.auth_header_secret ? { Authorization: recipient.auth_header_secret } : {}) },
            body: message,
            signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
        return { ok: true, detail: `HTTP ${res.status}` };
    } catch (e) {
        throw new Error(e.name === 'AbortError' ? 'Webhook timed out' : `Webhook failed: ${e.cause?.message || e.message}`);
    } finally {
        clearTimeout(timer);
    }
}

function viaMllp(recipient, message) {
    const m = /^(?:mllp:\/\/)?([^:/]+):(\d+)/.exec(recipient.endpoint ?? '');
    if (!m) throw new Error('MLLP endpoint must be host:port');
    const [, host, port] = m;
    return new Promise((resolve, reject) => {
        const sock = net.createConnection({ host, port: Number(port) });
        let buf = '';
        const fail = (err) => { sock.destroy(); reject(new Error(`MLLP failed: ${err.message || err}`)); };
        sock.setTimeout(15000, () => fail(new Error('timed out waiting for ACK')));
        sock.on('error', fail);
        sock.on('connect', () => sock.write(MLLP_SB + message + MLLP_EB + MLLP_CR));
        sock.on('data', (d) => {
            buf += d.toString('utf8');
            if (buf.includes(MLLP_EB)) {
                const ack = parseAck(buf.replace(MLLP_SB, '').split(MLLP_EB)[0]);
                sock.end();
                ack.accepted ? resolve({ ok: true, detail: `ACK ${ack.code}` }) : reject(new Error(`NACK ${ack.code ?? ''} ${ack.text ?? ''}`.trim()));
            }
        });
    });
}

async function viaEmail(recipient, message, subject) {
    if (!recipient.endpoint) throw new Error('Recipient has no email address');
    const r = await sendEmail({ to: recipient.endpoint, subject, text: message.replace(/\r/g, '\n') });
    return { ok: true, detail: r.sent ? 'email sent' : 'email stubbed (no SMTP configured)' };
}

export async function deliverAdt(recipient, message, { subject = 'ADT notification' } = {}) {
    switch (recipient.transport) {
        case 'stub':
            console.log(`[adt-notification:stub] → ${recipient.name ?? 'stub'}\n${message.replace(/\r/g, '\n')}`);
            return { ok: true, detail: 'stub (logged)' };
        case 'https_webhook': return viaWebhook(recipient, message);
        case 'mllp': return viaMllp(recipient, message);
        case 'email': return viaEmail(recipient, message, subject);
        case 'direct': throw new Error('Direct Secure Messaging transport is not configured');
        default: throw new Error(`Unknown transport '${recipient.transport}'`);
    }
}
