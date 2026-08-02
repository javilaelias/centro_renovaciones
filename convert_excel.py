#!/usr/bin/env python3
"""Convert CONSOLIDADO v2.xlsx data into the app's item format (real_items.json).

Sources (ALL rows; items without a date get expiryDate '' = "Pendiente"):
  1. Seguimiento OIT       - all requirements
  2. Info Jose             - all subscription renewals
  3. CONTRATOS Y OS VIGENTES - all contracts
  4. Control               - REQ registry (numeración + denominación). Matched
                            against already-loaded items by REQ code first, then
                            by normalized name; missing REQ codes are appended to
                            notes, and only genuinely new rows are added (as
                            "Pendiente").

Deduplication: by normalized name across sheets (Seguimiento OIT wins).
"""
import datetime
import json
import re
import unicodedata


def to_iso(v):
    """Convert a cell value (serial or date string/range) to ISO YYYY-MM-DD or None."""
    if v is None:
        return None
    s = str(v).strip()
    if not s or s in ("-", "N/A", "PENDIENTE", "PENDIENTE "):
        return None
    # Excel serial
    try:
        f = float(s)
        if 20000 <= f <= 70000:
            return (datetime.datetime(1899, 12, 30) + datetime.timedelta(days=f)).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        pass
    # Range like "17/09/2026 - 24/11/26" -> take start
    if " - " in s or "–" in s or "-" in s.replace(" ", ""):
        parts = re.split(r"\s*[-–]\s*", s)
        if parts:
            return to_iso(parts[0].strip())
    # dd/mm/yyyy or dd/mm/yy
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if m:
        d, mo, y = m.groups()
        y = "20" + y if len(y) == 2 else y
        try:
            return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
        except ValueError:
            return None
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    # Date like "12-05-26" (dd-mm-yy)
    m = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{2,4})$", s)
    if m:
        d, mo, y = m.groups()
        y = "20" + y if len(y) == 2 else y
        try:
            return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
        except ValueError:
            return None
    return None


def to_number(v):
    if v is None:
        return None
    s = str(v).strip().replace(",", "").replace("S/", "").replace("$", "")
    if not s or s in ("-", "Pendiente", "PENDIENTE"):
        return None
    try:
        return round(float(s), 2)
    except (TypeError, ValueError):
        return None


PREFIXES = [
    "contratacion del servicio de ", "contratacion de ", "contratacion del ",
    "servicio de ", "servicios de ", "adquisicion de ", "adquisicion de licencias de ",
    "suscripcion para el uso de ", "suscripcion de ", "servicio suscripcion para el uso de ",
]

# Phrases that vary between sheets but refer to the same item
SUFFIX_PHRASES = [
    " del ministerio de economia y finanzas", " para el ministerio de economia y finanzas",
    " del mef", " para el mef", " o equivalente", " de la marca microsoft",
    " en el marco de la inversion con codigo unico n 2510338",
    " en el marco de la inversion con codigo unico n 2455051",
    " en el marco de la inversion con codigo unico n 2607522",
    ", en el marco de la inversion con codigo unico n 2510338",
    ", en el marco de la inversion con codigo unico n 2455051",
    ", en el marco de la inversion con codigo unico n 2607522",
]


