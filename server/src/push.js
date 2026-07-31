/**
 * Web Push Notification Module
 * Sends browser push notifications via the Web Push protocol (VAPID).
 * Requires the 'web-push' package.
 */

let webPush = null;
try {
  webPush = require('web-push');
} catch (e) {
  // web-push no instalado, se manejará al inicializar
}

const DEFAULT_VAPID_SUBJECT = 'mailto:dev@centro-renovaciones.local';

/**
 * Ensure VAPID keys exist, generating and persisting them if missing.
 * Prefers environment variables, then stored settings, then auto-generation.
 * @param {object} settings - current settings (may include vapid_public_key / vapid_private_key)
 * @param {function} persist - callback to save new keys (e.g. (keys) => db.updateSettings(keys))
 * @returns {{publicKey: string, privateKey: string, subject: string}|null} VAPID config or null
 */
function ensureVapidKeys(settings, persist) {
  if (!webPush) {
    console.error('[Push] web-push no está instalado. Ejecuta: npm install web-push');
    return null;
  }

  let publicKey = process.env.VAPID_PUBLIC_KEY || settings.vapid_public_key || '';
  let privateKey = process.env.VAPID_PRIVATE_KEY || settings.vapid_private_key || '';
  const subject = process.env.VAPID_SUBJECT || settings.vapid_subject || DEFAULT_VAPID_SUBJECT;

  if (!publicKey || !privateKey) {
    try {
      const keys = webPush.generateVAPIDKeys();
      publicKey = publicKey || keys.publicKey;
      privateKey = privateKey || keys.privateKey;
      if (persist) {
        persist({
          vapid_public_key: publicKey,
          vapid_private_key: privateKey,
          vapid_subject: subject,
        });
      }
    } catch (err) {
      console.error('[Push] Error generando claves VAPID:', err.message);
      return null;
    }
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
}

/**
 * Send a web push notification to a single subscription.
 * @param {object} subscription - PushSubscription JSON (endpoint, keys)
 * @param {object} payload - { title, body, url? }
 * @returns {Promise<{success: boolean, gone: boolean, message: string}>}
 */
async function sendPushToSubscription(subscription, payload) {
  if (!webPush || !subscription || !subscription.endpoint) {
    return { success: false, gone: false, message: 'web-push no configurado' };
  }

  const data = JSON.stringify(payload);
  try {
    await webPush.sendNotification(subscription, data);
    return { success: true, gone: false, message: 'Push enviado' };
  } catch (err) {
    // 404 / 410 => la suscripción ya no es válida, debe eliminarse
    const gone = err.statusCode === 404 || err.statusCode === 410;
    if (gone) {
      console.log(`[Push] Suscripción inválida (${err.statusCode}), eliminando ${subscription.endpoint}`);
    } else {
      console.error('[Push] Error enviando:', err.message);
    }
    return { success: false, gone, message: `Error Push: ${err.message}` };
  }
}

/**
 * Send a web push notification to all stored subscriptions.
 * @param {Array<object>} subscriptions
 * @param {object} payload
 * @param {function} onGone - callback(endpoint) to remove invalid subscriptions
 * @returns {Promise<{sent: number, errors: number, gone: number}>}
 */
async function sendPushToAll(subscriptions, payload, onGone) {
  let sent = 0;
  let errors = 0;
  let gone = 0;

  for (const sub of subscriptions) {
    let subObj = sub;
    try {
      subObj = typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : (sub.subscription || sub);
    } catch (e) {
      console.error('[Push] Suscripción corrupta, omitiendo:', sub.endpoint);
      errors++;
      continue;
    }
    const result = await sendPushToSubscription(subObj, payload);
    if (result.success) {
      sent++;
    } else {
      errors++;
      if (result.gone && onGone && sub.endpoint) {
        gone++;
        onGone(sub.endpoint);
      }
    }
  }

  return { sent, errors, gone };
}

/**
 * Send a test push notification to a specific subscription.
 */
async function sendTestPush(subscription) {
  return sendPushToSubscription(subscription, {
    title: '✅ Prueba Push — Centro de Renovaciones',
    body: 'Si recibes esta notificación, las notificaciones push están funcionando correctamente.',
    url: '/',
  });
}

module.exports = {
  ensureVapidKeys,
  sendPushToSubscription,
  sendPushToAll,
  sendTestPush,
};
