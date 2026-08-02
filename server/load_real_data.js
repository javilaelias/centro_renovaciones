/* ==========================================
   CARGA DE DATOS REALES (desde doc/CONSOLIDADO v2.xlsx)
   - Elimina TODOS los items existentes (datos de prueba)
   - Inserta los 62 items reales convertidos (real_items.json)

   ⚠ ADVERTENCIA: este script borra todos los items de la base de datos.
   Detén el servidor (iniciar_centro.bat / npm start) antes de ejecutarlo:
   sql.js reescribe el archivo completo de la BD y un servidor corriendo
   podría sobrescribir o perder la escritura.

   Cadena de regeneración de real_items.json (solo si cambias el Excel):
     1) python3 extract_xlsx.py   → genera excel_dump.json
     2) python3 convert_excel.py  → genera real_items.json

   Uso:  node server/load_real_data.js
   ========================================== */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const db = require('./src/db');

const REAL_ITEMS_PATH = path.join(__dirname, '..', 'real_items.json');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

(async () => {
  try {
    if (!fs.existsSync(REAL_ITEMS_PATH)) {
      console.error(`No se encontró ${REAL_ITEMS_PATH}. Genera primero real_items.json:\n  python3 extract_xlsx.py && python3 convert_excel.py`);
      process.exit(1);
    }

    const rawItems = JSON.parse(fs.readFileSync(REAL_ITEMS_PATH, 'utf-8'));
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      console.error('real_items.json está vacío o no es un array');
      process.exit(1);
    }

    await db.initDb();

    // 1. Borrar todos los items (datos de prueba)
    db.deleteAllItems();

    // 2. Insertar los items reales
    const now = new Date().toISOString();
    const withIds = rawItems.map(item => ({
      ...item,
      id: genId(),
      createdAt: now,
    }));

    const result = db.seedItems(withIds);

    console.log(`✔ ${result.length} items reales cargados desde el Excel`);
    console.log(`✔ ${rawItems.length} items convertidos en real_items.json`);

    // Resumen por categoría
    const counts = {};
    result.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
    console.log('Resumen por categoría:', JSON.stringify(counts));

    // Rango de fechas
    const dates = result.map(i => i.expiryDate).sort();
    console.log(`Rango de vencimientos: ${dates[0]} → ${dates[dates.length - 1]}`);

    db.closeDb();
    console.log('Base de datos actualizada correctamente.');
  } catch (err) {
    console.error('Error cargando datos reales:', err);
    process.exit(1);
  }
})();