def norm(name):
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", str(name).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("°", "").replace("º", "").replace("–", "-").replace("—", "-")
    s = re.sub(r"\s+", " ", s).strip()
    # Strip leading prefixes so "Servicio de X" == "Contratación del servicio de X"
    for p in PREFIXES:
        if s.startswith(p):
            s = s[len(p):].strip()
            break
    # Strip a leading "una " leftover after prefix removal (e.g. "una solución de virtualización")
    if s.startswith("una "):
        s = s[4:].strip()
    # Remove varying suffixes
    for ph in SUFFIX_PHRASES:
        s = s.replace(ph, "")
    # Cut at "en el marco de la inversión..." / "en el marco de la IOARR..." clauses
    s = re.sub(r",?\s*en el marco de la (?:inversion|ioarr).*$", "", s)
    s = re.sub(r",?\s*en el marco de la inversi[oó]n con c[oó]digo \u00fanico.*$", "", s)
    # Cut at trailing MEF-reference clauses
    s = re.sub(r"\s*para el ministerio de economia y finanzas.*$", "", s)
    s = re.sub(r"\s*del ministerio de economia y finanzas.*$", "", s)
    # Strip trailing contract number / item tags that vary (e.g. "ITEM 1", "N° 0000149", "- 2026")
    s = re.sub(r"\s*item\s*\d+\s*(principal|secundario|complementario)?\s*$", "", s)
    s = re.sub(r"\s*-\s*complementario\s*n?\s*[0-9a-zA-Z\- ]{2,30}$", "", s)
    # Only strip trailing "N° <numero>"-style tokens: the char right after 'n' must be a digit
    s = re.sub(r"\s*n\s*\d[0-9a-zA-Z\- ]{2,40}$", "", s)
    s = re.sub(r"\s*-\s*\d{4}\s*$", "", s)  # trailing "- 2026" / "- 2024"
    s = s.rstrip(" .-,")
    return s


def map_category(text):
    """Map a service description to an app category."""
    t = norm(text)
    if any(k in t for k in ["licencias de software", "licencia de software", "licencias microsoft",
                            "suscripcion de licencias", "adobe creative cloud", "power bi",
                            "oracle", "red hat", "laserfiche"]):
        return "license"
    if any(k in t for k in ["soporte", "mantenimiento", "garantia", "actualizacion de software",
                            "acompañamiento", "monitoreo y soporte", "continuidad operativa"]):
        return "warranty"
    if any(k in t for k in ["suscripcion", "subscription", "cloud", "plataforma", "inteligencia artificial",
                            "videoconferencias", "whatsapp", "infobip", "copilot", "power automate",
                            "power apps", "planner", "project", "zoom"]):
        return "subscription"
    if any(k in t for k in ["internet", "conectividad", "transmision de datos", "telefonia", "telefono",
                            "radio troncalizado", "enlace", "escane", "fotocopiado", "impresion",
                            "housing", "call center", "videovigilancia", "video seguridad", "alquiler de escaner"]):
        return "subscription"
    return "subscription"


def build_notes(parts):
    """Join non-empty note parts with newlines."""
    return "\n".join(str(p) for p in parts if p and str(p).strip() not in ("-", "None"))


with open("excel_dump.json", encoding="utf-8") as f:
    sheets = {s["sheet"]: s["rows"] for s in json.load(f)}

items = []
seen = set()  # normalized names


def add_item(name, category, expiry, cost, provider, notes):
    n = norm(name)
    if not n:
        return
    if n in seen:
        # Merge: keep the first (most complete) entry, but fill gaps in the existing one
        for it in items:
            if norm(it["name"]) == n:
                if not it["cost"] and cost:
                    it["cost"] = cost
                if not it["provider"] and provider:
                    it["provider"] = provider
                if not it["notes"] and notes:
                    it["notes"] = notes
                if not it["expiryDate"] and expiry:
                    it["expiryDate"] = expiry
                return
    # Secondary dedup: same expiry + long shared prefix (>=30 chars) where one key
    # fully contains the other (handles cross-sheet name variants with extra clauses)
    if expiry and len(n) >= 30:
        for it in items:
            if it["expiryDate"] == expiry:
                other = norm(it["name"])
                if len(other) >= 30 and (n in other or other in n):
                    if not it["cost"] and cost:
                        it["cost"] = cost
                    if not it["provider"] and provider:
                        it["provider"] = provider
                    if not it["notes"] and notes:
                        it["notes"] = notes
                    return
    seen.add(n)
    items.append({
        "name": str(name).strip(),
        "category": category,
        "expiryDate": expiry,
        "cost": cost,
        "provider": (provider or "").strip() if provider else "",
        "notes": notes.strip() if notes else "",
    })


