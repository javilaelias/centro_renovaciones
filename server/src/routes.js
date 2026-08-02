const express = require('express');
const router = express.Router();
const db = require('./db');
const { checkAndNotify, testEmail, resetTransporter } = require('./notifications');
const { sendTestSms, initTwilio, resetTwilio } = require('./sms');
const { sendTestTelegram } = require('./telegram');
const { ensureVapidKeys, sendTestPush } = require('./push');
const { requireAdmin } = require('./auth');

// Normaliza un estado por acentos (misma regla que el frontend): 'En tramite' → 'En trámite'.
// Se usa al guardar los estados personalizados para no reintroducir duplicados.
function normalizeReqEstado(s) {
  const text = String(s || '').trim();
  if (!text) return '';
  const key = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return REQ_ESTADO_CANON[key] || text;
}

// Formas canónicas (con acentos) de los estados conocidos
const REQ_ESTADO_CANON = {
  'en tramite': 'En trámite',
  'sin tramitar': 'Sin tramitar',
  'revision oab': 'Revisión OAB',
  'revision area usuaria': 'Revisión área usuaria',
  'en elaboracion': 'En elaboración',
  'estudio de mercado': 'Estudio de Mercado',
  'evaluacion de propuestas': 'Evaluación de Propuestas',
  'apoyo presupuestal': 'Apoyo presupuestal',
  'proceso de implementacion/activacion/entrega': 'Proceso de implementación/Activación/Entrega',
  'emision de conformidad': 'Emisión de Conformidad',
  'por suscribir contrato': 'Por suscribir contrato',
  'contratado': 'Contratado',
  'en ejecucion': 'En ejecución',
  'ejecutado': 'Ejecutado',
  'culminado': 'Culminado',
  'vigente': 'Vigente',
  'para reformulacion': 'Para reformulación',
  'desistido': 'Desistido',
  'no corresponde atencion ogti': 'No corresponde atención OGTI',
  'por vencer': 'Por vencer',
  'vigente_por vencer': 'Vigente_por vencer',
};

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

  const validCategories = ['domain', 'ssl', 'hosting', 'license', 'insurance', 'certificate', 'tuition', 'subscription', 'warranty', 'equipment'];
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
      expiryDate: expiryDate || '',
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

// DELETE /api/items - Clear ALL items (solo admin)
router.delete('/', requireAdmin, (req, res) => {
  db.deleteAllItems();
  res.json({ success: true, message: 'Todos los items han sido eliminados' });
});

