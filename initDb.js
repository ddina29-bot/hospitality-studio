
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initializes the database, creates tables, and patches existing JSON data
 * to ensure new features (lists) exist, preventing frontend crashes.
 */
export function initializeDatabase() {
  let DATA_DIR;
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  } else if (fs.existsSync('/app/data')) {
    DATA_DIR = '/app/data';
  } else {
    DATA_DIR = path.join(__dirname, 'data');
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const DB_PATH = path.join(DATA_DIR, 'studio.db');
  console.log(`[DB] Initializing database at: ${DB_PATH}`);

  const db = new Database(DB_PATH);

  // Performance optimization for SQLite on persistent volumes
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // 1. Ensure the core table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      data TEXT
    )
  `);

  // 2. Data Migration: Patch JSON blobs for existing organizations
  // This ensures that new properties like 'supplyRequests' exist as empty arrays
  const rows = db.prepare('SELECT id, data FROM organizations').all();
  
  const updateStmt = db.prepare('UPDATE organizations SET data = ? WHERE id = ?');

  const requiredCollections = [
    'users',
    'shifts',
    'properties',
    'clients',
    'supplyRequests',
    'inventoryItems',
    'anomalyReports',
    'manualTasks',
    'leaveRequests',
    'invoices',
    'tutorials',
    'timeEntries'
  ];

  let patchCount = 0;

  db.transaction(() => {
    for (const row of rows) {
      let data;
      try {
        data = JSON.parse(row.data);
      } catch (e) {
        console.error(`[DB] Failed to parse data for org ${row.id}, skipping...`);
        continue;
      }

      let needsUpdate = false;

      // Ensure settings object exists
      if (!data.settings) {
        data.settings = { id: row.id, name: 'RESET STUDIO', address: '', email: '', phone: '' };
        needsUpdate = true;
      }

      // Ensure every required list is initialized
      requiredCollections.forEach(key => {
        if (!data[key] || !Array.isArray(data[key])) {
          data[key] = [];
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        updateStmt.run(JSON.stringify(data), row.id);
        patchCount++;
      }
    }
  })();

  if (patchCount > 0) {
    console.log(`[DB] Migration complete. Patched ${patchCount} organizations with missing data fields.`);
  } else {
    console.log(`[DB] Database is up to date. No patches required.`);
  }

  return db;
}

// Allow running standalone if needed
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeDatabase();
}