# ---- 1. Seguimiento OIT (header row 2, data from row 3) ----
rows = sheets["Seguimiento OIT"]
for r in rows[3:]:
    c = r["cells"]
    def C(i):
        return c[i] if len(c) > i else None
    codigo = C(0)
    tipo = C(5)
    denominacion = C(7)
    servicios = C(9)
    area = C(10)
    coordinador = C(11)
    responsable = C(12)
    area_usuaria = C(13)
    monto = to_number(C(14))
    estado = C(16)
    empresa = C(23)
    ejecucion = C(24)
    estado_servicio = C(25)
    fin_vigencia = to_iso(C(27))
    vigencia = C(28)
    comentarios_at = C(31)
    comentarios_serv = C(32)
    repo = C(33)
    requiere = C(34)
    estado_renov = C(35)
    fin_renov = to_iso(C(37))

    name = denominacion or codigo
    cat = map_category(f"{denominacion} {servicios or ''}")
    notes = build_notes([
        f"REQ: {codigo}" if codigo else None,
        f"Tipo: {tipo}" if tipo and tipo != "-" else None,
        f"Área: {area}" if area and area != "-" else None,
        f"Responsable: {responsable}" if responsable and responsable != "-" else None,
        f"Área usuaria: {area_usuaria}" if area_usuaria and area_usuaria != "-" else None,
        f"Servicios: {servicios}" if servicios and servicios != "-" else None,
        f"Estado: {estado}" if estado and estado != "-" else None,
        f"Estado servicio: {estado_servicio}" if estado_servicio and estado_servicio != "-" else None,
        f"Vigencia: {vigencia}" if vigencia and vigencia != "-" else None,
        f"¿Requiere renovar?: {requiere}" if requiere and str(requiere).strip() not in ("-", "") else None,
        f"Estado renovación: {estado_renov}" if estado_renov and estado_renov != "-" else None,
        f"Fecha fin renovación: {fin_renov}" if fin_renov else None,
        f"Empresa: {empresa}" if empresa and empresa != "-" else None,
        f"Ejecución: {ejecucion}" if ejecucion and ejecucion != "-" else None,
        f"Comentarios: {comentarios_at}" if comentarios_at and comentarios_at != "-" else None,
        f"Comentarios servicio: {comentarios_serv}" if comentarios_serv and comentarios_serv != "-" else None,
        f"Repositorio: {repo}" if repo and repo.startswith("http") else None,
    ])
    add_item(name, cat, fin_vigencia or '', monto, empresa, notes)

# ---- 2. Info Jose (header row 0, data from row 1) ----
rows = sheets["Info Jose"]
for r in rows[1:]:
    c = r["cells"]
    def C(i):
        return c[i] if len(c) > i else None
    denom = C(0)
    servicios = C(1)
    fin_vigencia = to_iso(C(2))
    periodo = C(3)
    monto_total = to_number(C(4))
    m2026 = to_number(C(5))
    m2027 = to_number(C(6))
    sustento = C(7)

    cat = map_category(f"{denom} {servicios or ''}")
    notes = build_notes([
        f"Servicios: {servicios}" if servicios else None,
        f"Periodo renovación: {periodo}" if periodo else None,
        f"Monto total: {monto_total}" if monto_total else None,
        f"Monto 2026: {m2026}" if m2026 else None,
        f"Monto 2027: {m2027}" if m2027 else None,
        sustento if sustento else None,
    ])
    add_item(denom, cat, fin_vigencia or '', monto_total, None, notes)

