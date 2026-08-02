/**
 * Telegram Notification Module
 * Sends renewal reminders to a Telegram chat via the Bot API.
 * No extra dependency needed: uses the global fetch (Node 18+).
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Send a text message to a Telegram chat using a bot token.
 * @param {string} botToken - Telegram bot token (from @BotFather)
 * @param {string|number} chatId - Chat ID (user, group or channel)
 * @param {string} text - Message text (plain text with emojis)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendTelegram(botToken, chatId, text) {
  if (!botToken || !chatId) {
    return { success: false, message: 'Token de bot y chat ID requeridos' };
  }
  if (!text) {
    return { success: false, message: 'Mensaje requerido' };
  }

  try {
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      const desc = json.description || `HTTP ${res.status}`;
      console.error('[Telegram] Error:', desc);
      return { success: false, message: `Error Telegram: ${desc}` };
    }

    console.log(`[Telegram] Mensaje enviado al chat ${chatId} (message_id ${json.result?.message_id})`);
    return { success: true, message: 'Mensaje de Telegram enviado' };
  } catch (err) {
    console.error('[Telegram] Error de red:', err.message);
    return { success: false, message: `Error Telegram: ${err.message}` };
  }
}

/**
 * Send a test message to verify the bot configuration.
 */
async function sendTestTelegram(settings) {
  const result = await sendTelegram(
    settings.telegram_bot_token,
    settings.telegram_chat_id,
    `✅ *Prueba Telegram — RenovaMEF*\n\nSi recibes este mensaje, la configuración de Telegram es correcta y comenzarás a recibir alertas automáticas de renovaciones.\n\nEnviado: ${new Date().toLocaleString('es-ES')}`
  );
  return result;
}

/**
 * Escape Telegram legacy-Markdown special characters in user-provided text.
 * Only the chars that are special in legacy Markdown are escaped (_ * ` [ ]),
 * so domain names like "aws.amazon.com" render without visible backslashes.
 */
function escapeMarkdown(text) {
  return String(text).replace(/([_*`\[\]])/g, '\\$1');
}

/**
 * Build a plain-text Telegram message from a list of items that match alert thresholds.
 */
function buildTelegramContent(items) {
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
      msg += `  ${icon} ${escapeMarkdown(item.name)} — ${daysLabel}\n`;
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
  sendTelegram,
  sendTestTelegram,
  buildTelegramContent,
};
