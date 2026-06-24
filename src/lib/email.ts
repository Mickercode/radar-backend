import { Resend } from 'resend';
import { env } from '../config/env';

// Singleton Resend client (lazy-initialized so backend can run without the key).
let _client: Resend | null = null;

function client(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(env.RESEND_API_KEY);
  return _client;
}

const FROM = env.EMAIL_FROM;

// ── HTML email layout ─────────────────────────────────────────────────────────

function layout(body: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'DM Sans',system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="color:#00c2cb;font-weight:700;font-size:20px;letter-spacing:-0.02em;">⚡ Radar</span>
            </td>
          </tr>
          <tr>
            <td style="background:#1e2438;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:28px 24px;color:#f7f7f9;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;color:#5a6378;font-size:13px;line-height:1.4;">
              <p style="margin:0 0 4px;">Radar — Understand once. Remember forever.</p>
              <p style="margin:0;">If you didn't expect this email, you can safely ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Welcome / signup confirmation ─────────────────────────────────────────────

function welcomeHtml(name: string | null): string {
  const greeting = name ? `Hey ${name},` : 'Hey there,';
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#f7f7f9;">
      Welcome to Radar
    </h1>
    <p style="margin:0 0 12px;color:#8892a4;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 12px;color:#8892a4;line-height:1.6;">
      You're all set. Radar will start sending you sharp, non-obvious insights about tech,
      business, and science — built for Nigeria.
    </p>
    <p style="margin:0 0 20px;color:#8892a4;line-height:1.6;">
      Every day you'll get new signals worth understanding. Save what matters, and Radar
      builds your personal knowledge web — automatically connecting ideas and reminding
      you before you forget.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td align="center" style="background:#00c2cb;border-radius:999px;padding:12px 28px;">
          <a href="${env.APP_URL}" style="color:#04141a;font-weight:600;font-size:15px;text-decoration:none;">
            Open Radar →
          </a>
        </td>
      </tr>
    </table>
  `, 'Welcome to Radar');
}

// ── Password reset ─────────────────────────────────────────────────────────────

function resetPasswordHtml(token: string): string {
  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#f7f7f9;">
      Reset your password
    </h1>
    <p style="margin:0 0 12px;color:#8892a4;line-height:1.6;">
      We received a request to reset your Radar password. Click the button below to
      choose a new one. This link expires in 1 hour.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td align="center" style="background:#00c2cb;border-radius:999px;padding:12px 28px;">
          <a href="${resetUrl}" style="color:#04141a;font-weight:600;font-size:15px;text-decoration:none;">
            Reset password →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#5a6378;font-size:13px;line-height:1.4;">
      If you didn't request this, you can safely ignore this email.
    </p>
  `, 'Reset your Radar password');
}

// ── Ingest digest ──────────────────────────────────────────────────────────────

