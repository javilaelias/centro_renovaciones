/**
 * SMS Notification Module
 * Sends SMS reminders via Twilio for upcoming renewals.
 */

let twilioClient = null;
let twilio = null;
try {
  twilio = require('twilio');
} catch (e) {
  // Twilio no instalado, se manejará en initTwilio
}

/**
 * Initialize (or re-initialize) the Twilio client with the given credentials.
 * Returns true if the client was created successfully.
 */
function initTwilio(accountSid, authToken) {
  if (!accountSid || !authToken) {
    twilioClient = null;
    return false;
  }

  try {
    if (!twilio) {
      console.error('[SMS] Twilio no está instalado. Ejecuta: npm install twilio');
      return false;
    }
    twilioClient = twilio(accountSid, authToken);
    return true;
  } catch (err) {
    console.error('[SMS] Error initializing Twilio:', err.message);
    twilioClient = null;
    return false;
  }
}

function resetTwilio() {
  twilioClient = null;
}

/**
 * Send an SMS via Twilio.
 * @param {string} to - Recipient phone number (E.164 format, e.g. +521234567890)
 * @param {string} body - Message text
 * @param {string} from - Twilio phone number
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendSms(to, body, from) {
  if (!twilioClient) {
    return { success: false, message: 'Twilio no configurado' };
  }

  if (!to || !body) {
    return { success: false, message: 'Destino y mensaje requeridos' };
  }

  try {
    const message = await twilioClient.messages.create({
      from: from,
      to: to,
      body: body,
    });

    console.log(`[SMS] Enviado a ${to}: ${message.sid}`);
    return { success: true, message: `SMS enviado (${message.sid})` };
  } catch (err) {
    console.error(`[SMS] Error enviando a ${to}:`, err.message);
    return { success: false, message: `Error SMS: ${err.message}` };
  }
}

/**
 * Send a test SMS to verify configuration.
 */
async function sendTestSms(settings) {
  const initialized = initTwilio(settings.twilio_account_sid, settings.twilio_auth_token);
  if (!initialized) {
    return { success: false, message: 'No se pudo inicializar Twilio. Verifica las credenciales.' };
  }

  const result = await sendSms(
    settings.twilio_to_number,
    `✅ Prueba SMS — RenovaMEF\n\nSi recibes este mensaje, la configuración de SMS es correcta.\n\nEnviado: ${new Date().toLocaleString('es-ES')}`,
    settings.twilio_from_number
  );

  resetTwilio();
  return result;
}

/**
 * Build a plain-text SMS message from a list of items that match alert thresholds.
 */
function buildSmsContent(items) {
  const ALERT_DAYS = [90, 60, 30, 7, 1];

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

  const CATEGORY_ICONS = {
    domain: '🌐', ssl: '🔒', hosting: '🖥️', license: '📄',
    insurance: '🪪', certificate: '🎓', tuition: '🏫',
    subscription: '💰', warranty: '🔐'
  };

  let msg = '🔔 *RenovaMEF*\n';
  msg += 'Próximos vencimientos:\n\n';

  Object.entries(grouped).forEach(([threshold, thresholdItems]) => {
    if (thresholdItems.length === 0) return;

    const label = parseInt(threshold) === 1 ? '⚠️ ¡Vence mañana!' : `📅 Vence en ${threshold} días`;
    msg += `▸ ${label} (${thresholdItems.length}):\n`;

    thresholdItems.forEach(item => {
      const icon = CATEGORY_ICONS[item.category] || '📌';
      const days = daysUntil(item.expiryDate);
      const daysLabel = days < 0 ? `Vencido hace ${Math.abs(days)}d` :
                        days === 0 ? 'Hoy' :
                        days === 1 ? 'Mañana' : `${days}d`;
      msg += `  ${icon} ${item.name} — ${daysLabel}\n`;
    });
    msg += '\n';
  });

  msg += '---\nRenovaMEF';
  return msg;
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + 'T00:00:00');
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

module.exports = {
  initTwilio,
  resetTwilio,
  sendSms,
  sendTestSms,
  buildSmsContent,
};
