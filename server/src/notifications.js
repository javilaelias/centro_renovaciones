const nodemailer = require('nodemailer');
const db = require('./db');
const { initTwilio, sendSms, buildSmsContent, resetTwilio } = require('./sms');
const { sendTelegram, buildTelegramContent } = require('./telegram');
const { ensureVapidKeys, sendPushToAll } = require('./push');

const ALERT_DAYS = [90, 60, 30, 7, 1];

const CATEGORIES = {
  domain:     { label: 'Dominio',     icon: '\u{1F310}' },
  ssl:        { label: 'SSL',         icon: '\u{1F512}' },
  hosting:    { label: 'Hosting',     icon: '\u{1F5A5}' },
  license:    { label: 'Licencia',    icon: '\u{1F4C4}' },
  insurance:  { label: 'Seguro',      icon: '\u{1F9E1}' },
  certificate:{ label: 'Certificado', icon: '\u{1F393}' },
  tuition:    { label: 'Colegiatura', icon: '\u{1F3EB}' },
  subscription:{ label: 'Suscripción', icon: '\u{1F4B0}' },
  warranty:   { label: 'Garantía',    icon: '\u{1F582}' },
};

let transporter = null;

function getTransporter() {
  const settings = db.getSettings();
  if (!settings.smtp_enabled || !settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: parseInt(settings.smtp_port) === 465,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });
  }
  return transporter;
}