// POST /api/items/import - Import items from JSON
router.post('/import', (req, res) => {
  const { items: importedItems } = req.body;

  if (!Array.isArray(importedItems) || importedItems.length === 0) {
    return res.status(400).json({ success: false, error: 'Se requiere un array de items' });
  }

  const validCategories = ['domain', 'ssl', 'hosting', 'license', 'insurance', 'certificate', 'tuition', 'subscription', 'warranty', 'equipment'];
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  const prepared = importedItems
    .filter(item => {
      if (!item.name || !item.category) return false;
      if (!validCategories.includes(item.category)) return false;
      if (item.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)) return false;
      if (item.cost != null && (isNaN(parseFloat(item.cost)) || parseFloat(item.cost) < 0)) return false;
      return true;
    })
    .map(item => ({
      ...item,
      id: genId(),
      expiryDate: item.expiryDate || '',
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

// PUT /api/settings - Update email, SMS, Telegram & requirements settings (solo admin)
router.put('/settings', requireAdmin, (req, res) => {
  const { smtp_enabled, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name } = req.body;

  const updates = {};
  // Estados personalizados de requerimientos (lista de strings, sin duplicados,
  // normalizada por acentos para no reintroducir 'En tramite'/'En trámite')
  if (Array.isArray(req.body.req_estados)) {
    updates.req_estados = JSON.stringify([...new Set(req.body.req_estados.map(normalizeReqEstado).filter(Boolean))]);
  }
  // Flujo secuencial de estados de requerimientos (solo avanzar)
  if (req.body.req_flow_enabled !== undefined) {
    updates.req_flow_enabled = req.body.req_flow_enabled ? 'true' : 'false';
  }
  if (Array.isArray(req.body.req_flow_order)) {
    updates.req_flow_order = JSON.stringify([...new Set(req.body.req_flow_order.map(normalizeReqEstado).filter(Boolean))]);
  }
  // URL del sistema de trámite documentario (hoja de ruta)
  if (req.body.tramite_url !== undefined) updates.tramite_url = String(req.body.tramite_url).trim();
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

// POST /api/notify/check - Manually trigger notification check (solo admin)
router.post('/notify/check', requireAdmin, async (req, res) => {
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

// DELETE /api/items/:id - Delete single item (solo admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const deleted = db.deleteItem(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Item no encontrado' });
  }
  res.json({ success: true, message: 'Item eliminado' });
});

// Extrae la línea 'Estado:' de las notas de un requerimiento (misma regex que el frontend)
function extractEstadoFromNotes(notes) {
  if (!notes) return '';
  const m = String(notes).match(/(?:^|\n)Estado:\s*([^\n]*)/i);
  return m ? m[1].trim() : '';
}

// Valida un cambio de estado contra el flujo secuencial (solo avanzar).
// Devuelve un mensaje de error si el movimiento está prohibido, o null si es válido.
function validateReqEstadoFlow(fromNotes, toNotes) {
  const settings = db.getSettings();
  if (!settings.req_flow_enabled) return null;
  const order = Array.isArray(settings.req_flow_order) ? settings.req_flow_order : [];
  if (order.length === 0) return null;

  const from = extractEstadoFromNotes(fromNotes);
  const to = extractEstadoFromNotes(toNotes);
  if (!from || !to || from === to) return null;

  const fromIdx = order.indexOf(from);
  const toIdx = order.indexOf(to);
  // Estados fuera del flujo no se validan (p. ej. estados personalizados agregados después)
  if (fromIdx === -1 || toIdx === -1) return null;
  if (toIdx < fromIdx) {
    return `Flujo secuencial activado: no puedes retroceder de "${from}" a "${to}". Solo se permite avanzar en el orden configurado.`;
  }
  return null;
}

// GET /api/items/:id/history - Historial de cambios de estado (auditoría)
router.get('/:id/history', (req, res) => {
  const history = db.getItemHistory(req.params.id);
  res.json({ success: true, data: history });
});

// PUT /api/items/:id - Update item
router.put('/:id', (req, res) => {
  const existing = db.getItemById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Item no encontrado' });
  }

  // E6: permisos por rol en los REQUERIMIENTOS (items sin fecha de vencimiento).
  // Los analistas solo pueden cambiar el estado (notes) y la fecha de vencimiento
  // (expiryDate); el resto de campos (nombre, categoría, costo, proveedor,
  // alertas) es exclusivo del administrador. Las renovaciones con fecha se
  // gestionan igual que antes para los analistas.
  const isReqItem = !existing.expiryDate;
  const isAdmin = req.user && req.user.role === 'admin';
  if (isReqItem && !isAdmin) {
    const sentKeys = Object.keys(req.body);
    const forbidden = sentKeys.filter(k => k !== 'notes' && k !== 'expiryDate');
    if (forbidden.length > 0) {
      return res.status(403).json({
        success: false,
        error: `Solo el administrador puede modificar: ${forbidden.join(', ')}. Los analistas solo pueden cambiar estado y fecha.`
      });
    }
  }

  const { name, category, expiryDate, cost, provider, notes, alertEmail, alertWhatsApp, alertTelegram } = req.body;

  // Validación de flujo secuencial: si se cambia el estado del requerimiento,
  // solo se permite avanzar en el orden lógico configurado.
  if (notes !== undefined) {
    const flowError = validateReqEstadoFlow(existing.notes || '', notes);
    if (flowError) {
      return res.status(400).json({ success: false, error: flowError });
    }
  }

  const updated = db.updateItem(req.params.id, {
    name: name || existing.name,
    category: category || existing.category,
    expiryDate: expiryDate !== undefined ? expiryDate : existing.expiryDate,
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

  // Auditoría: registra el cambio de estado del requerimiento (quién, cuándo, de qué a qué)
  const fromEstado = extractEstadoFromNotes(existing.notes || '');
  const toEstado = extractEstadoFromNotes(updated.notes || '');
  if (fromEstado !== toEstado) {
    db.addItemHistory({
      itemId: req.params.id,
      username: (req.user && req.user.username) || 'sistema',
      fromEstado,
      toEstado,
    });
  }

  res.json({ success: true, data: updated });
});

module.exports = router;
