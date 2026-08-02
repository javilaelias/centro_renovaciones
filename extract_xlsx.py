#!/usr/bin/env python3
"""Extract all content from an .xlsx file to a readable JSON file.
Uses only the Python standard library (zipfile + xml.etree)."""
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

XLSX_PATH = "doc/CONSOLIDADO v2.xlsx"
OUT_PATH = "excel_dump.json"

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def col_to_idx(col_letter):
    idx = 0
    for ch in col_letter:
        idx = idx * 26 + (ord(ch.upper()) - ord("A") + 1)
    return idx - 1


def parse_cell_ref(ref):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    if not m:
        return None
    return col_to_idx(m.group(1)), int(m.group(2)) - 1


def serial_to_date(serial):
    """Convert Excel serial date to ISO date string."""
    # Excel epoch: 1899-12-30 (to handle the 1900 leap year bug)
    import datetime
    if serial is None or serial == "":
        return None
    try:
        serial = float(serial)
    except (TypeError, ValueError):
        return str(serial)
    # Dates before 1900 (rare) - just return the number
    if serial < 1:
        return None
    # Handle the 1900 leap year bug: serials >= 61 are off by one day
    epoch = datetime.datetime(1899, 12, 30)
    dt = epoch + datetime.timedelta(days=serial)
    # If time component exists, keep it
    if abs(serial - int(serial)) < 1e-9:
        return dt.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def main():
    with zipfile.ZipFile(XLSX_PATH) as zf:
        names = zf.namelist()

        # --- shared strings ---
        shared = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall("main:si", NS):
                # Concatenate all text runs
                text_parts = []
                for node in si.iter():
                    if node.tag.endswith("}t") and node.text:
                        text_parts.append(node.text)
                shared.append("".join(text_parts))

        # --- workbook sheets ---
        wb_root = ET.fromstring(zf.read("xl/workbook.xml"))
        sheet_names = []
        for sheet in wb_root.findall(".//main:sheet", NS):
            sheet_names.append(sheet.get("name"))

        # --- relationships (sheet -> file mapping) ---
        rel_root = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        sheet_targets = {}
        for rel in rel_root.findall("pr:Relationship", NS):
            if rel.get("Type", "").endswith("/worksheet"):
                sheet_targets[rel.get("Id")] = rel.get("Target")

        # --- parse each worksheet ---
        result = []
        for i, name in enumerate(sheet_names):
            rid = None
            for sheet in wb_root.findall(".//main:sheet", NS):
                if sheet.get("name") == name:
                    rid = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                    break
            target = sheet_targets.get(rid, f"worksheets/sheet{i+1}.xml")
            if not target.startswith("xl/"):
                target = "xl/" + target.lstrip("/")
            if target not in names:
                result.append({"sheet": name, "error": f"file {target} not found"})
                continue

            root = ET.fromstring(zf.read(target))
            rows_data = []
            for row in root.findall(".//main:sheetData/main:row", NS):
                row_num = int(row.get("r", "0"))
                cells = {}
                for c in row.findall("main:c", NS):
                    ref = c.get("r")
                    t = c.get("t")  # type: s (shared), str (formula string), b (bool), e (error)
                    v_node = c.find("main:v", NS)
                    is_node = c.find("main:is", NS)
                    raw = None
                    if v_node is not None and v_node.text is not None:
                        raw = v_node.text
                    elif is_node is not None:
                        parts = []
                        for node in is_node.iter():
                            if node.tag.endswith("}t") and node.text:
                                parts.append(node.text)
                        raw = "".join(parts)

                    if t == "s" and raw is not None:
                        try:
                            val = shared[int(raw)]
                        except (ValueError, IndexError):
                            val = raw
                    elif t == "b":
                        val = raw == "1"
                    elif t == "str" or t == "inlineStr":
                        val = raw
                    elif raw is None:
                        val = None
                    else:
                        # Numeric: could be a date if cell has style with number format
                        val = raw
                    if ref:
                        parsed = parse_cell_ref(ref)
                        if parsed:
                            col, r = parsed
                            cells[col] = {"value": val, "type": t}
                if cells:
                    max_col = max(cells.keys())
                    row_list = [cells.get(c, {"value": None}).get("value") for c in range(max_col + 1)]
                    rows_data.append({"row": row_num, "cells": row_list})

            result.append({"sheet": name, "rows": rows_data})

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)

    # Print a summary
    for sheet in result:
        print(f"SHEET: {sheet['sheet']} - {len(sheet.get('rows', []))} rows")
        for row in sheet.get("rows", [])[:5]:
            print(f"  row {row['row']}: {row['cells']}")


if __name__ == "__main__":
    sys.exit(main())
