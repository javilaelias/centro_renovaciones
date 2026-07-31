const express = require('express');
const router = express.Router();
const db = require('./db');
const { checkAndNotify, testEmail, resetTransporter } = require('./notifications');
const { sendTestSms, initTwilio, resetTwilio } = require('./sms');
const { sendTestTelegram } = require('./telegram');
const { ensureVapidKeys, sendTestPush } = require('./push');

// ---- Item routes (collection-level, no :id) ----

// GET /api/items - List all items
router.get('/', (req, res) => {
  const items = db.getAllItems();
  res.json({ success: true, data: items });
});

// POST /api/items - Create item
router.post('/', (req, res) => {
  const { name, category, expiryDate, cost, provider, notes, alertEmail, alertWhatsApp, alertTelegram } = req.body;

  // Validation
  const errors = [];
  if (!name || !name.trim()) errors.push('El nombre es obligatorio');
  if (!category) errors.push('La categoría es obligatoria');
  if (!expiryDate) errors.push('La fecha de vencimiento es obligatoria');

  const validCategories = ['domain', 'ssl', 'hosting', 'license', 'insurance', 'certificate', 'tuition', 'subscription', 'warranty'];
  if (category && !validCategories.includes(category)) {
    errors.push('Categoría inválida');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors.join('. ') });
  }

  try {
    const item = db.createItem({
      name: name.trim(),
      category,
      expiryDate,
      cost: cost != null ? parseFloat(cost) : null,
      provider: provider || '',
      notes: notes || '',
      alertEmail: !!alertEmail,
      alertWhatsApp: !!alertWhatsApp,
      alertTelegram: !!alertTelegram,
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al crear el item' });
  }
});

// DELETE /api/items - Clear ALL items
router.delete('/', (req, res) => {
  db.deleteAllItems();
  res.json({ success: true, message: 'Todos los items han sido eliminados' });
});

// POST /api/items/seed - Seed demo data
router.post('/seed', (req, res) => {
  const today = new Date();
  const d = (offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
  };

  const demos = [
    { name: 'midominio.com', category: 'domain', expiryDate: d(120), cost: 14.99, provider: 'namecheap.com', notes: 'Dominio .com, renovación anual', alertEmail: true },
    { name: "SSL Let's Encrypt - Apache", category: 'ssl', expiryDate: d(45), cost: 0, provider: 'letsencrypt.org', notes: 'Certificado SSL gratuito, renovación automática', alertEmail: true, alertWhatsApp: true },
    { name: 'HostGator Plan Básico', category: 'hosting', expiryDate: d(15), cost: 89.99, provider: 'hostgator.com', notes: 'Hosting compartido, 1 sitio web, 10GB SSD', alertEmail: true, alertWhatsApp: true, alertTelegram: true },
    { name: 'Microsoft 365 Personal', category: 'license', expiryDate: d(3), cost: 69.99, provider: 'microsoft.com', notes: 'Suscripción anual con 1TB OneDrive', alertEmail: true, alertWhatsApp: true },
    { name: 'Seguro Auto AXA', category: 'insurance', expiryDate: d(-5), cost: 450.00, provider: 'axa.mx', notes: 'Seguro de responsabilidad civil, pago anual', alertEmail: true, alertWhatsApp: true },
    { name: 'Certificado SSL EV - Tienda', category: 'certificate', expiryDate: d(75), cost: 299.00, provider: 'comodo.com', notes: 'SSL Extended Validation para tienda en línea', alertEmail: true },
    { name: 'Colegiatura Semestral - Ana', category: 'tuition', expiryDate: d(25), cost: 3800.00, provider: 'universidad.edu.mx', notes: 'Inscripción semestre Agosto-Diciembre', alertEmail: true, alertWhatsApp: true },
    { name: 'Netflix Premium', category: 'subscription', expiryDate: d(55), cost: 17.99, provider: 'netflix.com', notes: 'Plan Premium 4K, 4 pantallas simultáneas', alertEmail: true },
    { name: 'Garantía Laptop Dell XPS', category: 'warranty', expiryDate: d(210), cost: 0, provider: 'dell.com', notes: 'Garantía extendida Plus 3 años', alertEmail: true },
    { name: 'aws.amazon.com', category: 'domain', expiryDate: d(1), cost: 12.00, provider: 'aws.amazon.com', notes: 'Dominio .com, ¡vence mañana!', alertEmail: true, alertWhatsApp: true, alertTelegram: true },
    { name: 'DigitalOcean Droplet', category: 'hosting', expiryDate: d(7), cost: 6.00, provider: 'digitalocean.com', notes: 'Servidor VPS básico, pago mensual', alertEmail: true, alertWhatsApp: true },
    { name: 'Dropbox Plus', category: 'subscription', expiryDate: d(90), cost: 119.99, provider: 'dropbox.com', notes: 'Plan anual 2TB de almacenamiento', alertEmail: true },
  ];

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  const withIds = demos.map(item => ({
    ...item,
    id: genId(),
    createdAt: now,
  }));

  const items = db.seedItems(withIds);
  res.json({ success: true, data: items, message: `${demos.length} items de ejemplo insertados` });
});

