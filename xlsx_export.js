/* ============================================================
   xlsx_export.js — Generador XLSX mínimo en JS puro (sin dependencias)
   ------------------------------------------------------------
   Crea archivos .xlsx (Office Open XML) válidos para Excel:
   - ZIP con método "store" (sin compresión) + CRC32 estándar
   - Hoja con celdas de texto inline (t="inlineStr") y numéricas
   - Estilo de encabezado (negrita + fondo)
   Funciona en navegador (global `CentroXlsx`) y en Node (CommonJS)
   para pruebas automatizadas.
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- CRC32 ----------
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(buf) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // ---------- Utilidades ----------
  function xmlEscape(s) {
    // Limpiar caracteres de control inválidos en XML 1.0 (romperían el archivo en Excel)
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function utf8(str) {
    return new TextEncoder().encode(str);
  }

  function dosDateTime(d) {
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time: time, date: date };
  }

  // ---------- ZIP (método store) ----------
  // files: [{ name: string, data: Uint8Array }]
  function buildZip(files, date) {
    var d = date || new Date();
    var dt = dosDateTime(d);
    var parts = [];
    var central = [];
    var offset = 0;

    for (var i = 0; i < files.length; i++) {
      var name = utf8(files[i].name);
      var data = files[i].data;
      var crc = crc32(data);

      var local = new Uint8Array(30 + name.length);
      var dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true); // firma local file header
      dv.setUint16(4, 20, true);         // versión necesaria
      dv.setUint16(6, 0x0800, true);     // flags: nombre UTF-8
      dv.setUint16(8, 0, true);          // método: store (sin compresión)
      dv.setUint16(10, dt.time, true);
      dv.setUint16(12, dt.date, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true); // tamaño comprimido
      dv.setUint32(22, data.length, true); // tamaño sin comprimir
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);           // longitud extra
      local.set(name, 30);

      parts.push(local, data);
      central.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += local.length + data.length;
    }

    // Directorio central
    var centralStart = offset;
    var cdParts = [];
    for (var j = 0; j < central.length; j++) {
      var c = central[j];
      var cd = new Uint8Array(46 + c.name.length);
      var dv2 = new DataView(cd.buffer);
      dv2.setUint32(0, 0x02014b50, true); // firma central directory
      dv2.setUint16(4, 20, true);         // versión creado por
      dv2.setUint16(6, 20, true);         // versión necesaria
      dv2.setUint16(8, 0x0800, true);     // flags
      dv2.setUint16(10, 0, true);         // método
      dv2.setUint16(12, dt.time, true);
      dv2.setUint16(14, dt.date, true);
      dv2.setUint32(16, c.crc, true);
      dv2.setUint32(20, c.size, true);
      dv2.setUint32(24, c.size, true);
      dv2.setUint16(28, c.name.length, true);
      dv2.setUint16(30, 0, true);
      dv2.setUint16(32, 0, true);
      dv2.setUint16(34, 0, true);
      dv2.setUint16(36, 0, true);
      dv2.setUint32(38, 0, true);
      dv2.setUint32(42, c.offset, true);
      cd.set(c.name, 46);
      cdParts.push(cd);
      offset += cd.length;
    }

    // EOCD
    var cdSize = 0;
    for (var k = 0; k < cdParts.length; k++) cdSize += cdParts[k].length;
    var eocd = new Uint8Array(22);
    var dv3 = new DataView(eocd.buffer);
    dv3.setUint32(0, 0x06054b50, true);
    dv3.setUint16(4, 0, true);
    dv3.setUint16(6, 0, true);
    dv3.setUint16(8, central.length, true);
    dv3.setUint16(10, central.length, true);
    dv3.setUint32(12, cdSize, true);
    dv3.setUint32(16, centralStart, true);
    dv3.setUint16(20, 0, true);

    var total = 0;
    for (var p = 0; p < parts.length; p++) total += parts[p].length;
    total += cdSize + eocd.length;

    var out = new Uint8Array(total);
    var pos = 0;
    for (var q = 0; q < parts.length; q++) { out.set(parts[q], pos); pos += parts[q].length; }
    for (var r = 0; r < cdParts.length; r++) { out.set(cdParts[r], pos); pos += cdParts[r].length; }
    out.set(eocd, pos);
    return out;
  }

  // ---------- Hoja de cálculo (sheet XML) ----------
  function colLetter(i) {
    var s = '';
    i++; // 0-based -> 1-based
    while (i > 0) {
      var m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  function isNumericString(v) {
    return typeof v === 'string' && v.trim() !== '' && /^[-+]?\d+(\.\d+)?$/.test(v.trim());
  }

  // rows: matriz de valores (la primera fila se trata como encabezado si opts.header !== false)
  // opts: { header, columnWidths: [number] }
  function buildSheetXml(rows, opts) {
    var o = opts || {};
    var headerStyle = o.header !== false;
    var widths = o.columnWidths || null;

    var cols = '';
    if (widths && widths.length) {
      cols = '<cols>' + widths.map(function (w, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Math.max(w, 10) + '" customWidth="1"/>';
      }).join('') + '</cols>';
    }

    var body = rows.map(function (row, r) {
      var cells = row.map(function (val, c) {
        var ref = colLetter(c) + (r + 1);
        var style = r === 0 && headerStyle ? ' s="1"' : '';
        if (typeof val === 'number' && isFinite(val)) {
          return '<c r="' + ref + '"' + style + '><v>' + val + '</v></c>';
        }
        if (val instanceof Date) {
          var iso = val.toISOString().slice(0, 10);
          return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t>' + xmlEscape(iso) + '</t></is></c>';
        }
        var s = String(val == null ? '' : val);
        // Proteger contra inyección de fórmulas en Excel (=, +, -, @)
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        if (isNumericString(s)) {
          return '<c r="' + ref + '"' + style + '><v>' + parseFloat(s) + '</v></c>';
        }
        return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t>' + xmlEscape(s) + '</t></is></c>';
      }).join('');
      return '<row r="' + (r + 1) + '">' + cells + '</row>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      cols + '<sheetData>' + body + '</sheetData></worksheet>';
  }

  // ---------- Partes fijas del paquete XLSX ----------
  function contentTypesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>';
  }

  function relsXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
  }

  function workbookXml(sheetName) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="' + xmlEscape(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>';
  }

  function workbookRelsXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
  }

  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  // ---------- API pública ----------
  // rows: matriz de valores; la primera fila se estiliza como encabezado.
  // opts: { sheetName, columnWidths }
  function buildXlsxBytes(rows, opts) {
    var o = opts || {};
    var sheetName = o.sheetName || 'Hoja1';
    var columnWidths = o.columnWidths || null;

    var files = [
      { name: '[Content_Types].xml', data: utf8(contentTypesXml()) },
      { name: '_rels/.rels', data: utf8(relsXml()) },
      { name: 'xl/workbook.xml', data: utf8(workbookXml(sheetName)) },
      { name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRelsXml()) },
      { name: 'xl/styles.xml', data: utf8(stylesXml()) },
      { name: 'xl/worksheets/sheet1.xml', data: utf8(buildSheetXml(rows, { columnWidths: columnWidths })) }
    ];
    return buildZip(files);
  }

  var api = {
    buildXlsxBytes: buildXlsxBytes,
    buildSheetXml: buildSheetXml,
    buildZip: buildZip,
    crc32: crc32,
    xmlEscape: xmlEscape
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CentroXlsx = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