function ingestDigestHtml(items: { title: string; type: string; source: string; url?: string }[]): string {
  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <a href="${item.url ?? env.APP_URL}" style="color:#f7f7f9;font-weight:600;font-size:15px;text-decoration:none;">
          ${item.title}
        </a>
        <p style="margin:2px 0 0;color:#5a6378;font-size:12px;">
          ${item.type} · ${item.source}
        </p>
      </td>
    </tr>`,
    )
    .join('');

  return layout(`
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f7f7f9;">
      New on Radar today
    </h1>
    <p style="margin:0 0 16px;color:#8892a4;font-size:14px;">
      ${items.length} new signal${items.length > 1 ? 's' : ''} worth understanding
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${itemRows}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td align="center" style="background:#00c2cb;border-radius:999px;padding:10px 24px;">
          <a href="${env.APP_URL}" style="color:#04141a;font-weight:600;font-size:14px;text-decoration:none;">
            See full feed →
          </a>
        </td>
      </tr>
    </table>
  `, 'New on Radar today');
}

// ── Capture confirmation ───────────────────────────────────────────────────────

function captureConfirmationHtml(insight: { title: string; what: string; why: string; edge: string }): string {
  return layout(`
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f7f7f9;">
      Saved to your Brain
    </h1>
    <p style="margin:0 0 20px;color:#8892a4;font-size:14px;">
      A new insight has been added to your knowledge web.
    </p>

    <h2 style="margin:0 0 12px;font-size:17px;font-weight:600;color:#f7f7f9;">
      ${insight.title}
    </h2>

    <div style="margin-bottom:14px;">
      <p style="margin:0 0 4px;color:#5a6378;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">
        🧩 What
      </p>
      <p style="margin:0;color:#8892a4;font-size:14px;line-height:1.5;">
        ${insight.what}
      </p>
    </div>

    <div style="margin-bottom:14px;">
      <p style="margin:0 0 4px;color:#5a6378;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">
        ⚡ Why it matters
      </p>
      <p style="margin:0;color:#8892a4;font-size:14px;line-height:1.5;">
        ${insight.why}
      </p>
    </div>

    <div style="margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#5a6378;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">
        🎯 Edge
      </p>
      <p style="margin:0;color:#f7f7f9;font-size:14px;line-height:1.5;">
        ${insight.edge}
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="background:#00c2cb;border-radius:999px;padding:10px 24px;">
          <a href="${env.APP_URL}" style="color:#04141a;font-weight:600;font-size:14px;text-decoration:none;">
            View in your Brain →
          </a>
        </td>
      </tr>
    </table>
  `, 'Saved to your Brain');
}

// ── Public send helpers ────────────────────────────────────────────────────────

/** Sends a welcome email to a newly registered user. Best-effort (never throws). */
export async function sendWelcomeEmail(email: string, name: string | null): Promise<void> {
  const c = client();
  if (!c) {
    console.log(`[email] RESEND_API_KEY not set — skipping welcome email to ${email}`);
    return;
  }
  try {
    await c.emails.send({ from: FROM, to: email, subject: 'Welcome to Radar 🚀', html: welcomeHtml(name) });
    console.log(`[email] welcome sent to ${email}`);
  } catch (e) {
    console.error(`[email] failed to send welcome to ${email}:`, (e as Error).message);
  }
}

/** Sends a password-reset email. Best-effort (never throws). */
export async function sendResetPasswordEmail(email: string, token: string): Promise<void> {
  const c = client();
  if (!c) {
    console.log(`[email] RESEND_API_KEY not set — skipping password-reset to ${email}`);
    return;
  }
  try {
    await c.emails.send({
      from: FROM,
      to: email,
      subject: 'Reset your Radar password',
      html: resetPasswordHtml(token),
    });
    console.log(`[email] password-reset sent to ${email}`);
  } catch (e) {
    console.error(`[email] failed to send password-reset to ${email}:`, (e as Error).message);
  }
}

/** Sends a capture confirmation email when a user manually saves an insight. Best-effort (never throws). */
export async function sendCaptureConfirmationEmail(
  email: string,
  insight: { title: string; what: string; why: string; edge: string },
): Promise<void> {
  const c = client();
  if (!c) {
    console.log(`[email] RESEND_API_KEY not set — skipping capture confirmation to ${email}`);
    return;
  }
  try {
    await c.emails.send({
      from: FROM,
      to: email,
      subject: `Saved: ${insight.title.slice(0, 60)}`,
      html: captureConfirmationHtml(insight),
    });
    console.log(`[email] capture confirmation sent to ${email}`);
  } catch (e) {
    console.error(`[email] failed to send capture confirmation to ${email}:`, (e as Error).message);
  }
}

/**
 * Sends an ingest digest to a user. Best-effort (never throws).
 * Items: list of { title, type, source, articleUrl? } for the digest.
 */
export async function sendIngestDigest(
  email: string,
  items: { title: string; type: string; source: string; articleUrl?: string | null }[],
): Promise<void> {
  const c = client();
  if (!c) {
    console.log(`[email] RESEND_API_KEY not set — skipping ingest digest to ${email}`);
    return;
  }
  if (items.length === 0) return;
  try {
    const digestItems = items.map((i) => ({ title: i.title, type: i.type, source: i.source, url: i.articleUrl ?? undefined }));
    await c.emails.send({
      from: FROM,
      to: email,
      subject: `📡 ${items.length} new signal${items.length > 1 ? 's' : ''} on Radar`,
      html: ingestDigestHtml(digestItems),
    });
    console.log(`[email] ingest digest sent to ${email} (${items.length} items)`);
  } catch (e) {
    console.error(`[email] failed to send ingest digest to ${email}:`, (e as Error).message);
  }
}
