const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const MONTHS = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};

const DOMAIN_LABELS = {
  COM: 'Communication',
  MET: 'Meteo',
  RESEAU: 'Reseau',
  SURV: 'Surveillance',
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePeriod(text, fallbackYear, fallbackMonth) {
  if (!text && fallbackYear && fallbackMonth) {
    return `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-01`;
  }
  const normalized = normalizeText(text);
  const parts = normalized.split(/\s+/);
  const month = parts.find((part) => MONTHS[part]);
  const year = parts.find((part) => /^20\d{2}$/.test(part));
  if (!month || !year) {
    if (fallbackYear && fallbackMonth) {
      return `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-01`;
    }
    return null;
  }
  return `${year}-${String(MONTHS[month]).padStart(2, '0')}-01`;
}

function getDomainFromFilename(filePath) {
  const base = path.basename(filePath).toUpperCase();
  const match = base.match(/(COM|MET|RESEAU|SURV)/);
  const code = match ? match[1] : 'GEN';
  return {
    code,
    label: DOMAIN_LABELS[code] || code,
  };
}

function collectFiles(pathsInput) {
  const results = [];
  const exts = new Set(['.xls', '.xlsx']);

  const walk = (entry) => {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      fs.readdirSync(entry, { withFileTypes: true }).forEach((dirent) => {
        walk(path.join(entry, dirent.name));
      });
      return;
    }
    const ext = path.extname(entry).toLowerCase();
    if (exts.has(ext)) {
      results.push(entry);
    }
  };

  pathsInput.forEach((input) => walk(path.resolve(input)));
  return results;
}

function findRowIndex(rows, predicate) {
  return rows.findIndex((row) => row.some((cell) => predicate(cell)));
}

async function upsertDomain(client, domain) {
  const res = await client.query(
    'INSERT INTO domains (code, label) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label RETURNING id',
    [domain.code, domain.label],
  );
  return res.rows[0].id;
}

async function upsertSite(client, name) {
  const res = await client.query(
    'INSERT INTO sites (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
    [name],
  );
  return res.rows[0].id;
}

async function upsertEquipment(client, domainId, name) {
  const res = await client.query(
    'INSERT INTO equipments (domain_id, name) VALUES ($1, $2) ON CONFLICT (domain_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
    [domainId, name],
  );
  return res.rows[0].id;
}

async function upsertReport(client, siteId, domainId, periodMonth, sourceFile) {
  const res = await client.query(
    'INSERT INTO monthly_reports (site_id, domain_id, period_month, source_file) VALUES ($1, $2, $3, $4) ON CONFLICT (site_id, domain_id, period_month) DO UPDATE SET source_file = EXCLUDED.source_file RETURNING id',
    [siteId, domainId, periodMonth, sourceFile],
  );
  return res.rows[0].id;
}

async function upsertStat(client, reportId, equipmentId, day, heures, pannes) {
  await client.query(
    'INSERT INTO daily_equipment_stats (report_id, equipment_id, day, heures, pannes) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (report_id, equipment_id, day) DO UPDATE SET heures = EXCLUDED.heures, pannes = EXCLUDED.pannes',
    [reportId, equipmentId, day, heures, pannes],
  );
}

async function importSheet({ client, filePath, sheetName }) {
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const domain = getDomainFromFilename(filePath);

  const siteRowIndex = findRowIndex(rows, (cell) => normalizeText(cell).startsWith('site'));
  const periodRowIndex = findRowIndex(rows, (cell) => normalizeText(cell).startsWith('periode'));

  const siteRow = siteRowIndex >= 0 ? rows[siteRowIndex] : [];
  const periodRow = periodRowIndex >= 0 ? rows[periodRowIndex] : [];

  const siteCell = siteRow.find((cell) => normalizeText(cell).startsWith('site')) || '';
  const periodCell = periodRow.find((cell) => normalizeText(cell).startsWith('periode')) || '';

  const siteName = String(siteCell).split(':')[1]?.trim() || 'Unknown';

  const fallbackYear = (path.basename(filePath).match(/20\d{2}/) || [])[0];
  const sheetMonth = MONTHS[normalizeText(sheetName)];

  const periodMonth = parsePeriod(periodCell, fallbackYear, sheetMonth);
  if (!periodMonth) {
    console.warn(`Impossible de determiner la periode pour ${filePath} / ${sheetName}`);
    return;
  }

  const headerRowIndex = findRowIndex(rows, (cell) => normalizeText(cell) === 'jour');
  if (headerRowIndex === -1) {
    console.warn(`Ligne d'entete introuvable pour ${filePath} / ${sheetName}`);
    return;
  }

  const headerRow = rows[headerRowIndex];
  const subHeaderRow = rows[headerRowIndex + 1] || [];

  const equipmentColumns = [];
  for (let col = 1; col < headerRow.length; col += 1) {
    const name = String(headerRow[col] || '').trim();
    if (name) {
      equipmentColumns.push({ name, col });
    }
  }

  if (!equipmentColumns.length) {
    console.warn(`Aucun equipement trouve pour ${filePath} / ${sheetName}`);
    return;
  }

  const domainId = await upsertDomain(client, domain);
  const siteId = await upsertSite(client, siteName);
  const reportId = await upsertReport(client, siteId, domainId, periodMonth, filePath);

  for (const equipment of equipmentColumns) {
    const heureLabel = normalizeText(subHeaderRow[equipment.col] || '');
    if (!['heure', 'panne', 'pannes'].includes(heureLabel)) {
      continue;
    }
    const equipmentId = await upsertEquipment(client, domainId, equipment.name);

    for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const day = parseInt(row[0], 10);
      if (!day || day < 1 || day > 31) {
        continue;
      }

      const heures = parseNumber(row[equipment.col]);
      const pannes = parseNumber(row[equipment.col + 1]);
      if (heures === null && pannes === null) {
        continue;
      }

      await upsertStat(client, reportId, equipmentId, day, heures, pannes);
    }
  }
}

async function run() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) {
    console.error('Usage: node scripts/import-excel.js <file-or-folder> [...paths]');
    process.exit(1);
  }

  const files = collectFiles(inputs);
  if (!files.length) {
    console.error('Aucun fichier .xls/.xlsx trouve.');
    process.exit(1);
  }

  if (!process.env.DB_PASSWORD) {
    console.error('DB_PASSWORD doit etre defini dans l environnement.');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'prediction_app',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'prediction',
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  });

  const client = await pool.connect();
  try {
    for (const filePath of files) {
      const workbook = xlsx.readFile(filePath, { cellDates: false });
      for (const sheetName of workbook.SheetNames) {
        if (normalizeText(sheetName).includes('indications')) {
          continue;
        }
        await client.query('BEGIN');
        try {
          await importSheet({ client, filePath, sheetName });
          await client.query('COMMIT');
          console.log(`Import ok: ${path.basename(filePath)} / ${sheetName}`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`Erreur import ${path.basename(filePath)} / ${sheetName}:`, error.message);
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run();