// POST /api/items/import - Import items from JSON
router.post('/import', (req, res) => {
  const { items: importedItems } = req.body;

  if (!Array.isArray(importedItems) || importedItems.length === 0) {
    return res.status(400).json({ success: false, error: 'Se requiere un array de items' });
  }

  const validCategories = ['domain', 'ssl', 'hosting', 'license', 'insurance', 'certificate', 'tuition', 'subscription', 'warranty'];
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  const prepared = importedItems
    .filter(item => {
      if (!item.name || !item.category || !item.expiryDate) return false;
      if (!validCategories.includes(item.category)) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)) return false;
      if (item.cost != null && (isNaN(parseFloat(item.cost)) || parseFloat(item.cost) < 0)) return false;
      return true;
    })
    .map(item => ({
      ...item,
      id: genId(),
      createdAt: now,
    }));

  if (prepared.length === 0) {
    return res.status(400).json({ success: false, error: 'No hay items válidos para importar' });
  }

  const items = db.seedItems(prepared);
  res.json({ success: true, data: items, message: `${prepared.length} items importados` });
});

// ---- Settings Routes (registered before any /:id route) ----

// GET /api/settings - Get all notification settings
router.get('/settings', (req, res) => {
  const settings = db.getSettings();
  // Never send secrets in plain text
  const { vapid_private_key, ...safeSettings } = settings;
  res.json({
    success: true,
    data: {
      ...safeSettings,
      smtp_pass: settings.smtp_pass ? '********' : '',
      twilio_auth_token: settings.twilio_auth_token ? '********' : '',
      telegram_bot_token: settings.telegram_bot_token ? '********' : '',
    },
  });
});

// PUT /api/settings - Update email, SMS & Telegram settings
router.put('/settings', (req, res) => {
  const { smtp_enabled, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name } = req.body;

  const updates = {};
  if (smtp_enabled !== undefined) updates.smtp_enabled = smtp_enabled ? 'true' : 'false';
  if (smtp_host !== undefined) updates.smtp_host = smtp_host;
  if (smtp_port !== undefined) updates.smtp_port = String(smtp_port);
  if (smtp_user !== undefined) updates.smtp_user = smtp_user;
  // Only update password if a new one was provided (not the masked '********')
  if (smtp_pass !== undefined && smtp_pass !== '********') updates.smtp_pass = smtp_pass;
  if (smtp_from_email !== undefined) updates.smtp_from_email = smtp_from_email;
  if (smtp_from_name !== undefined) updates.smtp_from_name = smtp_from_name;

  // SMS settings
  if (req.body.twilio_enabled !== undefined) updates.twilio_enabled = req.body.twilio_enabled ? 'true' : 'false';
  if (req.body.twilio_account_sid !== undefined) updates.twilio_account_sid = req.body.twilio_account_sid;
  if (req.body.twilio_auth_token !== undefined && req.body.twilio_auth_token !== '********') updates.twilio_auth_token = req.body.twilio_auth_token;
  if (req.body.twilio_from_number !== undefined) updates.twilio_from_number = req.body.twilio_from_number;
  if (req.body.twilio_to_number !== undefined) updates.twilio_to_number = req.body.twilio_to_number;

  // Telegram settings
  if (req.body.telegram_enabled !== undefined) updates.telegram_enabled = req.body.telegram_enabled ? 'true' : 'false';
  if (req.body.telegram_bot_token !== undefined && req.body.telegram_bot_token !== '********') updates.telegram_bot_token = req.body.telegram_bot_token;
  if (req.body.telegram_chat_id !== undefined) updates.telegram_chat_id = req.body.telegram_chat_id;

  db.updateSettings(updates);
  resetTransporter(); // Reset SMTP connection so it reconnects with new settings
  resetTwilio(); // Reset SMS Twilio client

  const settings = db.getSettings();
  const { vapid_private_key, ...safeSettings } = settings;
  res.json({
    success: true,
    data: {
      ...safeSettings,
      smtp_pass: smtp_pass === '********' || settings.smtp_pass ? '********' : '',
      twilio_auth_token: req.body.twilio_auth_token === '********' || settings.twilio_auth_token ? '********' : '',
      telegram_bot_token: req.body.telegram_bot_token === '********' || settings.telegram_bot_token ? '********' : ''
    }
  });
});

