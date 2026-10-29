import nodemailer from 'nodemailer';
import { config, isProd } from '../config.js';

let transporter = null;
let transporterInitFailed = false;

function getTransporter() {
    // Never send real mail from the automated test suite (it invites made-up @test.example
    // addresses repeatedly) even if real SMTP creds happen to be configured in .env.
    if (config.env === 'test') return null;
    if (!config.smtp.host) return null;
    if (transporter || transporterInitFailed) return transporter;
    try {
        transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.port === 465,
            auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
            // Matches the known-working Gmail SMTP config already used elsewhere in this project
            // (EMR-Backend's api/services/sendemail.js) — harmless for other providers too.
            tls: { rejectUnauthorized: false },
        });
    } catch (e) {
        transporterInitFailed = true;
        console.error('[email] failed to create SMTP transport:', e.message);
    }
    return transporter;
}

/**
 * Sends an email via SMTP when SMTP_HOST (see config.js/.env.example) is configured; otherwise logs
 * it instead (dev/test fallback — no mail transport configured). Returns whether it actually sent.
 */
export async function sendEmail({ to, subject, html, text }) {
    const t = getTransporter();
    if (!t) {
        if (!isProd) console.log(`[email:stub] to=${to} subject="${subject}"\n${text ?? html}`);
        return { sent: false };
    }
    try {
        await t.sendMail({ from: config.smtp.from, to, subject, html, text });
        return { sent: true };
    } catch (e) {
        console.error(`[email] send to ${to} failed:`, e.message);
        return { sent: false };
    }
}
