/* Test del generador XLSX (xlsx_export.js)
   Genera un archivo de ejemplo, valida la estructura ZIP (mini-unzip
   sin dependencias) y el XML de la hoja, y escribe el archivo para
   inspección externa. */
'use strict';
const fs = require('fs');
const xlsx = require('./xlsx_export.js');

function fail(msg) {
  console.error('❌ FAIL: ' + msg);
  process.exitCode = 1;
  process.exit(1);
}
function ok(msg) { console.log('✅ ' + msg); }

// ---------- Datos de ejemplo con casos límite ----------
const rows = [
  ['REQ', 'Requerimiento', 'Tipo', 'Área', 'Responsable', 'Estado', 'Costo', 'Proveedor'],
  ['REQ-2026-0002', 'Adquisición de audífonos', 'Equipamiento', 'Área de TI', 'Juan Pérez', 'En trámite', 1500.5, 'Proveedor A & Cía'],
  ['REQ-2026-0003', '=1+1 (prueba fórmula)', 'Servicio', 'Oficina Central', 'María <Gómez>', 'Ejecutado', '12345', 'https://x.com/?a=1&b=2'],
  ['REQ-2026-0004', 'Texto con comillas "y acentos é', 'Licencia', 'Sede Norte', 'Ana López', 'Desistido', '', ''],
];
const bytes = xlsx.buildXlsxBytes(rows, { sheetName: 'Requerimientos', columnWidths: [16, 40, 12, 18, 16, 14, 12, 22] });
console.log('Tamaño generado: ' + bytes.length + ' bytes');

// ---------- Mini-unzip (método store) ----------
function parseZip(buf) {
  // Buscar EOCD
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) fail('No se encontró el EOCD del ZIP');
  const eocdView = new DataView(buf.buffer, buf.byteOffset + eocd);
  const totalEntries = eocdView.getUint16(10, true);
  const cdOffset = eocdView.getUint32(16, true);
  const entries = [];
  let pos = cdOffset;
  for (let n = 0; n < totalEntries; n++) {
    const dv = new DataView(buf.buffer, buf.byteOffset + pos);
    if (dv.getUint32(0, true) !== 0x02014b50) fail('Firma de central directory inválida en entrada ' + n);
    const method = dv.getUint16(10, true);
    const crc = dv.getUint32(16, true);
    const compSize = dv.getUint32(20, true);
    const uncompSize = dv.getUint32(24, true);
    const nameLen = dv.getUint16(28, true);
    const extraLen = dv.getUint16(30, true);
    const commentLen = dv.getUint16(32, true);
    const localOffset = dv.getUint32(42, true);
    const name = Buffer.from(buf.slice(pos + 46, pos + 46 + nameLen)).toString('utf8');
    entries.push({ name, method, crc, compSize, uncompSize, localOffset, extraLen, commentLen });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readLocalEntry(buf, entry) {
  const dv = new DataView(buf.buffer, buf.byteOffset + entry.localOffset);
  if (dv.getUint32(0, true) !== 0x04034b50) fail('Firma de local header inválida para ' + entry.name);
  const nameLen = dv.getUint16(26, true);
  const extraLen = dv.getUint16(28, true);
  const dataStart = entry.localOffset + 30 + nameLen + extraLen;
  return buf.slice(dataStart, dataStart + entry.compSize);
}

const entries = parseZip(bytes);
const names = entries.map(e => e.name).sort();
ok('ZIP válido con ' + entries.length + ' entradas: ' + names.join(', '));

// Comprobar las 6 entradas esperadas
const expected = ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'];
for (const e of expected) {
  if (!names.includes(e)) fail('Falta entrada: ' + e);
}
ok('Las 6 entradas OOXML esperadas están presentes');

// Validar CRC32 y tamaños de cada entrada
let crcOk = true;
for (const e of entries) {
  if (e.method !== 0) fail('Método de compresión debe ser store (0) para ' + e.name + ', es ' + e.method);
  const data = readLocalEntry(bytes, e);
  if (data.length !== e.compSize) fail('Tamaño comprimido incorrecto para ' + e.name);
  const crc = xlsx.crc32(data);
  if (crc !== e.crc) { crcOk = false; fail('CRC32 incorrecto para ' + e.name + ': esperado ' + e.crc + ', obtenido ' + crc); }
}
if (crcOk) ok('CRC32 correcto en todas las entradas');

// Validar XML bien formado de la hoja (decodificar con Buffer para UTF-8)
const sheet = Buffer.from(readLocalEntry(bytes, entries.find(e => e.name === 'xl/worksheets/sheet1.xml'))).toString('utf8');
if (!sheet.includes('<sheetData>')) fail('Falta sheetData');
if (!sheet.includes('REQ-2026-0002')) fail('Falta el dato REQ-2026-0002');
if (!sheet.includes('Adquisición de audífonos')) fail('Falta el requerimiento de prueba');
if (!sheet.includes('1500.5')) fail('Falta el costo numérico');
if (!sheet.includes('12345')) fail('Falta el costo numérico-string convertido');
if (!sheet.includes('María &lt;Gómez&gt;')) fail('Falta escape XML de < >');
if (!sheet.includes('Proveedor A &amp; Cía')) fail('Falta escape XML de &');
if (!sheet.includes("'=1+1")) fail('Falta protección contra inyección de fórmula (=)');
if (!sheet.includes('<col min="1"')) fail('Faltan anchos de columna');
const headerRow = sheet.includes('s="1"');
if (!headerRow) fail('Falta estilo de encabezado (s="1")');
ok('Hoja: datos, escapes XML, protección de fórmulas, anchos y encabezado OK');

// Validar workbook.xml con el nombre de hoja
const wb = Buffer.from(readLocalEntry(bytes, entries.find(e => e.name === 'xl/workbook.xml'))).toString('utf8');
if (!wb.includes('Requerimientos')) fail('Falta el nombre de la hoja en workbook.xml');
ok('workbook.xml con nombre de hoja correcto');

// Escribir el archivo para validación externa
fs.writeFileSync('test_requerimientos.xlsx', Buffer.from(bytes));
ok('Archivo de prueba escrito: test_requerimientos.xlsx');

console.log('\n🎉 Todos los checks pasaron');