// POST /api/settings/test - Send test email
router.post('/settings/test', async (req, res) => {
  // Use current settings unless overridden in request body
  const currentSettings = db.getSettings();
  const maskedOrStored = (bodyVal, storedVal) =>
    (bodyVal && bodyVal !== '********') ? bodyVal : storedVal;

  const testSettings = {
    smtp_host: req.body.smtp_host || currentSettings.smtp_host,
    smtp_port: req.body.smtp_port || currentSettings.smtp_port,
    smtp_user: req.body.smtp_user || currentSettings.smtp_user,
    smtp_pass: maskedOrStored(req.body.smtp_pass, currentSettings.smtp_pass),
    smtp_from_email: req.body.smtp_from_email || currentSettings.smtp_from_email,
    smtp_from_name: req.body.smtp_from_name || currentSettings.smtp_from_name,
  };

  try {
    const result = await testEmail(testSettings);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/test-sms - Send test SMS
router.post('/settings/test-sms', async (req, res) => {
  const currentSettings = db.getSettings();
  const maskedOrStored = (bodyVal, storedVal) =>
    (bodyVal && bodyVal !== '********') ? bodyVal : storedVal;

  const testSettings = {
    twilio_account_sid: req.body.twilio_account_sid || currentSettings.twilio_account_sid,
    twilio_auth_token: maskedOrStored(req.body.twilio_auth_token, currentSettings.twilio_auth_token),
    twilio_from_number: req.body.twilio_from_number || currentSettings.twilio_from_number,
    twilio_to_number: req.body.twilio_to_number || currentSettings.twilio_to_number,
  };

  try {
    const result = await sendTestSms(testSettings);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/test-telegram - Send test Telegram message
router.post('/settings/test-telegram', async (req, res) => {
  const currentSettings = db.getSettings();
  const maskedOrStored = (bodyVal, storedVal) =>
    (bodyVal && bodyVal !== '********') ? bodyVal : storedVal;

  const testSettings = {
    telegram_bot_token: maskedOrStored(req.body.telegram_bot_token, currentSettings.telegram_bot_token),
    telegram_chat_id: req.body.telegram_chat_id || currentSettings.telegram_chat_id,
  };

  try {
    const result = await sendTestTelegram(testSettings);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/settings/vapid-public-key - Get (or create) the VAPID public key
router.get('/settings/vapid-public-key', (req, res) => {
  const settings = db.getSettings();
  const vapid = ensureVapidKeys(settings, db.updateSettings);
  if (!vapid) {
    return res.status(500).json({ success: false, error: 'No se pudo configurar VAPID. ¿Está instalado web-push?' });
  }
  res.json({ success: true, data: { publicKey: vapid.publicKey } });
});

// POST /api/settings/test-push - Send a test push to a provided subscription
router.post('/settings/test-push', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, error: 'Suscripción de push requerida' });
  }

  const settings = db.getSettings();
  const vapid = ensureVapidKeys(settings, db.updateSettings);
  if (!vapid) {
    return res.status(500).json({ success: false, error: 'No se pudo configurar VAPID. ¿Está instalado web-push?' });
  }

  try {
    const result = await sendTestPush(subscription);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/push/subscribe - Store a browser push subscription
router.post('/push/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, error: 'Suscripción de push requerida' });
  }
  db.addPushSubscription(subscription);
  res.json({ success: true, message: 'Suscripción registrada' });
});

// POST /api/push/unsubscribe - Remove a browser push subscription
router.post('/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Endpoint requerido' });
  }
  db.removePushSubscription(endpoint);
  res.json({ success: true, message: 'Suscripción eliminada' });
});

// POST /api/notify/check - Manually trigger notification check
router.post('/notify/check', async (req, res) => {
  try {
    const result = await checkAndNotify();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Item routes with :id (registered last so they don't shadow /settings etc.) ----

// GET /api/items/:id - Get single item
router.get('/:id', (req, res) => {
  const item = db.getItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Item no encontrado' });
  }
  res.json({ success: true, data: item });
});

// DELETE /api/items/:id - Delete single item
router.delete('/:id', (req, res) => {
  const deleted = db.deleteItem(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Item no encontrado' });
  }
  res.json({ success: true, message: 'Item eliminado' });
});

// PUT /api/items/:id - Update item
router.put('/:id', (req, res) => {
  const existing = db.getItemById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Item no encontrado' });
  }

  const { name, category, expiryDate, cost, provider, notes, alertEmail, alertWhatsApp, alertTelegram } = req.body;

  const updated = db.updateItem(req.params.id, {
    name: name || existing.name,
    category: category || existing.category,
    expiryDate: expiryDate || existing.expiryDate,
    cost: cost != null ? parseFloat(cost) : existing.cost,
    provider: provider ?? existing.provider,
    notes: notes ?? existing.notes,
    alertEmail: alertEmail != null ? !!alertEmail : existing.alertEmail,
    alertWhatsApp: alertWhatsApp != null ? !!alertWhatsApp : existing.alertWhatsApp,
    alertTelegram: alertTelegram != null ? !!alertTelegram : existing.alertTelegram,
  });

  if (!updated) {
    return res.status(500).json({ success: false, error: 'Error al actualizar' });
  }

  res.json({ success: true, data: updated });
});

module.exports = router;
