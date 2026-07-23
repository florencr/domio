export const UNITS_CSV_COLUMNS = [
  "unit_id",
  "building",
  "unit_name",
  "type",
  "size_m2",
  "block",
  "entrance",
  "floor",
  "owner_email",
  "owner_name",
  "owner_surname",
  "owner_phone",
  "owner_contact_email",
  "tenant_email",
  "tenant_name",
  "tenant_surname",
  "tenant_phone",
  "tenant_contact_email",
] as const;

export type UnitsCsvColumn = (typeof UNITS_CSV_COLUMNS)[number];

export type UnitsCsvRow = Record<UnitsCsvColumn, string>;

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function unitsToCsv(rows: Partial<Record<UnitsCsvColumn, string | number | null | undefined>>[]): string {
  const header = UNITS_CSV_COLUMNS.join(",");
  const lines = rows.map((row) =>
    UNITS_CSV_COLUMNS.map((col) => escapeCsvField(row[col] ?? "")).join(",")
  );
  return [header, ...lines].join("\r\n");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseUnitsCsv(text: string): UnitsCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const required = ["building", "unit_name", "type"];
  for (const col of required) {
    if (idx(col) < 0) throw new Error(`CSV missing column: ${col}`);
  }

  const rows: UnitsCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const get = (name: UnitsCsvColumn) => {
      const j = idx(name);
      return j >= 0 ? (parts[j] ?? "").trim() : "";
    };
    const building = get("building");
    const unit_name = get("unit_name");
    const type = get("type");
    if (!building || !unit_name || !type) continue;
    const row = {} as UnitsCsvRow;
    for (const col of UNITS_CSV_COLUMNS) {
      row[col] = get(col);
    }
    rows.push(row);
  }
  return rows;
}