# ---- 3. CONTRATOS Y OS VIGENTES (header row 1, data from row 2) ----
rows = sheets["CONTRATOS Y OS VIGENTES"]
for r in rows[2:]:
    c = r["cells"]
    def C(i):
        return c[i] if len(c) > i else None
    descripcion = C(0)
    nro = C(1)
    estado = C(2)
    proveedor = C(3)
    encargado = C(4)
    fin_servicio = to_iso(C(7))

    if not descripcion or str(descripcion).strip() in ("-", "None"):
        continue

    cat = map_category(descripcion)
    notes = build_notes([
        f"N°: {nro}" if nro and nro != "-" else None,
        f"Estado: {estado}" if estado and estado != "-" else None,
        f"Encargado: {encargado}" if encargado and encargado != "-" else None,
    ])
    add_item(descripcion, cat, fin_servicio or '', None, proveedor, notes)

# ---- 4. Control (header row 0, data from row 1) ----
# Registry of REQ codes + denominations. No dates/costs here, so this sheet
# mostly overlaps the others: we enrich existing items with their REQ code and
# only add rows that are truly new (as "Pendiente").
rows = sheets["Control"]
for r in rows[1:]:
    c = r["cells"]
    def C(i):
        return c[i] if len(c) > i else None
    codigo = C(0)
    denominacion = C(1)
    if not denominacion or str(denominacion).strip() in ("-", "None", ""):
        continue
    name = str(denominacion).strip()
    n = norm(name)
    if not n:
        continue
    req_code = str(codigo).strip() if codigo else None

    # 1) Match by REQ code already present in notes
    found = None
    if req_code:
        for it in items:
            if req_code in (it.get("notes") or ""):
                found = it
                break
    # 2) Match by normalized name
    if not found:
        for it in items:
            if norm(it["name"]) == n:
                found = it
                break
    if found:
        # Enrich notes with the REQ code if it's still missing
        if req_code and req_code not in (found.get("notes") or ""):
            found["notes"] = build_notes([found.get("notes"), f"REQ: {req_code}"])
    else:
        # Truly new: add as pending with the REQ code in notes
        add_item(name, map_category(name), '', None, None, f"REQ: {req_code}" if req_code else '')

# ---- Reclassify one-off hardware purchases as 'equipment' ----
# These are physical acquisitions that will never have a renewal date
# (audífonos, pantallas, USB, televisores, etc.), so they don't belong to
# a renewable service category.
HARDWARE_HINTS = [
    'audifonos', 'auriculares', 'puntero', 'pantalla interactiva', 'pantalla',
    'equipos de computo', 'equipos de cómputo', 'accesorios informaticos',
    'impresora', 'totem', 'tripodes', 'lectoras', 'usb', 'blu-ray',
    'soporte cooler', 'televisores', 'proyectores', 'amplificadores',
    'kit de capacitacion', 'cableado', 'base ajustable', 'equipos telefonicos',
    'equipamiento', 'equipos de comunicacion',
]
for it in items:
    # Normalize accents so 'Adquisición' matches 'adquisicion'
    raw = ''.join(c for c in unicodedata.normalize('NFKD', str(it['name']).lower())
                   if not unicodedata.combining(c))
    n = norm(it['name'])
    if 'adquisicion' in raw and any(h in n for h in HARDWARE_HINTS):
        it['category'] = 'equipment'

# ---- Dedupe exact duplicates (same normalized name + cost + provider) ----
# e.g. the BISSNETCORP "equipamiento y licencia" item listed twice.
seen_dupes = set()
unique_items = []
for it in items:
    key = (norm(it['name']), it['cost'], it['provider'])
    if key in seen_dupes:
        continue
    seen_dupes.add(key)
    unique_items.append(it)
items = unique_items

# ---- Sort by expiry date ----
items.sort(key=lambda i: (i["expiryDate"] == "", i["expiryDate"] or "9999-12-31"))

with open("real_items.json", "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

print(f"Total items convertidos: {len(items)}")
from collections import Counter
print("Por categoría:", dict(Counter(i["category"] for i in items)))
print("\n--- Items (nombre | categoría | vence) ---")
for i in items:
    print(f"  {i['name'][:70]} | {i['category']} | {i['expiryDate']} | ${i['cost'] if i['cost'] is not None else '-'} | {i['provider'][:35]}")