function resetTransporter() {
  transporter = null;
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + 'T00:00:00');
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysLabel(days) {
  if (days < 0) return `Vencido hace ${Math.abs(days)} días`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `${days} días`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Build an HTML email for items that are expiring within the given thresholds.
 * Items are expected to already be filtered to those matching alert thresholds.
 */
function buildEmailContent(items) {
  const grouped = {};
  ALERT_DAYS.forEach(d => { grouped[d] = []; });

  items.forEach(item => {
    const days = daysUntil(item.expiryDate);
    if (days >= 0 && ALERT_DAYS.includes(days)) {
      grouped[days].push(item);
    }
  });

  const hasAny = Object.values(grouped).some(arr => arr.length > 0);
  if (!hasAny) return null;

  const today = formatDate(new Date().toISOString().split('T')[0]);
  let rows = '';

  Object.entries(grouped).forEach(([threshold, thresholdItems]) => {
    if (thresholdItems.length === 0) return;

    const urgency = parseInt(threshold) <= 7 ? 'urgent' : parseInt(threshold) <= 30 ? 'warning' : 'info';
    const color = urgency === 'urgent' ? '#ef4444' : urgency === 'warning' ? '#f97316' : '#3b82f6';
    const label = parseInt(threshold) === 1 ? '¡Vence mañana!' : `Vence en ${threshold} días`;

    rows += `
      <tr>
        <td style="padding:16px 0 8px 0;">
          <h3 style="margin:0;font-size:14px;color:${color};text-transform:uppercase;letter-spacing:0.5px;">
            ${label} (${thresholdItems.length})
          </h3>
        </td>
      </tr>
    `;

    thresholdItems.forEach(item => {
      const cat = CATEGORIES[item.category] || { label: item.category, icon: '' };
      rows += `
        <tr>
          <td style="padding:4px 0 4px 16px;border-left:3px solid ${color};">
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:15px;font-weight:600;color:#1e293b;">${cat.icon} ${item.name}</td>
                <td style="text-align:right;font-size:13px;color:#64748b;">${cat.label}</td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:4px;">
              <tr>
                <td style="font-size:13px;color:#64748b;">Vence: ${formatDate(item.expiryDate)}</td>
                ${item.cost != null ? `<td style="text-align:right;font-size:13px;color:#1e293b;font-weight:600;">$${parseFloat(item.cost).toFixed(2)}</td>` : ''}
              </tr>
            </table>
            ${item.provider ? `<div style="font-size:12px;color:#3b82f6;margin-top:2px;">${item.provider}</div>` : ''}
          </td>
        </tr>
      `;
    });
  });

  const totalItems = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px 12px 0 0;padding:24px 32px;">
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td>
                  <h1 style="margin:0;font-size:22px;color:#fff;font-weight:700;">\u{1F504} RenovaMEF</h1>
                  <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Resumen de renovaciones — ${today}</p>
                </td>
                <td style="text-align:right;">
                  <span style="display:inline-block;background:rgba(255,255,255,0.1);border-radius:20px;padding:6px 16px;font-size:14px;font-weight:700;color:#60a5fa;">${totalItems} alertas</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:8px 32px 24px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              ${rows || '<tr><td style="padding:24px 0;text-align:center;color:#94a3b8;font-size:14px;">No hay renovaciones próximas.</td></tr>'}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
            Este correo fue generado automáticamente por RenovaMEF.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Check all items and send email notifications for items that match alert thresholds.
 * Returns { sent: number, errors: number, message: string }
 */
async function checkAndNotify() {
  const settings = db.getSettings();
  const today = new Date().toISOString().split('T')[0];
  let totalSent = 0;
  let totalErrors = 0;
  const messages = [];

  // ---- Email Notifications ----

  if (settings.smtp_enabled) {
    // Prevent duplicate sends: skip if already checked today
    if (settings.last_check_date !== today) {
      const transport = getTransporter();
      if (transport) {
        const allItems = db.getAllItems();
        const alertItems = allItems.filter(item => {
          const days = daysUntil(item.expiryDate);
          return days >= 0 && ALERT_DAYS.includes(days) && item.alertEmail;
        });

        if (alertItems.length > 0) {
          const html = buildEmailContent(alertItems);
          if (html) {
            const toEmail = settings.smtp_from_email || settings.smtp_user;
            if (toEmail) {
              try {
                await transport.sendMail({
                  from: `"${settings.smtp_from_name || 'RenovaMEF'}" <${settings.smtp_from_email || settings.smtp_user}>`,
                  to: toEmail,
                  subject: `🔔 ${alertItems.length} renovaciones próximas — RenovaMEF`,
                  html,
                });
                totalSent += alertItems.length;
                messages.push(`Email: ${alertItems.length} alertas enviadas`);
                console.log(`[Email] Notificación enviada: ${alertItems.length} alertas`);
              } catch (err) {
                totalErrors++;
                messages.push(`Email error: ${err.message}`);
                console.error('[Email] Error:', err.message);
              }
            }
          }
        }
      }
    }
  }

  // ---- SMS Notifications ----
  if (settings.twilio_enabled && settings.twilio_account_sid && settings.twilio_auth_token) {
    const allItems = db.getAllItems();
    const smsItems = allItems.filter(item => {
      const days = daysUntil(item.expiryDate);
      return days >= 0 && ALERT_DAYS.includes(days) && item.alertWhatsApp;
    });

    if (smsItems.length > 0 && settings.twilio_to_number) {
      const smsBody = buildSmsContent(smsItems);
      if (smsBody) {
        initTwilio(settings.twilio_account_sid, settings.twilio_auth_token);
        try {
          const result = await sendSms(
            settings.twilio_to_number,
            smsBody,
            settings.twilio_from_number
          );
          if (result.success) {
            totalSent++;
            messages.push(`SMS: ${smsItems.length} alertas`);
          } else {
            totalErrors++;
            messages.push(`SMS error: ${result.message}`);
          }
        } catch (err) {
          totalErrors++;
          messages.push(`SMS error: ${err.message}`);
        } finally {
          resetTwilio();
        }
      }
    }
  }

  // ---- Telegram Notifications ----
  if (settings.telegram_enabled && settings.telegram_bot_token && settings.telegram_chat_id) {
    const allItems = db.getAllItems();
    const tgItems = allItems.filter(item => {
      const days = daysUntil(item.expiryDate);
      return days >= 0 && ALERT_DAYS.includes(days) && item.alertTelegram;
    });

    if (tgItems.length > 0) {
      const tgBody = buildTelegramContent(tgItems);
      if (tgBody) {
        try {
          const result = await sendTelegram(settings.telegram_bot_token, settings.telegram_chat_id, tgBody);
          if (result.success) {
            totalSent++;
            messages.push(`Telegram: ${tgItems.length} alertas`);
          } else {
            totalErrors++;
            messages.push(`Telegram error: ${result.message}`);
          }
        } catch (err) {
          totalErrors++;
          messages.push(`Telegram error: ${err.message}`);
        }
      }
    }
  }

  // ---- Push Notifications (Web Push) ----
  const pushSubs = db.getPushSubscriptions();
  if (pushSubs.length > 0) {
    const allItems = db.getAllItems();
    const pushItems = allItems.filter(item => {
      const days = daysUntil(item.expiryDate);
      return days >= 0 && ALERT_DAYS.includes(days);
    });

    if (pushItems.length > 0) {
      const vapid = ensureVapidKeys(settings, db.updateSettings);
      if (vapid) {
        try {
          const payload = {
            title: `\u{1F514} ${pushItems.length} renovaciones próximas`,
            body: pushItems.slice(0, 5).map(i => `${i.name} — ${getDaysLabel(daysUntil(i.expiryDate))}`).join('\n'),
            url: '/',
          };
          const result = await sendPushToAll(pushSubs, payload, db.removePushSubscription);
          if (result.sent > 0) {
            totalSent++;
            messages.push(`Push: ${result.sent} notificaciones`);
          }
          if (result.errors > 0) {
            totalErrors++;
            messages.push(`Push error: ${result.errors} suscripciones fallidas`);
          }
          if (result.gone > 0) {
            messages.push(`Push: ${result.gone} suscripciones inválidas eliminadas`);
          }
        } catch (err) {
          totalErrors++;
          messages.push(`Push error: ${err.message}`);
        }
      }
    }
  }

  // Update last check date
  db.updateSettings({ last_check_date: today });

  const finalMessage = messages.length > 0 ? messages.join(' · ') : 'Sin alertas pendientes';
  return { sent: totalSent, errors: totalErrors, message: finalMessage };
}

/**
 * Test email configuration by sending a test message.
 */
async function testEmail(settings) {
  const testTransporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: parseInt(settings.smtp_port) || 587,
    secure: parseInt(settings.smtp_port) === 465,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });

  const toEmail = settings.smtp_from_email || settings.smtp_user;

  try {
    await testTransporter.sendMail({
      from: `"${settings.smtp_from_name || 'RenovaMEF'}" <${settings.smtp_from_email || settings.smtp_user}>`,
      to: toEmail,
      subject: '\u2705 Prueba — RenovaMEF',
      html: `
        <h2 style="color:#10b981;">\u2705 Conexión SMTP exitosa</h2>
        <p>Este es un correo de prueba desde <strong>RenovaMEF</strong>.</p>
        <p>Si recibes este mensaje, la configuración de email es correcta y comenzarás a recibir alertas automáticas de renovaciones.</p>
        <hr/>
        <p style="color:#94a3b8;font-size:12px;">Enviado el ${new Date().toLocaleString('es-ES')}</p>
      `,
    });
    return { success: true, message: 'Email de prueba enviado correctamente' };
  } catch (err) {
    return { success: false, message: `Error: ${err.message}` };
  }
}

module.exports = {
  checkAndNotify,
  testEmail,
  buildEmailContent,
  resetTransporter,
  getTransporter,
};
